const express = require('express');
const cors = require('cors');
require('dotenv').config();

const xrayService = require('./services/xrayService');

const app = express();
const PORT = process.env.PORT || 5000;
console.log("Panel URL:", process.env.PANEL_URL);

// Middleware
app.use(cors()); // В будущем можно настроить только на домен сайта
app.use(express.json());

// Роут для генерации демо-ключа
app.post('/api/generate-demo', async (req, res) => {
    try {
        const link = await xrayService.createDemoClient();
        res.json({
            success: true,
            key: link
        });
    } catch (error) {
        console.error("Error in /api/generate-demo:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to generate demo key. Please try again later."
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
