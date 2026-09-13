'use strict';

/**
 * xrayService.js — выдача VLESS-ключей через панель 3X-UI.
 *
 * Два режима:
 *  1. MOCK (PANEL_URL пуст) — возвращает заглушку-ключ без обращения к панели.
 *     Нужен для этапа разработки, пока нет доступа к реальной панели.
 *  2. REAL (PANEL_URL задан) — работает как бот HRZN2 (см. services/xui.py у бота):
 *     аутентификация (cookie или Bearer token), создание клиента через
 *     /panel/api/clients/add, кэширование параметров Reality из панели,
 *     верификация UUID.
 *
 * Особенности для сайта:
 *  - все демо-клиенты создаются строго в INBOUND_ID (у пользователя это «Demo_WEB», id=4);
 *  - email клиента вида web_<deviceId-префикс>_<timestamp> — видно, какой это визит;
 *  - PANEL_BASE_PATH (webBasePath панели) определяется автоматически:
 *      пробуем заданный из env префикс, затем пустой (как у бота);
 *      используем тот, через который панель отвечает;
 *  - cleanupExpiredDemos() удаляет только просроченные web_* клиенты (бот/платных не трогает).
 */

const axios = require('axios');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const DEMO_TTL_MS = (parseInt(process.env.DEMO_TTL_MINUTES || '120', 10) || 120) * 60 * 1000;

