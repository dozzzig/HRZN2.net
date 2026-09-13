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

async function tryLogin(candidate) {
    const url = candidate ? `${candidate}/login` : '/login';
    try {
        const bodyTxt = new URLSearchParams();
        bodyTxt.append('username', username);
        bodyTxt.append('password', password);
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
    // варианты: заданный base path (если есть), пустой, и без префикса «/»
    const candidates = [];
    if (envBase) candidates.push(envBase);
    candidates.push('');
    if (envBase && envBase !== '/') candidates.push('/');
    const unique = [...new Set(candidates)];

    for (const c of unique) {
        console.log(await tryLogin(c));
    }

    console.log('\n=== ПРОВЕРКА БАЗОВЫХ СТРАНИЦ ===');
    for (const c of unique) {
        console.log(await tryGET(c));
    }

    console.log('\n=== ВЫВОД ===');
    console.log('Если ВСЕ login дают 403 — панель, скорее всего, ограничивает доступ по IP');
    console.log('  (добавь IP этого сервера в whitelist панели или настрой её иначе).');
    console.log('Если login работает с путём X, но без него 404 — поставь PANEL_BASE_PATH=X в .env.');
})().catch((e) => {
    console.error('Критическая ошибка:', e.message);
    process.exit(1);
});