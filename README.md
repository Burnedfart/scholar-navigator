# Practice Problems Platform <!-- Last Updated: 2026-01-26 01:28 -->

A modern, educational platform for students and developers to explore web architecture, URL encoding, session management, and content retrieval.

## 📚 Overview

Practice Problems is designed as a learning tool to demonstrate how web requests flow through intermediary systems. It provides a clean, professional interface for fetching and inspecting educational content from across the web.

## 🚀 Key Features

- **Interactive Fetcher**: Retrieve and render web content in a sandboxed environment.
- **Protocol Inspection**: View response metadata, status codes, and headers.
- **Source Viewer**: Inspect the raw HTML/CSS/JS of retrieved content.
- **Secure Architecture**: Demonstrates URL encoding and safe request forwarding.
- **Responsive Design**: Fully functional on mobile and desktop devices.

## 📁 Technical Architecture

- **Backend**: Node.js with Express, handling request routing and proxying.
- **Frontend**: Vanilla JavaScript with a modern, dark-themed CSS architecture.
- **Security**: URL-safe Base64 encoding for request transmission.
- **Sessions**: In-memory session tracking for educational analysis.

## 🛠️ Installation & Setup

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

The server will start at `http://localhost:3000`.

## 📖 Educational Purpose

Every file in this project includes detailed comments explaining the underlying web protocols and architectural decisions. It is intended for researchers and students learning about network flow and server-side request handling.

---

*Built for exploration. Learn responsibly.*
