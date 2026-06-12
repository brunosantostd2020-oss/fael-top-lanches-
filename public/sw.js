// Service Worker mínimo — necessário para o site ser instalável como aplicativo.
// IMPORTANTE: sem cache! Tudo vai direto para a rede, então cada deploy
// chega na hora para todos os clientes (sem risco de versão velha presa).
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  // Passa direto para a rede (network-only)
  e.respondWith(fetch(e.request));
});
