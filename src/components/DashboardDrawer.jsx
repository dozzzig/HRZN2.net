import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function DashboardDrawer({ isOpen, onClose }) {
  const { deviceId, isPaid, vlessKey } = useStore();

  const handleCopy = () => {
    if (vlessKey) {
      navigator.clipboard.writeText(vlessKey);
      // Простая визуальная обратная связь
      alert('Ключ скопирован в буфер обмена!');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Темный оверлей на заднем фоне */}
          <motion.div 
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100
            }}
          />
          
          {/* Сама панель Drawer */}
          <motion.div
            key="drawer-content"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '100%', maxWidth: '400px',
              backgroundColor: '#0a0a0c', borderLeft: '1px solid #1e293b',
              zIndex: 101, display: 'flex', flexDirection: 'column',
              padding: '2rem', overflowY: 'auto', color: 'white',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Личный Кабинет</h2>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ marginBottom: '2rem', fontSize: '0.9rem', color: '#cbd5e1', background: '#0f172a', padding: '1rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
              Ваш анонимный ID:<br/>
              <span style={{ fontFamily: 'monospace', color: '#22d3ee', wordBreak: 'break-all', display: 'block', marginTop: '0.5rem' }}>{deviceId}</span>
            </div>

            {!isPaid ? (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <div style={{ marginBottom: '1.5rem', color: '#64748b' }}>
                  <ShieldCheck size={64} style={{ margin: '0 auto' }} />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#cbd5e1' }}>У вас нет активного ключа</h3>
                <button 
                  onClick={() => {
                    onClose();
                    document.getElementById('tariffs').scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(to right, #22d3ee, #a855f7)', color: 'white',
                    fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
                  }}
                >
                  Выбрать тариф
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #1e293b', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#cbd5e1' }}>Ваш VPN Ключ (VLESS)</h4>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem' }}>
                    <QRCodeSVG value={vlessKey} size={160} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      value={vlessKey} 
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', outline: 'none' }}
                    />
                    <button onClick={handleCopy} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#334155', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Copy size={20} />
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '1.5rem', borderRadius: '16px', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#22d3ee', fontSize: '1.1rem' }}>Telegram Управление</h4>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5 }}>Привяжите этот веб-аккаунт к Telegram-боту для получения уведомлений, управления подпиской и участия в реферальной программе.</p>
                  <a 
                    href={`tg://resolve?domain=HRZN2_bot&start=bind_${deviceId}`}
                    style={{
                      display: 'block', textDecoration: 'none', width: '100%', padding: '14px', borderRadius: '12px',
                      background: '#22d3ee', color: '#0f172a', fontWeight: 800, textAlign: 'center', fontSize: '1.05rem'
                    }}
                  >
                    Привязать к Telegram
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
