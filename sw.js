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

// Create BareMux connection in service worker
// The transport is set by the window, but the SW needs to connect to the same SharedWorker
let bareMuxConnection;

async function setupBareMux() {
    try {
        // Get the scope URL to construct the correct path to bare-mux-worker.js
        const scope = self.registration.scope;
        const workerPath = new URL('uv/bare-mux-worker.js', scope).pathname;

        console.log('[SW] Connecting to BareMux worker at:', workerPath);

        if (typeof BareMux !== 'undefined') {
            bareMuxConnection = new BareMux.BareMuxConnection(workerPath);
            console.log('[SW] ✅ Connected to BareMux SharedWorker');
        } else {
            console.error('[SW] BareMux not available');
        }
    } catch (err) {
        console.error('[SW] Failed to connect to BareMux:', err);
    }
}

// Skip waiting to activate immediately
self.addEventListener('install', () => {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        (async () => {
            await self.clients.claim();
            await setupBareMux();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            const url = new URL(event.request.url);

            // Bypass Scramjet for static assets, bare-mux worker, and API endpoints
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
