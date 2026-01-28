/**
 * Browser Controller
 * Manages tabs, UI state, and navigation.
 */

class Browser {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.nextTabId = 1;
        this.maxTabs = 10;

        // Blocked Domains (Base64 Encoded for basic obfuscation)
        this.blockedKeywords = ["cG9ybg==", "eHh4", "YWR1bHQ=", "c2V4"];

        // DOM Elements
        this.tabsContainer = document.getElementById('tabs-container');
        this.viewportsContainer = document.getElementById('viewports-container');
        this.omnibox = document.getElementById('omnibox-input');
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.proxyStatus = document.getElementById('proxy-status');
        this.logo = document.querySelector('.logo-container img'); // Select the image directly

        // Modal Elements
        this.modal = document.getElementById('custom-app-modal');
        this.appNameInput = document.getElementById('app-name');
        this.appUrlInput = document.getElementById('app-url');
        this.btnAddApp = document.getElementById('btn-add-app');
        this.btnCancelApp = document.getElementById('btn-cancel-app');

        this.navBtns = {
            back: document.getElementById('nav-back'),
            forward: document.getElementById('nav-forward'),
            refresh: document.getElementById('nav-refresh'),
            home: document.getElementById('nav-home'),
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        this.checkThemeContrast();
        this.updateProxyStatus('loading');

        // Create initial tab (Home)
        this.createTab();

        try {
            await window.ProxyService.ready;
            this.updateProxyStatus('connected');
        } catch (e) {
            this.updateProxyStatus('error');
            alert('Proxy initialization failed. Please reload.');
        }
    }

    checkThemeContrast() {
        // Automatic Logo Contrast Detection
        const root = document.documentElement;
        const bgColor = getComputedStyle(root).getPropertyValue('--window-bg').trim();

        // Simple brightness check
        const isDark = (color) => {
            let r, g, b;
            if (color.startsWith('#')) {
                const hex = color.replace('#', '');
                r = parseInt(hex.substr(0, 2), 16);
                g = parseInt(hex.substr(2, 2), 16);
                b = parseInt(hex.substr(4, 2), 16);
            } else if (color.startsWith('rgb')) {
                const parts = color.match(/\d+/g);
                r = parseInt(parts[0]);
                g = parseInt(parts[1]);
                b = parseInt(parts[2]);
            } else {
                return false; // Fallback, assume light
            }
            // Luminance formula
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness < 128; // < 128 is dark
        };

        if (isDark(bgColor)) {
            root.style.setProperty('--logo-filter', 'none'); // White logo on dark
        } else {
            root.style.setProperty('--logo-filter', 'invert(1)'); // Black logo on light
        }
    }

