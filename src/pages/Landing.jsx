import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Apple, Smartphone, Monitor, Copy, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { fetchVpnKey } from '../services/vpnApi';

export default function Landing() {
  const { hasAgreed, setHasAgreed, deviceId } = useStore();
  const [isChecked, setIsChecked] = useState(false);
  
  // Состояния для модального окна правил
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ios');
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  // Состояния для выдачи ключа
  const [keyStatus, setKeyStatus] = useState('NONE'); // 'NONE', 'ACTIVE', 'EXPIRED'
  const [demoKey, setDemoKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const DUMMY_KEY = "vless://stub_key_777_for_demo@vpn.hrzn2.net:443?security=reality&sni=google.com&type=tcp#HRZN2_Trial";
  const TIME_LIMIT = 15 * 60 * 1000; // 15 минут

  useEffect(() => {
    const savedKey = localStorage.getItem('hrzn2_demo_key');
    const savedTime = localStorage.getItem('hrzn2_demo_timestamp');

    if (savedKey && savedTime) {
      const timeElapsed = Date.now() - parseInt(savedTime, 10);
      if (timeElapsed < TIME_LIMIT) {
        setDemoKey(savedKey);
        setKeyStatus('ACTIVE');
      } else {
        setKeyStatus('EXPIRED');
      }
    }
    
    // Периодическая проверка таймера, если ключ ACTIVE
    const interval = setInterval(() => {
      const currentTime = localStorage.getItem('hrzn2_demo_timestamp');
      if (currentTime && keyStatus === 'ACTIVE') {
        if (Date.now() - parseInt(currentTime, 10) >= TIME_LIMIT) {
          setKeyStatus('EXPIRED');
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [keyStatus]);

  const handleGenerateKey = () => {
    localStorage.setItem('hrzn2_demo_key', DUMMY_KEY);
    localStorage.setItem('hrzn2_demo_timestamp', Date.now().toString());
    setDemoKey(DUMMY_KEY);
    setKeyStatus('ACTIVE');
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(demoKey || DUMMY_KEY);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Обработчик скролла в модальном окне
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight <= 5) {
      setIsScrolledToBottom(true);
    }
  };

  // Проверка: если текст полностью помещается на экран без скролла
  useEffect(() => {
    if (isModalOpen && scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight <= clientHeight + 5) {
        setIsScrolledToBottom(true);
      }
    }
  }, [isModalOpen]);

  const handleAcceptRules = () => {
    setIsChecked(true);
    setIsModalOpen(false);
  };

  // --- ЭКРАН-ШЛЮЗ (GATE) ---
  if (!hasAgreed) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0c',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        color: 'white', padding: '2rem', position: 'relative', overflow: 'hidden'
      }}>
        {/* Фоновые свечения */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.05) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }}></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ maxWidth: '440px', width: '100%', textAlign: 'center', zIndex: 10 }}
        >
          <h1 style={{ 
            fontSize: 'clamp(3rem, 10vw, 4.5rem)', fontWeight: 950, lineHeight: 1, marginBottom: '1rem',
            background: 'linear-gradient(to right, #22d3ee, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-2px'
          }}>
            HRZN2<br/>NETWORK
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '3rem', fontWeight: 500 }}>Анонимный доступ за гранью горизонтов.</p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', textAlign: 'left', marginBottom: '2.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <input 
              type="checkbox" checked={isChecked} disabled readOnly
              style={{ marginTop: '4px', width: '24px', height: '24px', accentColor: '#a855f7', cursor: 'not-allowed', flexShrink: 0, opacity: isChecked ? 1 : 0.5 }}
            />
            <label style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Я принимаю <span style={{ color: '#22d3ee', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setIsModalOpen(true)}>Правила сервиса и Пользовательское соглашение</span>
            </label>
          </div>

          <button 
            disabled={!isChecked} onClick={() => setHasAgreed(true)}
            style={{
              width: '100%', padding: '18px', borderRadius: '16px', border: 'none',
              background: isChecked ? 'linear-gradient(to right, #06b6d4, #9333ea)' : '#1e293b',
              color: isChecked ? 'white' : '#64748b', fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px',
              cursor: isChecked ? 'pointer' : 'not-allowed', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isChecked ? '0 10px 25px -5px rgba(147, 51, 234, 0.4)' : 'none'
            }}
          >
            Продолжить
          </button>
        </motion.div>

        {/* МОДАЛЬНОЕ ОКНО ПРАВИЛ */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div 
              key="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()}
                style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
              >
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e293b', background: 'rgba(255,255,255,0.02)' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', margin: 0 }}>Пользовательское соглашение и Политика конфиденциальности</h2>
                </div>
                
                <div ref={scrollRef} onScroll={handleScroll} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>1. Общие положения и Предмет Оферты</h4>
                  <p style={{ marginBottom: '1rem' }}>Настоящий документ является публичной Офертой. Сервис «HRZN2 NETWORK» предоставляет услуги доступа к виртуальной частной сети (VPN) через Telegram-бота и Web-приложение по принципу «как есть».</p>
                  <p style={{ marginBottom: '1.5rem' }}>Исполнитель обязуется предоставить доступ к VPN, а Пользователь – оплатить его. Мы стремимся к максимальной стабильности, но не гарантируем 100% аптайм в случае форс-мажорных обстоятельств или глобальных блокировок со стороны магистральных провайдеров. Сервис не аффилирован с Telegram FZ-LLC.</p>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>2. Политика отсутствия логов (No-Log Policy) и Конфиденциальность</h4>
                  <p style={{ marginBottom: '0.5rem' }}>Мы уважаем вашу анонимность. HRZN2 NETWORK работает по строгой политике No-Log.</p>
                  <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '0.5rem' }}>Мы не собираем, не храним и не передаем третьим лицам историю ваших посещений, DNS-запросы, реальные IP-адреса или метаданные трафика.</li>
                    <li style={{ marginBottom: '0.5rem' }}>Мы не требуем ввода номера телефона или электронной почты для использования Web-версии. На наших серверах хранится только сгенерированный анонимный Device-ID (или ваш Telegram ID, если вы используете бота), а также статус подписки, необходимые для выдачи ключа.</li>
                    <li style={{ marginBottom: '0.5rem' }}>Обработка данных осуществляется исключительно для предоставления доступа к сервису. Хранение осуществляется не дольше, чем этого требуют цели обработки.</li>
                  </ul>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>3. Запрещенная деятельность</h4>
                  <p style={{ marginBottom: '0.5rem' }}>Пользователям строго запрещено использовать ресурсы HRZN2 NETWORK для:</p>
                  <ul style={{ paddingLeft: '1.5rem', marginBottom: '0.5rem', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '0.5rem' }}>Рассылки спама (e-mail, мессенджеры).</li>
                    <li style={{ marginBottom: '0.5rem' }}>Совершения DDoS-атак и попыток взлома любых ресурсов.</li>
                    <li style={{ marginBottom: '0.5rem' }}>Распространения вредоносного ПО и фишинга.</li>
                    <li style={{ marginBottom: '0.5rem' }}>Загрузки и распространения контента, нарушающего международное право (включая детскую порнографию и террористические материалы).</li>
                    <li style={{ marginBottom: '0.5rem' }}>Доступа к материалам, нарушающим законодательство страны расположения сервера.</li>
                  </ul>
                  <p style={{ marginBottom: '1.5rem' }}>При фиксации подобных действий со стороны дата-центров, доступ будет аннулирован без права на возврат средств.</p>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>4. Подписки, Оплата и Условия возврата</h4>
                  <p style={{ marginBottom: '0.5rem' }}>Активация подписки происходит автоматически после подтверждения транзакции в Telegram Stars, Crypto Pay или через фиатные/P2P платежные шлюзы (оплата банковскими картами).</p>
                  <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', listStyleType: 'disc' }}>
                    <li style={{ marginBottom: '0.5rem' }}>Услуга предоставляется на условиях 100% предоплаты.</li>
                    <li style={{ marginBottom: '0.5rem' }}>После успешной генерации и выдачи VPN-ключа услуга считается оказанной, возврат средств не производится в связи с анонимной природой сервиса. Возврат или перерасчет возможны только при подтвержденных технических сбоях (оплата списана, но услуга не зачислена).</li>
                    <li style={{ marginBottom: '0.5rem' }}>Демо-режим предоставляется один раз на один аккаунт/устройство. Попытки обхода этого ограничения ведут к блокировке.</li>
                  </ul>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>5. Реферальная программа</h4>
                  <p style={{ marginBottom: '1.5rem' }}>Бонусные дни за приглашение друзей начисляются только после того, как приглашенный пользователь подтвердит согласие с данными правилами и совершит целевое действие. Злоупотребление реферальной системой (использование ботов, самореферальство) ведет к обнулению бонусного баланса.</p>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>6. Ответственность и Разрешение споров</h4>
                  <p style={{ marginBottom: '1.5rem' }}>Пользователь несет единоличную ответственность за действия, совершенные с использованием его учетной записи и VPN-ключа в рамках HRZN2. Администрация оставляет за собой право приостановить доступ при обнаружении аномальной активности, создающей угрозу стабильности серверов. Стороны освобождаются от ответственности при форс-мажоре (глобальные сбои интернета, блокировки сервисов государственными органами).</p>

                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', marginBottom: '0.5rem' }}>7. Техническая поддержка</h4>
                  <p style={{ marginBottom: '1rem' }}>Все вопросы по работе сервиса, настройке подключения или проблемам с оплатой принимаются через официальную службу поддержки.</p>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid #1e293b', background: 'rgba(255,255,255,0.02)' }}>
                  <button 
                    disabled={!isScrolledToBottom} onClick={handleAcceptRules}
                    style={{
                      width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                      background: isScrolledToBottom ? 'linear-gradient(to right, #06b6d4, #9333ea)' : '#1e293b',
                      color: isScrolledToBottom ? 'white' : '#64748b', fontSize: '1.05rem', fontWeight: 700, cursor: isScrolledToBottom ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease'
                    }}
                  >
                    {isScrolledToBottom ? 'Я прочитал и согласен' : 'Прокрутите текст до конца...'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- ONE-PAGE (ОСНОВНАЯ СТРАНИЦА) ---
  return (
    <div style={{ backgroundColor: '#0a0a0c', minHeight: '100vh', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        backgroundColor: 'rgba(10, 10, 12, 0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, background: 'linear-gradient(to right, #22d3ee, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', cursor: 'pointer' }} onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          HRZN2
        </div>
        <nav style={{ display: 'none', gap: '2rem' }}>
           {/* Скрываем на мобилках, показываем на десктопах через медиа-запросы в CSS. Пока ставим display flex в инлайне для десктопа */}
        </nav>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }} className="desktop-nav">
            <a href="#instructions" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Инструкции</a>
            <a href="#support" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Поддержка</a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', paddingLeft: '2rem', paddingRight: '2rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 60%)', pointerEvents: 'none', zIndex: 0 }}></div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 900, marginBottom: '1.5rem', lineHeight: 1.1 }}>
            Свобода за гранью <span style={{ color: '#22d3ee' }}>горизонта.</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Безопасный доступ к Telegram и всему интернету без ограничений. Быстро, просто и всегда онлайн. Никаких обязательных регистраций.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => document.getElementById('instructions').scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '16px 36px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(to right, #06b6d4, #9333ea)', color: 'white',
                fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(147, 51, 234, 0.4)', transition: 'transform 0.2s'
              }}
            >
              Получить доступ
            </button>
          </div>
        </motion.div>
      </section>

      {/* INSTRUCTIONS SECTION */}
      <section id="instructions" style={{ padding: '80px 2rem', maxWidth: '800px', margin: '0 auto', scrollMarginTop: '80px' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: '3rem', fontWeight: 900, textAlign: 'center' }}>
          Настройка в <span style={{ color: '#22d3ee' }}>3 клика</span>
        </h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('ios')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '16px', background: activeTab === 'ios' ? 'rgba(34, 211, 238, 0.15)' : '#0f172a', border: `1px solid ${activeTab === 'ios' ? '#22d3ee' : '#1e293b'}`, color: activeTab === 'ios' ? '#22d3ee' : '#64748b', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Apple size={20} /> Apple iOS
          </button>
          <button 
            onClick={() => setActiveTab('android')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '16px', background: activeTab === 'android' ? 'rgba(168, 85, 247, 0.15)' : '#0f172a', border: `1px solid ${activeTab === 'android' ? '#a855f7' : '#1e293b'}`, color: activeTab === 'android' ? '#a855f7' : '#64748b', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Smartphone size={20} /> Android
          </button>
          <button 
            onClick={() => setActiveTab('pc')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '16px', background: activeTab === 'pc' ? 'rgba(34, 211, 238, 0.15)' : '#0f172a', border: `1px solid ${activeTab === 'pc' ? '#22d3ee' : '#1e293b'}`, color: activeTab === 'pc' ? '#22d3ee' : '#64748b', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Monitor size={20} /> Windows / Mac
          </button>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '2.5rem', minHeight: '300px' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'ios' && (
              <motion.div key="ios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Установите приложение</strong> Happ Proxy.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Нажмите кнопку внизу</strong>, чтобы получить стартовый 15-минутный ключ, и скопируйте его.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Вставьте ключ в приложение</strong> и подключитесь. Как только будете в свободной сети, вернитесь сюда и перейдите в Telegram для активации подписки.</div>
                  </div>
                </div>
                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
                  <a href="https://apps.apple.com/us/app/happ-proxy-utility/id6504287215?l=ru" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', color: 'black', padding: '12px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}>
                    <Apple size={20} /> Скачать в App Store
                  </a>
                </div>
              </motion.div>
            )}

            {activeTab === 'android' && (
              <motion.div key="android" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Установите приложение</strong> Happ Proxy.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Нажмите кнопку внизу</strong>, чтобы получить стартовый 15-минутный ключ, и скопируйте его.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Вставьте ключ в приложение</strong> и подключитесь. Как только будете в свободной сети, вернитесь сюда и перейдите в Telegram для активации подписки.</div>
                  </div>
                </div>
                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <a href="https://play.google.com/store/apps/details?id=com.happproxy&hl=ru" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#22c55e', color: 'white', padding: '12px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}>
                    <Smartphone size={20} /> Скачать в Google Play
                  </a>
                </div>
              </motion.div>
            )}

            {activeTab === 'pc' && (
              <motion.div key="pc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', fontSize: '1.05rem' }}>Для <strong>Windows</strong> скачайте v2rayN, для <strong>macOS</strong> используйте V2RayXS или Vfox.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Установите приложение</strong> для вашей платформы (Windows или Mac).</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Нажмите кнопку внизу</strong>, чтобы получить стартовый 15-минутный ключ, и скопируйте его.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</div>
                    <div style={{ color: '#94a3b8' }}><strong style={{ color: 'white' }}>Вставьте ключ в приложение</strong> и подключитесь. Как только будете в свободной сети, вернитесь сюда и перейдите в Telegram для активации подписки.</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
      {/* CALL TO ACTION SECTION */}
      <section id="get-key" style={{ padding: '40px 2rem 80px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(147, 51, 234, 0.1))', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '24px', padding: '3rem 2rem', boxShadow: '0 10px 40px -10px rgba(168, 85, 247, 0.15)' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 900, marginBottom: '1rem' }}>
            Готовы к <span style={{ color: '#a855f7' }}>подключению?</span>
          </h2>
          
          {keyStatus === 'NONE' && (
            <>
              <p style={{ color: '#cbd5e1', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem' }}>
                Сгенерируйте ваш стартовый ключ прямо сейчас. Это займет всего секунду.
              </p>
              <button 
                onClick={handleGenerateKey}
                style={{
                  padding: '18px 40px', borderRadius: '16px', border: 'none',
                  background: 'linear-gradient(to right, #06b6d4, #9333ea)', color: 'white',
                  fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(147, 51, 234, 0.5)', transition: 'transform 0.2s', width: '100%', maxWidth: '350px'
                }}
              >
                Сгенерировать ключ доступа
              </button>
            </>
          )}

          {keyStatus === 'ACTIVE' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '450px', margin: '0 auto' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <Check size={32} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Ваш ключ готов!</h3>
              
              <div style={{ width: '100%', position: 'relative', marginBottom: '1.5rem' }}>
                <input 
                  type="text" value={demoKey} readOnly
                  style={{ width: '100%', padding: '16px 50px 16px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <button 
                  onClick={handleCopyKey}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: isCopied ? '#22c55e' : '#a855f7', cursor: 'pointer', padding: '8px' }}
                >
                  {isCopied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '2rem' }}>
                <p style={{ color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                  <strong>Внимание:</strong> Ключ работает 15 минут. Подключитесь в приложении, а затем нажмите кнопку ниже, чтобы оформить и активировать подписку.
                </p>
              </div>

              <a 
                href="https://t.me/HRZN2_bot"
                target="_blank" rel="noopener noreferrer"
                style={{
                  width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
                  background: '#2481cc', color: 'white', fontSize: '1.1rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', textDecoration: 'none', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1d6fa5'}
                onMouseOut={(e) => e.currentTarget.style.background = '#2481cc'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.48 15.82 14.39 15.48 16.2C15.33 16.97 15.05 17.23 14.78 17.26C14.19 17.31 13.74 16.87 13.17 16.49C12.28 15.9 11.78 15.54 10.92 14.97C9.93 14.31 10.57 13.95 11.15 13.35C11.3 13.2 13.88 10.85 13.93 10.64C13.94 10.61 13.94 10.54 13.9 10.5C13.86 10.46 13.81 10.47 13.77 10.48C13.7 10.5 12.56 11.25 10.35 12.74C10.02 12.96 9.73 13.07 9.47 13.07C9.18 13.07 8.63 12.91 8.22 12.78C7.72 12.62 7.33 12.49 7.37 12.21C7.39 12.07 7.59 11.92 7.97 11.77C11.36 10.3 13.62 9.35 14.75 8.88C15.82 8.44 16.04 8.36 16.19 8.36C16.22 8.36 16.32 8.37 16.38 8.42C16.43 8.46 16.46 8.53 16.47 8.58C16.47 8.64 16.46 8.74 16.44 8.84L16.64 8.8Z" fill="white"/>
                </svg>
                Активировать подписку в Telegram
              </a>
            </div>
          )}

          {keyStatus === 'EXPIRED' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '450px', margin: '0 auto' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', width: '100%' }}>
                <p style={{ color: '#fca5a5', fontSize: '1.05rem', lineHeight: 1.5, textAlign: 'center', margin: 0, fontWeight: 500 }}>
                  Ваш пробный период завершен. Для продолжения работы оформите подписку.
                </p>
              </div>

              <a 
                href="https://t.me/HRZN2_bot"
                target="_blank" rel="noopener noreferrer"
                style={{
                  width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
                  background: '#2481cc', color: 'white', fontSize: '1.1rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', textDecoration: 'none', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1d6fa5'}
                onMouseOut={(e) => e.currentTarget.style.background = '#2481cc'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.48 15.82 14.39 15.48 16.2C15.33 16.97 15.05 17.23 14.78 17.26C14.19 17.31 13.74 16.87 13.17 16.49C12.28 15.9 11.78 15.54 10.92 14.97C9.93 14.31 10.57 13.95 11.15 13.35C11.3 13.2 13.88 10.85 13.93 10.64C13.94 10.61 13.94 10.54 13.9 10.5C13.86 10.46 13.81 10.47 13.77 10.48C13.7 10.5 12.56 11.25 10.35 12.74C10.02 12.96 9.73 13.07 9.47 13.07C9.18 13.07 8.63 12.91 8.22 12.78C7.72 12.62 7.33 12.49 7.37 12.21C7.39 12.07 7.59 11.92 7.97 11.77C11.36 10.3 13.62 9.35 14.75 8.88C15.82 8.44 16.04 8.36 16.19 8.36C16.22 8.36 16.32 8.37 16.38 8.42C16.43 8.46 16.46 8.53 16.47 8.58C16.47 8.64 16.46 8.74 16.44 8.84L16.64 8.8Z" fill="white"/>
                </svg>
                Активировать подписку в Telegram
              </a>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER & SUPPORT */}{/* FOOTER & SUPPORT */}
      <footer style={{ background: '#0a0a0c', borderTop: '1px solid #1e293b', paddingTop: '4rem', paddingBottom: '2rem', marginTop: '4rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>Остались вопросы?</h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Наша поддержка решит их за 5 минут.</p>
            <a 
              href="tg://resolve?domain=your_support_account" 
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '12px 28px', borderRadius: '12px',
                background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)',
                textDecoration: 'none', fontWeight: 700, transition: 'all 0.2s'
              }}
            >
              Написать в поддержку
            </a>
          </div>

          <div style={{ width: '100%', height: '1px', background: '#1e293b' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
            <div style={{ fontWeight: 900, color: '#94a3b8', letterSpacing: '2px', fontSize: '1.2rem' }}>HRZN2 <span style={{ color: '#22d3ee' }}>NETWORK</span></div>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setIsModalOpen(true)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>Пользовательское соглашение и Политика конфиденциальности</button>
            </div>
            <div style={{ color: '#475569', fontSize: '0.85rem', marginTop: '1rem' }}>
              © {new Date().getFullYear()} HRZN2 Network. Все права защищены.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
