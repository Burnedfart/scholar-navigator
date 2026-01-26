/**
 * Practice Problems Server
 * 
 * This server demonstrates web content retrieval and architectural flow.
 * 
 * EDUCATIONAL PURPOSE:
 * - Understand HTTP request/response flow
 * - Learn about URL encoding and safe data transmission
 * - See how proxies handle headers and content
 * - Observe session management in practice
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Import our custom modules (educational utilities)
const { encodeUrl, decodeUrl, isValidUrl } = require('./src/utils/urlEncoder');
const sessionManager = require('./src/middleware/sessionManager');
const errorHandler = require('./src/middleware/errorHandler');
const proxyHandler = require('./src/handlers/proxyHandler');

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// 1. GLOBAL CORS (Must be first!)
app.use((req, res, next) => {
    // Reflect the origin to support credentials
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle Pre-flight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 2. Logging and Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// Serve static files from the root directory
// We use a guard to ensure we don't serve the server code itself
app.use((req, res, next) => {
    if (req.path === '/server.js' || req.path.startsWith('/src')) {
        return res.status(403).send('Access Forbidden');
    }
    next();
}, express.static(path.join(__dirname, '.')));

// Apply session management middleware
// Creates/validates session for each request
app.use(sessionManager.middleware);

// ============================================================================
// API ROUTES
// Educational Note: Routes define how the server responds to different
// HTTP requests. Each route has a method (GET, POST, etc.) and a path.
// ============================================================================

/**
 * GET /api/health
 * Health check endpoint - useful for monitoring server status
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sessionId: req.sessionId
    });
});

/**
 * GET /api/session
 * Returns current session information
 * Educational: Demonstrates stateful session tracking
 */
app.get('/api/session', (req, res) => {
    const session = sessionManager.getSession(req.sessionId);
    res.json({
        sessionId: req.sessionId,
        created: session?.created,
        requestCount: session?.requestCount || 0,
        lastAccess: session?.lastAccess
    });
});

/**
 * POST /api/encode
 * Encodes a URL for safe transmission
 * Educational: Shows how data is encoded for transport
 */
app.post('/api/encode', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const encoded = encodeUrl(url);
    res.json({
        original: url,
        encoded: encoded,
        explanation: 'The URL has been Base64 encoded for safe transmission through the proxy'
    });
});

/**
 * POST /api/decode
 * Decodes an encoded URL
 * Educational: Shows the reverse of the encoding process
 */
app.post('/api/decode', (req, res) => {
    const { encoded } = req.body;

    if (!encoded) {
        return res.status(400).json({ error: 'Encoded string is required' });
    }

    try {
        const decoded = decodeUrl(encoded);
        res.json({
            encoded: encoded,
            decoded: decoded,
            explanation: 'The Base64 encoded string has been decoded back to the original URL'
        });
    } catch (error) {
        res.status(400).json({ error: 'Invalid encoded string' });
    }
});

/**
 * GET /api/proxy
 * Main proxy endpoint - fetches content from a target URL
 * 
 * Query Parameters:
 * - url: The target URL to fetch (can be plain or encoded)
 * - encoded: Set to 'true' if the URL is Base64 encoded
 * 
 * Educational: This is the core proxy functionality. It demonstrates:
 * 1. Receiving a request from the client
 * 2. Decoding/validating the target URL
 * 3. Forwarding the request to the target server
 * 4. Receiving the response from the target
 * 5. Returning the response to the client
 */
app.get('/api/proxy', proxyHandler.handleProxyRequest);

/**
 * POST /api/proxy
 * Alternative proxy endpoint using POST (for longer URLs)
 */
app.post('/api/proxy', proxyHandler.handleProxyRequest);

/**
 * GET /api/resource
 * Serves resources (CSS, JS, images, fonts) directly without JSON wrapper
 * This is used by the proxied HTML to load assets
 */
app.get('/api/resource', proxyHandler.handleResourceRequest);

// ============================================================================
// ERROR HANDLING
// Educational Note: Error handling middleware catches errors from route
// handlers and provides consistent error responses to clients.
// ============================================================================

app.use(errorHandler.middleware);

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║               PRACTICE PROBLEMS SERVER                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Server running at: http://localhost:${PORT}                  ║`);
    console.log('║                                                            ║');
    console.log('║  This platform demonstrates:                               ║');
    console.log('║  • Web architectural flow                                  ║');
    console.log('║  • URL encoding/decoding                                   ║');
    console.log('║  • Session management                                      ║');
    console.log('║  • Error handling                                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\\nShutting down gracefully...');
    process.exit(0);
});

module.exports = app;
