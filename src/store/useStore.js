import { create } from 'zustand';

// Функция генерации UUID (Shadow Account ID)
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useStore = create((set, get) => ({
  deviceId: null,
  isTgLinked: false,
  hasAgreed: false,
  subscription: null,
  isLoading: true,
  isPaid: false,
  vlessKey: null,

  initDeviceId: () => {
    let id = localStorage.getItem('hrzn_device_id');
    if (!id) {
      id = generateUUID();
      localStorage.setItem('hrzn_device_id', id);
    }
    
    const linked = localStorage.getItem('hrzn_tg_linked') === 'true';
    const agreed = localStorage.getItem('hrzn_has_agreed') === 'true';
    
    set({ deviceId: id, isTgLinked: linked, hasAgreed: agreed });
    
    // Сразу запрашиваем статус по Device-ID
    get().fetchSubscriptionStatus(id);
  },

  setHasAgreed: (agreed) => {
    localStorage.setItem('hrzn_has_agreed', agreed ? 'true' : 'false');
    set({ hasAgreed: agreed });
  },

  markTgLinked: () => {
    localStorage.setItem('hrzn_tg_linked', 'true');
    set({ isTgLinked: true });
  },

  setSubscription: (isPaid, vlessKey) => {
    set({ isPaid, vlessKey });
  },

  // Заглушка: запрос к промежуточному бэкенду
  fetchSubscriptionStatus: async (deviceId) => {
    set({ isLoading: true });
    
    // Имитация задержки сети
    setTimeout(() => {
      set({
        isLoading: false,
        subscription: {
          status: 'active',
          key: 'vless://8f4c2e6b-1234-5678-abcd-ef0123456789@h1.hrzn.net:443?type=tcp&security=reality&pbk=J8Mxyz...&fp=chrome&sni=yahoo.com&sid=a1b2c3d4&spx=%2F#Horizon-VPN',
          expire_date: '2026-06-01T00:00:00Z',
          remainingDays: 30
        }
      });
    }, 600);
  }
}));
