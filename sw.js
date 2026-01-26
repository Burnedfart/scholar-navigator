/*
 * Ultraviolet Service Worker Registration Handler
 * This SW intercepts all requests and routes them through Ultraviolet
 */
importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            // Check if this request should be handled by UV
            if (uv.route(event)) {
                return await uv.fetch(event);
            }
            // Otherwise, pass through to normal fetch
            return await fetch(event.request);
        })()
    );
});
