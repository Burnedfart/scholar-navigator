importScripts("./lib/scramjet/scramjet.all.js");


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

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({
    prefix: prefix,
    files: {
        wasm: new URL("./lib/scramjet/scramjet.wasm.wasm", baseURL).href,
        all: new URL("./lib/scramjet/scramjet.all.js", baseURL).href,
        sync: new URL("./lib/scramjet/scramjet.sync.js", baseURL).href,
    }
});

async function handleRequest(event) {
    const url = event.request.url;
    console.log(`SW: 🔍 Intercepted: ${url}`);

    // Ensure config is loaded
    await scramjet.loadConfig();

    let response;
    const isRouted = scramjet.route(event);
    console.log(`SW: 🤖 Routing decision: ${isRouted ? 'PROXY' : 'NETWORK'} for ${url}`);

    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Explicit debug of routing logic
    const manualMatch = path.startsWith(prefix);
    console.log(`SW: 🧐 Routing Check:`);
    console.log(`    Prefix:  '${prefix}'`);
    console.log(`    Path:    '${path}'`);
    console.log(`    Match?:  ${manualMatch}`);
    console.log(`    Scramjet.route(): ${isRouted}`);

    if (isRouted || manualMatch) {
        if (!isRouted && manualMatch) {
            console.warn("SW: ⚠️ Scramjet.route() returned false but manual check passed! Forcing proxy.");
        }
        try {
            response = await scramjet.fetch(event);
            console.log(`SW: ✅ Proxied response for ${url}`);
        } catch (err) {
            console.error(`SW: ❌ Proxy fetch failed for ${url}:`, err);
            // Fallback to fetch to see the 404 from server, or maybe return a custom error page
            response = await fetch(event.request);
        }
    } else {
        response = await fetch(event.request);
    }

    // Inject COOP/COEP headers into EVERY response
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
    console.log(`SW: 🔒 Injected isolation headers for ${url}`);

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
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
