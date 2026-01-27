import { createServer } from "node:http";
import { fileURLToPath } from "url";
import path from "path";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import express from "express";

// Get paths for serving static files
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Paths to node_modules packages
const scramjetPath = path.join(__dirname, "node_modules/@mercuryworkshop/scramjet/dist");
const libcurlPath = path.join(__dirname, "node_modules/@mercuryworkshop/libcurl-transport");
const baremuxPath = path.join(__dirname, "node_modules/@mercuryworkshop/bare-mux/dist");

const app = express();

// WISP Configuration
logging.set_level(logging.NONE); // Disable verbose logging
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
    next();
});

// Serve static files from root
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.wasm')) {
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        }
    }
}));

// Serve Scramjet files
app.use("/scram/", express.static(scramjetPath, {
    setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
}));

// Serve libcurl transport
app.use("/libcurl/", express.static(libcurlPath, {
    setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
}));

// Serve BareMux
app.use("/baremux/", express.static(baremuxPath, {
    setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
}));

// Create HTTP server
const server = createServer();

// Handle HTTP requests with Express
server.on("request", (req, res) => {
    app(req, res);
});

// Handle WebSocket upgrade for WISP
server.on("upgrade", (req, socket, head) => {
    if (req.url.endsWith("/wisp/")) {
        console.log("📡 WISP WebSocket connection established");
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
    console.log("🚀 Scramjet Proxy Server with WISP");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 WISP Endpoint: ws://localhost:${PORT}/wisp/`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nServing static files:");
    console.log(`  📂 Root: ${__dirname}`);
    console.log(`  📦 Scramjet: /scram/`);
    console.log(`  📦 BareMux: /baremux/`);
    console.log(`  📦 libcurl: /libcurl/`);
    console.log("\nPress Ctrl+C to stop");
});
