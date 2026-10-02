import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './field-design.css';
import { I18nProvider } from './i18n';
import { deferredFeature } from './components/deferredFeature';
import './features/farms/workspace.css';

const FarmWorkspace = deferredFeature(() => import('./features/farms/FarmWorkspace'));
const App = deferredFeature(() => import('./App'));
const farmRoute = ['/', '/farm', '/today', '/my-farm', '/register'].includes(window.location.pathname);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nProvider>
      {farmRoute ? <FarmWorkspace /> : <App />}
    </I18nProvider>
  </React.StrictMode>
);

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {
    // The online application remains usable when installation/storage is denied.
    console.warn('Offline shell installation is unavailable.');
  }));
}
