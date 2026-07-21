const CACHE_NAME = 'chatbot-militar-v1';
const STATIC_ASSETS = [
  '/html/index.html',
  '/html/buscador.html',
  '/html/resultados.html',
  '/html/instrucciones.html',
  '/html/emergencia.html',
  '/html/panel.html',
  '/html/admin.html',
  '/html/medicos.html',
  '/html/registro.html',
  '/html/login_admin.html',
  '/js/api.js',
  '/js/db-local.js',
  '/js/sync.js',
  '/js/buscador.js',
  '/js/resultados.js',
  '/js/instrucciones.js',
  '/js/emergencia.js',
  '/js/panel.js',
  '/js/admin.js',
  '/js/medicos.js',
  '/js/registro.js',
  '/js/login_admin.js',
  '/js/gestures.js',
  '/styles/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('Cache addAll failed:', err);
        return Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url).catch(() => null))
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('/html/index.html');
        }
      });
    })
  );
});
