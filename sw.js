// sw.js - Service Worker

const CACHE_NAME = 'variable-remuneration-calculator-v13';
const urlsToCache = [
    './',
    './index.html',
    './bundle.js',
    './manifest.json',
    './css/base.css',
    './css/components.css',
    './css/layout.css',
    './css/responsive.css',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Usamos un addAll más robusto que no falle si una URL externa falla
                return Promise.allSettled(
                    urlsToCache.map(url => cache.add(url))
                );
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Solo cacheamos peticiones GET y evitamos extensiones de navegador
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(err => {
                    console.error('SW fetch failed:', err);
                    return cachedResponse;
                });

            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
