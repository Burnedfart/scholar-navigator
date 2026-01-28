/**
 * WebSocket Health Checker
 * Tests WebSocket connectivity and provides fallback strategies
 */

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

        // Test HTTP first
        const httpResult = await this.testHttpHealth(httpUrl);

        if (!httpResult.success) {
            return {
                diagnosis: 'Server is completely unreachable. The backend server may be down, or DNS is not resolving.',
                recommendations: [
                    'Check if the server is running',
                    'Verify DNS configuration',
                    'Check firewall rules on the server',
                    'Ensure Oracle Cloud security lists allow inbound traffic'
                ]
            };
        }

        // HTTP works, now test WebSocket
        const wsResult = await this.testConnection(wispUrl);

        if (wsResult.success) {
            return {
                diagnosis: 'All systems operational! WebSocket connection is working.',
                recommendations: ['No action needed']
            };
        }

        // HTTP works but WebSocket doesn't - classic censorship scenario
        let diagnosis = 'HTTP requests work, but WebSocket connections are blocked. ';

        if (wsResult.closeCode === 1006) {
            diagnosis += 'This is typical of network-level censorship or deep packet inspection (DPI).';
            recommendations.push(
                'Try using standard HTTPS port 443 instead of custom ports',
                'Consider using a CDN like Cloudflare with WebSocket proxying',
                'Implement WebSocket obfuscation or disguising techniques',
                'Use a VPN or proxy to bypass the censorship',
                'Contact network administrator about WebSocket blocking'
            );
        } else if (wsResult.closeCode === 1015) {
            diagnosis += 'TLS handshake failed, suggesting certificate issues or TLS inspection.';
            recommendations.push(
                'Verify SSL certificate is valid and not expired',
                'Check if the network is performing TLS interception',
                'Ensure certificate chain is complete',
                'Try accessing via VPN to rule out TLS inspection'
            );
        } else {
            diagnosis += `Connection closed with code ${wsResult.closeCode}.`;
            recommendations.push(
                'Check server logs for connection errors',
                'Verify WebSocket endpoint is correctly configured',
                'Test from different network to isolate the issue'
            );
        }

        return { diagnosis, recommendations };
    }
};
