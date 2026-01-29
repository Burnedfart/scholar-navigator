import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";
import path from "path";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import express from "express";

// Load SSL certificates (certbot standard locations)
const DOMAIN = "my-site.boxathome.net";
let httpsOptions;
try {
    httpsOptions = {
        key: readFileSync(`/etc/letsencrypt/live/${DOMAIN}/privkey.pem`),
        cert: readFileSync(`/etc/letsencrypt/live/${DOMAIN}/fullchain.pem`)
    };
    console.log("✅ SSL certificates loaded successfully");
} catch (err) {
    console.error("❌ Failed to load SSL certificates:", err.message);
    console.error("   Make sure certbot certificates exist at /etc/letsencrypt/live/" + DOMAIN);
    process.exit(1);
}

// Get paths for serving static files
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const app = express();

// WISP Configuration
logging.set_level(logging.DEBUG);
Object.assign(wisp.options, {
    allow_udp_streams: false,
    hostname_blacklist: [],
    dns_servers: ["1.1.1.1", "1.0.0.1"],
});

// CORS headers for cross-origin requests
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://burnedfart.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        wisp: 'active',
        uptime: process.uptime()
    });
});

// Serve static files from root
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.wasm') || path.endsWith('.mjs')) {
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        }
    }
}));

// Serve 'lib' directory for static assets
app.use("/lib/", express.static(path.join(__dirname, "lib"), {
    setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
}));

// Create HTTPS server with SSL certificates
const server = createServer(httpsOptions);

// Handle HTTP requests with Express
server.on("request", (req, res) => {
    app(req, res);
});

// Handle WebSocket upgrade for WISP
server.on("upgrade", (req, socket, head) => {
    if (req.url.endsWith("/wisp/")) {
        console.log("📡 WISP WebSocket connection established from:", req.headers.origin);
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

// Graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    console.log("\n🛑 Shutting down server...");
    server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
    });
}

// Start server
const PORT = parseInt(process.env.PORT || "3000");
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
    console.log("🚀 Scramjet Proxy Server with WISP (HTTPS)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 HTTPS Server: https://${DOMAIN}:${PORT}`);
    console.log(`🔌 WISP Endpoint: wss://${DOMAIN}:${PORT}/wisp/`);
    console.log(`🏥 Health Check: https://${DOMAIN}:${PORT}/api/health`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nServing static files:");
    console.log(`  📂 Root: ${__dirname}`);
    console.log(`  📦 Lib: /lib/ (Static Assets)`);
    console.log("\nPress Ctrl+C to stop");
});