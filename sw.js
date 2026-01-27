/*
 * Scramjet Proxy Service Worker
 * Intercepts requests and routes them through the Scramjet engine
 */

// Import required scripts
importScripts('uv/bare-mux.js');
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.codecs.js');
importScripts('js/scramjet.config.js');
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.bundle.js');
importScripts('https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

// Initialize BareMux transport in the service worker
async function initTransport() {
    const bareServerUrl = 'https://my-site.boxathome.net/bare/';
    const transportPath = 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-as-module3@2.2.5/dist/index.mjs';

    if (typeof BareMux !== 'undefined') {
        try {
            // Get the worker path relative to service worker location
            const swUrl = new URL(self.registration.scope);
            const muxWorkerPath = swUrl.pathname + 'uv/bare-mux-worker.js';

            console.log('[SW] Initializing BareMux with worker:', muxWorkerPath);
            const connection = new BareMux.BareMuxConnection(muxWorkerPath);

            await connection.setTransport(transportPath, [bareServerUrl]);
            console.log('[SW] ✅ Transport configured in service worker');
        } catch (err) {
            console.error('[SW] ❌ Failed to set transport in SW:', err);
        }
    } else {
        console.warn('[SW] BareMux not available in service worker');
    }
}

// Initialize transport when the service worker activates
self.addEventListener('activate', (event) => {
    event.waitUntil(initTransport());
});

// Also try to init on install (in case activate already happened)
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            const url = new URL(event.request.url);

            // Bypass Scramjet for static assets and API endpoints
            if (url.pathname.includes('/js/') ||
                url.pathname.includes('/css/') ||
                url.pathname.includes('/uv/') ||
                url.pathname.startsWith('/api/')) {
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
