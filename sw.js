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
const VERSION = 'v19'; // Logo Color Fix Update

self.addEventListener('install', (event) => {
    console.log(`SW: 📥 Installing version ${VERSION}...`);
    self.skipWaiting();
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

// Cache name for static resources
const CACHE_NAME = 'scramjet-proxy-cache-v19'; // Logo Fix Update
const STATIC_CACHE_PATTERNS = [
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.png$/,
    /\.jpg$/,
    /\.svg$/,
    /\.ico$/,
];

// Check if URL matches static resource patterns
function isStaticResource(url) {
    return STATIC_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// Strip headers that prevent embedding and restrict content
// Critical for sites like Coolmathgames to work in iframe
function stripRestrictiveHeaders(headers) {
    const newHeaders = new Headers(headers);

    // CSP headers - these are the main culprits for blocking content
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('Content-Security-Policy-Report-Only');

    // Frame-related headers - prevent iframe embedding
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Frame-Options');

    // Additional restrictive headers
    newHeaders.delete('X-Content-Type-Options'); // Can interfere with resource loading

    return newHeaders;
}

// PERFORMANCE: Load config ONCE at startup, not on every request
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

// DON'T load config immediately - wait for main page to initialize database first
// ensureConfigLoaded(); // REMOVED - causes race condition

async function handleRequest(event) {
    const url = event.request.url;
    const isNavigationRequest = event.request.mode === 'navigate' || event.request.destination === 'document';
    const fetchDest = event.request.headers.get('Sec-Fetch-Dest');
    const isIframe = fetchDest === 'iframe' || fetchDest === 'embed';

    // If scramjet hasn't been initialized yet, pass through all requests
    if (!scramjet || !scramjetConfigLoaded) {
        // CRITICAL: Check if this is a URL that SHOULD be proxied.
        // On GitHub Pages, proxied URLs start with our origin but contain '/service/'
        // We look for '/service/' and 'http' to be extra sure (handles encoded strings too)
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
        // Check if this request should be proxied
        if (scramjet.route(event)) {
            // console.log(`SW: 🚀 PROXY for ${url}`);

            // Catch top-level navigations (native tabs) and redirect to our Shell
            // Scramjet adds "Inception-Guard: 1" to iframe/AJAX requests.
            // If this header is missing AND it's a document/navigate request, it's a new native tab.
            const isTopLevel = isNavigationRequest && fetchDest === 'document';
            const hasInceptionGuard = event.request.headers.get('Inception-Guard') === '1';

            // Secondary check: Referrer check as fallback
            const referrer = event.request.referrer || '';
            const isFromOurShell = referrer.includes('index.html') || referrer.includes('/proxy/');

            if (isTopLevel && !hasInceptionGuard && !isFromOurShell && !isIframe) {
                console.log(`SW: 🔄 Top-level proxy navigation detected (New Tab): ${url}`);

                let targetUrl = url;
                try {
                    const prefix = scramjet.config.prefix;
                    if (url.includes(prefix)) {
                        const pathAfterPrefix = url.split(prefix)[1] || '';
                        if (pathAfterPrefix.startsWith('http')) {
                            targetUrl = decodeURIComponent(pathAfterPrefix);
                        } else {
                            const parts = pathAfterPrefix.split('/');
                            const encodedPart = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
                            if (encodedPart && self.__scramjet$codecs && self.__scramjet$codecs.xor) {
                                targetUrl = self.__scramjet$codecs.xor.decode(encodedPart);
                            }
                        }
                    }
                } catch (e) { /* fallback to proxied url */ }

                const shellUrl = new URL('./index.html', self.location.href);
                shellUrl.searchParams.set('url', targetUrl);

                console.log(`SW: 🚀 Redirecting new tab to shell: ${shellUrl.href}`);
                return Response.redirect(shellUrl.href, 302);
            }

            // PERFORMANCE: Use cache-first strategy for static resources
            if (isStaticResource(url)) {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
            }

            const response = await scramjet.fetch(event);

            // Strip restrictive headers from proxied content
            let newHeaders = stripRestrictiveHeaders(response.headers);

            // PERFORMANCE: Only inject COOP/COEP on navigation requests
            if (isNavigationRequest) {
                if (isIframe) {
                    newHeaders.delete("Cross-Origin-Embedder-Policy");
                    newHeaders.delete("Cross-Origin-Opener-Policy");
                } else {
                    newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                }
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
                newHeaders.delete("Cross-Origin-Embedder-Policy");
                newHeaders.delete("Cross-Origin-Opener-Policy");
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