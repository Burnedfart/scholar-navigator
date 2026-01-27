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
// e.g. .../repo/sw.js -> .../repo/ -> .../repo/scramjet/
const swLocation = self.location.href;
const baseURL = swLocation.substring(0, swLocation.lastIndexOf('/') + 1);
const prefix = new URL("scramjet/", baseURL).pathname;
console.log('SW: 🔧 Computed prefix:', prefix);

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({
    prefix: prefix
});

async function handleRequest(event) {
    // Ensure config is loaded (defaults to constructor config if not reconfigured)
    await scramjet.loadConfig();

    let response;
    if (scramjet.route(event)) {
        response = await scramjet.fetch(event);
    } else {
        response = await fetch(event.request);
    }

    // Inject COOP/COEP headers into EVERY response
    // This is required because the main page is isolated, so iframes must be too.
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

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
