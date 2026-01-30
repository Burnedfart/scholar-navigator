# 🧭 Navigator

**Navigator** is a high-performance, feature-rich web proxy browser designed for speed, privacy, and customization. Built on top of the **Scramjet** engine and **BareMux** transport, Navigator provides a seamless "browser-within-a-browser" experience with advanced cloaking features.

## 🌟 Key Features

### 🚀 Powerful Proxying
- **Scramjet Engine**: Optimized for modern web compatibility and speed.
- **BareMux Transport**: Flexible transport layer supporting WISP and other protocols.
- **Service Worker Driven**: Operates entirely within your browser for a smooth, app-like experience.

### 🍱 Desktop-Class UI
- **Dynamic Tab System**: Manage multiple proxied sessions simultaneously.
- **Modern Navigation**: Fully functional Back, Forward, Refresh, and Home controls.
- **Interactive Omnibox**: Smart address bar with real-time URL syncing and search capabilities.
- **Pinned Apps**: Quick access to your favorite sites from the custom home screen.

### 🎨 Personalization
- **Theme System**: Choose from presets like *Cloud*, *Ink*, *Coffee*, and *Nebula*.
- **Live Theme Editor**: Create your own custom color palettes with real-time previews.
- **Logo Filters**: Intelligent logo recoloring to match your chosen theme.

### 🎭 Stealth & Security
- **about:blank Cloaking**: Launch the proxy inside a hidden `about:blank` window to prevent history tracking.
- **Tab Disguiser**: Instantly mask your tab title and favicon as "Google Classroom," "Google Drive," "Wikipedia," and more.
- **Panic Redirection**: Quickly redirect the original tab to a safe URL when entering cloak mode.
- **Inception Protection**: Safeguards against redundant proxy loops and unauthorized embedding.

## 🛠️ Technology Stack
- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables), ES6+ JavaScript.
- **Core Engine**: Scramjet v2 (Alpha).
- **Transport**: BareMux & WISP.
- **Security**: Service Workers, COOP/COEP Isolation.

## 🚀 Getting Started

### Prerequisites
- A modern Chromium-based browser (Chrome, Edge, Brave).
- A running WISP server (configured in `js/proxy-init.js`).

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Burnedfart/scholar-navigator.git
   ```
2. Serve the directory using any static web server:
 
3. Open the provided local URL in your browser.

## ⚙️ Configuration
- **WISP Server**: Update the `wispUrl` in `js/proxy-init.js` to point to your backend.
- **Disguises**: Customize preset disguises in the `Browser` class within `js/browser.js`.

---
*Disclaimer: This project is for educational purposes. Please use responsibly and respect the terms of service of the websites you visit.*
