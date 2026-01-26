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
    const allowedOrigins = [
        'https://burnedfart.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];

    const origin = req.headers.origin;

    // Dynamically allow Vercel deployments (this is important!)
    if (origin && (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
        // Allow requests with no origin (like mobile apps or curl requests)
        res.header('Access-Control-Allow-Origin', '*');
    } else {
        // Fallback or explicit allow for debugging
        res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

    // CSP - Permissive policy for proxying
    res.header(
        'Content-Security-Policy',
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; " +
        "style-src 'self' 'unsafe-inline' https:; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' https: wss:;"
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 2. Logging and Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// 3. Static Files (Serve these BEFORE session management to avoid overhead)
// ============================================================================

// Serve our custom UV config (overrides the default)
app.get('/uv/uv.config.js', (req, res) => {
    const filePath = path.join(__dirname, 'uv', 'uv.config.js');
    console.log('[UV] Serving config from:', filePath);
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
});

// Serve UV static files from node_modules (Manual fallback)
app.get('/uv/:file', (req, res) => {
    const filename = req.params.file;
    const filePath = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist', filename);

    console.log(`[UV] Serving ${filename} from:`, filePath);

    if (require('fs').existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(filePath);
    } else {
        console.error(`[UV] File not found: ${filePath}`);
        res.status(404).send('File not found');
    }
});

// Serve the service worker at root
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Serve our static frontend
app.use(express.static(path.join(__dirname, './')));

// ============================================================================
// 4. Session Management
app.use(sessionManager.middleware);

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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        sessionId: req.sessionId
    });
});



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

if (require.main === module) {
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
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\\nShutting down gracefully...');
    server.close();
    process.exit(0);
});

module.exports = (req, res) => {
    if (bareServer.shouldRoute(req)) {
        // Manually inject CORS headers for the Bare Server (bypasses Express middleware)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        bareServer.routeRequest(req, res);
    } else {
        app(req, res);
    }
};
