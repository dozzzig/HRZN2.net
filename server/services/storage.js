/**
 * storage.js — слой хранения данных.
 *
 * Два режима:
 *  1. Neon Postgres (если задан DATABASE_URL) — production, клиенты и ключи сохраняются.
 *  2. In-memory (если DATABASE_URL пуст) — dev-режим: данные живут в оперативке,
 *     сбрасываются при перезапуске сервера.
 *
 * Схема данных (обязательная к применению в обоих режимах):
 *  clients  (id, device_id UNIQUE, tg_id NULL-able, created_at)
 *  demo_keys(value, client_id, expires_at +2h, one_time, used, status)
 */

const path = require('path');
const fs = require('fs');

const DEMO_TTL_MS = (parseInt(process.env.DEMO_TTL_MINUTES || '120', 10) || 120) * 60 * 1000;

// ---------------------------------------------------------------------------
// PostgreSQL-режим (Neon)
// ---------------------------------------------------------------------------
class PostgresStore {
    constructor(pool) {
        this.pool = pool;
    }

    async init() {
        const schema = `
            CREATE TABLE IF NOT EXISTS clients (
                id          SERIAL PRIMARY KEY,
                device_id   TEXT NOT NULL UNIQUE,
                tg_id       TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS demo_keys (
                id          SERIAL PRIMARY KEY,
                value       TEXT NOT NULL,
                client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                expires_at  TIMESTAMPTZ NOT NULL,
                one_time    BOOLEAN NOT NULL DEFAULT TRUE,
                used        BOOLEAN NOT NULL DEFAULT FALSE,
                status      TEXT NOT NULL DEFAULT 'active'
            );
            CREATE INDEX IF NOT EXISTS idx_demo_keys_client ON demo_keys(client_id);

            -- Лиды с сайта (B1): outbox-таблица, бот поллит её и уведомляет админов.
            -- ВАЖНО: идентичная схема в HRZN2/database.py (миграции бота)
            CREATE TABLE IF NOT EXISTS site_leads (
                id          BIGSERIAL   PRIMARY KEY,
                device_id   TEXT        NOT NULL,
                tg_id       TEXT,
                event       TEXT        NOT NULL,
                referer     TEXT,
                utm         TEXT,
                user_agent  TEXT,
                notified    BOOLEAN     NOT NULL DEFAULT FALSE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_site_leads_unnotified
                ON site_leads (id)
                WHERE notified = FALSE;
        `;
        await this.pool.query(schema);
    }

    async getClientByDevice(deviceId) {
        const res = await this.pool.query(
            'SELECT id, device_id, tg_id, created_at FROM clients WHERE device_id = $1',
            [deviceId]
        );
        return res.rows[0] || null;
    }

    async createClient(deviceId, tgId) {
        const res = await this.pool.query(
            'INSERT INTO clients (device_id, tg_id) VALUES ($1, $2) ON CONFLICT (device_id) DO UPDATE SET tg_id = COALESCE(clients.tg_id, EXCLUDED.tg_id) RETURNING id, device_id, tg_id',
            [deviceId, tgId || null]
        );
        return res.rows[0];
    }

    async setTgId(clientId, tgId) {
        await this.pool.query('UPDATE clients SET tg_id = $2 WHERE id = $1', [clientId, tgId]);
    }

    async getActiveKey(clientId) {
        const res = await this.pool.query(
            `SELECT * FROM demo_keys
             WHERE client_id = $1 AND status = 'active' AND used = FALSE AND expires_at > now()
             ORDER BY id DESC LIMIT 1`,
            [clientId]
        );
        return res.rows[0] || null;
    }

    async getKeyCount(clientId) {
        const res = await this.pool.query(
            'SELECT COUNT(*)::int AS n FROM demo_keys WHERE client_id = $1',
            [clientId]
        );
        return res.rows[0].n;
    }

    async createKey(clientId, value, expiresAt) {
        const res = await this.pool.query(
            `INSERT INTO demo_keys (value, client_id, expires_at, one_time, used, status)
             VALUES ($1, $2, $3, TRUE, FALSE, 'active') RETURNING id, value, expires_at`,
            [value, clientId, new Date(expiresAt)]
        );
        return res.rows[0];
    }

    async markUsed(keyId) {
        await this.pool.query(
            "UPDATE demo_keys SET used = TRUE, status = 'used' WHERE id = $1",
            [keyId]
        );
    }

