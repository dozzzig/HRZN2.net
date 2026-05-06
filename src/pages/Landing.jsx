import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import DashboardDrawer from '../components/DashboardDrawer';

export default function Landing() {
  const { hasAgreed, setHasAgreed, setSubscription } = useStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Состояния для модального окна правил
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

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

  const handleMockPayment = (plan) => {
    const mockKey = `vless://mock-uuid-key@hrzn2.network:443?type=tcp&security=reality&pbk=mock_pbk&sni=hrzn2.network&fp=chrome#HRZN2-${plan}`;
    setSubscription(true, mockKey);
    setIsDrawerOpen(true);
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
            <a href="#tariffs" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Тарифы</a>
            <a href="#instructions" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Инструкции</a>
            <a href="#support" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Поддержка</a>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.5)',
              background: 'rgba(168, 85, 247, 0.1)', color: '#e9d5ff', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)'
            }}
          >
            Личный кабинет
          </button>
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
              onClick={() => document.getElementById('tariffs').scrollIntoView({ behavior: 'smooth' })}
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

      {/* TARIFFS SECTION */}
      <section id="tariffs" style={{ padding: '80px 2rem', maxWidth: '1200px', margin: '0 auto', scrollMarginTop: '80px' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', textAlign: 'center', marginBottom: '3rem', fontWeight: 900 }}>
          Выбор <span style={{ color: '#a855f7' }}>доступа</span>
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          
          {/* Demo */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white', fontWeight: 800 }}>Демо-режим</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', flex: 1, fontSize: '0.95rem' }}>Доступ для проверки или перехода в Telegram-бот.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white' }}>0 ₽</div>
            <button onClick={() => handleMockPayment('DEMO')} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#1e293b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s' }}>Попробовать</button>
          </div>

          {/* 3 Months */}
          <div style={{ background: '#0f172a', border: '1px solid #22d3ee', borderRadius: '24px', padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 0 30px rgba(34, 211, 238, 0.1)', transform: 'scale(1.02)' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: '#22d3ee', color: '#0a0a0c', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Рекомендуем</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white', fontWeight: 800 }}>90 дней</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', flex: 1, fontSize: '0.95rem' }}>Идеальный баланс цены и длительности подписки.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white' }}>290 ₽ <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>/мес</span></div>
            <button onClick={() => handleMockPayment('90_DAYS')} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#22d3ee', color: '#0a0a0c', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 15px rgba(34, 211, 238, 0.3)' }}>Выбрать</button>
          </div>

          {/* 6 Months */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white', fontWeight: 800 }}>6 месяцев</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', flex: 1, fontSize: '0.95rem' }}>Долгосрочная уверенность и стабильный доступ.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white' }}>250 ₽ <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>/мес</span></div>
            <button onClick={() => handleMockPayment('6_MONTHS')} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#1e293b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Выбрать</button>
          </div>

          {/* 12 Months */}
          <div style={{ background: '#0f172a', border: '1px solid #a855f7', borderRadius: '24px', padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 0 30px rgba(168, 85, 247, 0.1)' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: '#a855f7', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Выгодно</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white', fontWeight: 800 }}>12 месяцев</h3>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', flex: 1, fontSize: '0.95rem' }}>Максимальная экономия на год вперед.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white' }}>190 ₽ <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>/мес</span></div>
            <button onClick={() => handleMockPayment('12_MONTHS')} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#a855f7', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)' }}>Выбрать</button>
          </div>

        </div>
      </section>

      {/* INSTRUCTIONS SECTION */}
      <section id="instructions" style={{ padding: '80px 2rem', maxWidth: '1000px', margin: '0 auto', textAlign: 'center', scrollMarginTop: '80px' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: '1rem', fontWeight: 900 }}>Как <span style={{ color: '#22d3ee' }}>подключиться?</span></h2>
        <p style={{ color: '#94a3b8', marginBottom: '3.5rem', fontSize: '1.15rem' }}>Всего три простых шага к свободному интернету.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '2.5rem 1.5rem', borderRadius: '24px', border: '1px solid #1e293b' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>1</div>
            <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'white', fontWeight: 800 }}>Выберите тариф</h4>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>Оформите подписку или возьмите бесплатный демо-доступ.</p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '2.5rem 1.5rem', borderRadius: '24px', border: '1px solid #1e293b' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#22d3ee' }}>2</div>
            <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'white', fontWeight: 800 }}>Скачайте клиент</h4>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>Установите приложение для iOS, Android, macOS или Windows.</p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '2.5rem 1.5rem', borderRadius: '24px', border: '1px solid #1e293b' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>3</div>
            <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'white', fontWeight: 800 }}>Вставьте ключ</h4>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>Скопируйте ваш VLESS-ключ из Личного кабинета и добавьте в клиент.</p>
          </div>
        </div>
      </section>

      {/* SUPPORT SECTION */}
      <section id="support" style={{ padding: '80px 2rem', background: '#0f172a', borderTop: '1px solid #1e293b', textAlign: 'center', scrollMarginTop: '80px' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 900 }}>Остались вопросы?</h2>
        <p style={{ color: '#94a3b8', marginBottom: '2.5rem', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>Наша поддержка решит их за 5 минут. Поможем с настройкой, оплатой или любыми другими техническими проблемами.</p>
        <a 
          href="tg://resolve?domain=your_support_account" 
          style={{
            display: 'inline-block', padding: '18px 36px', borderRadius: '14px',
            background: '#22d3ee', color: '#0a0a0c', textDecoration: 'none',
            fontSize: '1.1rem', fontWeight: 800, transition: 'all 0.2s', boxShadow: '0 10px 25px -5px rgba(34, 211, 238, 0.4)'
          }}
        >
          Написать в Telegram
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '3rem 2rem', textAlign: 'center', borderTop: '1px solid #1e293b', color: '#64748b', fontSize: '0.95rem', background: '#0a0a0c' }}>
        <div style={{ fontWeight: 800, color: '#94a3b8', marginBottom: '1rem', letterSpacing: '1px' }}>HRZN2 NETWORK</div>
        © {new Date().getFullYear()} Все права защищены.
      </footer>

      {/* DRAWER OVERLAY (Личный Кабинет) */}
      <DashboardDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
