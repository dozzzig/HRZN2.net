// Заглушка: API для связи с панелью 3x-ui

export const fetchVpnKey = async (deviceId, planType) => {
  return new Promise((resolve) => {
    // Имитация сетевой задержки запроса к API
    setTimeout(() => {
      // Генерируем уникальный VLESS ключ с привязкой к устройству
      const uniqueId = deviceId.substring(0, 8);
      const mockKey = `vless://${deviceId}@h1.hrzn.net:443?type=tcp&security=reality&pbk=J8Mxyz_${uniqueId}_mock&fp=chrome&sni=yahoo.com&sid=a1b2c3d4&spx=%2F#HRZN2-${planType || 'DEMO'}`;
      
      resolve({
        success: true,
        key: mockKey
      });
    }, 800);
  });
};
