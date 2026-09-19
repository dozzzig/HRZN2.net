import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Apple, Smartphone, Monitor, Copy, Check, ChevronDown, Zap, ShieldCheck, Server, Globe, X } from 'lucide-react';
import { useStore } from '../store/useStore';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------
const DEMO_TTL_MS = 2 * 60 * 60 * 1000; // 2 часа
const BOT_USERNAME = 'HRZN2_bot';

// Тексты инструкций для трёх платформ
const INSTRUCTIONS = {
  ios: {
    app: 'Happ Proxy',
    store: 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215?l=ru',
    storeLabel: 'Скачать в App Store',
    steps: [
      'Установите приложение Happ Proxy.',
      'Нажмите кнопку ниже и получите стартовый ключ на 2 часа.',
      'Скопируйте ключ, вставьте в приложение и подключитесь.',
    ],
    color: 'cyan',
  },
  android: {
    app: 'Happ Proxy',
    store: 'https://play.google.com/store/apps/details?id=com.happproxy&hl=ru',
    storeLabel: 'Скачать в Google Play',
    steps: [
      'Установите приложение Happ Proxy.',
      'Нажмите кнопку ниже и получите стартовый ключ на 2 часа.',
      'Скопируйте ключ, вставьте в приложение и подключитесь.',
    ],
    color: 'violet',
  },
  pc: {
    app: 'v2rayN (Windows) / V2RayXS (macOS)',
    store: null,
    storeLabel: undefined,
    steps: [
      'Установите приложение для вашей платформы (Windows или Mac).',
      'Нажмите кнопку ниже и получите стартовый ключ на 2 часа.',
      'Вставьте ключ в приложение и подключитесь.',
    ],
    color: 'cyan',
  },
};

const FAQ = [
  {
    q: 'Что я получаю бесплатно?',
    a: 'Одноразовый демо-ключ на 2 часа. Этого хватит, чтобы проверить скорость и стабильность сервиса — без регистрации и банковской карты.',
  },
  {
    q: 'Это безопасно?',
    a: 'Да. Мы работаем по политике No-Log: не собираем и не храним историю ваших посещений. Для выдачи ключа достаточно одного устройства.',
  },
  {
    q: 'Зачем указывать Telegram?',
    a: 'Не обязательно. Но если укажете @username в поле при выдаче — пришлём ваш ключ сюда и сможем быстро помочь с настройкой. Без него тоже всё работает.',
  },
  {
    q: 'Что после того, как демо-ключ закончится?',
    a: 'Перейдите в нашего Telegram-бота и оформите подписку. Оплата картой, Telegram Stars или криптой — доступ активируется мгновенно.',
  },
];

