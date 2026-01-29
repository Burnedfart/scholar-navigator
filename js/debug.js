/**
 * Developer Debug Menu
 * Accessible via showDebugMenu() in the console
 */

(function () {
    'use strict';

    const DEBUG_MENU_ID = 'dev-debug-menu';

    function createDebugMenu() {
        if (document.getElementById(DEBUG_MENU_ID)) return;

        const style = document.createElement('style');
        style.textContent = `
            #${DEBUG_MENU_ID} {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 450px;
                max-width: 90vw;
                max-height: 80vh;
                background: rgba(15, 15, 25, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                z-index: 1000000;
                color: white;
                font-family: 'Montserrat', sans-serif;
                padding: 24px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                animation: debugFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes debugFadeIn {
                from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }

            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 12px;
            }

            .debug-title {
                font-size: 18px;
                font-weight: 700;
                color: #a78bfa;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .debug-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                font-size: 20px;
                transition: color 0.2s;
            }

            .debug-close:hover {
                color: white;
            }

            .debug-content {
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding-right: 4px;
            }

            .debug-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .debug-section-title {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 8px;
            }

            .debug-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }

            .debug-btn {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 10px 14px;
                color: white;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .debug-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
            }

            .debug-btn:active {
                transform: translateY(0);
            }

            .debug-btn.danger {
                color: #f87171;
            }

            .debug-btn.danger:hover {
                background: rgba(248, 113, 113, 0.1);
                border-color: rgba(248, 113, 113, 0.3);
            }

            .debug-info-list {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                padding: 12px;
                font-size: 12px;
                font-family: 'monospace';
                color: rgba(255, 255, 255, 0.7);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .debug-info-item {
                display: flex;
                justify-content: space-between;
            }

            .debug-info-value {
                color: #6ee7b7;
            }

            .debug-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                z-index: 999999;
                display: none;
            }

            .debug-overlay.show {
                display: block;
            }

            /* Scrollbar styling */
            .debug-content::-webkit-scrollbar {
                width: 4px;
            }
            .debug-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .debug-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.className = 'debug-overlay';
        overlay.id = 'debug-overlay';
        document.body.appendChild(overlay);

        const menu = document.createElement('div');
        menu.id = DEBUG_MENU_ID;
        menu.style.display = 'none';
        menu.innerHTML = `
            <div class="debug-header">
                <div class="debug-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    Developer Debug Menu
                </div>
                <button class="debug-close" id="debug-close-btn">✕</button>
            </div>
            <div class="debug-content">
                <div class="debug-section">
                    <div class="debug-section-title">UI Controls</div>
                    <div class="debug-grid">
                        <button class="debug-btn" id="db-btn-emergency">
                            🚨 Emergency UI
                        </button>
                        <button class="debug-btn" id="db-btn-banner">
                            ⚠️ Network Banner
                        </button>
                        <button class="debug-btn" id="db-btn-spinner">
                            🔄 Toggle Spinner
                        </button>
                        <button class="debug-btn" id="db-btn-theme">
                            🌓 Toggle Theme
                        </button>
                    </div>
                </div>

                <div class="debug-section">
                    <div class="debug-section-title">System & Proxy</div>
                    <div class="debug-grid">
                        <button class="debug-btn" id="db-btn-diagnose">
                            🔬 Run Diagnostics
                        </button>
                        <button class="debug-btn" id="db-btn-sw">
                            📦 SW Status
                        </button>
                        <button class="debug-btn" id="db-btn-tabs">
                            📑 Log Tabs Data
                        </button>
                        <button class="debug-btn danger" id="db-btn-clear">
                            🗑️ Reset Storage
                        </button>
                    </div>
                </div>

                <div class="debug-section">
                    <div class="debug-section-title">Live Stats</div>
                    <div class="debug-info-list" id="debug-stats">
                        <div class="debug-info-item">
                            <span>WISP Connection:</span>
                            <span class="debug-info-value" id="stat-wisp">Checking...</span>
                        </div>
                        <div class="debug-info-item">
                            <span>Service Worker:</span>
                            <span class="debug-info-value" id="stat-sw">Checking...</span>
                        </div>
                        <div class="debug-info-item">
                            <span>Active Tabs:</span>
                            <span class="debug-info-value" id="stat-tabs">0</span>
                        </div>
                        <div class="debug-info-item">
                            <span>Memory Usage:</span>
                            <span class="debug-info-value" id="stat-mem">N/A</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(menu);

        // Event Listeners
        document.getElementById('debug-close-btn').addEventListener('click', hideDebugMenu);
        overlay.addEventListener('click', hideDebugMenu);

        // Button Handlers
        document.getElementById('db-btn-emergency').addEventListener('click', () => {
            if (window.ErrorHandler) {
                window.ErrorHandler.show('Debug Emergency UI Triggered', 'Manual trigger from developer console.');
            }
        });

        document.getElementById('db-btn-banner').addEventListener('click', () => {
            const banner = document.getElementById('network-warning-banner');
            if (banner) {
                banner.classList.toggle('hidden');
            }
        });

        document.getElementById('db-btn-spinner').addEventListener('click', () => {
            if (window.app && typeof window.app.setLoading === 'function') {
                const isSpinning = document.querySelector('.logo-container img')?.classList.contains('spin');
                window.app.setLoading(!isSpinning);
            }
        });

        document.getElementById('db-btn-theme').addEventListener('click', () => {
            const root = document.documentElement;
            const currentBg = getComputedStyle(root).getPropertyValue('--window-bg').trim();
            // Simple toggle for testing (actual theme logic might be more complex)
            if (currentBg.includes('0, 0, 0') || currentBg === '#0a0a0c') {
                root.style.setProperty('--window-bg', '#ffffff');
                root.style.setProperty('--text-main', '#1a202c');
            } else {
                root.style.setProperty('--window-bg', '#0a0a0c');
                root.style.setProperty('--text-main', '#ffffff');
            }
            if (window.app && typeof window.app.checkThemeContrast === 'function') {
                window.app.checkThemeContrast();
            }
        });

        document.getElementById('db-btn-diagnose').addEventListener('click', async () => {
            const btn = document.getElementById('db-btn-diagnose');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Running...';
            btn.disabled = true;

            if (window.WispHealthChecker) {
                // Get URLs from ProxyService if possible
                const wispUrl = window.ProxyService?.wispUrl || (location.protocol === "https:" ? "wss" : "ws") + "://navigator.scholarnavigator.workers.dev/wisp/";
                const httpUrl = "https://navigator.scholarnavigator.workers.dev/api/health";

                console.log('🧪 Starting manual diagnostics...');
                const results = await window.WispHealthChecker.diagnose(wispUrl, httpUrl);
                console.log('🧪 Results:', results);
                alert(`Diagnosis: ${results.diagnosis}\n\nRecommendations:\n- ${results.recommendations.join('\n- ')}`);
            } else {
                alert('WispHealthChecker not loaded');
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
            updateStats();
        });

        document.getElementById('db-btn-sw').addEventListener('click', async () => {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                if (regs.length === 0) {
                    alert('No service workers registered');
                } else {
                    const info = regs.map(r => `Scope: ${r.scope}\nStatus: ${r.active ? 'Active' : 'Missing Active'}`).join('\n\n');
                    alert(`Registered Service Workers:\n\n${info}`);
                }
            }
        });

        document.getElementById('db-btn-tabs').addEventListener('click', () => {
            if (window.app && window.app.tabs) {
                console.table(window.app.tabs);
                alert(`Logged ${window.app.tabs.length} tabs to console.`);
            }
        });

        document.getElementById('db-btn-clear').addEventListener('click', () => {
            if (window.ErrorHandler) {
                const confirmed = confirm('DANGER: This will clear ALL application data and reload. Proceed?');
                if (confirmed) {
                    window.ErrorHandler.clearStorage();
                }
            }
        });
    }

    function updateStats() {
        const wispStat = document.getElementById('stat-wisp');
        const swStat = document.getElementById('stat-sw');
        const tabsStat = document.getElementById('stat-tabs');
        const memStat = document.getElementById('stat-mem');

        if (window.WispHealthChecker) {
            wispStat.textContent = window.WispHealthChecker.isHealthy ? 'Connected' : 'Disconnected';
            wispStat.style.color = window.WispHealthChecker.isHealthy ? '#6ee7b7' : '#f87171';
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                const active = regs.some(r => r.active);
                swStat.textContent = active ? 'Active' : 'Inactive';
                swStat.style.color = active ? '#6ee7b7' : '#f87171';
            });
        }

        if (window.app && window.app.tabs) {
            tabsStat.textContent = window.app.tabs.length;
        }

        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
            memStat.textContent = `${used}MB`;
        }
    }

    function showDebugMenu() {
        createDebugMenu();
        const menu = document.getElementById(DEBUG_MENU_ID);
        const overlay = document.getElementById('debug-overlay');

        menu.style.display = 'flex';
        overlay.classList.add('show');

        updateStats();
        console.log('🔓 [DEV] Debug menu opened');
    }

    function hideDebugMenu() {
        const menu = document.getElementById(DEBUG_MENU_ID);
        const overlay = document.getElementById('debug-overlay');

        if (menu) menu.style.display = 'none';
        if (overlay) overlay.classList.remove('show');
    }

    // Expose to global scope
    window.showDebugMenu = showDebugMenu;

    console.log('🛠️ [DEV] showDebugMenu() available. Type it in the console to explore.');
})();
