const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Настройка ключа шифрования для почты (AES-256)
const SECRET_KEY = process.env.ENCRYPTION_KEY || '6f72697a6f6e5f76706e5f7365637265745f6b65795f32303236'; // 32 байта
const IV_LENGTH = 16;

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

// Функция для шифрования (обратимая)
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Эндпоинт регистрации
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Заполните все поля' });
  }

  try {
    // 1. Хэшируем пароль (безопасно)
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Шифруем почту для сверки (AES)
    const encryptedEmail = encrypt(email);

    // 3. Сохраняем в Neon
    const query = `
      INSERT INTO users (email, password, backup_email, original_password_plain) 
      VALUES ($1, $2, $3, $4) RETURNING id
    `;
    const values = [email, passwordHash, encryptedEmail, password]; // Сохраняем пароль в plain как просил для сверки

    const result = await pool.query(query, values);
    
    res.json({ 
      success: true, 
      message: 'Пользователь успешно создан',
      userId: result.rows[0].id 
    });
  } catch (err) {
    if (err.code === '23505') {
       return res.status(400).json({ success: false, message: 'Этот email уже зарегистрирован' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend Horizon запущен на порту ${PORT}`));
