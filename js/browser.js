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

        // Settings Elements
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsCloseBtn = document.getElementById('settings-close-btn');
        this.themeBtns = document.querySelectorAll('.theme-btn');

        this.navBtns = {
            back: document.getElementById('nav-back'),
            forward: document.getElementById('nav-forward'),
            refresh: document.getElementById('nav-refresh'),
            home: document.getElementById('nav-home'),
        };

        // Safety: Check if critical elements exist before proceeding
        if (!this.tabsContainer || !this.viewportsContainer || !this.omnibox || !this.settingsBtn) {
            console.error('[BROWSER] Critical DOM elements missing. Mismatched cache suspected.');
        }

        this.init().catch(err => {
            console.error('[BROWSER] Fatal initialization error:', err);
        });
    }

    async init() {
        // INCEPTION GUARD: Never load the browser UI inside an iframe
        if (window.self !== window.top) {
            console.warn('[BROWSER] Inception detected (running in iframe). Aborting UI initialization.');
            // proxy-init.js already aborted initialization, just return silently
            return;
        }

        this.bindEvents();
        this.loadTheme();
        this.updateProxyStatus('loading');

        // Check for URL in query parameters
        const params = new URLSearchParams(window.location.search);
        const urlToOpen = params.get('url');

        if (urlToOpen && urlToOpen !== 'browser://home') {
            const decodedUrl = decodeURIComponent(urlToOpen);

            // Clean up the address bar
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            console.log('[BROWSER] Deep-linking to:', decodedUrl);
            this.createTab(decodedUrl);
        } else {
            this.createTab();
        }

        try {
            await window.ProxyService.ready;
            this.updateProxyStatus('connected');
        } catch (e) {
            console.error('[BROWSER] Proxy initialization error:', e);
            this.updateProxyStatus('error');
            // Don't show alert - the error handler will show proper recovery UI if needed
            // This prevents false positives during SW updates
        }
    }



    bindEvents() {
        // Intercept new window requests from Scramjet or the Service Worker
        window.addEventListener('message', (e) => {
            if (!e.data) return;

            // Handle various "open" message formats
            // 1. Service Worker or internal redirect: { type: 'proxy:open', url: '...' }
            // 2. Scramjet 2.x: { type: 'scramjet:open', url: '...' }
            // 3. Nested Scramjet: { scramjet: { type: 'open', url: '...' } }

            let url = null;
            if (e.data.type === 'proxy:open') {
                url = e.data.url;
            } else if (e.data.type === 'scramjet:open') {
                url = e.data.url;
            } else if (e.data.scramjet && e.data.scramjet.type === 'open') {
                url = e.data.url || e.data.scramjet.url;
            }

            if (url) {
                console.log('[BROWSER] Intercepted link/window request:', url);

                // If it's an encoded Scramjet URL, we might want to decode it for the tab bar UI, 
                // but navigate() handles strings fine.
                this.createTab(url);
            }
        });

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

        // Settings Events
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.openSettings());
        }
        if (this.settingsCloseBtn) {
            this.settingsCloseBtn.addEventListener('click', () => this.closeSettings());
        }
        if (this.settingsModal) {
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) this.closeSettings();
            });
        }

        if (this.themeBtns) {
            this.themeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const theme = btn.getAttribute('data-theme');
                    this.setTheme(theme);
                });
            });
        }

        // Network Warning Close
        const warningClose = document.getElementById('warning-close-btn');
        if (warningClose) {
            warningClose.addEventListener('click', () => {
                document.getElementById('network-warning-banner').classList.add('hidden');
            });
        }
    }

    // Settings & Themes
    openSettings() {
        this.settingsModal.classList.remove('hidden');
        this.updateThemeActiveState();
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('browser_theme', theme);
        this.updateThemeActiveState();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('browser_theme') || 'cloud';
        this.setTheme(savedTheme);
    }

    updateThemeActiveState() {
        const currentTheme = localStorage.getItem('browser_theme') || 'cloud';
        this.themeBtns.forEach(btn => {
            if (btn.getAttribute('data-theme') === currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
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
                <img src="assets/logo.png" class="home-logo-img">
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
                <div class="item-title">Add Pin</div>
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
                url = 'https://bing.com/search?q=' + encodeURIComponent(input);
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

                    // Helper function to override window.open
                    const attachWindowOpenOverride = () => {
                        try {
                            const iframeWindow = tab.iframe.contentWindow;

                            // Debug logging
                            console.log('[BROWSER] Override attempt - has contentWindow:', !!iframeWindow,
                                'already overridden:', iframeWindow?.__proxyTabsOverridden,
                                'iframe src:', tab.iframe.src?.substring(0, 100));

                            if (iframeWindow && !iframeWindow.__proxyTabsOverridden) {
                                console.log('[BROWSER] ⚡ Attaching window.open override...');

                                // Store the original
                                iframeWindow.__originalOpen = iframeWindow.open;

                                // Override window.open
                                iframeWindow.open = (url, target, features) => {
                                    console.log('[BROWSER] ✅✅ Intercepted window.open:', url, 'target:', target);

                                    // Create new tab in our proxy
                                    this.createTab(url);

                                    // Return a mock window object
                                    return {
                                        focus: () => { },
                                        blur: () => { },
                                        close: () => { },
                                        closed: false,
                                        location: { href: url }
                                    };
                                };

                                iframeWindow.__proxyTabsOverridden = true;
                                console.log('[BROWSER] ✅ window.open override SUCCESS');

                                // AGGRESSIVE TARGET=_BLANK REMOVAL
                                // Use MutationObserver to catch dynamically loaded links
                                try {
                                    const removeBlankTargets = () => {
                                        const links = iframeWindow.document.querySelectorAll('a[target="_blank"]');
                                        if (links.length > 0) {
                                            console.log('[BROWSER] 🔗 Found', links.length, 'target=_blank links, removing...');
                                            links.forEach(link => {
                                                link.removeAttribute('target');
                                                console.log('[BROWSER] 🔗 Removed target from:', link.href);
                                            });
                                        }
                                    };

                                    // Remove immediately
                                    removeBlankTargets();

                                    // Watch for new links being added
                                    const observer = new MutationObserver(() => {
                                        removeBlankTargets();
                                    });

                                    observer.observe(iframeWindow.document.body, {
                                        childList: true,
                                        subtree: true,
                                        attributes: true,
                                        attributeFilter: ['target']
                                    });

                                    console.log('[BROWSER] ✅ target=_blank removal observer active');
                                } catch (err) {
                                    console.warn('[BROWSER] ⚠️ Could not attach observer:', err.message);
                                }

                                // NOTE: We removed link click interception because:
                                // 1. Scramjet truncates href to "..." for security
                                // 2. Cross-origin detection broke normal navigation  
                                // 3. Scramjet's postMessage API sends full URLs for window.open
                                // The window.open override above is sufficient.
                            }
                        } catch (e) {
                            // Cross-origin or security errors
                            console.warn('[BROWSER] ⚠️ Cannot override window.open:', e.message);
                        }
                    };

                    // Attach immediately
                    setTimeout(attachWindowOpenOverride, 100);

                    // Attach on load
                    tab.iframe.addEventListener('load', () => {
                        if (this.activeTabId === tab.id) {
                            this.setLoading(false);
                        }
                        attachWindowOpenOverride();
                    });

                    // Also try to re-attach periodically for the first few seconds
                    // (in case the iframe content loads asynchronously)
                    let attempts = 0;
                    const reattachInterval = setInterval(() => {
                        attachWindowOpenOverride();
                        attempts++;
                        if (attempts >= 10) {
                            clearInterval(reattachInterval);
                        }
                    }, 500);

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
        }
    }

    async fetchFavicon(tab, url) {
        try {
            const response = await fetch(url);
            const text = await response.text();

            // Simple regex to find <link rel="icon" href="...">
            const linkRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i;
            const match = text.match(linkRegex);

            if (match && match[1]) {
                let faviconUrl = match[1];
                faviconUrl = new URL(faviconUrl, url).href;
                this.updateFavicon(tab, faviconUrl);
            } else {
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
