// Service worker minimal — nécessaire pour que Chrome/Edge autorisent
// l'installation de l'app (icône dans la barre d'adresse).
// Ne fait pas de mise en cache agressive pour ne pas perturber
// la synchronisation temps réel des données médicales.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler minimal requis par les critères d'installabilité de Chrome.
// Laisse simplement passer toutes les requêtes normalement.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
