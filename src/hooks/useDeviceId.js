import { useState, useEffect } from 'react';

const STORAGE_KEY = 'hrzn_device_id';
const TG_LINKED_KEY = 'hrzn_tg_linked';

/**
 * Generates a UUID v4 without external dependencies.
 * Uses crypto.randomUUID() when available (modern browsers),
 * falls back to manual construction for older environments.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 compliant UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hook that returns a stable Device ID persisted in localStorage.
 * On first visit, a UUID is generated and saved silently.
 * Subsequent visits reuse the same ID — this is the "Shadow Account".
 *
 * @returns {{ deviceId: string, isTgLinked: boolean, markTgLinked: () => void }}
 */
export function useDeviceId() {
  const [deviceId, setDeviceId] = useState('');
  const [isTgLinked, setIsTgLinked] = useState(false);

  useEffect(() => {
    // Retrieve existing ID or create a new one
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    setDeviceId(id);

    // Check if Telegram was previously linked
    const linked = localStorage.getItem(TG_LINKED_KEY) === 'true';
    setIsTgLinked(linked);
  }, []);

  /** Call this after successful Telegram bind confirmation from backend */
  const markTgLinked = () => {
    localStorage.setItem(TG_LINKED_KEY, 'true');
    setIsTgLinked(true);
  };

  return { deviceId, isTgLinked, markTgLinked };
}
