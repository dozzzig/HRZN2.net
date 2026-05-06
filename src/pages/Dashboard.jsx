import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import TelegramBridge from '../components/TelegramBridge';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Clock, ShieldCheck, Download, Smartphone, Monitor } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { deviceId, isTgLinked, markTgLinked, subscription, isLoading } = useStore();
  const [copied, setCopied] = useState(false);

  const handleCopyKey = async () => {
    if (subscription?.key) {
      await navigator.clipboard.writeText(subscription.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loader">Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Навигация */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div 
          onClick={() => navigate('/')}
          style={{ fontSize: '1.5rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8 }}></div>
          HORIZON
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          ID: {deviceId?.split('-')[0]}...
        </div>
      </nav>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}
      >
        {/* Ключ 3x-ui и QR */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={24} color="var(--accent)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ваш VPN Ключ</h2>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'white', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <QRCodeSVG 
                value={subscription?.key || 'error'} 
                size={140} 
                level="M"
                includeMargin={false}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Строка подписки (VLESS/Reality)</div>
              <div 
                style={{ 
                  background: 'rgba(0,0,0,0.03)', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  fontSize: '0.75rem', 
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  border: '1px solid var(--border)',
                  maxHeight: '80px',
                  overflowY: 'auto'
                }}
              >
                {subscription?.key}
              </div>
            </div>
          </div>

          <button 
            onClick={handleCopyKey}
            className="btn-primary" 
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', padding: '14px', fontSize: '1rem' }}
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? 'Скопировано!' : 'Скопировать ключ'}
          </button>
        </div>

        {/* Статус подписки и Telegram */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <Clock size={24} color="var(--accent)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Подписка</h2>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
              {subscription?.remainingDays} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>дней</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Активна до: {new Date(subscription?.expire_date).toLocaleDateString('ru-RU')}
            </div>
            
            <button className="btn-secondary" style={{ width: '100%', marginTop: '1.5rem', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', fontWeight: 600 }}>
              Продлить доступ
            </button>
          </div>

          <TelegramBridge deviceId={deviceId} isTgLinked={isTgLinked} markTgLinked={markTgLinked} />
        </div>

        {/* Инструкции и Клиенты */}
        <div className="glass-panel" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Download size={24} color="var(--accent)" /> Скачать приложения
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            
            {/* iOS */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 700 }}>
                <Smartphone size={20} /> iOS / iPadOS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973" target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', fontSize: '0.9rem', padding: '10px' }}>
                  Happ Proxy Plus (Рекомендуем)
                </a>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Альтернативы: Vfox, Shadowrocket
                </div>
              </div>
            </div>

            {/* Android */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 700 }}>
                <Smartphone size={20} /> Android
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="https://play.google.com/store/apps/details?id=com.v2ray.ang" target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', fontSize: '0.9rem', padding: '10px', background: '#10b981' }}>
                  v2rayNG (Рекомендуем)
                </a>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Альтернативы: Hiddify
                </div>
              </div>
            </div>

            {/* PC */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 700 }}>
                <Monitor size={20} /> Windows / macOS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontWeight: 600 }}>
                  Скачать v2rayN (Windows)
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Hiddify Next (Win/Mac/Linux)
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
