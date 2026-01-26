/**
 * Proxy Handler Module
 * 
 * EDUCATIONAL PURPOSE:
 * This is the core module that handles the actual proxying of requests.
 * It demonstrates:
 * - HTTP request forwarding
 * - Response processing
 * - Header manipulation
 * - Content transformation
 * 
 * HOW PROXYING WORKS:
 * 
 * 1. Client sends request to our proxy with target URL
 * 2. Proxy validates and decodes the target URL
 * 3. Proxy makes a new request to the target server
 * 4. Target server sends response to proxy
 * 5. Proxy processes/transforms the response
 * 6. Proxy sends the processed response to the client
 * 
 * This is a "forward proxy" - it forwards requests on behalf of clients.
 * Compare to a "reverse proxy" which sits in front of servers.
 */

const fetch = require('node-fetch');
const { decodeUrl, isValidUrl, extractDomain } = require('../utils/urlEncoder');
const { InvalidUrlError, NetworkError, ContentError } = require('../middleware/errorHandler');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROXY_CONFIG = {
    // Maximum time to wait for target server response (milliseconds)
    timeout: 30000,

    // Maximum response size to prevent memory issues (bytes)
    maxResponseSize: 10 * 1024 * 1024, // 10MB

    // User agent to identify as (important for some websites)
    userAgent: 'PracticeProblems/1.0 (Educational Tool)',

    // Headers to forward from client to target
    forwardHeaders: [
        'accept',
        'accept-language',
        'accept-encoding'
    ],

    // Headers to remove from target response
    stripHeaders: [
        'x-frame-options',      // Allows embedding in iframe
        'content-security-policy',
        'x-content-type-options',
        'strict-transport-security'
    ]
};

// ============================================================================
// PROXY FUNCTIONS
// ============================================================================

/**
 * Main proxy request handler
 * This is the endpoint that clients call to fetch remote content
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function handleProxyRequest(req, res, next) {
    try {
        // ========================================
        // STEP 1: Extract and validate the target URL
        // ========================================

        // Get URL from query parameter (GET) or body (POST)
        let targetUrl = req.query.url || req.body.url;
        const isEncoded = req.query.encoded === 'true' || req.body.encoded === true;

        console.log(`[Proxy] Received request for: ${targetUrl} (encoded: ${isEncoded})`);

        // Decode if the URL was Base64 encoded
        if (isEncoded && targetUrl) {
            targetUrl = decodeUrl(targetUrl);
            console.log(`[Proxy] Decoded URL: ${targetUrl}`);
        }

        // Validate the URL
        if (!targetUrl || !isValidUrl(targetUrl)) {
            throw new InvalidUrlError(targetUrl);
        }

        // ========================================
        // STEP 2: Build the proxy request
        // ========================================

        // Prepare headers to send to target server
        const proxyHeaders = buildProxyHeaders(req);

        console.log(`[Proxy] Fetching: ${targetUrl}`);
        console.log(`[Proxy] Domain: ${extractDomain(targetUrl)}`);

        // ========================================
        // STEP 3: Make the request to target server
        // ========================================

        const startTime = Date.now();

        const targetResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: proxyHeaders,
            timeout: PROXY_CONFIG.timeout,
            // Follow redirects automatically so users don't see redirect messages
            redirect: 'follow'
        });

        const fetchTime = Date.now() - startTime;
        console.log(`[Proxy] Response received in ${fetchTime}ms - Status: ${targetResponse.status}`);

        // Note: Redirects are now handled automatically via redirect: 'follow'
        // The final URL after redirects is available via targetResponse.url
        const finalUrl = targetResponse.url || targetUrl;
        console.log(`[Proxy] Final URL after redirects: ${finalUrl}`);

        // ========================================
        // STEP 5: Process the response
        // ========================================

        const contentType = targetResponse.headers.get('content-type') || 'text/html';

        // Check if content type is something we can handle
        if (!isProcessableContent(contentType)) {
            throw new ContentError(contentType, 'This content type cannot be displayed in the browser');
        }

        // Get the response body
        const responseBody = await targetResponse.text();

        // Check response size
        if (responseBody.length > PROXY_CONFIG.maxResponseSize) {
            throw new ContentError(contentType, 'Response is too large to process');
        }

        // ========================================
        // STEP 6: Transform HTML content
        // ========================================

        let processedContent = responseBody;

        if (contentType.includes('text/html')) {
            // Build proxy base URL from the request
            const protocol = req.secure ? 'https' : 'http';
            const proxyBase = `${protocol}://${req.get('host')}`;
            processedContent = transformHtml(responseBody, finalUrl, proxyBase);
        }

        // ========================================
        // STEP 7: Build and send the response
        // ========================================

        // Build response headers
        const responseHeaders = buildResponseHeaders(targetResponse);

        res.json({
            success: true,
            type: 'content',
            metadata: {
                url: finalUrl,
                domain: extractDomain(finalUrl),
                statusCode: targetResponse.status,
                contentType: contentType,
                contentLength: processedContent.length,
                fetchTimeMs: fetchTime
            },
            headers: responseHeaders,
            content: processedContent
        });

    } catch (error) {
        // Handle fetch errors specifically
        if (error.name === 'FetchError' || error.code) {
            return next(new NetworkError(error, req.query.url || req.body.url));
        }

        // Pass other errors to error handler
        next(error);
    }
}

/**
 * Builds headers to send to the target server
 * 
 * EDUCATIONAL NOTE:
 * Not all client headers should be forwarded:
 * - Some reveal proxy infrastructure
 * - Some contain authentication meant for the proxy
 * - Some might confuse the target server
 */