class XrayService {
    constructor() {
        this.panelUrl = (process.env.PANEL_URL || '').trim().replace(/\/$/, '');
        this.isMock = !this.panelUrl;
        this.inboundId = parseInt(process.env.INBOUND_ID || '4', 10);
        this.apiToken = (process.env.PANEL_API_TOKEN || '').trim();
        this.sessionCookie = null;

        // webBasePath панели: null = ещё не определён (автодетект при первом подключении)
        const envBase = (process.env.PANEL_BASE_PATH || '').trim().replace(/\/$/, '');
        this.basePath = envBase === '' ? null : envBase;

        // Кэш параметров Reality инбаунда (заполняется из панели)
        this.cache = {
            port: 443,
            pbk: '',
            sid: '',
            sni: '',
            fp: 'chrome',
            spx: '/',
        };

        this.client = axios.create({
            baseURL: this.panelUrl || undefined,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        // Автоподстановка cookie к запросам
        this.client.interceptors.request.use((config) => {
            if (this.sessionCookie) config.headers['Cookie'] = this.sessionCookie;
            return config;
        });

        this._refreshTask = null;
    }

    get serverHost() {
        // Хост/IP VPN-сервера в ссылке. Приоритет: явная настройка → hostname панели.
        if (process.env.VPN_SERVER_HOST) return process.env.VPN_SERVER_HOST.trim();
        try {
            return new URL(this.panelUrl).hostname;
        } catch {
            return '127.0.0.1';
        }
    }

    // -----------------------------------------------------------------------
    // Публичный API
    // -----------------------------------------------------------------------
    async createDemoClient(tgId = null, deviceId = null) {
        if (this.isMock) {
            return this._createMockKey(tgId);
        }
        return this._createRealKey(tgId, deviceId);
    }

    /**
     * Очищает просроченные демо-клиенты (web_*) в нашем inbound.
     * Возвращает число удалённых. Не трогает user_* (бот) и платных.
     */
    async cleanupExpiredDemos() {
        if (this.isMock) return 0;

        const clients = await this._listClients();
        const now = Date.now();
        let removed = 0;

        for (const client of clients) {
            const email = client.email || '';
            if (!email.startsWith('web_')) continue;

            // Если панель отдаёт inboundId клиента — сверяем с нашим
            if (client.inboundId && Number(client.inboundId) !== this.inboundId) continue;

            const expiry = client.expiryTime || 0;
            if (!expiry || expiry > now) continue;

            const uuid = client.uuid || client.id;
            if (!uuid) continue;

            try {
                await this._request('POST', `/panel/api/inbounds/${this.inboundId}/delClient/${uuid}`);
                removed++;
                console.log(`[xray:cleanup] Удалён просроченный демо-клиент ${email}`);
            } catch (err) {
                console.warn(`[xray:cleanup] Не удалось удалить ${email}: ${err.message}`);
            }
        }

        if (removed > 0) console.log(`[xray:cleanup] Удалено демо-клиентов: ${removed}`);
        return removed;
    }

    // -----------------------------------------------------------------------
    // MOCK-режим (заглушка)
    // -----------------------------------------------------------------------
    _createMockKey(tgId) {
        // TODO: база vendor для «нет панели» — возвращает синтетический ключ.
        const clientId = uuidv4();
        const pbk = 'MISSING_PBK_MOCK_vless_key_not_connected';
        const remark = 'HRZN2-MOCK';
        const link = `vless://${clientId}@${this.serverHost}:7443?type=tcp&security=reality&pbk=${pbk}&fp=chrome&sni=localhost&sid=c8&spx=%2F#${remark}`;
        console.log(`[xray:MOCK] Демо-ключ для tgId=${tgId || 'anon'} (реальная панель не настроена).`);
        return link;
    }

    // -----------------------------------------------------------------------
    // REAL-режим
    // -----------------------------------------------------------------------

    /** Добавляет webBasePath к пути, если он определён. */
    _path(path) {
        return this.basePath ? `${this.basePath}${path}` : path;
    }

    /** Аутентификация по конкретному префиксу. Возвращает true/false, бросает при сетевой ошибке. */
    async _rawLogin(basePath) {
        if (this.apiToken) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiToken}`;
            return true;
        }

        const params = new URLSearchParams();
        params.append('username', (process.env.PANEL_USERNAME || '').trim());
        params.append('password', (process.env.PANEL_PASSWORD || '').trim());

        const url = basePath ? `${basePath}/login` : '/login';
        const resp = await this.client.post(url, params);

        if (resp.data && resp.data.success) {
            const setCookie = resp.headers['set-cookie'];
            if (setCookie && setCookie.length > 0) {
                this.sessionCookie = setCookie[0].split(';')[0];
            }
            return true;
        }
        return false;
    }

    /**
     * Автодетект webBasePath: пробуем заданный из env префикс (если он был),
     * затем пустой путь (как у бота). Сохраняет рабочий вариант.
     */
    async _ensureBasePath() {
        if (this.basePath !== null) return true;

        const envBase = (process.env.PANEL_BASE_PATH || '').trim().replace(/\/$/, '');
        const candidates = [...new Set([envBase, ''].filter(Boolean))];
        // если с env ничего не задано — всё равно проверяем и базовый путь
        if (candidates.length === 0) candidates.push('');

        let lastErr = null;
        for (const candidate of candidates) {
            try {
                const ok = await this._rawLogin(candidate);
                if (ok) {
                    this.basePath = candidate;
                    console.log(`[xray] webBasePath определён: ${candidate || '(без префикса)'}`);
                    return true;
                }
            } catch (err) {
                lastErr = err;
            }
        }
        throw new Error(`Не удалось авторизоваться в 3x-ui (basePath=${JSON.stringify(candidates)}): ${lastErr ? lastErr.message : 'нет ответа'}`);
    }

    async _login() {
        await this._ensureBasePath();
        if (this.apiToken) return true;
        const ok = await this._rawLogin(this.basePath);
        if (!ok) throw new Error('3x-ui login failed');
    }

    /**
     * HTTP-запрос с повторной авторизацией при 401/403.
     * body = URLSearchParams | объект | undefined.
     */
    async _request(method, path, body, { retry = true } = {}) {
        if (this.isMock) {
            // имитируем ответ панели в mock-режиме
            return { success: true, obj: {} };
        }

        const url = this._path(path);
        const isLogin = path.endsWith('/login');

        try {
            const response = await this.client.request({
                method,
                url,
                data: body,
                headers: body instanceof URLSearchParams
                    ? { 'Content-Type': 'application/x-www-form-urlencoded' }
                    : body !== undefined
                        ? { 'Content-Type': 'application/json' }
                        : undefined,
            });

            const type = response.headers['content-type'] || '';
            if (type.includes('text/html') && !isLogin) {
                throw new Error('Expected JSON but got HTML (session likely expired)');
            }
            return response.data;
        } catch (err) {
            const status = err.response ? err.response.status : 0;
            const isAuthProblem = status === 401 || status === 403 || (err.message && err.message.includes('HTML'));
            if (retry && !isLogin && !this.apiToken && isAuthProblem && !this.isMock) {
                console.warn(`[xray] Сессия истекла (${status}), повторная авторизация…`);
                await this._login();
                return this._request(method, path, body, { retry: false });
            }
            if (err.response) {
                const e = new Error(`HTTP ${status} на ${url}: ${JSON.stringify(err.response.data || {}).slice(0, 200)}`);
                throw e;
            }
            throw err;
        }
    }

    async _refreshInboundCache() {
        const data = await this._request('GET', `/panel/api/inbounds/get/${this.inboundId}`);
        if (!data || !data.success) {
            throw new Error('Failed to load inbound settings');
        }
        const obj = data.obj || {};
        this.cache.port = obj.port || 443;

        let streamSettings = obj.streamSettings || {};
        if (typeof streamSettings === 'string') {
            try { streamSettings = JSON.parse(streamSettings); } catch { streamSettings = {}; }
        }

        const reality = streamSettings.realitySettings || {};
        const inner = reality.settings || {};
        const shortIds = reality.shortIds || [];
        const serverNames = reality.serverNames || [];

        this.cache.pbk = inner.publicKey || this.cache.pbk;
        this.cache.sid = shortIds[0] || this.cache.sid;
        this.cache.sni = serverNames[0] || this.cache.sni;
        this.cache.fp = inner.fingerprint || this.cache.fp;
        this.cache.spx = inner.spiderX || this.cache.spx || '/';
        console.log(`[xray] Inbound #${this.inboundId} cached: port=${this.cache.port}, sni=${this.cache.sni}`);
    }

    async _getClientByEmail(email) {
        const data = await this._request('GET', '/panel/api/clients/list');
        if (!data || !data.success) return null;
        for (const client of data.obj || []) {
            if (client.email === email) return client;
        }
        return null;
    }

    async _listClients() {
        const data = await this._request('GET', '/panel/api/clients/list');
        if (!data || !data.success) return [];
        return data.obj || [];
    }

    /** Создаёт демо-клиента в нашем inbound. Возвращает vless-ссылку. */
    async _createRealKey(tgId, deviceId) {
        await this._login();
        await this._refreshInboundCache();

        const clientUuid = uuidv4();
        const devicePrefix = (deviceId || 'anon').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'anon';
        const email = tgId
            ? `web_${devicePrefix}_${tgId.replace(/[^a-zA-Z0-9_@]/g, '').slice(0, 24)}`
            : `web_${devicePrefix}_${Date.now()}`;
        const expiryMs = Date.now() + DEMO_TTL_MS;
        let link;

        try {
            const payload = {
                inboundIds: [this.inboundId],
                client: {
                    id: clientUuid,
                    flow: '',
                    email,
                    limitIp: 0,
                    totalGB: 0,
                    expiryTime: expiryMs,
                    enable: true,
                    tgId: tgId || '',
                    subId: `sub_${email}`,
                    comment: 'Web Demo 2h',
                    reset: 0,
                },
            };

            const data = await this._request('POST', '/panel/api/clients/add', payload);
            if (!data || !data.success) {
                throw new Error(`Panel returned success=false: ${JSON.stringify(data).slice(0, 200)}`);
            }

            // Верифицируем UUID (панель может назначить свой)
            let finalUuid = clientUuid;
            try {
                const actual = await this._getClientByEmail(email);
                if (actual) {
                    const stored = actual.uuid || actual.id;
                    if (stored && stored !== clientUuid) finalUuid = stored;
                }
            } catch (err) {
                console.warn('[xray] UUID verification skipped:', err.message);
            }

            link = this._buildLink(finalUuid);
            console.log(`[xray] Создан демо-клиент ${email} (inbound #${this.inboundId}), expiry ${DEMO_TTL_MS / 60000} мин.`);
        } catch (err) {
            // Если add не сработал (напр., уже есть клиент с таким email) — отдаём существующий
            const existing = await this._getClientByEmail(email);
            if (existing) {
                const stored = existing.uuid || existing.id;
                link = this._buildLink(stored);
                console.log(`[xray] Вернули существующего клиента ${email}.`);
            } else {
                throw err;
            }
        }

        return link;
    }

    _buildLink(clientId) {
        const paramsDict = {
            encryption: 'none',
            fp: this.cache.fp,
            pbk: this.cache.pbk,
            security: 'reality',
            sid: this.cache.sid,
            sni: this.cache.sni,
            spx: encodeURIComponent(this.cache.spx),
            type: 'tcp',
        };
        const paramsStr = Object.keys(paramsDict)
            .sort()
            .map((k) => `${k}=${paramsDict[k]}`)
            .join('&');
        const host = this.serverHost;
        const remark = `HRZN2-${host}_${this.cache.port}`;
        return `vless://${clientId}@${host}:${this.cache.port}?${paramsStr}#${remark}`;
    }
}

module.exports = new XrayService();
module.exports.XrayService = XrayService;
module.exports.DEMO_TTL_MS = DEMO_TTL_MS;