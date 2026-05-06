import { useState } from 'react';

const BOT_NAME = 'HorizonVPNBot'; // Замените на реальное имя вашего бота

/**
 * TelegramBridge — блок для привязки веб-аккаунта (Device ID) к Telegram-боту.
 *
 * Механизм:
 * 1. Генерирует Deep Link вида: tg://resolve?domain=BOT&start=bind_UUID
 * 2. Пользователь открывает ссылку в Telegram → бот получает /start bind_UUID
 * 3. Бот на бэкенде склеивает telegram_id ↔ device_id
 *
 * @param {{ deviceId: string, isTgLinked: boolean, markTgLinked: () => void }} props
 */
export default function TelegramBridge({ deviceId, isTgLinked, markTgLinked }) {
  const [copied, setCopied] = useState(false);

  // Deep Link для мобильного Telegram (открывает приложение)
  const deepLink = `tg://resolve?domain=${BOT_NAME}&start=bind_${deviceId}`;
  // Универсальная ссылка для браузера (работает и через веб)
  const webLink = `https://t.me/${BOT_NAME}?start=bind_${deviceId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ничего не делаем, пользователь использует кнопку
    }
  };

  if (isTgLinked) {
    return (
      <div className="glass-panel tg-bridge tg-bridge--linked">
        <div className="tg-bridge__icon">✅</div>
        <div>
          <div className="tg-bridge__title">Telegram привязан</div>
          <div className="tg-bridge__desc">
            Управляйте подпиской прямо в боте. Уведомления о продлении включены.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel tg-bridge">
      <div className="tg-bridge__header">
        {/* SVG-иконка Telegram */}
        <svg className="tg-bridge__tg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.942z" fill="#229ED9"/>
        </svg>
        <div>
          <div className="tg-bridge__title">Привяжите аккаунт к Telegram</div>
          <div className="tg-bridge__desc">
            Получайте уведомления о продлении, управляйте ключами и обращайтесь в поддержку прямо в боте.
          </div>
        </div>
      </div>

      <div className="tg-bridge__actions">
        {/* Основная кнопка — открывает Telegram */}
        <a
          href={deepLink}
          className="btn-tg-primary"
          onClick={markTgLinked} // Оптимистичная привязка; бэкенд подтвердит
        >
          Открыть в Telegram
        </a>

        {/* Альтернатива: скопировать ссылку */}
        <button className="btn-tg-copy" onClick={handleCopy}>
          {copied ? '✓ Скопировано' : 'Скопировать ссылку'}
        </button>
      </div>

      <div className="tg-bridge__hint">
        Это безопасно. Мы не запрашиваем ваш номер телефона — только привязываем ваш Device ID к боту.
      </div>
    </div>
  );
}
