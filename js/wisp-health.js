window.WispHealthChecker = {
    lastCheckTime: null,
    isHealthy: null,

    /**
     * Test WebSocket connectivity to WISP server
     * @param {string} wispUrl - The WebSocket URL to test
     * @param {number} timeout - Timeout in milliseconds (default: 5000)
     * @returns {Promise<{success: boolean, error?: string, latency?: number}>}
     */
    async testConnection(wispUrl, timeout = 5000) {
        console.log('🔍 [WISP-HEALTH] Testing WebSocket connection to:', wispUrl);

        const startTime = Date.now();

        return new Promise((resolve) => {
            const ws = new WebSocket(wispUrl);
            let resolved = false;

            // Set timeout
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    ws.close();
                    const latency = Date.now() - startTime;
                    console.error(`⏰ [WISP-HEALTH] Connection timeout after ${latency}ms`);
                    resolve({
                        success: false,
                        error: `Connection timeout after ${latency}ms`,
                        latency
                    });
                }
            }, timeout);

            ws.onopen = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    const latency = Date.now() - startTime;
                    console.log(`✅ [WISP-HEALTH] Connection successful (${latency}ms)`);
                    ws.close();
                    this.lastCheckTime = Date.now();
                    this.isHealthy = true;
                    resolve({
                        success: true,
                        latency
                    });
                }
            };

            ws.onerror = (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    const latency = Date.now() - startTime;
                    console.error(`❌ [WISP-HEALTH] Connection failed after ${latency}ms:`, error);
                    this.isHealthy = false;
                    resolve({
                        success: false,
                        error: error.message || 'WebSocket connection failed',
                        latency
                    });
                }
            };

            ws.onclose = (event) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    const latency = Date.now() - startTime;

                    // Check close code for specific issues
                    let errorMsg = `WebSocket closed with code ${event.code}`;
                    if (event.code === 1006) {
                        errorMsg = 'Connection closed abnormally (likely blocked by network/firewall)';
                    } else if (event.code === 1015) {
                        errorMsg = 'TLS handshake failed (certificate issue or DPI blocking)';
                    }

                    console.error(`❌ [WISP-HEALTH] ${errorMsg}`);
                    this.isHealthy = false;
                    resolve({
                        success: false,
                        error: errorMsg,
                        latency,
                        closeCode: event.code
                    });
                }
            };
        });
    },

    /**
     * Test HTTP health endpoint as a baseline
     * @param {string} healthUrl - HTTP health check URL
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async testHttpHealth(healthUrl) {
        console.log('🔍 [HTTP-HEALTH] Testing HTTP endpoint:', healthUrl);

        try {
            const response = await fetch(healthUrl, {
                method: 'GET',
                cache: 'no-cache'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ [HTTP-HEALTH] Server reachable:', data);
                return { success: true, data };
            } else {
                console.error('❌ [HTTP-HEALTH] Server returned error:', response.status);
                return {
                    success: false,
                    error: `HTTP ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            console.error('❌ [HTTP-HEALTH] Request failed:', error);
            return {
                success: false,
                error: error.message || 'Network error'
            };
        }
    },

    /**
     * Perform comprehensive diagnostics
     * @param {string} wispUrl - WebSocket URL
     * @param {string} httpUrl - HTTP health check URL
     * @returns {Promise<{diagnosis: string, recommendations: string[]}>}
     */
    async diagnose(wispUrl, httpUrl) {
        console.log('🔬 [DIAGNOSTICS] Starting comprehensive check...');

        const recommendations = [];

        // 1. Test HTTP and WebSocket in parallel or sequence
        // We test HTTP primarily as a fallback and for detailed error reporting
        const [httpResult, wsResult] = await Promise.all([
            this.testHttpHealth(httpUrl),
            this.testConnection(wispUrl, 7000) // Slightly longer timeout for restricted networks
        ]);

        if (wsResult.success) {
            this.isHealthy = true;
            if (httpResult.success) {
                return {
                    diagnosis: 'All systems operational! WebSocket connection is working.',
                    recommendations: ['No action needed']
                };
            } else {
                return {
                    diagnosis: 'WebSocket is working, but the HTTP API is unreachable. This is unusual but the proxy should still function.',
                    recommendations: [
                        'The proxy uses WebSocket for traffic, so it should work normally.',
                        'Check if the /api/health endpoint is blocked by your network.',
                        'Verify CORS settings on the server if testing from a new domain.'
                    ]
                };
            }
        }

        // WebSocket failed
        this.isHealthy = false;
        let diagnosis = '';

        if (!httpResult.success) {
            diagnosis = 'Server is completely unreachable. Both HTTP and WebSocket failed. ';
            recommendations.push(
                'Check if the server is running',
                'Verify DNS configuration for ' + new URL(wispUrl).hostname,
                'Check if your network blocks all traffic to this domain'
            );
        } else {
            diagnosis = 'HTTP requests work, but WebSocket connections are blocked. ';

            if (wsResult.closeCode === 1006) {
                diagnosis += 'This is typical of network-level censorship or deep packet inspection (DPI).';
                recommendations.push(
                    'Try using standard HTTPS port 443 instead of custom ports',
                    'Consider using a CDN like Cloudflare with WebSocket proxying',
                    'Implement WebSocket obfuscation techniques',
                    'Use a VPN to bypass the network restriction'
                );
            } else if (wsResult.closeCode === 1015) {
                diagnosis += 'TLS handshake failed, suggesting certificate issues or TLS inspection.';
                recommendations.push(
                    'Verify SSL certificate is valid',
                    'Check if the network is performing TLS interception'
                );
            } else {
                diagnosis += `Connection closed with code ${wsResult.closeCode}.`;
                recommendations.push('Test from a different network to isolate the issue');
            }
        }

        return { diagnosis, recommendations };
    }
};
