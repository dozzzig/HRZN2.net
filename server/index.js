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
const axios = require('axios');
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

// B1: fire-and-forget запись события лида (сбой логирования не ломает выдачу ключа)
async function logLead(deviceId, tgId, event, req, utm) {
    try {
        await store.logLeadEvent(deviceId, tgId, event, req.headers.referer, utm, req.headers['user-agent']);
    } catch (err) {
        console.warn('[leads] Не удалось записать событие:', err.message);
    }
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true, mock: xrayService.isMock });
});

app.post('/api/generate-demo', async (req, res) => {
    try {
        const deviceId = (req.body && req.body.deviceId) ? String(req.body.deviceId).trim() : '';
        const tgId = (req.body && req.body.tgId && String(req.body.tgId).trim()) ? String(req.body.tgId).trim() : null;
        const utm = (req.body && req.body.utm) ? String(req.body.utm).slice(0, 200) : null;

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
            // B1: повторный визит — тоже лид-событие (видно в /funnel и в группе)
            logLead(deviceId, tgId, 'demo_repeat', req, utm);

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

        // 3. Генерируем ключ в панели (если PANEL_URL не задан — mock-заглушка)
        const key = await xrayService.createDemoClient(tgId, deviceId);
        const expiresAt = Date.now() + DEMO_TTL_MS;

        // 4. Сохраняем ключ в БД
        await store.createKey(client.id, key, expiresAt);

        // B1: новый лид — событие в outbox, бот уведомит админов
        logLead(deviceId, tgId, 'demo_issued', req, utm);

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
        return;
    }
    res.sendFile(path.join(DIST_PATH, 'index.html'), (err) => {
        if (err) res.status(404).end();
    });
});

createStore()
    .then((s) => {
        store = s;
        app.listen(PORT, () => {
            console.log(`HRZN2 backend running on port ${PORT} (xray mode: ${xrayService.isMock ? 'MOCK' : 'REAL'})`);
        });

        // Периодическая очистка просроченных демо-клиентов в панели.
        // Запускается только в REAL-режиме (при настройке панели).
        const CLEANUP_MIN = parseInt(process.env.DEMO_CLEANUP_INTERVAL_MIN || '15', 10) || 15;
        setInterval(async () => {
            try {
                await xrayService.cleanupExpiredDemos();
            } catch (err) {
                console.warn('[cleanup] Ошибка очистки демо-клиентов:', err.message);
            }
        }, CLEANUP_MIN * 60 * 1000);
        console.log(`[cleanup] Очистка демо-клиентов: каждые ${CLEANUP_MIN} мин`);

        // v2.2.2: сторож бота — сайт следит за heartbeat бота в общей БД.
        // Если бот не обновлял heartbeat дольше BOT_STALE_SEC — алерт.
        // Доставка алерта: ALARM_BOT_TOKEN + ALARM_CHAT_ID (отдельный «сигнальный»
        // бот, чтобы не зависеть от основного) или просто console.error.
        const BOT_STALE_SEC = parseInt(process.env.BOT_STALE_SEC || '900', 10) || 900;
        const WATCH_INTERVAL_MS = (parseInt(process.env.WATCH_INTERVAL_MIN || '5', 10) || 5) * 60 * 1000;
        let botWasHealthy = true;

        async function sendAlarm(text) {
            const token = process.env.ALARM_BOT_TOKEN;
            const chatId = process.env.ALARM_CHAT_ID;
            if (!token || !chatId) {
                console.error('[alarm]', text.replace(/<[^>]+>/g, ''));
                return;
            }
            try {
                await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML',
                });
            } catch (e) {
                console.error('[alarm] Не удалось отправить алерт:', e.message);
            }
        }

        setInterval(async () => {
            try {
                const age = await store.getBotHeartbeatAgeSec();
                if (age === null) return; // таблица ещё не создана / dev-режим
                const healthy = age <= BOT_STALE_SEC;
                if (botWasHealthy && !healthy) {
                    await sendAlarm(
                        `🔴 <b>СБОЙ: Telegram-бот не отвечает</b>\n` +
                        `heartbeat устарел на ${Math.round(age / 60)} мин (порог ${Math.round(BOT_STALE_SEC / 60)} мин).\n` +
                        `Проверьте на VPS: <code>systemctl status hrzn2</code>`
                    );
                } else if (!botWasHealthy && healthy) {
                    await sendAlarm('🟢 <b>Восстановлено: Telegram-бот снова на связи</b>');
                }
                botWasHealthy = healthy;
            } catch (err) {
                console.warn('[watch] Ошибка проверки heartbeat бота:', err.message);
            }
        }, WATCH_INTERVAL_MS);
        console.log(`[watch] Контроль heartbeat бота: каждые ${WATCH_INTERVAL_MS / 60000} мин, порог ${BOT_STALE_SEC}с`);
    })
    .catch((err) => {
        console.error('[server] Не удалось инициализировать хранилище:', err.message);
        process.exit(1);
    });