function buildProxyHeaders(req) {
    const headers = {
        'User-Agent': PROXY_CONFIG.userAgent,
        // Some servers require an Accept header
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    };

    // Forward selected headers from the original request
    PROXY_CONFIG.forwardHeaders.forEach(headerName => {
        const value = req.get(headerName);
        if (value) {
            headers[headerName] = value;
        }
    });

    return headers;
}

/**
 * Builds response headers to send back to the client
 * Strips headers that would prevent embedding or cause issues
 */
function buildResponseHeaders(targetResponse) {
    const headers = {};

    targetResponse.headers.forEach((value, name) => {
        // Skip headers we want to strip
        if (PROXY_CONFIG.stripHeaders.includes(name.toLowerCase())) {
            return;
        }

        headers[name] = value;
    });

    return headers;
}

/**
 * Checks if the content type is something we can process
 */
function isProcessableContent(contentType) {
    const processableTypes = [
        'text/html',
        'text/plain',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'application/xml',
        'text/xml',
        'image/',
        'font/',
        'application/font',
        'application/octet-stream'
    ];

    return processableTypes.some(type => contentType.includes(type));
}

/**
 * Resolves a URL relative to a base URL
 */
function resolveUrl(url, baseUrl) {
    try {
        // Handle protocol-relative URLs
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        // Handle data URLs, javascript:, mailto:, etc.
        if (url.startsWith('data:') || url.startsWith('javascript:') ||
            url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
            return null; // Don't proxy these
        }
        return new URL(url, baseUrl).href;
    } catch (e) {
        return null;
    }
}

/**
 * Creates a proxy URL for a given resource URL
 * Uses /api/resource which serves raw content (not JSON-wrapped)
 */
function makeProxyUrl(resourceUrl, proxyBase) {
    if (!resourceUrl) return null;
    return `${proxyBase}/api/resource?url=${encodeURIComponent(resourceUrl)}`;
}

/**
 * Transforms HTML content for display through the proxy
 * Rewrites all resource URLs to go through the proxy
 */
