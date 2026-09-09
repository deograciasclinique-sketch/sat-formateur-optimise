/**
 * Service Worker — DEO GRACIAS / sat-formateur
 *
 * Objectif : rendre l'application installable tout en garantissant que les
 * utilisateurs voient TOUJOURS la dernière version publiée dès qu'ils ont
 * une connexion internet (stratégie "réseau prioritaire"), avec un repli
 * sur le cache uniquement en cas de coupure réseau.
 *
 * IMPORTANT : incrémentez CACHE_VERSION à chaque déploiement significatif
 * pour forcer le nettoyage des anciens caches sur tous les postes.
 */
const CACHE_VERSION = "v3";
const CACHE_NAME = `dg-clinique-${CACHE_VERSION}`;

// Installation : on n'attend pas l'ancien SW, on prend la main tout de suite.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activation : on supprime tous les anciens caches d'une version précédente
// et on prend le contrôle immédiat de tous les onglets ouverts.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Stratégie "réseau prioritaire" : on tente toujours le réseau en premier
// pour être sûr d'avoir la dernière version du code. On ne se rabat sur le
// cache que si la requête réseau échoue (pas de connexion).
self.addEventListener("fetch", (event) => { const { request } = event; // On ne gère que les requêtes GET (les autres, ex: POST vers Firebase, // doivent passer directement par le réseau sans interception). if (request.method !== "GET") return; // On laisse TOUJOURS passer les requêtes vers Firebase/Google directement // au réseau, sans interception ni mise en cache : ce sont des connexions // temps réel (Firestore, Auth) qui ne doivent jamais être mises en cache. const url = new URL(request.url); if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("firebaseio.com")) { return; }


  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        // On met à jour le cache en arrière-plan avec la version fraîche.
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        // Pas de réseau : on sert la dernière copie connue si elle existe.
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});

// Permet à la page (main.tsx) de demander l'activation immédiate d'une
// nouvelle version dès qu'elle est détectée, sans attendre la fermeture
// de tous les onglets.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
