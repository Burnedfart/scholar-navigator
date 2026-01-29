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
self.addEventListener('install', (event) => {
    console.log('SW: 📥 Installing version 10 (WASM rewriter fix)...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('SW: ⚡ Activating and claiming clients...');
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Clear old caches to prevent stale content issues
            caches.keys().then(names => {
                return Promise.all(
                    names.map(name => {
                        if (name !== CACHE_NAME) {
                            console.log(`SW: 🗑️ Deleting old cache: ${name}`);
                            return caches.delete(name);
                        }
                    })
                );
            })
        ])
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
const CACHE_NAME = 'scramjet-proxy-cache-v10'; // WASM rewriter fix
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

    // If scramjet hasn't been initialized yet, pass through all requests
    if (!scramjet) {
        console.warn(`SW: ⚠️ Scramjet not ready. Passing through: ${url}`);
        return fetch(event.request);
    }

    try {
        // CRITICAL: If the main page hasn't finished its setup, DO NOT touch the DB.
        // This prevents deadlocks during DB deletion/rebuilds.
        if (!scramjetConfigLoaded) {
            console.log(`SW: ⏳ Waiting for init_complete signal. Passing through: ${url}`);
            return fetch(event.request);
        }

        // Check if this request should be proxied
        if (scramjet.route(event)) {
            // console.log(`SW: 🚀 PROXY for ${url}`);

            // PERFORMANCE: Use cache-first strategy for static resources
            if (isStaticResource(url)) {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request);

                if (cachedResponse) {
                    // console.log(`SW: 💾 Cache HIT for ${url}`);
                    // Return cached, but update cache in background
                    event.waitUntil(
                        scramjet.fetch(event).then(response => {
                            if (response.ok) {
                                cache.put(event.request, response.clone());
                            }
                        }).catch(() => { })
                    );
                    return cachedResponse;
                }
            }

            const response = await scramjet.fetch(event);

            // CRITICAL: Detect iframe context to determine header strategy
            const fetchDest = event.request.headers.get('Sec-Fetch-Dest');
            const isIframe = fetchDest === 'iframe' || fetchDest === 'embed';

            // Strip restrictive headers from proxied content
            // This is ESSENTIAL for sites like Coolmathgames to work in iframe mode
            let newHeaders = stripRestrictiveHeaders(response.headers);

            // PERFORMANCE: Only inject COOP/COEP on navigation requests
            // BUT: CRITICAL: Scramjet WASM needs COEP to load in workers
            if (isNavigationRequest) {
                if (isIframe) {
                    // IFRAME MODE: Remove COEP/COOP (can't achieve isolation in embeds)
                    newHeaders.delete("Cross-Origin-Embedder-Policy");
                    newHeaders.delete("Cross-Origin-Opener-Policy");
                    console.log('SW: 🖼️ Iframe - Removed COEP/COOP');
                } else {
                    // STANDALONE: credentialless = WASM works + resources load
                    // This allows Scramjet's WASM rewriter to load in workers
                    newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    console.log('SW: 🔒 Standalone - COEP: credentialless');
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
        // console.log(`SW: 🌐 NETWORK for ${url}`);

        // PERFORMANCE: Cache app's own static files
        if (isStaticResource(url)) {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(event.request);

            if (cachedResponse) {
                // console.log(`SW: 💾 Cache HIT for ${url}`);
                return cachedResponse;
            }

            const response = await fetch(event.request);
            if (response.ok) {
                cache.put(event.request, response.clone());
            }
            return response;
        }

        // PERFORMANCE: Only inject isolation headers on navigation requests for app
        const response = await fetch(event.request);

        if (isNavigationRequest) {
            const newHeaders = new Headers(response.headers);

            // Detect iframe context
            const fetchDest = event.request.headers.get('Sec-Fetch-Dest');
            const isIframe = fetchDest === 'iframe' || fetchDest === 'embed';

            if (isIframe) {
                // IFRAME MODE: Relax ALL isolation headers for the main app too
                newHeaders.delete("Cross-Origin-Embedder-Policy");
                newHeaders.delete("Cross-Origin-Opener-Policy");
                console.log('SW: 🖼️ Iframe detected (App) - Removed COEP/COOP');
            } else {
                // STANDALONE MODE: Enforce isolation
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            }

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

// Listen for messages from main page
self.addEventListener('message', async (event) => {
    if (event.data?.type === 'init_complete') {
        console.log('SW: 📨 Received init_complete signal');

        // NOW it's safe to create the ScramjetServiceWorker instance
        if (!scramjet && scramjetBundle) {
            const { ScramjetServiceWorker } = scramjetBundle;
            scramjet = new ScramjetServiceWorker();
            console.log('SW: ✅ ScramjetServiceWorker created');
        }

        await ensureConfigLoaded();
    } else if (event.data?.type === 'invalidate_config') {
        scramjetConfigLoaded = false;
        // Force close database handle to allow deletion
        if (scramjet && scramjet.db) {
            try { scramjet.db.close(); } catch (e) { }
        }
        console.log('SW: 🔄 Config invalidated and DB handle closed');
    }
});