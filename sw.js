/*
 * Scramjet Proxy Service Worker
 * Intercepts requests and routes them through the Scramjet engine
 */

// Import Scramjet core files from CDN
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.codecs.js');
importScripts('js/scramjet.config.js');
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.bundle.js');
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            // Bypass Scramjet for static assets and API endpoints
            const url = new URL(event.request.url);
            if (url.pathname.includes('/js/') || url.pathname.includes('/css/') || url.pathname.startsWith('/api/')) {
                return await fetch(event.request);
            }

            // Check if this request should be handled by Scramjet
            if (scramjet.route(event)) {
                return await scramjet.fetch(event);
            }
            // Otherwise, pass through to normal fetch
            return await fetch(event.request);
        })()
    );
});