    bindEvents() {
        this.newTabBtn.addEventListener('click', () => this.createTab());

        this.omnibox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleOmniboxSubmit();
            }
        });

        this.navBtns.back.addEventListener('click', () => {
            const tab = this.getActiveTab();
            if (tab && tab.iframe && tab.iframe.contentWindow) {
                tab.iframe.contentWindow.history.back();
            }
        });

        this.navBtns.forward.addEventListener('click', () => {
            const tab = this.getActiveTab();
            if (tab && tab.iframe && tab.iframe.contentWindow) {
                tab.iframe.contentWindow.history.forward();
            }
        });

        this.navBtns.refresh.addEventListener('click', () => {
            const tab = this.getActiveTab();
            if (tab) {
                if (tab.url === 'browser://home') {
                    this.renderHomePage(tab); // Re-render to show any new custom apps
                } else if (tab.iframe) {
                    this.setLoading(true);
                    tab.iframe.contentWindow.location.reload();
                    // Determine when stop loading? Difficult with iframe cross-origin.
                    // We'll set a timeout fallback or rely on onload if possible.
                    tab.iframe.onload = () => this.setLoading(false);
                }
            }
        });

        this.navBtns.home.addEventListener('click', () => {
            this.navigate('browser://home');
        });

        // Modal Events
        this.btnAddApp.addEventListener('click', () => this.addCustomApp());
        this.btnCancelApp.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Modal Inputs Enter key
        const handleModalEnter = (e) => {
            if (e.key === 'Enter') this.addCustomApp();
            if (e.key === 'Escape') this.closeModal();
        };
        this.appNameInput.addEventListener('keydown', handleModalEnter);
        this.appUrlInput.addEventListener('keydown', handleModalEnter);
    }

    updateProxyStatus(status) {
        this.proxyStatus.className = `status-indicator ${status}`;
        this.proxyStatus.title = `Proxy Status: ${status}`;

        if (status === 'loading') {
            this.setLoading(true);
        } else {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        if (this.logo) {
            if (isLoading) {
                this.logo.classList.add('spin');
            } else {
                this.logo.classList.remove('spin');
            }
        }
    }

    isUrlBlocked(url) {
        try {
            const urlObj = new URL(url);
            const fullString = urlObj.toString().toLowerCase();

            // Check against basic keywords
            for (const keywordB64 of this.blockedKeywords) {
                const keyword = atob(keywordB64);
                if (fullString.includes(keyword)) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            // If invalid URL, allow logic elsewhere to handle or block if it looks suspicious? 
            // For now, assume valid URLs passed here.
            return false;
        }
    }

    createTab(url = 'browser://home') {
        if (this.tabs.length >= this.maxTabs) return;

        const id = this.nextTabId++;
        const tab = {
            id,
            url,
            title: 'New Tab',
            favicon: '',
            iframe: null,
            scramjetWrapper: null,
            homeElement: null,
            element: null
        };

        // Create Tab UI
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        tabEl.dataset.id = id;
        tabEl.innerHTML = `
            <img class="tab-favicon" src="" style="display:none;"> 
            <div class="tab-title">New Tab</div>
            <div class="tab-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
        `;

        tabEl.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-close')) {
                this.switchTab(id);
            }
        });

        tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(id);
        });

        this.tabsContainer.insertBefore(tabEl, this.newTabBtn);
        tab.element = tabEl;

        this.createViewport(tab);
        this.tabs.push(tab);
        this.switchTab(id);

        if (url !== 'browser://home') {
            this.navigate(url);
        }
    }

    createViewport(tab) {
        const homeEl = document.createElement('div');
        homeEl.className = 'home-page hidden';
        this.viewportsContainer.appendChild(homeEl);
        tab.homeElement = homeEl;

        this.renderHomePage(tab);
    }

    renderHomePage(tab) {
        if (!tab.homeElement) return;

        // Default Apps
        const apps = [
            { name: 'Bing', url: 'https://bing.com', icon: 'B' },
            { name: 'Coolmath Games', url: 'https://coolmathgames.com', icon: 'CM' },
            { name: 'GitHub', url: 'https://github.com', icon: 'GH' }
        ];

        // Custom Apps from LocalStorage
        const customApps = JSON.parse(localStorage.getItem('custom_apps') || '[]');
        const allApps = [...apps, ...customApps];

        let gridHtml = `
            <div class="home-logo">
                <img src="assets/logo.png" style="width: 80px; height: 80px; object-fit: contain;">
            </div>
            <div class="home-grid">
        `;

        allApps.forEach(app => {
            // Determine icon display
            let iconContent = app.icon || app.name.charAt(0).toUpperCase();

            gridHtml += `
                <div class="grid-item" data-url="${app.url}">
                    <div class="item-icon">${iconContent}</div>
                    <div class="item-title">${app.name}</div>
                </div>
            `;
        });

        // Add "Add App" Button
        gridHtml += `
            <div class="grid-item add-app-btn" id="add-app-trigger-${tab.id}">
                <div class="item-icon">+</div>
                <div class="item-title">Add App</div>
            </div>
        `;

        // Add "Clear Storage" Button (Debug/Recovery)
        gridHtml += `
            <div class="grid-item debug-btn" id="clear-storage-trigger-${tab.id}" style="opacity: 0.7;" title="Clear all storage and reload">
                <div class="item-icon">🗑️</div>
                <div class="item-title">Clear Storage</div>
            </div>
        `;

        gridHtml += `</div>`;
        tab.homeElement.innerHTML = gridHtml;

        // Attach Event Listeners for Grid Items
        tab.homeElement.querySelectorAll('.grid-item:not(.add-app-btn):not(.debug-btn)').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.getAttribute('data-url');
                this.navigate(url);
            });
        });

        // Attach Event Listener for Add App
        const addBtn = tab.homeElement.querySelector(`#add-app-trigger-${tab.id}`);
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        // Attach Event Listener for Clear Storage
        const clearBtn = tab.homeElement.querySelector(`#clear-storage-trigger-${tab.id}`);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (window.ErrorHandler) {
                    const confirmed = confirm('This will clear all storage (IndexedDB, localStorage, caches, etc.) and reload the page. Continue?');
                    if (confirmed) {
                        window.ErrorHandler.clearStorage();
                    }
                }
            });
        }
    }

    openModal() {
        this.modal.classList.remove('hidden');
        this.appNameInput.value = '';
        this.appUrlInput.value = '';
        this.appNameInput.focus();
    }

    closeModal() {
        this.modal.classList.add('hidden');
    }

    addCustomApp() {
        const name = this.appNameInput.value.trim();
        let url = this.appUrlInput.value.trim();

        if (!name || !url) return;

        try {
            // Basic URL validation/fix
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            new URL(url); // Will throw if invalid
        } catch (e) {
            alert('Invalid URL');
            return;
        }

        const customApps = JSON.parse(localStorage.getItem('custom_apps') || '[]');
        customApps.push({ name, url });
        localStorage.setItem('custom_apps', JSON.stringify(customApps));

        this.closeModal();

        // Re-render home page for all tabs that are currently on home
        this.tabs.forEach(t => {
            if (t.url === 'browser://home') {
                this.renderHomePage(t);
            }
        });
    }

    switchTab(id) {
        if (this.activeTabId === id) return;

        // Deactivate old
        const oldTab = this.tabs.find(t => t.id === this.activeTabId);
        if (oldTab) {
            oldTab.element.classList.remove('active');
            if (oldTab.iframe) oldTab.iframe.classList.remove('active');
            if (oldTab.homeElement) oldTab.homeElement.classList.add('hidden');
        }

        // Activate new
        const newTab = this.tabs.find(t => t.id === id);
        if (newTab) {
            newTab.element.classList.add('active');
            this.activeTabId = id;

            if (newTab.url === 'browser://home') {
                newTab.homeElement.classList.remove('hidden');
                if (newTab.iframe) newTab.iframe.classList.remove('active');
                this.omnibox.value = '';
                this.omnibox.placeholder = 'Search or enter address';
                this.setLoading(false); // Home is static
            } else {
                if (newTab.homeElement) newTab.homeElement.classList.add('hidden');
                if (newTab.iframe) newTab.iframe.classList.add('active');
                this.omnibox.value = newTab.url;
                // If it was loading? We don't track per-tab loading state deeply in this simple refactor, 
                // but checking connection/spin could be global or per active tab. 
                // For now, simplicity: active tab determines spinner.
            }
        }
    }

    closeTab(id) {
        const tabIndex = this.tabs.findIndex(t => t.id === id);
        if (tabIndex === -1) return;

        const tab = this.tabs[tabIndex];

        // Remove Elements
        tab.element.remove();
        if (tab.iframe) tab.iframe.remove();
        if (tab.homeElement) tab.homeElement.remove();

        this.tabs.splice(tabIndex, 1);

        if (this.activeTabId === id) {
            if (this.tabs.length > 0) {
                const nextTab = this.tabs[tabIndex] || this.tabs[tabIndex - 1];
                this.switchTab(nextTab.id);
            } else {
                this.createTab();
            }
        }
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    handleOmniboxSubmit() {
        const input = this.omnibox.value.trim();
        if (!input) return;
        this.navigate(input);
    }

    async navigate(input) {
        if (!window.ProxyService.initialized) {
            alert('Proxy is still loading...');
            return;
        }

        let url = input;
        if (input === 'browser://home') {
            url = input;
        } else if (!input.startsWith('http')) {
            if (input.includes('.') && !input.includes(' ')) {
                url = 'https://' + input;
            } else {
                url = 'https://www.google.com/search?q=' + encodeURIComponent(input);
            }
        }

        // BLOCKING CHECK
        if (this.isUrlBlocked(url)) {
            // Cancel and redirect home
            this.navigate('browser://home');
            return;
        }

        const tab = this.getActiveTab();
        if (!tab) return;

        tab.url = url;

        // UI Updates
        tab.title = new URL(url).hostname || 'Browse';
        tab.element.querySelector('.tab-title').textContent = tab.title;
        // Reset Favicon
        this.updateFavicon(tab, '');

        this.omnibox.value = url;

        if (url === 'browser://home') {
            if (tab.iframe) tab.iframe.classList.remove('active');
            tab.homeElement.classList.remove('hidden');
            this.setLoading(false);
        } else {
            tab.homeElement.classList.add('hidden');
            this.setLoading(true);

            if (!tab.scramjetWrapper || !tab.iframe) {
                if (window.scramjet) {
                    tab.scramjetWrapper = window.scramjet.createFrame();
                    tab.iframe = tab.scramjetWrapper.frame;
                    tab.iframe.classList.add('browser-viewport');
                    tab.iframe.classList.add('active');
                    tab.iframe.style.border = 'none';
                    tab.iframe.width = '100%';
                    tab.iframe.style.position = 'absolute';
                    this.viewportsContainer.appendChild(tab.iframe);

                    // Add load listener to stop spinner
                    tab.iframe.onload = () => {
                        if (this.activeTabId === tab.id) {
                            this.setLoading(false);
                        }
                    };
                } else {
                    console.error('Scramjet unavailable');
                    this.setLoading(false);
                    return;
                }
            }

            tab.iframe.classList.add('active');

            if (tab.scramjetWrapper) {
                try {
                    await tab.scramjetWrapper.go(url);
                    // Fetch Favicon separately since we can't easily access iframe DOM
                    this.fetchFavicon(tab, url);
                } catch (e) {
                    console.error("Navigation failed", e);
                    this.setLoading(false);
                }
            }
        }
    }

    updateFavicon(tab, src) {
        tab.favicon = src;
        const iconEl = tab.element.querySelector('.tab-favicon');
        if (src) {
            iconEl.src = src;
            iconEl.style.display = 'block';

            // If fallback for load error
            iconEl.onerror = () => {
                iconEl.style.display = 'none'; // Fallback to blank
            };
        } else {
            iconEl.style.display = 'none'; // Blank circle is default via CSS effectively or just hidden image
            // CSS for .tab-favicon has a background-color #ccc so hidden img shows that.
        }
    }

    async fetchFavicon(tab, url) {
        // Attempt to fetch the page content to parse for favicon
        // We use fetch() - if CORS fails, we might fail to get it. 
        // As a proxy, ideally we'd fetch through the proxy helper if available, but window.fetch 
        // will go through the Service Worker if it intercepts matching requests.
        try {
            const response = await fetch(url);
            const text = await response.text();

            // Simple regex to find <link rel="icon" href="...">
            // Supports: rel="icon", rel="shortcut icon", href can be relative or absolute
            const linkRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i;
            const match = text.match(linkRegex);

            if (match && match[1]) {
                let faviconUrl = match[1];
                // Resolve relative URLs
                faviconUrl = new URL(faviconUrl, url).href;
                this.updateFavicon(tab, faviconUrl);
            } else {
                // Try default only if not found (less strict per prompt, but good fallback)
                // Prompt says: "If favicon fetch fails: Fall back to a blank circle."
                // So we don't try strict guessing if regex fails.
                this.updateFavicon(tab, '');
            }
        } catch (e) {
            console.warn('Favicon fetch failed', e);
            this.updateFavicon(tab, '');
        }
    }
}

// Start
window.app = new Browser();
