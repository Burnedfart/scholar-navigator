window.WispEvasion = {
    createStealthSocket(url, options = {}) {
        console.log('🥷 [EVASION] Creating stealth WebSocket connection');

        const ws = new WebSocket(url, options.protocols);

        ws.addEventListener('open', () => {
            console.log('✅ [EVASION] Stealth connection established');
        });

        ws.addEventListener('error', (error) => {
            console.error('❌ [EVASION] Stealth connection failed:', error);
        });

        return ws;
    },

    async connectWithRetry(createConnectionFn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [EVASION] Connection attempt ${attempt}/${maxRetries}`);
                const result = await createConnectionFn();
                console.log('✅ [EVASION] Connection successful');
                return result;
            } catch (error) {
                if (attempt === maxRetries) {
                    console.error('❌ [EVASION] All retry attempts failed');
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ [EVASION] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    async findWorkingEndpoint(baseUrl, pathVariations = ['/wisp/', '/ws/', '/websocket/', '/']) {
        console.log('🔍 [EVASION] Testing endpoint variations...');

        const protocol = baseUrl.split('://')[0];
        const domain = baseUrl.split('://')[1].split('/')[0];

        for (const path of pathVariations) {
            const testUrl = `${protocol}://${domain}${path}`;
            console.log(`🔍 Testing: ${testUrl}`);

            if (window.WispHealthChecker) {
                const result = await window.WispHealthChecker.testConnection(testUrl, 3000);
                if (result.success) {
                    console.log(`✅ [EVASION] Found working endpoint: ${testUrl}`);
                    return testUrl;
                }
            }
        }

        console.error('❌ [EVASION] No working endpoint found');
        return null;
    },

    isSecureConnection(url) {
        return url.startsWith('wss://') || url.startsWith('https://');
    },

    getBypassRecommendations() {
        return {
            network: [
                'Use standard HTTPS port (443) instead of custom ports',
                'Ensure WebSocket uses WSS (encrypted) not WS',
                'Run server behind Cloudflare or similar CDN with WebSocket support',
                'Use domain fronting techniques if available'
            ],
            client: [
                'Use browser with strong privacy protections (Firefox, Brave)',
                'Try different browser profiles to rule out extension interference',
                'Clear all browser data including HSTS cache',
                'Test from incognito/private mode'
            ],
            server: [
                'Enable WebSocket compression if not already enabled',
                'Use standard TLS configurations (no custom ciphers)',
                'Ensure certificate is from trusted CA (Let\'s Encrypt is fine)',
                'Add rate limiting to avoid triggering automated blocks'
            ],
            advanced: [
                'Implement domain fronting through CDN',
                'Use Meek or similar pluggable transport',
                'Route through Tor or I2P for maximum censorship resistance',
                'Consider HTTP/3 (QUIC) which is harder to inspect'
            ]
        };
    }
};
