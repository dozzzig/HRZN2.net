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

console.log('ПАНЕЛЬ:', panelUrl || '(пусто)');
console.log('BASE PATH (из env):', envBase || '(пусто)');
console.log('USERNAME задан:', username ? 'да' : 'НЕТ');
console.log('PASSWORD задан:', password ? 'да' : 'НЕТ');

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

    // 2. CSRF-токен свежезалогиненной сессии
    const csrfResp = await getCsrf(workingBase);
    console.log(`CSRF-токен: ${csrfResp && csrfResp.token ? 'получен' : 'НЕ ПОЛУЧЕН'}`);

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
            tgId: '',
            subId: `sub_${email}`,
            comment: 'diag',
            reset: 0,
        }
    };
    const addHeaders = { 'Content-Type': 'application/json' };
    if (csrfResp && csrfResp.token) addHeaders['X-CSRF-Token'] = csrfResp.token;
    const cookieStr = sessionCookie ? sessionCookie : '';
    if (csrfResp && csrfResp.cookie) addHeaders['Cookie'] = [cookieStr, csrfResp.cookie].filter(Boolean).join('; ');

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
            if (sc && sc.length) sessionCookie = sc[0].split(';')[0];
            return { ok: true };
        }
        return { ok: false };
    } catch (err) {
        return { ok: false };
    }
}