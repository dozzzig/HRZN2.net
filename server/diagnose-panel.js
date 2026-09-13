'use strict';

/**
 * diagnose-panel.js — диагностика подключения к панели 3x-ui.
 *
 * Читает настройки из server/.env (dotenv), пробует логиниться по нескольким
 * вариантам пути и печатает ЧТО отвечает панель: HTTP-статус и обрывок тела.
 * Пароли НЕ печатаются.
 *
 * Запуск (на VPS, из папки server):
 *   node diagnose-panel.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const https = require('https');

const panelUrl = (process.env.PANEL_URL || '').trim().replace(/\/$/, '');
const envBase = (process.env.PANEL_BASE_PATH || '').trim().replace(/\/$/, '');
const inboundId = parseInt(process.env.INBOUND_ID || '4', 10);
const username = (process.env.PANEL_USERNAME || '').trim();
const password = (process.env.PANEL_PASSWORD || '').trim();
const apiToken = (process.env.PANEL_API_TOKEN || '').trim();

function maskToken(t) {
    if (!t) return '';
    if (t.length <= 10) return `${t.slice(0, 2)}… (короткий, ${t.length} симв.)`;
    return `${t.slice(0, 4)}…${t.slice(-4)} (${t.length} симв.)`;
}

console.log('ПАНЕЛЬ:', panelUrl || '(пусто)');
console.log('BASE PATH (из env):', envBase || '(пусто)');
console.log('USERNAME задан:', username ? 'да' : 'НЕТ');
console.log('PASSWORD задан:', password ? 'да' : 'НЕТ');
console.log('API-ТОКЕН:', apiToken ? maskToken(apiToken) : 'НЕТ');

if (!panelUrl) {
    console.log('\nPANEL_URL пуст — код работает в MOCK-режиме. Диагностика не нужна.');
    process.exit(0);
}

const client = axios.create({
    baseURL: panelUrl,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
    },
    timeout: 10000,
});

async function getCsrf(basePath) {
    const url = basePath ? `${basePath}/csrf-token` : '/csrf-token';
    try {
        const resp = await client.get(url, { timeout: 8000 });
        const token = resp.data && resp.data.obj ? String(resp.data.obj) : '';
        const cookie = (resp.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        if (token) return { token, cookie };
    } catch (e) { /* fallback ниже */ }
    try {
        const pageUrl = basePath || '/';
        const resp = await client.get(pageUrl, { timeout: 8000 });
        const html = typeof resp.data === 'string' ? resp.data : '';
        const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)/i);
        const cookie = (resp.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        if (m && m[1]) return { token: m[1], cookie };
    } catch (e) { /* нет CSRF */ }
    return { token: '', cookie: '' };
}

async function tryLoginWithCsrf(candidate) {
    const url = candidate ? `${candidate}/login` : '/login';
    const bodyTxt = new URLSearchParams();
    bodyTxt.append('username', username);
    bodyTxt.append('password', password);

    // Без CSRF
    try {
        const resp = await client.post(url, bodyTxt);
        const snippet = JSON.stringify(resp.data || {}).slice(0, 160);
        return `[POST ${url} (без CSRF)] -> ${resp.status} (success=${resp.data ? resp.data.success : '?'}) тело: ${snippet}`;
    } catch (err) {
        const st = err.response ? err.response.status : 'сеть';
        const body = err.response ? JSON.stringify(err.response.data || {}).slice(0, 160) : (err.code || err.message);
        // Пробуем с CSRF
        let csrf = '';
        try { csrf = await getCsrf(candidate); } catch (e) { csrf = { token: '', cookie: '' }; }
        const headers = {};
        if (csrf.token) headers['X-CSRF-Token'] = csrf.token;
        if (csrf.cookie) headers['Cookie'] = csrf.cookie;
        try {
            const resp2 = await client.post(url, bodyTxt, { headers });
            const snippet = JSON.stringify(resp2.data || {}).slice(0, 160);
            return `[POST ${url}] без CSRF -> ${st}; С CSRF -> ${resp2.status} (success=${resp2.data ? resp2.data.success : '?'}) тело: ${snippet}`;
        } catch (err2) {
            const st2 = err2.response ? err2.response.status : 'сеть';
            const body2 = err2.response ? JSON.stringify(err2.response.data || {}).slice(0, 160) : (err2.code || err2.message);
            return `[POST ${url}] без CSRF -> ${st} (${body}); С CSRF -> ${st2} (${body2})`;
        }
    }
}

