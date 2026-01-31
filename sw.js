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

// Bump to force cache refresh
const VERSION = 'v32'; // Syntax Fix for Iframe Permissions
const CACHE_NAME = 'scramjet-proxy-cache-v32';

self.addEventListener('install', (event) => {
    console.log(`SW: 📥 Installing version ${VERSION}...`);
});

self.addEventListener('activate', (event) => {
    console.log('SW: ⚡ Activating and claiming clients...');
    // Clear old caches to force UI updates
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

let scramjet = null; // Will be created later
let scramjetConfigLoaded = false;

// Store the bundle for later instantiation
let scramjetBundle;
if (typeof self.$scramjetLoadWorker === 'function') {
    scramjetBundle = self.$scramjetLoadWorker();
} else if (self.__scramjet$bundle) {
    scramjetBundle = self.__scramjet$bundle;
}

if (!scramjetBundle) {
    console.error('SW: ❌ Scramjet bundle not found! __scramjet$bundle is undefined.');
}


const STATIC_CACHE_PATTERNS = [
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.png$/,
    /\.jpg$/,
    /\.svg$/,
    /\.ico$/,
    /\.wasm$/,
];

function isStaticResource(url) {
    return STATIC_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

function stripRestrictiveHeaders(headers) {
    const newHeaders = new Headers(headers);

    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('Content-Security-Policy-Report-Only');

    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Frame-Options');

    newHeaders.delete('X-Content-Type-Options');

    return newHeaders;
}

async function ensureConfigLoaded() {
    if (!scramjetConfigLoaded && scramjet) {
        try {
            await scramjet.loadConfig();
            scramjetConfigLoaded = true;
            console.log('SW: ✅ Config loaded (one-time)');
        } catch (err) {
            console.warn('SW: ⚠️ Failed to load config:', err);
        }
    }
}

async function handleRequest(event) {
    const url = event.request.url;
    const isNavigationRequest = event.request.mode === 'navigate' || event.request.destination === 'document';
    const fetchDest = event.request.headers.get('Sec-Fetch-Dest');
    const isIframe = fetchDest === 'iframe' || fetchDest === 'embed';

    // If scramjet hasn't been initialized yet, pass through all requests
    if (!scramjet || !scramjetConfigLoaded) {
        const isProxied = url.includes('/service/') && (url.includes('http%3A') || url.includes('http:'));
        const isExternal = url.startsWith('http') && !url.startsWith(self.location.origin);

        if (isProxied || isExternal) {
            console.warn(`SW: ⏳ Proxy not ready for URL: ${url}. showing loading state...`);
            return new Response(`
                <html><body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;color:#eee;text-align:center;">
                    <div style="border:4px solid #333;border-top:4px solid #0078d4;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
                    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                    <h2 style="margin:0;">Initializing Proxy</h2>
                    <p style="opacity:0.7;">Securing your connection...</p>
                    <script>setTimeout(() => location.reload(), 2000);</script>
                </body></html>
            `, { status: 503, headers: { 'Content-Type': 'text/html' } });
        }

        console.log(`SW: ⏩ Handling as app resource: ${url}`);
        return fetch(event.request);
    }
    try {
        if (url.includes('/lib/scramjet/') || url.includes('scramjet.wasm')) {
            return fetch(event.request);
        }

        if (scramjet.route(event)) {
            // console.log(`SW: 🚀 PROXY for ${url}`);

            if (isStaticResource(url)) {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
            }

            const response = await scramjet.fetch(event);

            let newHeaders = stripRestrictiveHeaders(response.headers);

            if (isNavigationRequest) {
                // All documents MUST have these headers to work in our isolated environment
                // If we delete them for iframes, the browser might sandbox or block them.
                newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            }

            const modifiedResponse = new Response(response.body, {
                status: response.status === 0 ? 200 : response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });

            // Cache static resources
            if (isStaticResource(url) && response.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, modifiedResponse.clone());
            }

            return modifiedResponse;
        }

        // Standard network request for app files
        if (isStaticResource(url)) {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) return cachedResponse;

            const response = await fetch(event.request);
            if (response.ok) {
                cache.put(event.request, response.clone());
            }
            return response;
        }

        const response = await fetch(event.request);

        if (isNavigationRequest) {
            const newHeaders = new Headers(response.headers);
            // isIframe is defined above

            if (isIframe) {
                newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            } else {
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            }

            return new Response(response.body, {
                status: response.status === 0 ? 200 : response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }

        return response;
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

// Helper to safely convert buffer to base64 without stack overflow
function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
    }
    return btoa(binary);
}

// Listen for messages from main page
self.addEventListener('message', async (event) => {
    if (event.data === 'skipWaiting') {
        console.log('SW: 🚀 Skipping waiting on user request');
        self.skipWaiting();
        return;
    }

    if (event.data?.type === 'init_complete') {
        console.log('SW: 📨 Received init_complete signal');

        const config = event.data.config;

        // NOW it's safe to create the ScramjetServiceWorker instance
        if (!scramjet && scramjetBundle) {
            const { ScramjetServiceWorker } = scramjetBundle;
            scramjet = new ScramjetServiceWorker(config);
            console.log('SW: ✅ ScramjetServiceWorker created with config');
        } else if (scramjet && config) {
            scramjet.config = config;
            console.log('SW: 🔄 Scramjet config updated');
        }

        await ensureConfigLoaded();

        // Pre-load WASM rewriter in Service Worker context
        console.log('SW: 📦 Pre-loading WASM rewriter...');
        try {
            // Use config path if available, else fallback to relative
            const wasmUrl = (config?.files?.wasm) || new URL("./lib/scramjet/scramjet.wasm.wasm", self.location.href).href;
            console.log(`SW: 🔍 Fetching WASM from: ${wasmUrl}`);

            const wasmResponse = await fetch(wasmUrl);
            if (!wasmResponse.ok) throw new Error(`WASM fetch failed: ${wasmResponse.status}`);
            const wasmBuffer = await wasmResponse.arrayBuffer();

            // Store in global for Scramjet to use (SAFE METHOD)
            self.WASM = bufferToBase64(wasmBuffer);
            console.log(`SW: ✅ WASM loaded safely (${(wasmBuffer.byteLength / 1024).toFixed(1)} KB)`);
        } catch (wasmErr) {
            console.warn('SW: ⚠️ WASM pre-load failed (will lazy-load):', wasmErr);
        }
    } else if (event.data?.type === 'invalidate_config') {
        scramjetConfigLoaded = false;
        // Force close database handle to allow deletion
        if (scramjet && scramjet.db) {
            try { scramjet.db.close(); } catch (e) { }
        }
        console.log('SW: 🔄 Config invalidated and DB handle closed');
    }
});