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

// Calculate prefix relative to SW location to ensure routing works immediately
// Using 'lib/scramjet/' to match physical directory
const swLocation = self.location.href;
const baseURL = swLocation.substring(0, swLocation.lastIndexOf('/') + 1);
const prefix = new URL("lib/scramjet/", baseURL).pathname;
console.log('SW: 🔧 Computed prefix:', prefix);

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
    scramjet = new ScramjetServiceWorker({
        prefix: prefix,
        wisp: (self.location.protocol === "https:" ? "wss" : "ws") + "://my-site.boxathome.net/wisp/",
        transport: {
            path: new URL("./lib/libcurl/index.mjs", baseURL).href,
        },
        files: {
            wasm: new URL("./lib/scramjet/scramjet.wasm.wasm", baseURL).href,
            all: new URL("./lib/scramjet/scramjet.all.js", baseURL).href,
            sync: new URL("./lib/scramjet/scramjet.sync.js", baseURL).href,
        }
    });
} else {
    console.error('SW: ❌ Scramjet bundle not found! __scramjet$bundle is undefined.');
}

async function handleRequest(event) {
    const url = event.request.url;

    // Failsafe: if scramjet failed to initialize, fall back to network immediately
    if (!scramjet) {
        return fetch(event.request);
    }

    try {
        // Ensure config is loaded (wrapped in try/catch to prevent SW crash)
        try {
            await scramjet.loadConfig();
        } catch (configErr) {
            console.warn(`SW: ⚠️ Failed to load config for ${url}, falling back to network:`, configErr);
            return fetch(event.request);
        }

        const isRouted = scramjet.route(event);
        console.log(`SW: 🤖 Routing decision: ${isRouted ? 'PROXY' : 'NETWORK'} for ${url}`);

        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const manualMatch = path.startsWith(prefix);

        if (isRouted || manualMatch) {
            try {
                const response = await scramjet.fetch(event);

                // Inject COOP/COEP headers into proxied response
                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status === 0 ? 200 : response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            } catch (proxyErr) {
                console.error(`SW: ❌ Proxy fetch failed for ${url}:`, proxyErr);
                // Return a clear error response instead of crashing
                return new Response(
                    `<h1>Proxy Error</h1><p>Failed to fetch: ${url}</p><pre>${proxyErr.toString()}</pre>`,
                    { status: 500, headers: { 'Content-Type': 'text/html' } }
                );
            }
        }

        // Standard network request
        const response = await fetch(event.request);

        // Inject COOP/COEP headers into EVERY response (needed for SharedArrayBuffer)
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
    } catch (globalErr) {
        console.error(`SW: 💥 Fatal error handling ${url}:`, globalErr);
        return fetch(event.request);
    }
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});


self.addEventListener("message", async (event) => {
    if (event.data && event.data.type === 'config') {
        console.log('SW: Received config', event.data.config);
        try {
            await scramjet.configure(event.data.config);
            console.log('SW: Scramjet configured successfully');
        } catch (err) {
            console.error('SW: Configuration failed', err);
        }
    }
});