async function tryLoginWithoutCsrf(candidate) {
    const url = candidate ? `${candidate}/login` : '/login';
    const bodyTxt = new URLSearchParams();
    bodyTxt.append('username', username);
    bodyTxt.append('password', password);
    try {
        const resp = await client.post(url, bodyTxt);
        const snippet = JSON.stringify(resp.data || {}).slice(0, 160);
        return `[POST ${url}] -> ${resp.status} (success=${resp.data ? resp.data.success : '?'}) тело: ${snippet}`;
    } catch (err) {
        if (err.response) {
            const snippet = JSON.stringify(err.response.data || {}).slice(0, 160);
            return `[POST ${url}] -> HTTP ${err.response.status} тело: ${snippet}`;
        }
        return `[POST ${url}] -> СЕТЕВАЯ ОШИБКА: ${err.code || err.message}`;
    }
}

async function tryGET(candidate) {
    const url = candidate || '/';
    try {
        const resp = await client.get(url);
        return `[GET  ${url}] -> ${resp.status} (type: ${resp.headers['content-type'] || '?'})`;
    } catch (err) {
        if (err.response) return `[GET  ${url}] -> HTTP ${err.response.status}`;
        return `[GET  ${url}] -> СЕТЕВАЯ ОШИБКА: ${err.code || err.message}`;
    }
}