// ---------------------------------------------------------------------------
// Вспомогательный компонент: Telegram-иконка
// ---------------------------------------------------------------------------
function TelegramIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.48 15.82 14.39 15.48 16.2C15.33 16.97 15.05 17.23 14.78 17.26C14.19 17.31 13.74 16.87 13.17 16.49C12.28 15.9 11.78 15.54 10.92 14.97C9.93 14.31 10.57 13.95 11.15 13.35C11.3 13.2 13.88 10.85 13.93 10.64C13.94 10.61 13.94 10.54 13.9 10.5C13.86 10.46 13.81 10.47 13.77 10.48C13.7 10.5 12.56 11.25 10.35 12.74C10.02 12.96 9.73 13.07 9.47 13.07C9.18 13.07 8.63 12.91 8.22 12.78C7.72 12.62 7.33 12.49 7.37 12.21C7.39 12.07 7.59 11.92 7.97 11.77C11.36 10.3 13.62 9.35 14.75 8.88C15.82 8.44 16.04 8.36 16.19 8.36C16.22 8.36 16.32 8.37 16.38 8.42C16.43 8.46 16.46 8.53 16.47 8.58C16.47 8.64 16.46 8.74 16.44 8.84L16.64 8.8Z" fill="white"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
export default function Landing() {
  const { hasAgreed, setHasAgreed, deviceId } = useStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Состояние выдачи ключа
  const [keyStatus, setKeyStatus] = useState('NONE'); // NONE | ACTIVE | EXPIRED
  const [demoKey, setDemoKey] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [tgContact, setTgContact] = useState('');
  const [showTgField, setShowTgField] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [activeTab, setActiveTab] = useState('ios');

  // -------------------------------------------------------------------------
  // Восстановление ключа из localStorage
  // -------------------------------------------------------------------------
  useEffect(() => {
    const savedKey = localStorage.getItem('hrzn_demo_key');
    const savedExp = localStorage.getItem('hrzn_demo_expires_at');
    if (savedKey && savedExp) {
      const exp = parseInt(savedExp, 10);
      if (exp > Date.now()) {
        setDemoKey(savedKey);
        setExpiresAt(exp);
        setKeyStatus('ACTIVE');
      } else {
        setKeyStatus('EXPIRED');
      }
    }
  }, []);

  // Тикающий таймер для отображения оставшегося времени
  useEffect(() => {
    if (keyStatus !== 'ACTIVE') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [keyStatus]);

  // Авто-перевод в EXPIRED по истечении времени
  useEffect(() => {
    if (keyStatus !== 'ACTIVE') return;
    const interval = setInterval(() => {
      if (Date.now() >= expiresAt) {
        setKeyStatus('EXPIRED');
        setDemoKey('');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [keyStatus, expiresAt]);

  // -------------------------------------------------------------------------
  // Выдача ключа
  // -------------------------------------------------------------------------
  const handleGenerateKey = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch('/api/generate-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          tgId: tgContact.trim() || null,
          utm: useStore.getState().utm || null,
        }),
      });
      const data = await response.json();

      if (data.success && data.key) {
        const exp = data.expiresAt || Date.now() + DEMO_TTL_MS;
        localStorage.setItem('hrzn_demo_key', data.key);
        localStorage.setItem('hrzn_demo_expires_at', String(exp));
        setDemoKey(data.key);
        setExpiresAt(exp);
        setKeyStatus('ACTIVE');
      } else if (data.success && data.status === 'already-used') {
        setKeyStatus('EXPIRED');
      } else {
        setGenerateError(data.error || 'Ошибка при генерации ключа');
      }
    } catch (err) {
      setGenerateError('Ошибка сети. Попробуйте позже.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(demoKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleAcceptRules = () => {
    setIsChecked(true);
    setIsTermsOpen(false);
  };

  // -------------------------------------------------------------------------
  // Таймер обратного отсчёта
  // -------------------------------------------------------------------------
  function formatRemaining() {
    const diff = Math.max(0, expiresAt - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // -------------------------------------------------------------------------
  // ШЛЮЗ
  // -------------------------------------------------------------------------
  if (!hasAgreed) {
    return <Gate
      isChecked={isChecked}
      setIsChecked={setIsChecked}
      isTermsOpen={isTermsOpen}
      setIsTermsOpen={setIsTermsOpen}
      onAccept={handleAcceptRules}
      onContinue={() => setHasAgreed(true)}
    />;
  }

  const stepsData = INSTRUCTIONS[activeTab];
  const stepColor = stepsData.color === 'cyan' ? 'text-accent-cyan bg-cyan-400/10' : 'text-accent-violet bg-purple-400/10';

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight cursor-pointer select-none" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="text-gradient">HRZN2</span>
          </div>
          <nav className="hidden md:block">
            <div className="flex items-center gap-6">
              <a href="#instructions" className="text-slate-400 font-medium hover:text-white transition-colors">Инструкции</a>
              <a href="#how-it-works" className="text-slate-400 font-medium hover:text-white transition-colors">Как получить</a>
              <a href="#faq" className="text-slate-400 font-medium hover:text-white transition-colors">FAQ</a>
              <a href="#support" className="text-slate-400 font-medium hover:text-white transition-colors">Поддержка</a>
            </div>
          </nav>
          <a href="#get-key" className="btn-primary hidden sm:inline-flex !px-5 !py-2.5 !text-sm !font-bold">Получить ключ</a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-40 pb-24 px-6 text-center overflow-hidden">
        <div className="glow-purple top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px]"
          style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, rgba(0,0,0,0) 60%)' }} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 mb-6">
            <Zap size={14} className="text-accent-cyan" />
            Проверьте бесплатно за 2 часа — без регистрации
          </p>
          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
            Свобода за гранью <span className="text-gradient">горизонта.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Безопасный доступ к Telegram и всему интернету, когда всё остальное заблокировано.
            Стабильный сервис, который работает без остановок.
          </p>
          <div className="flex flex-col items-center gap-4">
            <a href="#get-key" className="btn-primary !text-xl !px-12 !py-5">Получить демо-ключ</a>
            <p className="text-sm text-slate-500">
              Без регистрации · Без банковской карты · Ключ за 5 секунд
            </p>
          </div>
        </motion.div>
      </section>

      {/* ДОВЕРИЕ / СТАБИЛЬНОСТЬ */}
      <section id="how-it-works" className="px-6 pb-24 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="card p-8 md:p-10 relative overflow-hidden">
            <div className="glow-purple top-[-100px] right-[-100px] w-[300px] h-[300px]"
              style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, rgba(0,0,0,0) 60%)' }} />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Server size={20} />
                </div>
                <h2 className="text-2xl font-extrabold">Сервис, который работает</h2>
              </div>
              <p className="text-slate-400 leading-relaxed mb-8 max-w-2xl">
                Наши серверы работают без перебоев месяцами. Ниже — пример реальной статистики аптайма:
                вы можете убедиться сами, что HRZN2 не «разовый» сервис, а стабильный оператор доступа.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile icon={<Server size={18} />} value="99.9%" label="аптайм серверов" />
                <StatTile icon={<Zap size={18} />} value="× 4" label="выше скорость" />
                <StatTile icon={<ShieldCheck size={18} />} value="No-Log" label="не храним логи" />
                <StatTile icon={<Globe size={18} />} value="RU/ЕС/Азия" label="серверы" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ИНСТРУКЦИИ */}
      <section id="instructions" className="px-6 pb-24 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4">Настройка в <span className="text-gradient">3 клика</span></h2>
          <p className="text-slate-400 text-center max-w-md mx-auto mb-10">
            11-минутная настройка не нужна. Установите приложение, получите ключ, вставьте его — и вы в сети.
          </p>

          <div className="flex justify-center gap-3 flex-wrap mb-8">
            <PlatformTab active={activeTab === 'ios'} onClick={() => setActiveTab('ios')}>
              <Apple size={18} /> Apple iOS
            </PlatformTab>
            <PlatformTab active={activeTab === 'android'} onClick={() => setActiveTab('android')}>
              <Smartphone size={18} /> Android
            </PlatformTab>
            <PlatformTab active={activeTab === 'pc'} onClick={() => setActiveTab('pc')}>
              <Monitor size={18} /> Windows / Mac
            </PlatformTab>
          </div>

          <div className="card p-8 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                <div className="flex flex-col gap-5">
                  {stepsData.steps.map((step, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-extrabold ${stepColor}`}>{i + 1}</div>
                      <p className="text-slate-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
                {stepsData.store && (
                  <div className="mt-8 flex justify-center">
                    <a href={stepsData.store} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-6 py-3 font-bold hover:opacity-90 transition-opacity no-underline">
                      {activeTab === 'ios' ? <Apple size={18} /> : <Smartphone size={18} />} {stepsData.storeLabel}
                    </a>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* CTA-БЛОК ВЫДАЧИ КЛЮЧА */}
      <section id="get-key" className="px-6 pb-24 scroll-mt-24">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl border border-purple-400/30 p-8 md:p-12 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(147, 51, 234, 0.12))', boxShadow: '0 10px 40px -10px rgba(168, 85, 247, 0.2)' }}>
            <h2 className="text-3xl font-black mb-3">Готовы проверить?</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Нажмите одну кнопку — ключ на 2 часа получите прямо здесь. Без карт и регистраций.
            </p>

            {keyStatus === 'NONE' && (
              <>
                <button onClick={handleGenerateKey} disabled={isGenerating} className="btn-primary !w-full !max-w-sm !py-5 !text-xl">
                  {isGenerating ? 'Генерация ключа...' : 'Получить демо-ключ'}
                </button>

                {/* Необязательное поле Telegram — привлечение в бота */}
                <div className="mt-6 max-w-sm mx-auto">
                  <button type="button" onClick={() => setShowTgField(v => !v)}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent-cyan transition-colors">
                    {showTgField ? <ChevronDown size={16} className="rotate-180" /> : <ChevronDown size={16} />}
                    Указать Telegram (необязательно)
                  </button>
                  <AnimatePresence>
                    {showTgField && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <input
                          type="text"
                          id="tg-contact"
                          name="tgContact"
                          value={tgContact}
                          onChange={(e) => setTgContact(e.target.value)}
                          placeholder="@username или числовой ID"
                          className="mt-3 w-full rounded-xl bg-black/30 border border-slate-700 px-4 py-3 text-white outline-none focus:border-accent-violet transition-colors"
                        />
                        <p className="mt-2 text-xs text-slate-500 text-left">
                          Пришлём ваш ключ сюда и поможем с настройкой. Можно пропустить.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {generateError && (
                  <p className="mt-4 text-red-300 font-medium">{generateError}</p>
                )}
              </>
            )}

            {keyStatus === 'ACTIVE' && (
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-accent-cyan mb-4">
                  <Check size={32} />
                </div>
                <h3 className="text-2xl font-extrabold mb-1">Ваш ключ готов!</h3>
                <p className="text-sm text-slate-400 mb-6">Ключ активен ещё {formatRemaining()}</p>

                <div className="w-full max-w-sm relative mb-5">
                  <input
                    type="text"
                    value={demoKey}
                    readOnly
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-xl bg-black/30 border border-slate-700 px-4 py-3 pr-12 text-slate-400 text-sm outline-none"
                  />
                  <button onClick={handleCopyKey} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-accent-violet hover:text-white transition-colors" aria-label="Скопировать ключ">
                    {isCopied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
                  </button>
                </div>

                <div className="rounded-2xl bg-white p-4 mb-6">
                  <QRCodeSVG value={demoKey} size={180} level="M" />
                  <p className="text-xs text-slate-400 mt-2">Отсканируйте камерой — ключ добавится сам</p>
                </div>

                <div className="w-full max-w-sm rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 mb-6">
                  <p className="text-sm text-red-200 leading-relaxed">
                    <strong>Внимание:</strong> ключ одноразовый и работает <strong>2 часа</strong>.
                    Подключитесь в приложении, а затем перейдите в Telegram, чтобы оформить подписку.
                  </p>
                </div>

                {/* Переход в бота сразу после ключа */}
                <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="btn-tg !w-full !max-w-sm">
                  <TelegramIcon size={22} />
                  Активировать подписку в Telegram
                </a>
                <p className="text-xs text-slate-500 mt-3">Подписка от 100 ₽/мес · Оплата картой, Stars или криптой</p>
              </div>
            )}

            {keyStatus === 'EXPIRED' && (
              <div className="flex flex-col items-center max-w-sm mx-auto">
                <div className="w-full rounded-xl border border-red-400/20 bg-red-500/10 px-5 py-4 mb-6">
                  <p className="text-red-200 font-medium">Ваш демо-ключ завершился. Продолжите в Telegram-боте.</p>
                </div>
                <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="btn-tg !w-full">
                  <TelegramIcon size={22} />
                  Оформить подписку в Telegram
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ПРЕИМУЩЕСТВА */}
      <BenefitSection />

      {/* FAQ */}
      <section id="faq" className="px-6 pb-24 scroll-mt-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-10">Частые вопросы</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((item) => <FaqItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ФИНАЛЬНЫЙ CTA */}
      <section id="support" className="px-6 pb-28 scroll-mt-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Стабильная сеть <span className="text-gradient">за гранью горизонта</span>
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Проверьте бесплатно прямо сейчас — 2 часа на знакомство.
          </p>
          <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="btn-tg !w-full !max-w-sm !text-lg">
            <TelegramIcon size={22} />
            Начать в Telegram
          </a>
          <p className="text-xs text-slate-500 mt-6">
            Вопросы по настройке — в наш бот: @{BOT_USERNAME}
          </p>
        </div>
      </section>

      {/* ФУТЕР */}
      <footer className="border-t border-slate-800 py-10">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="text-lg font-black tracking-[2px] text-slate-400">
            HRZN2 <span className="text-accent-cyan">NETWORK</span>
          </div>
          <button onClick={() => setIsTermsOpen(true)} className="text-sm text-slate-500 underline hover:text-slate-300 transition-colors">
            Пользовательское соглашение и Политика конфиденциальности
          </button>
          <div className="text-sm text-slate-600">© {new Date().getFullYear()} HRZN2 Network. Все права защищены.</div>
        </div>
      </footer>

      {/* Модалка соглашения */}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Шлюз
// ---------------------------------------------------------------------------
function Gate({ isChecked, setIsChecked, isTermsOpen, setIsTermsOpen, onAccept, onContinue }) {
  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="glow-purple top-[5%] left-1/2 -translate-x-1/2 w-[600px] h-[600px]"
        style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, rgba(0,0,0,0) 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 max-w-md w-full text-center"
      >
        <h1 className="text-6xl font-black leading-none mb-4 tracking-tight text-gradient">HRZN2<br />NETWORK</h1>
        <p className="text-slate-400 text-lg font-medium mb-10">Анонимный доступ за гранью горизонтов.</p>

        <label className="flex items-start gap-4 text-left rounded-2xl border border-white/5 bg-white/5 p-5 cursor-pointer transition-colors hover:bg-white/[0.07] mb-6">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-violet-600 cursor-pointer"
          />
          <span className="text-sm text-slate-300 leading-relaxed">
            Я принимаю{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); setIsTermsOpen(true); }}
              className="inline text-accent-cyan underline hover:text-accent-violet transition-colors">
              Правила сервиса и Пользовательское соглашение
            </button>
          </span>
        </label>

        <button onClick={onContinue} disabled={!isChecked} className="btn-primary !w-full !py-4 !text-lg !uppercase !tracking-wide">
          Продолжить
        </button>
      </motion.div>

      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} onAccept={onAccept} showAccept />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Модальное окно соглашения (без принудительного скролла)
// ---------------------------------------------------------------------------
function TermsModal({ isOpen, onClose, onAccept, showAccept }) {
  const scrollerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight <= 5) setScrolled(true);
  };

  useEffect(() => {
    if (isOpen && scrollerRef.current) {
      const { scrollHeight, clientHeight } = scrollerRef.current;
      if (scrollHeight <= clientHeight + 5) setScrolled(true);
      else setScrolled(false);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="terms-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="card flex max-h-[85vh] w-full max-w-[700px] flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-white/[0.02] px-6 py-4">
              <h2 className="text-lg font-extrabold">Соглашение и Политика конфиденциальности</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>

            <div ref={scrollerRef} onScroll={handleScroll} className="z-10 flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-300 leading-relaxed">
              <TermsContent />
            </div>

            {showAccept && (
              <div className="border-t border-slate-800 bg-white/[0.02] px-6 py-4">
                <button onClick={onAccept} disabled={!scrolled} className={`btn-primary !w-full ${scrolled ? '' : '!bg-slate-800 !text-slate-500'}`}>
                  {scrolled ? 'Я прочитал и согласен' : 'Прочитайте текст до конца'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TermsContent() {
  return (
    <>
      <h4 className="text-accent-cyan font-bold mb-2">1. Общие положения</h4>
      <p className="mb-4">Сервис «HRZN2 NETWORK» предоставляет услуги доступа к виртуальной частной сети (VPN) через Telegram-бота и Web-приложение по принципу «как есть». Пользоваться сервисом можно в объёме, разрешённом законодательством страны нахождения сервера.</p>

      <h4 className="text-accent-cyan font-bold mb-2">2. No-Log Policy</h4>
      <p className="mb-2">Мы не собираем, не храним и не передаём третьим лицам историю посещений, DNS-запросы, реальные IP или метаданные трафика.</p>
      <ul className="mb-4 list-disc pl-5">
        <li className="mb-1">Не требуем телефон или e-mail для Web-версии.</li>
        <li className="mb-1">Храним только анонимный Device-ID (или ваш Telegram ID) и статус подписки, необходимые для выдачи ключа.</li>
        <li>Данные удаляются, когда перестают быть нужны для целей обработки.</li>
      </ul>

      <h4 className="text-accent-cyan font-bold mb-2">3. Запрещённая деятельность</h4>
      <p className="mb-2">Запрещено использовать ресурсы сервиса для:</p>
      <ul className="mb-4 list-disc pl-5">
        <li className="mb-1">рассылки спама;</li>
        <li className="mb-1">DDoS-атак и попыток взлома;</li>
        <li className="mb-1">распространения вредоносного ПО и фишинга;</li>
        <li>доступа к материалам, нарушающим законодательство страны сервера.</li>
      </ul>
      <p className="mb-4">При фиксации подобных действий доступ аннулируется без возврата средств.</p>

      <h4 className="text-accent-cyan font-bold mb-2">4. Подписка и возврат</h4>
      <p className="mb-2">Оплата: картой, Telegram Stars, криптой. Услуга — 100% предоплата. После выдачи ключа услуга считается оказанной; возврат — только при подтверждённом техническом сбое.</p>
      <p className="mb-4">Демо-режим — один раз на аккаунт/устройство. Обход ограничения ведёт к блокировке.</p>

      <h4 className="text-accent-cyan font-bold mb-2">5. Ответственность</h4>
      <p className="mb-4">Пользователь несёт ответственность за действия с использованием его ключа. Сервис вправе приостановить доступ при аномальной активности. Стороны освобождаются от ответственности при форс-мажоре.</p>

      <h4 className="text-accent-cyan font-bold mb-2">6. Поддержка</h4>
      <p className="mb-4">Вопросы по работе, настройке и оплате — через официальную поддержку в Telegram.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Мелкие компоненты
// ---------------------------------------------------------------------------
function StatTile({ icon, value, label }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-white/[0.02] p-4 text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-accent-cyan">{icon}</div>
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function PlatformTab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-bold transition-all duration-200 cursor-pointer ${active ? 'bg-accent-violet/15 border border-accent-violet text-accent-violet' : 'bg-surface border border-border text-slate-500 hover:text-slate-300'}`}>
      {children}
    </button>
  );
}

function BenefitSection() {
  const benefits = [
    {
      icon: <Zap size={22} />, title: 'Скорость', text: 'Высокая скорость и низкий пинг — даже в Telegram, даже под блокировками.',
    },
    {
      icon: <Server size={22} />, title: 'Стабильность', text: 'Серверы работают без остановок. Это видно по аптайму — без «разовых» сервисов.',
    },
    {
      icon: <ShieldCheck size={22} />, title: 'No-Log', text: 'Не собираем и не храним ваши логи, IP и историю посещений.',
    },
    {
      icon: <Globe size={22} />, title: 'Все устройства', text: 'iOS, Android, Windows и macOS. Один ключ — на вашей платформе.',
    },
  ];
  return (
    <section className="px-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-10">Почему HRZN2</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="card p-6 flex gap-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-accent-cyan">
                {b.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">{b.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{b.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-bold hover:bg-white/[0.03] transition-colors cursor-pointer">
        <span>{q}</span>
        <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="px-6 pb-5 text-sm text-slate-400 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}