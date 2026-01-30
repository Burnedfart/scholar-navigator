const fetch = require('node-fetch');
const { decodeUrl, isValidUrl, extractDomain } = require('../utils/urlEncoder');
const { InvalidUrlError, NetworkError, ContentError } = require('../middleware/errorHandler');

const PROXY_CONFIG = {
    timeout: 30000,
    maxResponseSize: 10 * 1024 * 1024,
    userAgent: 'ScholarNavigator/1.0',

    forwardHeaders: [
        'accept',
        'accept-language',
        'accept-encoding'
    ],

    stripHeaders: [
        'x-frame-options',
        'content-security-policy',
        'x-content-type-options',
        'strict-transport-security'
    ]
};

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
            const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
            const proxyBase = `${protocol}://${req.get('host')}`;
            processedContent = transformHtml(responseBody, finalUrl, proxyBase);
        }

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
        if (error.name === 'FetchError' || error.code) {
            return next(new NetworkError(error, req.query.url || req.body.url));
        }
        next(error);
    }
}

function buildProxyHeaders(req) {
    const headers = {
        'User-Agent': PROXY_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    };
    PROXY_CONFIG.forwardHeaders.forEach(headerName => {
        const value = req.get(headerName);
        if (value) {
            headers[headerName] = value;
        }
    });

    return headers;
}

function buildResponseHeaders(targetResponse) {
    const headers = {};

    targetResponse.headers.forEach((value, name) => {
        if (PROXY_CONFIG.stripHeaders.includes(name.toLowerCase())) {
            return;
        }

        headers[name] = value;
    });

    return headers;
}

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

function resolveUrl(url, baseUrl) {
    try {
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        if (url.startsWith('data:') || url.startsWith('javascript:') ||
            url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
            return null;
        }
        return new URL(url, baseUrl).href;
    } catch (e) {
        return null;
    }
}

function makeProxyUrl(resourceUrl, proxyBase) {
    if (!resourceUrl) return null;
    return `${proxyBase}/api/resource?url=${encodeURIComponent(resourceUrl)}`;
}

function transformHtml(html, baseUrl, proxyBase = '') {
    const baseTag = `<base href="${baseUrl}">`;
    const attributePatterns = [
        { attr: 'src', regex: /(<[^>]+\ssrc=["'])([^"']+)(["'][^>]*>)/gi },
        { attr: 'href', regex: /(<[^>]+\shref=["'])([^"']+)(["'][^>]*>)/gi },
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

        // Intercept DOM property setters
        const elementDescriptors = Object.getOwnPropertyDescriptors(HTMLElement.prototype);
        
        // Helper to patch property properties
        function patchProperty(prototype, property) {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
            if (descriptor && descriptor.set) {
                Object.defineProperty(prototype, property, {
                    get: descriptor.get,
                    set: function(value) {
                       if (typeof value === 'string' && value.trim() !== '') {
                           try {
                               // Don't double-proxy
                               if (!value.includes(PROXY_BASE)) {
                                   value = proxyUrl(value);
                               }
                           } catch(e) {}
                       }
                       return descriptor.set.call(this, value);
                    },
                    enumerable: true,
                    configurable: true
                });
            }
        }

        // Patch common URL properties
        if (window.HTMLImageElement) patchProperty(HTMLImageElement.prototype, 'src');
        if (window.HTMLScriptElement) patchProperty(HTMLScriptElement.prototype, 'src');
        if (window.HTMLLinkElement) patchProperty(HTMLLinkElement.prototype, 'href');
        if (window.HTMLAnchorElement) patchProperty(HTMLAnchorElement.prototype, 'href');
        if (window.HTMLMediaElement) patchProperty(HTMLMediaElement.prototype, 'src');
        if (window.HTMLSourceElement) patchProperty(HTMLSourceElement.prototype, 'src');

        // Intercept setAttribute
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, value) {
            if ((name === 'src' || name === 'href' || name === 'action') && typeof value === 'string') {
                if (!value.includes(PROXY_BASE)) {
                    value = proxyUrl(value);
                }
            }
            return originalSetAttribute.call(this, name, value);
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
        const finalUrl = targetResponse.url || targetUrl;

        // Set appropriate headers
        res.set('Content-Type', contentType);

        // Reflect origin to support credentials
        const origin = req.headers.origin;
        if (origin) {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Access-Control-Allow-Credentials', 'true');
        } else {
            res.set('Access-Control-Allow-Origin', '*');
        }

        // Remove security headers that might cause issues
        PROXY_CONFIG.stripHeaders.forEach(header => {
            res.removeHeader(header);
        });

        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const proxyBase = `${protocol}://${req.get('host')}`;

        // For text content, rewrite URLs if it's CSS
        if (contentType.includes('text/css')) {
            let cssContent = await targetResponse.text();

            // Rewrite url() in CSS
            cssContent = cssContent.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
                const resolvedUrl = resolveUrl(url.trim(), finalUrl);
                if (!resolvedUrl) return match;
                return `url("${proxyBase}/api/resource?url=${encodeURIComponent(resolvedUrl)}")`;
            });

            // Rewrite @import
            cssContent = cssContent.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
                const resolvedUrl = resolveUrl(url.trim(), finalUrl);
                if (!resolvedUrl) return match;
                return `@import "${proxyBase}/api/resource?url=${encodeURIComponent(resolvedUrl)}"`;
            });

            res.send(cssContent);
        } else if (contentType.includes('text/html')) {
            // Rewrite URLs in HTML resources (for navigation within iframe)
            let htmlContent = await targetResponse.text();
            htmlContent = transformHtml(htmlContent, finalUrl, proxyBase);
            res.send(htmlContent);
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