(async () => {
    console.log('\n=== РЕЖИМ API-ТОКЕНА (Bearer) ===');
    if (apiToken) {
        console.log('PANEL_API_TOKEN задан — тестируем обход CSRF через Bearer.');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
            'X-Requested-With': 'XMLHttpRequest',
        };
        const uuid = (require('crypto').randomUUID)();
        const email = `diag_${String(Date.now()).slice(-6)}`;
        // Сначала проверим GET — 401/404 на GET тоже валидная инфа
        const getUrl = envBase ? `${envBase}/panel/api/inbounds/list` : '/panel/api/inbounds/list';
        try {
            const g = await client.get(getUrl, { headers: { Authorization: `Bearer ${apiToken}`, 'X-Requested-With': 'XMLHttpRequest' } });
            console.log(`[Bearer GET inbounds/list] -> ${g.status} (success=${g.data ? g.data.success : '?'})`);
            if (g.data && g.data.success) {
                console.log('✅ Токен работает на GET!');
                console.log('\n=== СПИСОК ИН-БАУНДОВ ПАНЕЛИ ===');
                const list = g.data.obj || [];
                for (const ib of list) {
                    let ss = ib.streamSettings || {};
                    if (typeof ss === 'string') { try { ss = JSON.parse(ss); } catch { ss = {}; } }
                    const realm = ss.realitySettings || {};
                    const inner = realm.settings || {};
                    const row = [
                        `id=${ib.id}`,
                        `rem=${ib.remark}`,
                        `port=${ib.port}`,
                        `proto=${ib.protocol}`,
                        `enable=${ib.enable}`,
                        `flow=${ib.flow || ''}`,
                        `network=${ss.network || ''}`,
                        `sni=${(realm.serverNames || [])[0] || ''}`,
                        `sid=[${(realm.shortIds || []).join(',')}]`,
                        `pbk=${inner.publicKey ? String(inner.publicKey).slice(0, 12) + '…' : ''}`,
                    ];
                    console.log('  ' + row.join(' | '));
                    // Подробно для двух интересующих инбаундов
                    if (String(ib.id) === '4' || String(ib.id) === '3' || String(ib.id) === '5') {
                        console.log('    --- streamSettings (полный) ---');
                        console.log('    ' + JSON.stringify(ss).slice(0, 900));
                    }
                }
            }
        } catch (gErr) {
            const gs = gErr.response ? gErr.response.status : 'сеть';
            console.log(`[Bearer GET inbounds/list] -> ${gs}`);
        }
        const payload = {
            inboundIds: [inboundId],
            client: {
                id: uuid,
                flow: '',
                email,
                limitIp: 0,
                totalGB: 0,
                expiryTime: Date.now() + 2 * 3600 * 1000,
                enable: true,
                tgId: 0,
                subId: `sub_${email}`,
                comment: 'diag',
                reset: 0,
            }
        };
        {
            // Тоже для session-режима ниже (если используется)
            /* noop */
        }
        try {
            const resp = await client.post(
                envBase ? `${envBase}/panel/api/clients/add` : '/panel/api/clients/add',
                payload,
                { headers }
            );
            const snippet = JSON.stringify(resp.data || {}).slice(0, 200);
            console.log(`[Bearer POST clients/add] -> ${resp.status} (success=${resp.data ? resp.data.success : '?'}) тело: ${snippet}`);
            if (resp.data && resp.data.success) console.log('✅ Bearer-токен работает — панель принимает клиентов!');
        } catch (err) {
            const st = err.response ? err.response.status : 'сеть';
            const body = err.response ? JSON.stringify(err.response.data || {}).slice(0, 200) : (err.code || err.message);
            console.log(`[Bearer POST clients/add] -> ${st} тело: ${body}`);
            if (st === 401) {
                console.log('401 = панель НЕ принимает токен. Причины:');
                console.log('  1) токен скопирован с ошибкой (лишний пробел/символ/обрезан) — пересоздай и вставь заново;');
                console.log('  2) токен отозван/истёк в панели;');
                console.log('  3) в панели не включён доступ по API-токену (Settings → Security).');
                console.log('  Проверь: вставленный токен ДОЛЖЕН быть ДЛИННЕЕ ~40 символов (см. «API-ТОКЕН» в шапке).');
            } else {
                console.log('Если здесь 403/другое — токен неверный/неактивный. Создай новый в панели: Settings → Security → API Tokens.');
            }
        }
        console.log('\nВывод: установи PANEL_API_TOKEN в server/.env и перезапусти сервис.');
        process.exit(0);
    }
    console.log('PANEL_API_TOKEN не задан. Создай API-токен в панели 3x-ui (Settings → Security → API Tokens)\nи пропиши его в server/.env → PANEL_API_TOKEN=...  Это обходит CSRF.');

    console.log('\n=== ПРОБУЕМ ВАРИАНТЫ ПУТИ ===');
    const candidates = [];
    if (envBase) candidates.push(envBase);
    candidates.push('');
    if (envBase && envBase !== '/') candidates.push('/');
    const unique = [...new Set(candidates)];

    // 1. Определяем рабочий base path
    let workingBase = null;
    for (const c of unique) {
        const res = await probeLogin(c);
        if (res.ok) { workingBase = c; break; }
    }
    if (workingBase === null) {
        console.log('\n❌ НЕ УДАЛОСЬ ЗАЛОГИНИТЬСЯ ни по одному пути.');
        console.log('Панель отклоняет логин. Возможные причины: неверный пароль, IP-доступ ограничен.');
        process.exit(1);
    }
    console.log(`\n✅ Рабочий путь: ${workingBase || '(без префикса)'}`);

    // 2. CSRF-токен свежезалогиненной сессии — из АВТОРИЗОВАННОГО ответа панели.
    console.log('\n=== ПЕРЕХВАТ CSRF ИЗ АВТОРИЗОВАННОГО ОТВЕТА ===');
    // GET к панели со session cookie (иначе токен будет анонимным и панель режнет 403)
    const csrfFromAuth = await getCsrfFromAuthenticatedGet(workingBase);
    console.log(
        csrfFromAuth && csrfFromAuth.token
            ? `CSRF-токен сессии: получен (ист. ${csrfFromAuth.source})`
            : `CSRF-токен сессии: НЕ ПОЛУЧЕН`
    );
    const csrfResp = csrfFromAuth || { token: '', cookie: '' };

    // 3. ПРОВЕРКА create-клиента — самый важный шаг (у нас на нём 403)
    console.log('\n=== ПРОБУЕМ СОЗДАТЬ ТЕСТОВОГО КЛИЕНТА (clients/add) ===');
    const uuid = (require('crypto').randomUUID)();
    const email = `diag_${String(Date.now()).slice(-6)}`;
    const payload = {
        inboundIds: [inboundId],
        client: {
            id: uuid,
            flow: '',
            email,
            limitIp: 0,
            totalGB: 0,
            expiryTime: Date.now() + 2 * 3600 * 1000,
            enable: true,
            tgId: 0,
            subId: `sub_${email}`,
            comment: 'diag',
            reset: 0,
        }
    };
    const addHeaders = { 'Content-Type': 'application/json' };
    if (csrfResp && csrfResp.token) addHeaders['X-CSRF-Token'] = csrfResp.token;
    const cookieStr = (sessionCookie || '') + (csrfResp && csrfResp.cookie ? '; ' + csrfResp.cookie : '');
    if (cookieStr) addHeaders['Cookie'] = cookieStr;

    try {
        const resp = await client.post(
            workingBase ? `${workingBase}/panel/api/clients/add` : '/panel/api/clients/add',
            payload,
            { headers: addHeaders }
        );
        const snippet = JSON.stringify(resp.data || {}).slice(0, 200);
        console.log(`[POST clients/add] -> ${resp.status} (success=${resp.data ? resp.data.success : '?'}) тело: ${snippet}`);
        if (resp.data && resp.data.success) {
            console.log('✅ КЛИЕНТ СОЗДАН! Панель готова принимать. Теперь удаляем diag-клиента.');
            // 4. Чистим за собой
            try {
                await client.delete(
                    workingBase ? `${workingBase}/panel/api/inbounds/${inboundId}/delClient/${uuid}` : `/panel/api/inbounds/${inboundId}/delClient/${uuid}`,
                    { headers: { 'X-CSRF-Token': csrfResp.token, Cookie: addHeaders['Cookie'] } }
                );
                console.log('Тест-клиент удалён. Полный цикл работает!');
            } catch (delErr) {
                console.log('(не критично) Не удалось самоочиститься:', delErr.response ? delErr.response.status : delErr.message);
            }
        }
    } catch (err) {
        const st = err.response ? err.response.status : 'сеть';
        const body = err.response ? JSON.stringify(err.response.data || {}).slice(0, 200) : (err.code || err.message);
        console.log(`[POST clients/add] -> ${st} тело: ${body}`);
        console.log('\nЕсли здесь 403 — дело в CSRF-токене на create. Если 404 — неверный путь вокруг /panel/api/');
    }

    console.log('\n=== ВЫВОД ===');
    console.log('Если создание клиента прошло (success=true) — панель работает, смотри лог сайта.');
    console.log('Если 403 — панель требует больше (IP-whitelist, другой метод auth).');
    console.log('Если 404 — неверный путь /base path.');
})().catch((e) => {
    console.error('Критическая ошибка:', e.message);
    process.exit(1);
});