function transformHtml(html, baseUrl, proxyBase = '') {
    // First add a base tag for any URLs we miss
    const baseTag = `<base href="${baseUrl}">`;

    // Rewrite src and href attributes to go through proxy
    // Match src="..." or href="..." or src='...' or href='...'
    const attributePatterns = [
        { attr: 'src', regex: /(<[^>]+\ssrc=["'])([^"']+)(["'][^>]*>)/gi },
        { attr: 'href', regex: /(<link[^>]+\shref=["'])([^"']+)(["'][^>]*>)/gi },
        { attr: 'action', regex: /(<form[^>]+\saction=["'])([^"']+)(["'][^>]*>)/gi }
    ];

    for (const pattern of attributePatterns) {
        html = html.replace(pattern.regex, (match, prefix, url, suffix) => {
            const resolvedUrl = resolveUrl(url.trim(), baseUrl);
            if (!resolvedUrl) return match; // Keep original if can't resolve
            const proxyUrl = makeProxyUrl(resolvedUrl, proxyBase);
            return proxyUrl ? `${prefix}${proxyUrl}${suffix}` : match;
        });
    }

    // Rewrite srcset attributes (for responsive images)
    html = html.replace(/(<[^>]+\ssrcset=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, srcset, suffix) => {
        const rewrittenSrcset = srcset.split(',').map(entry => {
            const parts = entry.trim().split(/\s+/);
            if (parts.length >= 1) {
                const resolvedUrl = resolveUrl(parts[0], baseUrl);
                if (resolvedUrl) {
                    const proxyUrl = makeProxyUrl(resolvedUrl, proxyBase);
                    if (proxyUrl) {
                        parts[0] = proxyUrl;
                    }
                }
            }
            return parts.join(' ');
        }).join(', ');
        return `${prefix}${rewrittenSrcset}${suffix}`;
    });

    // Rewrite CSS url() references in style tags and inline styles
    html = html.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
        const resolvedUrl = resolveUrl(url.trim(), baseUrl);
        if (!resolvedUrl) return match;
        const proxyUrl = makeProxyUrl(resolvedUrl, proxyBase);
        return proxyUrl ? `url("${proxyUrl}")` : match;
    });

    // Inject a script to intercept fetch/XHR requests
    const proxyInterceptScript = `
    <script>
    (function() {
        const PROXY_BASE = '${proxyBase}';
        const BASE_URL = '${baseUrl}';
        
        // Helper to resolve and proxy URLs
        function proxyUrl(url) {
            try {
                if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('blob:')) {
                    return url;
                }
                const resolved = new URL(url, BASE_URL).href;
                return PROXY_BASE + '/api/resource?url=' + encodeURIComponent(resolved);
            } catch(e) {
                return url;
            }
        }
        
        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = function(resource, init) {
            if (typeof resource === 'string') {
                resource = proxyUrl(resource);
            } else if (resource instanceof Request) {
                resource = new Request(proxyUrl(resource.url), resource);
            }
            return originalFetch.call(this, resource, init);
        };
        
        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            return originalOpen.call(this, method, proxyUrl(url), ...args);
        };
    })();
    </script>`;

    // Insert base tag and intercept script after <head>
    if (html.match(/<head[^>]*>/i)) {
        html = html.replace(/<head[^>]*>/i, `$&\n${baseTag}\n${proxyInterceptScript}`);
    } else {
        html = baseTag + '\n' + proxyInterceptScript + '\n' + html;
    }

    return html;
}

/**
 * Handles resource requests - serves content directly without JSON wrapper
 * Used for CSS, JS, images, fonts, etc.
 */
async function handleResourceRequest(req, res, next) {
    try {
        let targetUrl = req.query.url;

        if (!targetUrl) {
            return res.status(400).send('URL parameter required');
        }

        // Decode URL if it's encoded
        targetUrl = decodeURIComponent(targetUrl);

        console.log(`[Resource] Fetching: ${targetUrl}`);

        const proxyHeaders = buildProxyHeaders(req);

        const targetResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: proxyHeaders,
            timeout: PROXY_CONFIG.timeout,
            redirect: 'follow'
        });

        const contentType = targetResponse.headers.get('content-type') || 'application/octet-stream';

        // Set appropriate headers
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');

        // Remove security headers that might cause issues
        PROXY_CONFIG.stripHeaders.forEach(header => {
            res.removeHeader(header);
        });

        // For text content, rewrite URLs if it's CSS
        if (contentType.includes('text/css')) {
            let cssContent = await targetResponse.text();
            const protocol = req.secure ? 'https' : 'http';
            const proxyBase = `${protocol}://${req.get('host')}`;

            // Rewrite url() in CSS
            cssContent = cssContent.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
                const resolvedUrl = resolveUrl(url.trim(), targetUrl);
                if (!resolvedUrl) return match;
                return `url("${proxyBase}/api/resource?url=${encodeURIComponent(resolvedUrl)}")`;
            });

            // Rewrite @import
            cssContent = cssContent.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
                const resolvedUrl = resolveUrl(url.trim(), targetUrl);
                if (!resolvedUrl) return match;
                return `@import "${proxyBase}/api/resource?url=${encodeURIComponent(resolvedUrl)}"`;
            });

            res.send(cssContent);
        } else if (contentType.includes('javascript') || contentType.includes('text/')) {
            // Send text content directly
            const textContent = await targetResponse.text();
            res.send(textContent);
        } else {
            // For binary content (images, fonts), pipe directly
            const buffer = await targetResponse.buffer();
            res.send(buffer);
        }

    } catch (error) {
        console.error('[Resource] Error:', error.message);
        res.status(500).send('Failed to fetch resource');
    }
}

module.exports = {
    handleProxyRequest,
    handleResourceRequest,
    PROXY_CONFIG
};
