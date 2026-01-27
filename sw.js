try {
    importScripts("./lib/scramjet/scramjet.all.js");
    console.log('SW: ✅ Scramjet script imported locally');
} catch (e) {
    console.warn('SW: ⚠️ Failed to import local Scramjet script, trying CDN:', e);
    try {
        // Fallback to jsDelivr (GitHub source) which supports CORP
        importScripts("https://cdn.jsdelivr.net/gh/MercuryWorkshop/scramjet@2.0.0-alpha/dist/scramjet.all.js");
        console.log('SW: ✅ Scramjet script imported via CDN');
    } catch (cdnErr) {
        console.error('SW: ❌ Failed to import Scramjet script from CDN:', cdnErr);
    }
}

// Ensure immediate control
self.addEventListener('install', () => {
    self.skipWaiting();
    console.log('SW: ⏩ Skipped waiting');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log('SW: ⚡ Clients claimed');
});

// Scramjet 2.0.0-alpha defines $scramjetLoadWorker on globalThis
let scramjetBundle;
if (typeof self.$scramjetLoadWorker === 'function') {
    scramjetBundle = self.$scramjetLoadWorker();
} else if (self.__scramjet$bundle) {
    scramjetBundle = self.__scramjet$bundle;
}

let scramjet;
if (scramjetBundle) {
    const { ScramjetServiceWorker } = scramjetBundle;
    // CRITICAL: Match official demo - NO constructor options!
    // ScramjetServiceWorker gets config via loadConfig() from main page's BareMux
    scramjet = new ScramjetServiceWorker();
    console.log('SW: ✅ ScramjetServiceWorker created (no options - uses BareMux config)');
} else {
    console.error('SW: ❌ Scramjet bundle not found! __scramjet$bundle is undefined.');
}

async function handleRequest(event) {
    const url = event.request.url;

    // Failsafe: if scramjet failed to initialize, fall back to network immediately
    if (!scramjet) {
        console.warn(`SW: ⚠️ Scramjet not ready. Passing through: ${url}`);
        return fetch(event.request);
    }

    try {
        // Load config from main page's BareMux connection
        await scramjet.loadConfig();

        // Check if this request should be proxied
        if (scramjet.route(event)) {
            console.log(`SW: 🤖 PROXY for ${url}`);
            const response = await scramjet.fetch(event);

            // Inject COOP/COEP headers for SharedArrayBuffer support
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(response.body, {
                status: response.status === 0 ? 200 : response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }

        // Standard network request - still inject COOP/COEP for all responses
        console.log(`SW: 🤖 NETWORK for ${url}`);
        const response = await fetch(event.request);

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

        try {
            return new Response(response.body, {
                status: response.status === 0 ? 200 : response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        } catch (wrapErr) {
            // Opaque responses cannot be wrapped
            return response;
        }
    } catch (err) {
        console.error(`SW: ❌ Error handling ${url}:`, err);
        return new Response(
            `<h1>Proxy Error</h1><p>Failed to fetch: ${url}</p><pre>${err.toString()}</pre>`,
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        );
    }
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});


// Message listener removed - scramjet.configure() doesn't exist in 2.0.0-alpha
// Configuration is handled via loadConfig() which reads from BareMux
