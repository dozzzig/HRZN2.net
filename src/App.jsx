import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import Landing from './pages/Landing';

export default function App() {
  const initDeviceId = useStore((state) => state.initDeviceId);

  // Инициализация Shadow Account при старте приложения
  useEffect(() => {
    initDeviceId();
  }, [initDeviceId]);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
