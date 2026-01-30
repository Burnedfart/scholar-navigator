window.ProxyService = {
    initialized: false,
    ready: null, // Promise
};

window.ProxyService.ready = new Promise(async (resolve, reject) => {
    try {
        // INCEPTION GUARD: Don't initialize proxy in Scramjet-created iframes
        // EXCEPT: Allow if parent is about:blank (our intentional cloak)
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            let isAboutBlankCloak = false;
            try {
                isAboutBlankCloak = window.parent.location.href === 'about:blank';
            } catch (e) {
                // Cross-origin error means it's not our cloak
                isAboutBlankCloak = false;
            }

            if (!isAboutBlankCloak) {
                console.log('🖼️ [PROXY] Inception detected - running in iframe. Skipping initialization.');
                // Mark as "initialized" to prevent errors in browser.js
                window.ProxyService.initialized = true;
                resolve(true);
                return; // CRITICAL: Stop all initialization
            } else {
                console.log('🔐 [PROXY] Running in about:blank cloak - initialization allowed');
            }
        }

        // Signal to error handler that initialization has started
        if (window.ErrorHandler) {
            window.ErrorHandler.startTimeout();
        }

        console.log('🔧 [PROXY] Starting initialization...');

        // 1. PRE-FLIGHT HEALTH CHECK (NEW)
        if (window.StorageHealth) {
            console.log('🔍 [PROXY] Running pre-flight storage health check...');
            const healthResult = await window.StorageHealth.performHealthCheck();

            if (!healthResult.healthy && !healthResult.autoFixed) {
                throw new Error(`Storage health check failed: ${healthResult.issues.join(', ')}`);
            }

            if (healthResult.autoFixed) {
                console.log('🔧 [PROXY] Storage issues auto-fixed, proceeding with clean state');
            }
        } else {
            console.warn('⚠️ [PROXY] Storage health module not loaded, skipping pre-flight check');
        }

        // 2. Calculate Base Paths
        window.APP_BASE_URL = new URL("./", window.location.href).href;
        window.SCRAMJET_PREFIX = new URL("./service/", window.APP_BASE_URL).pathname;

        // 3. Register Service Worker with improved options
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker not supported');
        }

        const registration = await navigator.serviceWorker.register('./sw.js', {
            scope: './',
            updateViaCache: 'none'  // Prevent cache issues on updates
        });
        console.log('✅ [SW] Registered:', registration.scope);

        // Handle Service Worker Updates
        const showUpdatePrompt = (waitingWorker) => {
            const banner = document.getElementById('update-banner');
            const updateBtn = document.getElementById('update-btn');
            const closeBtn = document.getElementById('update-close-btn');

            if (banner && updateBtn) {
                banner.classList.remove('hidden');
                updateBtn.onclick = () => {
                    waitingWorker.postMessage('skipWaiting');
                    banner.classList.add('hidden');
                };
                if (closeBtn) {
                    closeBtn.onclick = () => banner.classList.add('hidden');
                }
            }
        };

        // 1. If there's already a waiting worker, show prompt immediately
        if (registration.waiting) {
            console.log('🔄 [SW] New version already waiting');
            showUpdatePrompt(registration.waiting);
        }

        // 2. If a new worker is found, listen for it to be installed
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('🔄 [SW] Update found, installing...');
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('🔄 [SW] Update installed and waiting');
                    showUpdatePrompt(newWorker);
                }
            });
        });

        // 3. When the new worker takes control, reload the page
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('⚡ [SW] Controller changed, reloading...');
            window.location.reload();
        });

        // Wait for SW to be ready with timeout
        await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Service Worker ready timeout')), 5000)
            )
        ]);
        console.log('✅ [SW] Ready and Active');

        // 3. Handle Cross-Origin Isolation
        if (!window.crossOriginIsolated && window.isSecureContext) {
            if (!sessionStorage.getItem('coi_reloaded')) {
                sessionStorage.setItem('coi_reloaded', 'true');
                console.log('🔄 [PROXY] Reloading NOW for Isolation headers...');
                // Use setTimeout to ensure log is visible, then reload immediately
                setTimeout(() => window.location.reload(), 10);
                throw new Error('RELOADING'); // Stop all execution immediately
            }
        } else {
            sessionStorage.removeItem('coi_reloaded');
        }

        // 4. Load Core Libraries
        const loadScript = (src, fallbackSrc) => new Promise((resolveScript, rejectScript) => {
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = "anonymous";
            s.onload = () => resolveScript(true);
            s.onerror = async () => {
                if (fallbackSrc) {
                    console.log(`🔄 [PROXY] Fallback to: ${fallbackSrc}`);
                    try {
                        await loadScript(fallbackSrc, null);
                        resolveScript(true);
                    } catch (e) { rejectScript(e); }
                } else {
                    rejectScript(new Error(`Failed to load ${src}`));
                }
            };
            document.head.appendChild(s);
        });

        // Paths
        const bareMuxPath = new URL("./lib/baremux/index.js", window.APP_BASE_URL).href;
        const bareMuxCDN = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2.1.7/dist/index.js";
        const scramjetPath = new URL("./lib/scramjet/scramjet.all.js", window.APP_BASE_URL).href;
        const scramjetCDN = 'https://cdn.jsdelivr.net/gh/MercuryWorkshop/scramjet@2.0.0-alpha/dist/scramjet.all.js';

        await Promise.all([
            loadScript(bareMuxPath, bareMuxCDN),
            loadScript(scramjetPath, scramjetCDN)
        ]);
        console.log('📦 [PROXY] Libraries loaded');

        // 5. Initialize Scramjet
        let scramjetBundle;
        try {
            if (typeof window.$scramjetLoadController === 'function') {
                scramjetBundle = window.$scramjetLoadController();
            } else if (window.__scramjet$bundle) {
                scramjetBundle = window.__scramjet$bundle;
            }
        } catch (crossOriginErr) {
            // In iframe context, accessing some globals may fail due to cross-origin restrictions
            console.warn('⚠️ [PROXY] Cross-origin access blocked, trying alternative:', crossOriginErr.message);
            // Try direct access as fallback
            scramjetBundle = window.__scramjet$bundle;
        }

        if (!scramjetBundle) throw new Error('Scramjet bundle not found');

        const { ScramjetController } = scramjetBundle;

        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://navigator.scholarnavigator.workers.dev/wisp/";

        // DIAGNOSTIC: Test WebSocket connectivity before proceeding
        if (window.WispHealthChecker) {
            console.log('🔬 [PROXY] Running WebSocket diagnostics...');
            const healthUrl = wispUrl.replace(/^wss?/, location.protocol.replace(':', ''))
                .replace('/wisp/', '/api/health');

            const diagResult = await window.WispHealthChecker.diagnose(wispUrl, healthUrl);
            console.log('📊 [PROXY] Diagnosis:', diagResult.diagnosis);

            if (diagResult.recommendations && diagResult.recommendations.length > 0) {
                console.log('💡 [PROXY] Recommendations:');
                diagResult.recommendations.forEach(rec => console.log(`   - ${rec}`));
            }

            // If WebSocket is explicitly confirmed blocked, show user-friendly warning
            if (window.WispHealthChecker.isHealthy === false) {
                console.warn('⚠️ [PROXY] WebSocket connection may be blocked or restricted');
                console.warn('⚠️ [PROXY] The proxy will attempt to connect, but may fail on this network');

                // Show warning banner to user
                setTimeout(() => {
                    const banner = document.getElementById('network-warning-banner');
                    const closeBtn = document.getElementById('warning-close-btn');

                    if (banner) {
                        banner.classList.remove('hidden');

                        // Auto-hide after 10 seconds
                        const autoHideTimer = setTimeout(() => {
                            banner.classList.add('hidden');
                        }, 10000);

                        // Close button handler
                        if (closeBtn) {
                            closeBtn.addEventListener('click', () => {
                                banner.classList.add('hidden');
                                clearTimeout(autoHideTimer);
                            }, { once: true });
                        }
                    }
                }, 1000); // Show after a brief delay
            }
        }

        // 6. Configure Scramjet with iframe-safe settings
        const scramjetConfig = {
            prefix: window.SCRAMJET_PREFIX,
            wisp: wispUrl,
            files: {
                wasm: new URL("./lib/scramjet/scramjet.wasm.wasm", window.APP_BASE_URL).href,
                all: new URL("./lib/scramjet/scramjet.all.js", window.APP_BASE_URL).href,
                sync: new URL("./lib/scramjet/scramjet.sync.js", window.APP_BASE_URL).href,
            },
            codec: {
                // Disable URL truncation to prevent "domain.com/..." links
                truncate: false,
            },
        };

        // Note: We never run in iframe mode (inception guard aborts early)

        window.scramjet = new ScramjetController(scramjetConfig);

        // 7. Initialize Scramjet with improved error handling
        console.log('🔄 [PROXY] Initializing Scramjet...');

        try {
            await window.scramjet.init();
            console.log('✅ [PROXY] Scramjet Controller initialized');
        } catch (initErr) {
            console.error('❌ [PROXY] Scramjet init failed:', initErr);

            // If init fails, it's likely a fresh DB corruption during init
            // Try one more time after cleanup
            console.log('🗑️ [PROXY] Attempting recovery with fresh database...');

            if (window.StorageHealth) {
                await window.StorageHealth.deleteScramjetDB();
                await new Promise(r => setTimeout(r, 300));

                // Final attempt
                await window.scramjet.init();
                console.log('✅ [PROXY] Scramjet initialized after recovery');
            } else {
                throw initErr; // No recovery mechanism available
            }
        }

        // 7.5. Pre-load WASM rewriter (CRITICAL for inline script rewriting)
        console.log('📦 [PROXY] Pre-loading WASM rewriter...');
        try {
            // Fetch and cache the WASM file immediately
            const wasmUrl = new URL("./lib/scramjet/scramjet.wasm.wasm", window.APP_BASE_URL).href;
            const wasmResponse = await fetch(wasmUrl);
            if (!wasmResponse.ok) throw new Error(`WASM fetch failed: ${wasmResponse.status}`);
            const wasmBuffer = await wasmResponse.arrayBuffer();

            // Helper to safely convert buffer to base64 without stack overflow
            const bufferToBase64 = (buf) => {
                let binary = '';
                const bytes = new Uint8Array(buf);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i += 8192) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
                }
                return btoa(binary);
            };

            // Store in global for Scramjet to use (SAFE METHOD)
            if (typeof self !== 'undefined') {
                self.WASM = bufferToBase64(wasmBuffer);
            }
            console.log(`✅ [PROXY] WASM loaded safely (${(wasmBuffer.byteLength / 1024).toFixed(1)} KB)`);
        } catch (wasmErr) {
            console.warn('⚠️ [PROXY] WASM pre-load failed (will lazy-load):', wasmErr);
            // Non-fatal - Scramjet will try to load it when needed
        }



        // CRITICAL: Signal to Service Worker that database is ready
        // Wait for SW to be controlling (handles SW update race condition)
        let swController = navigator.serviceWorker.controller;

        if (!swController) {
            console.log('⏳ [PROXY] Waiting for Service Worker to take control...');

            // Wait up to 2 seconds for SW to take control
            const controllerTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
            const controllerReady = new Promise((resolve) => {
                const checkController = () => {
                    if (navigator.serviceWorker.controller) {
                        resolve(navigator.serviceWorker.controller);
                    } else {
                        setTimeout(checkController, 100);
                    }
                };
                checkController();
            });

            swController = await Promise.race([controllerReady, controllerTimeout]);
        }

        // Send signal to Service Worker
        const sendInitSignal = async () => {
            const msg = {
                type: 'init_complete',
                config: scramjetConfig
            };

            // 1. Try sending to current controller
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(msg);
                console.log('📨 [PROXY] Sent init_complete to controller');
            }

            // 2. Try sending to all active registrations (more robust)
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    if (reg.active) {
                        reg.active.postMessage(msg);
                        console.log('📨 [PROXY] Sent init_complete to active registration');
                    }
                }
            } catch (err) {
                console.warn('⚠️ [PROXY] Failed to send signal to registrations:', err);
            }
        };

        // Execute immediately and also listen for controller changes
        await sendInitSignal();
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 [PROXY] SW controller changed, re-sending signal...');
            sendInitSignal();
        });

        // 7. Initialize BareMux Transport (only if cross-origin isolated)
        if (window.crossOriginIsolated) {
            const bareMuxWorkerPath = new URL("./lib/baremux/worker.js", window.APP_BASE_URL).href;
            window.bareMuxConnection = new BareMux.BareMuxConnection(bareMuxWorkerPath);
            const transportPath = new URL("./lib/libcurl/index.mjs", window.APP_BASE_URL).href;

            // Perform connection
            await window.bareMuxConnection.setTransport(transportPath, [{ websocket: wispUrl }]);
            console.log('✅ [PROXY] BareMux transport connected');
        } else {
            console.log('⚠️ [PROXY] Skipping BareMux (requires cross-origin isolation)');
            console.log('ℹ️ [PROXY] Using Scramjet direct WISP transport only');
        }

        window.ProxyService.initialized = true;

        // Signal to error handler that initialization succeeded
        if (window.ErrorHandler) {
            window.ErrorHandler.stopTimeout();
        }

        resolve(true);

    } catch (err) {
        console.error('❌ [PROXY] Initialization failed:', err);

        // Show emergency UI on critical failure
        if (window.ErrorHandler) {
            window.ErrorHandler.show(
                'Proxy initialization failed. This may be due to corrupted storage or network issues.',
                err.message || String(err)
            );
        }

        reject(err);
    }
});
