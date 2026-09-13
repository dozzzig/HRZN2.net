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

    async createDemoClient(tgId = null) {
        if (this.isMock) {
            return this._createMockKey(tgId);
        }
        return this._createRealKey(tgId);
    }

    // -----------------------------------------------------------------------
    // MOCK-режим (заглушка; TBD: подключить реальную панель)
    // -----------------------------------------------------------------------
    _createMockKey(tgId) {
        // TODO: заменить на реальную выдачу ключа через панель,
        // как только пользователь даст доступ к 3x-ui (PANEL_URL и креды).
        const clientId = uuidv4();
        const email = `demo_${Date.now()}`;
        const pbk = 'MISSING_PBK_MOCK_vless_key_not_connected';
        const remark = 'HRZN2-MOCK';
        const link = `vless://${clientId}@${this.serverHost}:7443?type=tcp&security=reality&pbk=${pbk}&fp=chrome&sni=localhost&sid=c8&spx=%2F#${remark}`;
        console.log(`[xray:MOCK] Демо-ключ для tgId=${tgId || 'anon'} (TDB: подключить панель).`);
        return link;
    }

    // -----------------------------------------------------------------------
    // REAL-режим (как бот — services/xui.py)
    // -----------------------------------------------------------------------
    async _login() {
        if (this.apiToken) {
            console.log('[xray] Используется Bearer API token.');
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiToken}`;
            return true;
        }

        const params = new URLSearchParams();
        params.append('username', (process.env.PANEL_USERNAME || '').trim());
        params.append('password', (process.env.PANEL_PASSWORD || '').trim());

        const resp = await this.client.post('/login', params);
        if (resp.data && resp.data.success) {
            const setCookie = resp.headers['set-cookie'];
            if (setCookie && setCookie.length > 0) {
                this.sessionCookie = setCookie[0].split(';')[0];
            }
            console.log('[xray] 3x-ui login successful.');
            return true;
        }
        throw new Error(`3x-ui login failed: ${JSON.stringify(resp.data)}`);
    }

    async _refreshInboundCache() {
        const resp = await this.client.get(`/panel/api/inbounds/get/${this.inboundId}`);
        if (!resp.data || !resp.data.success) {
            throw new Error('Failed to load inbound settings');
        }
        const obj = resp.data.obj || {};
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
        console.log(`[xray] Inbound cached: port=${this.cache.port}, sni=${this.cache.sni}`);
    }

    async _getClientByEmail(email) {
        const resp = await this.client.get('/panel/api/clients/list');
        if (!resp.data || !resp.data.success) return null;
        for (const client of resp.data.obj || []) {
            if (client.email === email) return client;
        }
        return null;
    }

    async _createRealKey(tgId) {
        await this._login();

        const clientUuid = uuidv4();
        const email = tgId ? `web_${tgId}` : `web_${Date.now()}`;
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

            const resp = await this.client.post('/panel/api/clients/add', payload);
            if (!resp.data || !resp.data.success) {
                throw new Error(`Panel returned success=false: ${JSON.stringify(resp.data)}`);
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
            console.log(`[xray] Создан демо-клиент ${email}, expiry ${DEMO_TTL_MS / 60000} мин.`);
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
module.exports.DEMO_TTL_MS = DEMO_TTL_MS;