    /** B1: событие лида в outbox-таблицу (бот заберёт и уведомит админов). */
    async logLeadEvent(deviceId, tgId, event, referer, utm, userAgent) {
        await this.pool.query(
            `INSERT INTO site_leads (device_id, tg_id, event, referer, utm, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                deviceId,
                tgId || null,
                event,
                referer ? String(referer).slice(0, 300) : null,
                utm ? String(utm).slice(0, 200) : null,
                userAgent ? String(userAgent).slice(0, 300) : null,
            ]
        );
    }

    /** v2.2.2: возраст heartbeat бота в секундах (null — записи/таблицы нет). */
    async getBotHeartbeatAgeSec() {
        try {
            const res = await this.pool.query(
                'SELECT EXTRACT(EPOCH FROM (now() - ts)) AS age FROM bot_heartbeat WHERE id = 1'
            );
            return res.rows[0] ? Number(res.rows[0].age) : null;
        } catch (err) {
            // таблица ещё не создана миграцией бота — не ошибка
            return null;
        }
    }
}

// ---------------------------------------------------------------------------
// In-memory режим (dev)
// ---------------------------------------------------------------------------
class MemoryStore {
    constructor() {
        this._clients = new Map();   // device_id -> { id, device_id, tg_id, created_at }
        this._keys = [];             // [{ id, client_id, value, created_at, expires_at, one_time, used, status }]
        this._nextClientId = 1;
        this._nextKeyId = 1;
    }

    async init() {
        console.log('[storage] In-memory режим (DATABASE_URL не задан). Данные не сохраняются между перезапусками.');
    }

    async getClientByDevice(deviceId) {
        return this._clients.get(deviceId) || null;
    }

    async createClient(deviceId, tgId) {
        let client = this._clients.get(deviceId);
        if (!client) {
            client = {
                id: this._nextClientId++,
                device_id: deviceId,
                tg_id: tgId || null,
                created_at: new Date(),
            };
            this._clients.set(deviceId, client);
        } else if (tgId && !client.tg_id) {
            client.tg_id = tgId;
        }
        return client;
    }

    async setTgId(clientId, tgId) {
        const client = [...this._clients.values()].find((c) => c.id === clientId);
        if (client) client.tg_id = tgId;
    }

    async getActiveKey(clientId) {
        return (
            this._keys
                .filter((k) => k.client_id === clientId && k.status === 'active' && !k.used && k.expires_at > Date.now())
                .sort((a, b) => b.id - a.id)[0] || null
        );
    }

    async getKeyCount(clientId) {
        return this._keys.filter((k) => k.client_id === clientId).length;
    }

    async createKey(clientId, value, expiresAt) {
        const key = {
            id: this._nextKeyId++,
            client_id: clientId,
            value,
            created_at: new Date(),
            expires_at: expiresAt,
            one_time: true,
            used: false,
            status: 'active',
        };
        this._keys.push(key);
        return key;
    }

    async markUsed(keyId) {
        const key = this._keys.find((k) => k.id === keyId);
        if (key) {
            key.used = true;
            key.status = 'used';
        }
    }

    /** B1: в dev-режиме события лидов просто логируются. */
    async logLeadEvent(deviceId, tgId, event, referer, utm, userAgent) {
        console.log(`[storage:memory] site_lead event=${event} device=${String(deviceId).slice(0, 8)}… tg=${tgId || '—'} utm=${utm || '—'}`);
    }

    /** v2.2.2: в dev-режиме heartbeat не отслеживается. */
    async getBotHeartbeatAgeSec() {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Фабрика
// ---------------------------------------------------------------------------
async function createStore() {
    const databaseUrl = (process.env.DATABASE_URL || '').trim();

    if (databaseUrl) {
        // Лениво подключаем pg, чтобы dev-режим работал без установленного пакета в edge-случаях
        try {
            const { Pool } = require('pg');
            // Neon/прод — SSL обязателен; локальная dev-БД (unix-сокет / sslmode=disable) — без SSL
            const useSsl = !databaseUrl.includes('sslmode=disable') && !databaseUrl.includes('host=/');
            const pool = new Pool({
                connectionString: databaseUrl,
                ssl: useSsl ? { rejectUnauthorized: false } : false,
            });
            const store = new PostgresStore(pool);
            await store.init();
            console.log('[storage] Подключено к Neon Postgres.');
            return store;
        } catch (err) {
            console.error('[storage] Не удалось подключиться к Postgres:', err.message);
            throw err;
        }
    }

    const store = new MemoryStore();
    await store.init();
    return store;
}

module.exports = { createStore, DEMO_TTL_MS };