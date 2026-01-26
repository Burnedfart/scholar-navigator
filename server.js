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
// Educational Note: Middleware functions process requests before they reach
// route handlers. They can modify request/response objects, end requests,
// or pass control to the next middleware.
// ============================================================================

// Enable CORS (Cross-Origin Resource Sharing)
// This allows the frontend to make requests to our proxy server
app.use(cors({
    origin: '*', // In production, you'd restrict this
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-ID']
}));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// Request logging for educational observation
// Morgan logs each request with method, URL, status, and response time
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// Serve static files from the root directory
// This ensures GitHub Pages can find index.html at the top level
app.use(express.static(path.join(__dirname, '.')));

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
