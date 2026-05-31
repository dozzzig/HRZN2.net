const axios = require('axios');
const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class XrayService {
    constructor() {
        this.baseUrl = (process.env.PANEL_URL || '').trim().replace(/\/$/, '');
        this.inboundId = parseInt(process.env.INBOUND_ID || '4', 10);
        this.sessionCookie = null;
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            }
        });
        
        // Перехватчик для автоматического добавления Cookie к запросам
        this.client.interceptors.request.use((config) => {
            if (this.sessionCookie) {
                config.headers['Cookie'] = this.sessionCookie;
            }
            return config;
        });
    }

    async login() {
        try {
            const params = new URLSearchParams();
            params.append('username', (process.env.PANEL_USERNAME || '').trim());
            params.append('password', (process.env.PANEL_PASSWORD || '').trim());

            const response = await this.client.post('/login', params);
            
            if (response.data && response.data.success) {
                // Извлекаем session cookie из заголовка ответа
                const setCookieHeader = response.headers['set-cookie'];
                if (setCookieHeader && setCookieHeader.length > 0) {
                    this.sessionCookie = setCookieHeader[0].split(';')[0];
                }
                console.log("3x-ui login successful.");
                return true;
            } else {
                console.error("3x-ui login failed:", response.data);
                return false;
            }
        } catch (error) {
            console.error("3x-ui login error:", error.message);
            return false;
        }
    }

    async createDemoClient() {
        // Авторизуемся при каждом создании (либо можно сохранять сессию и проверять ее)
        const loggedIn = await this.login();
        if (!loggedIn) {
            throw new Error("Failed to authenticate with 3x-ui panel.");
        }

        const clientId = uuidv4();
        // 15 минут в миллисекундах
        const expiryMs = Date.now() + 15 * 60 * 1000;
        const email = `demo_${Date.now()}`;

        // Структура строго как в боте
        const clientSettings = {
            clients: [{
                id: clientId,
                flow: "",
                email: email,
                limitIp: 0,
                totalGB: 0,
                expiryTime: expiryMs,
                enable: true,
                tgId: "", // В боте мы писали tgId, здесь оставляем пустым
                subId: `sub_${email}`,
                comment: "Web Demo 15m",
                reset: 0
            }]
        };

        const params = new URLSearchParams();
        params.append('id', this.inboundId);
        params.append('settings', JSON.stringify(clientSettings));

        try {
            const response = await this.client.post('/panel/api/inbounds/addClient', params);
            
            if (response.data && response.data.success) {
                console.log(`Created XUI demo client ${email}. Expiry: 15m.`);
                return this.buildLink(clientId, email);
            } else {
                console.error("Failed to create XUI client:", response.data);
                throw new Error("Panel returned success=false");
            }
        } catch (error) {
            console.error("XUI API request failed:", error.message);
            throw error;
        }
    }

    buildLink(clientId, email) {
        // Те же параметры, что и в Python xui.py
        const params = "type=tcp&encryption=none&security=reality&pbk=4uiJtJy-CDxtQjIdRvAgW-JiNTX5hoMu6guTVOGBkDI&fp=chrome&sni=www.intel.com&sid=c8&spx=%2F";
        return `vless://${clientId}@144.31.141.164:7443?${params}#HRZN2-${email}`;
    }
}

module.exports = new XrayService();
