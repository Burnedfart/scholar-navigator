/**
 * Practice Problems Server with Ultraviolet Proxy
 * 
 * This server now uses Ultraviolet + Bare Server for full web proxy support.
 * 
 * ARCHITECTURE:
 * - Express handles the frontend and API routes
 * - Bare Server handles proxied requests at /bare/
 * - Ultraviolet client-side Service Worker intercepts all requests
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { createBareServer } = require('@nebula-services/bare-server-node');

// Import our custom modules
const { encodeUrl, decodeUrl, isValidUrl } = require('./src/utils/urlEncoder');
const sessionManager = require('./src/middleware/sessionManager');
const errorHandler = require('./src/middleware/errorHandler');
const proxyHandler = require('./src/handlers/proxyHandler');

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

const app = express();
const server = http.createServer(app);
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// 1. GLOBAL CORS (Must be first!)
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    } else {
        res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 2. Logging and Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// 3. Session Management
app.use(sessionManager.middleware);

// ============================================================================
// STATIC FILES - Serve Ultraviolet client files
// ============================================================================

// Serve UV static files from node_modules
app.use('/uv/', express.static(path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist')));

// Serve our custom UV config (overrides the default)
app.use('/uv/', express.static(path.join(__dirname, 'uv')));

// Serve the service worker at root
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Serve our static frontend
app.use(express.static(path.join(__dirname, './')));

// ============================================================================
// API ENDPOINTS
// ============================================================================

// URL Encoding endpoints (keep for educational purposes)
app.post('/api/encode', (req, res) => {
    const { url } = req.body;
    if (!url || !isValidUrl(url)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid URL provided'
        });
    }
    res.json({
        success: true,
        original: url,
        encoded: encodeUrl(url)
    });
});

app.post('/api/decode', (req, res) => {
    const { encoded } = req.body;
    if (!encoded) {
        return res.status(400).json({
            success: false,
            error: 'No encoded URL provided'
        });
    }
    res.json({
        success: true,
        encoded: encoded,
        decoded: decodeUrl(encoded)
    });
});

// Legacy proxy endpoints (keep for fallback/simple sites)
app.get('/api/proxy', proxyHandler.handleProxyRequest);
app.post('/api/proxy', proxyHandler.handleProxyRequest);
app.get('/api/resource', proxyHandler.handleResourceRequest);

// ============================================================================
// BARE SERVER ROUTING (for Ultraviolet)
// ============================================================================

// Route bare server requests
server.on('request', (req, res) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeRequest(req, res);
    } else {
        app(req, res);
    }
});

// Handle WebSocket upgrades (critical for sites like Discord, YouTube)
server.on('upgrade', (req, socket, head) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeUpgrade(req, socket, head);
    } else {
        socket.end();
    }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorHandler.middleware);

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ULTRAVIOLET PROXY SERVER                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Server running at: http://localhost:${PORT}                  ║`);
    console.log('║                                                            ║');
    console.log('║  Features:                                                 ║');
    console.log('║  • Bare Server at /bare/                                   ║');
    console.log('║  • Ultraviolet client at /uv/                              ║');
    console.log('║  • WebSocket support for YouTube/Discord                   ║');
    console.log('║  • Full site compatibility                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\\nShutting down gracefully...');
    server.close();
    process.exit(0);
});

module.exports = { app, server };
