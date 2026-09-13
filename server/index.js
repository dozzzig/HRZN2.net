'use strict';

/**
 * server/index.js — бэкенд HRZN2.net.
 *
 * Эндпоинт выдачи демо-ключа:
 *   POST /api/generate-demo  { deviceId (string), tgId (string|null) }
 *   -> { success, key, expiresAt, status }
 *
 * Логика:
 *  - клиент фиксируется в БД по device_id (анонимно, без обязательного tgId);
 *  - необязательный tgId сохраняется клиенту (привлечение в Telegram-бота);
 *  - демо-ключ одноразовый, срок действия = DEMO_TTL_MINUTES (по умолчанию 2 часа);
 *  - повторная выдача тому же device_id блокируется на сервере (одноразовость).
 *  - формат ответа:
 *      { success: true, key, expiresAt }            — ключ выдан
 *      { success: true, status: 'already-used' }    — ключ уже был выдан этому устройству
 *      { success: false, error }                    — ошибка
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const xrayService = require('./services/xrayService');
const { createStore, DEMO_TTL_MS } = require('./services/storage');

const app = express();
const PORT = process.env.PORT || 5000;

// Путь к собранному фронтенду (для production: фронт и API — один процесс)
const DIST_PATH = path.join(__dirname, '..', 'dist');

app.use(cors());
app.use(express.json());

let store;

app.get('/api/health', (req, res) => {
    res.json({ ok: true, mock: xrayService.isMock });
});

app.post('/api/generate-demo', async (req, res) => {
    try {
        const deviceId = (req.body && req.body.deviceId) ? String(req.body.deviceId).trim() : '';
        const tgId = (req.body && req.body.tgId && String(req.body.tgId).trim()) ? String(req.body.tgId).trim() : null;

        // Обязательный deviceId: это наш анонимный идентификатор устройства из localStorage
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'Отсутствует deviceId. Обновите страницу.' });
        }

        // 1. Фиксируем клиента (анонимно, без регистрации)
        const client = await store.createClient(deviceId, tgId);
        if (tgId) {
            await store.setTgId(client.id, tgId);
        }
        console.log(`[server] Клиент #${client.id} (device=${deviceId.slice(0, 8)}…, tg=${tgId || '—'}) запросил демо-ключ.`);

        // 2. Одноразовость: если у этого клиента уже был демо-ключ — повторно не выдаём
        const keyCount = await store.getKeyCount(client.id);
        if (keyCount > 0) {
            // Проверяем, нет ли ещё активного (не истёкшего) ключа — вернём его же
            const active = await store.getActiveKey(client.id);
            if (active) {
                return res.json({
                    success: true,
                    key: active.value,
                    expiresAt: new Date(active.expires_at).getTime(),
                    status: 'active',
                });
            }
            // Ключ был, но истёк/использован — не выдаём новый (одноразовость)
            return res.json({ success: true, status: 'already-used' });
        }

        // 3. Генерируем ключ в панели (сейчас — mock-заглушка)
        const key = await xrayService.createDemoClient(tgId);
        const expiresAt = Date.now() + DEMO_TTL_MS;

        // 4. Сохраняем ключ в БД
        await store.createKey(client.id, key, expiresAt);

        return res.json({
            success: true,
            key,
            expiresAt,
            status: 'active',
        });
    } catch (error) {
        console.error('[server] Ошибка выдачи демо-ключа:', error.message);
        res.status(500).json({ success: false, error: 'Не удалось сгенерировать ключ. Попробуйте позже.' });
    }
});

// Статика фронтенда (production): один процесс обслуживает и сайт, и API.
// Если dist/ не собран (dev-режим), эта часть пропускается — фронт поднимает Vite.
app.use(express.static(DIST_PATH));
app.get(/^\/(?!api\/).*/, (req, res, next) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'), (err) => {
        if (err) next();
    });
});
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ success: false, error: 'Not found' });
    } else {
        next();
    }
});

createStore()
    .then((s) => {
        store = s;
        app.listen(PORT, () => {
            console.log(`HRZN2 backend running on port ${PORT} (xray mode: ${xrayService.isMock ? 'MOCK' : 'REAL'})`);
        });
    })
    .catch((err) => {
        console.error('[server] Не удалось инициализировать хранилище:', err.message);
        process.exit(1);
    });