// --- helper: логин + возврат рабочего пути ---
let sessionCookie = '';
let sessionCookies = [];
async function probeLogin(candidate) {
    const csrf = await getCsrf(candidate).catch(() => ({ token: '', cookie: '' }));
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (csrf.token) headers['X-CSRF-Token'] = csrf.token;
    if (csrf.cookie) headers['Cookie'] = csrf.cookie;
    try {
        const resp = await client.post(candidate ? `${candidate}/login` : '/login', body, { headers });
        if (resp.status === 200 && resp.data && resp.data.success) {
            const sc = resp.headers['set-cookie'];
            if (sc && sc.length) {
                sessionCookie = sc[0].split(';')[0];
                sessionCookies = sc.map((c) => c.split(';')[0]);
            }
            return { ok: true };
        }
        return { ok: false };
    } catch (err) {
        return { ok: false };
    }
}

/** Авторизованный GET к панели, из ответа снимаем CSRF (header X-CSRF-Token или cookie x-ui-csrf). */
async function getCsrfFromAuthenticatedGet(base) {
    // Составляем полный cookie: все session-cookie после логина
    const cookieHeader = [
        ...(sessionCookies || []),
    ].filter(Boolean).join('; ');
    const url = base ? `${base}/panel/api/inbounds/get/${inboundId}` : `/panel/api/inbounds/get/${inboundId}`;
    try {
        const resp = await client.get(url, { headers: { Cookie: cookieHeader } });
        const headerToken = resp.headers['x-csrf-token'] ? String(resp.headers['x-csrf-token']).trim() : '';
        const setCookies = resp.headers['set-cookie'] || [];
        const csrfC = setCookies.map((c) => c.split(';')[0]).find((c) => c.toLowerCase().startsWith('x-ui-csrf='));
        const csrfFromCookie = csrfC ? csrfC.split('=').slice(1).join('=') : '';
        const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
        const token = headerToken || csrfFromCookie;
        if (token) return { token, cookie, source: headerToken ? 'header X-CSRF-Token' : 'cookie x-ui-csrf' };
    } catch (err) {
        return { token: '', cookie: '', source: `ОШИБКА ${err.response ? err.response.status : err.message}` };
    }
    return { token: '', cookie: '' };
}