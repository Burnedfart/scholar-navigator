/**
 * Proxy Initialization Service
 * Handles Service Worker registration, COOP/COEP isolation, and Scramjet/BareMux setup.
 */

window.ProxyService = {
    initialized: false,
    ready: null, // Promise
};

window.ProxyService.ready = new Promise(async (resolve, reject) => {
    try {
        // Signal to error handler that initialization has started
        if (window.ErrorHandler) {
            window.ErrorHandler.startTimeout();
        }

        // Detect iframe embedding
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            console.log('🖼️ [PROXY] Running in iframe mode');
        }

        console.log('🔧 [PROXY] Starting initialization...');

        // 1. Calculate Base Paths
        window.APP_BASE_URL = new URL("./", window.location.href).href;
        window.SCRAMJET_PREFIX = new URL("./service/", window.APP_BASE_URL).pathname;

        // 2. Register Service Worker
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker not supported');
        }

        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        console.log('✅ [SW] Registered:', registration.scope);

        await navigator.serviceWorker.ready;
        console.log('✅ [SW] Ready and Active');

        // 3. Handle Cross-Origin Isolation
        // Skip reload in iframe - isolation impossible with COOP: unsafe-none
        if (!window.crossOriginIsolated && window.isSecureContext && !isInIframe) {
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

        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://scholarnavigator.top/wisp/";

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

            // If WebSocket is blocked but HTTP works, show user-friendly warning
            if (!window.WispHealthChecker.isHealthy) {
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

        // Check if database exists and has correct schema
        const needsReset = await new Promise((resolve) => {
            const checkDB = indexedDB.open('$scramjet');
            checkDB.onsuccess = (event) => {
                const db = event.target.result;
                const requiredStores = ['config', 'cookies', 'publicSuffixList', 'redirectTrackers', 'referrerPolicies'];
                const missingStores = requiredStores.filter(store => !db.objectStoreNames.contains(store));

                // CRITICAL: Close DB immediately to allow deletion if needed
                db.close();

                if (missingStores.length > 0) {
                    console.log(`⚠️ [PROXY] $scramjet database missing stores: ${missingStores.join(', ')}`);
                    // Wait a tick to ensure DB is fully closed
                    setTimeout(() => resolve(true), 50);
                } else {
                    console.log(`✅ [PROXY] $scramjet database schema valid (${db.objectStoreNames.length} stores)`);
                    resolve(false);
                }
            };
            checkDB.onerror = () => resolve(true); // Database doesn't exist, needs creation
        });

        // Only delete if schema is corrupt
        if (needsReset) {
            console.log('🗑️ [PROXY] Deleting corrupted $scramjet database...');
            await new Promise((resolve) => {
                const deleteReq = indexedDB.deleteDatabase('$scramjet');
                deleteReq.onsuccess = () => {
                    console.log('✅ [PROXY] Database deleted, will recreate');
                    resolve();
                };
                deleteReq.onerror = deleteReq.onblocked = () => {
                    console.log('⚠️ [PROXY] Could not delete database, continuing anyway');
                    resolve();
                };
            });
        }

        // Configure Scramjet with iframe-safe settings
        const scramjetConfig = {
            prefix: window.SCRAMJET_PREFIX,
            wisp: wispUrl,
            files: {
                wasm: new URL("./lib/scramjet/scramjet.wasm.wasm", window.APP_BASE_URL).href,
                all: new URL("./lib/scramjet/scramjet.all.js", window.APP_BASE_URL).href,
                sync: new URL("./lib/scramjet/scramjet.sync.js", window.APP_BASE_URL).href,
            },
        };

        // Disable sourcemaps in iframe mode to prevent cross-origin errors
        if (isInIframe) {
            scramjetConfig.sourcemaps = false; // Correct format: boolean not object
            console.log('🖼️ [PROXY] Disabled sourcemaps for iframe compatibility');
        }

        window.scramjet = new ScramjetController(scramjetConfig);

        // Initialize Scramjet with retry logic
        let initAttempts = 0;
        const maxAttempts = 3;

        while (initAttempts < maxAttempts) {
            try {
                console.log(`🔄 [PROXY] Scramjet init attempt ${initAttempts + 1}/${maxAttempts}...`);
                await window.scramjet.init();

                // Verify database was created properly
                await new Promise((resolve, reject) => {
                    const checkDB = indexedDB.open('$scramjet');
                    checkDB.onsuccess = (event) => {
                        const db = event.target.result;
                        const requiredStores = ['config', 'cookies', 'publicSuffixList', 'redirectTrackers', 'referrerPolicies'];
                        const missingStores = requiredStores.filter(store => !db.objectStoreNames.contains(store));

                        if (missingStores.length > 0) {
                            db.close();
                            reject(new Error(`Missing object stores: ${missingStores.join(', ')}`));
                        } else {
                            console.log(`✅ [PROXY] Verified $scramjet database (${db.objectStoreNames.length} stores)`);
                            db.close();
                            resolve();
                        }
                    };
                    checkDB.onerror = () => reject(new Error('Could not verify $scramjet database'));
                });

                console.log('✅ [PROXY] Scramjet Controller initialized and verified');
                break; // Success, exit retry loop

            } catch (initErr) {
                initAttempts++;
                console.warn(`⚠️ [PROXY] Scramjet init attempt ${initAttempts} failed:`, initErr);

                if (initAttempts >= maxAttempts) {
                    // Last resort: delete corrupted database and retry once more
                    console.log('🗑️ [PROXY] Deleting corrupted $scramjet database...');
                    await new Promise(resolve => {
                        const delReq = indexedDB.deleteDatabase('$scramjet');
                        delReq.onsuccess = delReq.onerror = () => resolve();
                    });

                    // Final attempt after delete
                    console.log('🔄 [PROXY] Final init attempt after cleanup...');
                    await window.scramjet.init();
                    break;
                }

                // Wait before retry
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // CRITICAL: Signal to Service Worker that database is ready
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'init_complete'
            });
            console.log('📨 [PROXY] Sent init_complete signal to Service Worker');
        }

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
