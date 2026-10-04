import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import './styles/globals.css';

// Initialize theme
if (localStorage.getItem('et_theme') === 'light') {
  document.documentElement.classList.add('light-theme');
}

// Auto-recover from Vite dynamic import chunk mismatches after new deploys
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error, reloading latest app bundle...', event);
  window.location.reload();
});

// Register PWA service worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <SpeedInsights />
  </React.StrictMode>
);
