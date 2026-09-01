import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enregistre le service worker requis pour que l'app soit "installable"
// (icône d'installation dans le navigateur / sur PC), avec une stratégie
// réseau-prioritaire : toute nouvelle version publiée est détectée et
// appliquée automatiquement, sans que l'utilisateur reste bloqué sur une
// ancienne version en cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Vérifie s'il existe une mise à jour dès le chargement, puis
      // régulièrement (toutes les 30 minutes) pendant que l'app est ouverte.
      registration.update().catch(() => {});
      setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Une nouvelle version est prête : on l'active immédiatement.
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(() => {
      // Échec silencieux — l'app fonctionne normalement même sans installation possible.
    });

    // Dès que le nouveau service worker prend le contrôle, on recharge la
    // page une seule fois pour afficher la nouvelle version à jour.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
