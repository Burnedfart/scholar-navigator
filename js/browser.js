class Browser {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.nextTabId = 1;
        this.maxTabs = 10;


        this.blockedKeywords = ["cG9ybg==", "eHh4", "YWR1bHQ=", "c2V4"];

        // DOM Elements
        this.tabsContainer = document.getElementById('tabs-container');
        this.viewportsContainer = document.getElementById('viewports-container');
        this.omnibox = document.getElementById('omnibox-input');
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.proxyStatus = document.getElementById('proxy-status');
        this.logo = document.querySelector('.logo-container img');

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

        // Theme Editor Elements
        this.themeEditorModal = document.getElementById('theme-editor-modal');
        this.btnOpenThemeEditor = document.getElementById('btn-open-theme-editor');
        this.btnCloseThemeEditor = document.getElementById('theme-editor-close-btn');
        this.btnSaveTheme = document.getElementById('btn-save-theme');
        this.btnResetTheme = document.getElementById('btn-reset-theme');
        this.customThemeNameInput = document.getElementById('custom-theme-name');
        this.colorInputs = document.querySelectorAll('.color-item input[type="color"]');

        // Cloak Elements
        this.cloakToggle = document.getElementById('cloak-toggle');
        this.btnTriggerCloak = document.getElementById('btn-trigger-cloak');

        // Disguise Elements
        this.disguiseSelect = document.getElementById('disguise-select');
        this.btnApplyDisguise = document.getElementById('btn-apply-disguise');
        this.btnResetDisguise = document.getElementById('btn-reset-disguise');

        // Performance Elements
        this.perfToggles = {
            animations: document.getElementById('perf-disable-animations'),
            shadows: document.getElementById('perf-disable-shadows'),
            blur: document.getElementById('perf-disable-blur'),
            showTabData: document.getElementById('perf-show-tab-data'),
            tabSleep: document.getElementById('perf-tab-sleep-toggle'),
            tabSleepTimer: document.getElementById('perf-tab-sleep-timer')
        };
        this.perfConfig = {
            tabSleepGroup: document.getElementById('tab-sleep-config'),
            tabSleepValue: document.getElementById('tab-sleep-value'),
            tabSleepTicks: document.querySelectorAll('.number-line-ticks .tick'),
            tabSleepDot: document.getElementById('tab-sleep-dot')
        };
        this.sleepThresholds = [60, 300, 600, 1200, 1800]; // 1m, 5m, 10m, 20m, 30m
        this.sleepInterval = null;



        // Monitor Elements
        this.monitorElements = {
            memoryBar: document.getElementById('monitor-memory-bar'),
            memoryValue: document.getElementById('monitor-memory-value'),
            tabsValue: document.getElementById('monitor-tabs-value'),
            uptimeValue: document.getElementById('monitor-uptime-value')
        };
        this.startTime = Date.now();
        this.monitorInterval = null;

        // Tooltip Elements
        this.tooltip = {
            el: document.getElementById('tab-tooltip'),
            memory: document.getElementById('tt-memory'),
            sleep: document.getElementById('tt-sleep'),
            sleepContainer: document.getElementById('tt-sleep-container')
        };
        this.currentTooltipTabId = null;
        this.tooltipUpdateInterval = null;

        // Error Modal
        this.errorModal = document.getElementById('error-modal');
        this.errorMessage = document.getElementById('error-message');
        this.errorOkBtn = document.getElementById('error-ok-btn');

        // Disguise Presets
        this.disguises = {
            'default': {
                title: 'Navigator',
                favicon: 'assets/logo.png'
            },
            'google-classroom': {
                title: 'Home - Classroom',
                favicon: 'https://ssl.gstatic.com/classroom/favicon.png'
            },
            'google-drive': {
                title: 'Home - Google Drive',
                favicon: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png'
            },
            'wikipedia': {
                title: 'Wikipedia',
                favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico'
            },
            'google-docs': {
                title: 'Google Docs',
                favicon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'
            },
            'gmail': {
                title: 'Inbox (24)',
                favicon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
            }
        };

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

        // Cloak Event Bindings
        if (this.cloakToggle) {
            this.cloakToggle.addEventListener('change', () => {
                localStorage.setItem('ab', this.cloakToggle.checked ? 'true' : 'false');
            });
        }
        if (this.btnTriggerCloak) {
            this.btnTriggerCloak.addEventListener('click', () => {
                this.openCloaked();
            });
        }

        // Disguise Event Bindings
        if (this.btnApplyDisguise) {
            this.btnApplyDisguise.addEventListener('click', () => {
                this.applyDisguise();
            });
        }
        if (this.btnResetDisguise) {
            this.btnResetDisguise.addEventListener('click', () => {
                this.resetDisguise();
            });
        }

        if (this.errorOkBtn) {
            this.errorOkBtn.addEventListener('click', () => this.hideError());
        }
        if (this.errorModal) {
            this.errorModal.addEventListener('click', (e) => {
                if (e.target === this.errorModal) this.hideError();
            });
        }

        // Performance Event Bindings
        Object.keys(this.perfToggles).forEach(key => {
            const toggle = this.perfToggles[key];
            if (toggle) {
                const eventType = toggle.type === 'range' ? 'input' : 'change';
                toggle.addEventListener(eventType, () => {
                    this.applyPerformanceSettings();
                    localStorage.setItem(`perf_${key}`, toggle.checked !== undefined ? (toggle.checked ? 'true' : 'false') : toggle.value);
                });
            }
        });

        // Settings Sidebar Navigation
        this.settingsNavItems = document.querySelectorAll('.nav-item');
        this.settingsScrollArea = document.querySelector('.settings-scroll-area');

        if (this.settingsNavItems.length > 0) {
            this.settingsNavItems.forEach(item => {
                item.addEventListener('click', () => {
                    const targetId = item.getAttribute('data-target');
                    const targetSection = document.getElementById(targetId);
                    if (targetSection && this.settingsScrollArea) {
                        this.settingsScrollArea.scrollTo({
                            top: targetSection.offsetTop - 32,
                            behavior: 'smooth'
                        });
                        this.updateActiveNavItem(item);
                    }
                });
            });
        }

        if (this.settingsScrollArea) {
            this.settingsScrollArea.addEventListener('scroll', () => this.handleSettingsScroll());
        }
    }

    /**
     * [SECURITY] Sanitize user input to prevent XSS attacks
     * Converts HTML special characters to their text equivalents
     */
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async init() {
        if (window.self !== window.top) {
            let isAllowedFrame = false;

            try {
                const parentUrl = window.parent.location.href;
                // Check for the existing about:blank cloak
                if (parentUrl === 'about:blank') {
                    isAllowedFrame = true;
                    console.log('[BROWSER] 🔐 Running in about:blank cloak');
                }
            } catch (e) {
                isAllowedFrame = true;
                console.log('[BROWSER] 🌐 Cross-origin iframe detected (likely Google Sites) - UI allowed');
            }

            if (!isAllowedFrame) {
                console.warn('[BROWSER] Inception detected (unauthorized iframe). Aborting UI initialization.');
                return;
            }
        }

        window.history.pushState({ anchor: true }, '');
        window.addEventListener('popstate', (e) => {
            console.log('[BROWSER] 🛡️ Popstate detected in shell! State:', e.state);
            if (e.state && e.state.anchor) return;
            window.history.pushState({ anchor: true }, '');
        });

        this.initializePins();
        this.bindEvents();
        this.loadTheme();
        this.loadDisguise();
        this.loadPerformanceSettings();
        this.updateProxyStatus('loading');
        if (localStorage.getItem('ab') === 'true') {
            this.openCloaked();
        }

        const params = new URLSearchParams(window.location.search);
        const urlToOpen = params.get('url');

        if (urlToOpen && urlToOpen !== 'browser://home') {
            const decodedUrl = decodeURIComponent(urlToOpen);

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
        }

        // Start Monitor
        this.startMonitor();
    }

    startMonitor() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.updateMonitor();
        this.monitorInterval = setInterval(() => this.updateMonitor(), 1000);
    }

    updateMonitor() {
        if (!this.monitorElements.memoryValue) return;

        // 1. Memory Usage
        let memUsed = 0;
        let memLimit = 1024; // Default limit 1GB for calculation

        if (window.performance && window.performance.memory) {
            memUsed = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
            memLimit = Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024));
        } else {
            // Fallback: Simulate realistic base browser usage based on tabs
            const baseUsage = 120; // Base MB
            const tabUsage = this.tabs.length * 45; // ~45MB per tab
            memUsed = baseUsage + tabUsage + Math.floor(Math.random() * 10);
        }

        const memPercent = Math.min(100, (memUsed / memLimit) * 100);
        this.monitorElements.memoryValue.textContent = `${memUsed} MB`;
        this.monitorElements.memoryBar.style.width = `${memPercent}%`;

        // Change color based on usage
        if (memPercent > 80) {
            this.monitorElements.memoryBar.style.background = 'var(--danger-color)';
        } else {
            this.monitorElements.memoryBar.style.background = 'var(--accent-color)';
        }

        // 2. Active Tabs
        this.monitorElements.tabsValue.textContent = this.tabs.length;

        // 3. Uptime
        const uptimeMs = Date.now() - this.startTime;
        const totalSeconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        this.monitorElements.uptimeValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // 4. Update individual tab memory (Fluctuation)
        this.tabs.forEach(tab => {
            if (!tab.sleeping) {
                const change = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2);
                tab.memory = Math.max(10, Math.min(500, tab.memory + change));
            }
        });
    }



    initializePins() {
        // Version number - increment this whenever you update the default apps list
        const PINS_VERSION = 2; // v1: initial 2 apps, v2: added YT/SpenFlix/GeForce NOW

        const defaultApps = [
            { name: 'Coolmath Games', url: 'https://coolmathgames.com', icon: 'CM' },
            { name: 'GitHub', url: 'https://github.com', icon: 'GH' },
            { name: 'YouTube (Unblocked)', url: 'https://yewtu.be', icon: 'YT' },
            { name: 'SpenFlix (Movies)', url: 'https://watch.spencerdevs.xyz/', icon: 'SF' },
            { name: 'GeForce NOW', url: 'https://www.geforcenow.com', icon: 'GF' }
        ];

        // Get current version from localStorage
        const storedVersion = parseInt(localStorage.getItem('pins_version') || '0');

        // If version is outdated or first visit, merge new defaults
        if (storedVersion < PINS_VERSION) {
            const existing = JSON.parse(localStorage.getItem('custom_apps') || '[]');

            // Filter out defaults that already exist (by URL) to avoid duplicates
            const newDefaults = defaultApps.filter(def =>
                !existing.some(ext => ext.url === def.url)
            );

            // Merge: new defaults first, then existing apps
            const combined = [...newDefaults, ...existing];

            localStorage.setItem('custom_apps', JSON.stringify(combined));
            localStorage.setItem('pins_version', PINS_VERSION.toString());
            localStorage.setItem('pins_initialized', 'true');

            if (storedVersion > 0) {
                console.log(`[BROWSER] 📌 Updated pins from v${storedVersion} to v${PINS_VERSION} - added ${newDefaults.length} new apps`);
            } else {
                console.log(`[BROWSER] 📌 Initialized pins v${PINS_VERSION}`);
            }
        }
    }

    bindEvents() {
        // Intercept new window requests from Scramjet or the Service Worker
        window.addEventListener('message', (e) => {
            if (!e.data) return;

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

        this.navBtns.back.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const tab = this.getActiveTab();
            if (!tab || tab.url === 'browser://home') return;

            if (this.__backProcessing) return;
            this.__backProcessing = true;
            setTimeout(() => this.__backProcessing = false, 300);

            if (tab.iframe && tab.iframe.contentWindow) {
                try {
                    const oldUrl = tab.url;
                    console.log('[NAVIGATOR] 🔙 Back Request. URL:', oldUrl);

                    if (tab.scramjetWrapper && typeof tab.scramjetWrapper.back === 'function') {
                        tab.scramjetWrapper.back();
                    } else {
                        tab.iframe.contentWindow.history.back();
                    }

                    // Sync UI after a longer delay to ensure the back navigation has committed
                    setTimeout(() => {
                        this.syncTabWithIframe(tab);
                        if (tab.url === oldUrl) {
                            console.log('[NAVIGATOR] 🔙 History exhausted. Returning Home.');
                            this.navigate('browser://home');
                        }
                    }, 500);
                } catch (err) {
                    console.error('[NAVIGATOR] 🔙 Execution Error:', err);
                    this.navigate('browser://home');
                }
            } else {
                this.navigate('browser://home');
            }
        });

        this.navBtns.forward.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const tab = this.getActiveTab();
            if (!tab) return;

            // Restore from Home if possible
            if (tab.url === 'browser://home' && tab.iframe) {
                if (this.__forwardProcessing) return;
                this.__forwardProcessing = true;
                setTimeout(() => this.__forwardProcessing = false, 300);

                console.log('[NAVIGATOR] 🔜 Forward from Home - restoring site view.');
                tab.homeElement.classList.add('hidden');
                tab.iframe.classList.add('active');

                // Immediately update tab.url and omnibox
                this.syncTabWithIframe(tab);
                return;
            }

            if (tab.url === 'browser://home') return;

            if (this.__forwardProcessing) return;
            this.__forwardProcessing = true;
            setTimeout(() => this.__forwardProcessing = false, 300);

            if (tab.iframe && tab.iframe.contentWindow) {
                try {
                    console.log('[NAVIGATOR] 🔜 Forward Request.');
                    if (tab.scramjetWrapper && typeof tab.scramjetWrapper.forward === 'function') {
                        tab.scramjetWrapper.forward();
                    } else {
                        tab.iframe.contentWindow.history.forward();
                    }

                    setTimeout(() => {
                        this.syncTabWithIframe(tab);
                    }, 500);
                } catch (err) {
                    console.error('[NAVIGATOR] 🔜 Forward error:', err);
                }
            }
        });

        this.navBtns.refresh.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const tab = this.getActiveTab();
            if (tab) {
                if (tab.url === 'browser://home') {
                    this.renderHomePage(tab);
                } else if (tab.iframe) {
                    this.setLoading(true);
                    if (tab.scramjetWrapper && typeof tab.scramjetWrapper.reload === 'function') {
                        tab.scramjetWrapper.reload();
                    } else {
                        tab.iframe.contentWindow.location.reload();
                    }
                    tab.iframe.onload = () => this.setLoading(false);
                }
            }
        });

        this.navBtns.home.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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
            // Theme Editor Events
            if (this.btnOpenThemeEditor) {
                this.btnOpenThemeEditor.addEventListener('click', () => this.openThemeEditor());
            }
            if (this.btnCloseThemeEditor) {
                this.btnCloseThemeEditor.addEventListener('click', () => this.closeThemeEditor());
            }
            if (this.themeEditorModal) {
                this.themeEditorModal.addEventListener('click', (e) => {
                    if (e.target === this.themeEditorModal) this.closeThemeEditor();
                });
            }
            if (this.btnSaveTheme) {
                this.btnSaveTheme.addEventListener('click', () => this.saveCustomTheme());
            }
            if (this.btnResetTheme) {
                this.btnResetTheme.addEventListener('click', () => this.resetThemeEditor());
            }

            this.colorInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    const varName = e.target.getAttribute('data-var');
                    const color = e.target.value;
                    document.documentElement.style.setProperty(varName, color);

                    // If updating primary text, we should ideally update the logo filter
                    // For custom themes, we'll default to a simple light/dark filter logic
                    if (varName === '--text-primary') {
                        this.updateLogoFilterForColor(color);
                    }
                    if (varName === '--window-bg') {
                        document.documentElement.style.setProperty('--window-bg-solid', color);
                    }
                });
            });
        }
    }

    // Settings & Themes
    openSettings() {
        if (this.cloakToggle) {
            this.cloakToggle.checked = localStorage.getItem('ab') === 'true';
        }
        if (this.disguiseSelect) {
            const savedDisguise = localStorage.getItem('tab_disguise') || 'default';
            this.disguiseSelect.value = savedDisguise;
        }
        this.settingsModal.classList.remove('hidden');
        this.updateThemeActiveState();

        // Reset to first section
        if (this.settingsScrollArea) {
            this.settingsScrollArea.scrollTop = 0;
            this.updateActiveNavItem(this.settingsNavItems[0]);
        }

        // Sync performance settings in UI
        Object.keys(this.perfToggles).forEach(key => {
            const toggle = this.perfToggles[key];
            if (toggle) {
                const val = localStorage.getItem(`perf_${key}`);
                if (toggle.type === 'checkbox') {
                    toggle.checked = val === 'true';
                } else if (toggle.type === 'range' && val !== null) {
                    toggle.value = val;
                }
            }
        });
    }

    loadPerformanceSettings() {
        Object.keys(this.perfToggles).forEach(key => {
            const toggle = this.perfToggles[key];
            if (toggle) {
                const val = localStorage.getItem(`perf_${key}`);
                if (toggle.type === 'checkbox') {
                    toggle.checked = val === 'true';
                } else if (toggle.type === 'range' && val !== null) {
                    toggle.value = val;
                }
            }
        });
        this.applyPerformanceSettings();
    }

    applyPerformanceSettings() {
        const doc = document.documentElement;

        if (this.perfToggles.animations && this.perfToggles.animations.checked) {
            doc.classList.add('perf-no-animations');
        } else {
            doc.classList.remove('perf-no-animations');
        }

        if (this.perfToggles.shadows && this.perfToggles.shadows.checked) {
            doc.classList.add('perf-no-shadows');
        } else {
            doc.classList.remove('perf-no-shadows');
        }

        if (this.perfToggles.blur && this.perfToggles.blur.checked) {
            doc.classList.add('perf-no-blur');
        } else {
            doc.classList.remove('perf-no-blur');
        }

        // Tab Sleep UI Sync
        const sleepEnabled = this.perfToggles.tabSleep && this.perfToggles.tabSleep.checked;
        if (this.perfConfig.tabSleepGroup) {
            this.perfConfig.tabSleepGroup.classList.toggle('disabled-gray', !sleepEnabled);
        }

        if (this.perfToggles.tabSleepTimer && this.perfConfig.tabSleepValue) {
            const val = parseInt(this.perfToggles.tabSleepTimer.value);
            const labels = ["1 Minute", "5 Minutes", "10 Minutes", "20 Minutes", "30 Minutes"];
            this.perfConfig.tabSleepValue.textContent = labels[val] || "5 Minutes";

            // Update Number Line Ticks
            if (this.perfConfig.tabSleepTicks) {
                this.perfConfig.tabSleepTicks.forEach((tick, idx) => {
                    tick.classList.toggle('active', idx === val);
                });
            }

            // Update Phantom Dot Position (The Jump Animation)
            if (this.perfConfig.tabSleepDot) {
                // val is 0-4. Calculate position from center of first tick (11px) to center of last tick (100% - 11px)
                const ratio = val / 4;
                this.perfConfig.tabSleepDot.style.left = `calc(11px + ${ratio} * (100% - 22px))`;
            }
        }

        // Start or Stop the interval based on the setting
        if (sleepEnabled) {
            if (!this.sleepInterval) {
                this.sleepInterval = setInterval(() => this.checkTabInactivity(), 5000);
            }
        } else {
            if (this.sleepInterval) {
                clearInterval(this.sleepInterval);
                this.sleepInterval = null;
            }
            // Wake up all sleeping tabs if feature is disabled
            this.tabs.forEach(tab => {
                if (tab.sleeping) this.wakeUpTab(tab);
            });
        }
    }

    updateActiveNavItem(activeItem) {
        if (!activeItem) return;
        this.settingsNavItems.forEach(item => item.classList.remove('active'));
        activeItem.classList.add('active');
    }

    checkTabInactivity() {
        if (!this.perfToggles.tabSleep || !this.perfToggles.tabSleep.checked) return;

        const val = parseInt(this.perfToggles.tabSleepTimer.value);
        const threshold = this.sleepThresholds[val] * 1000;
        const now = Date.now();

        this.tabs.forEach(tab => {
            if (tab.id === this.activeTabId || tab.sleeping || tab.url === 'browser://home') return;

            if (now - tab.lastActive > threshold) {
                this.putTabToSleep(tab);
            }
        });
    }

    putTabToSleep(tab) {
        if (tab.sleeping) return;
        console.log(`[BROWSER] 😴 Putting tab ${tab.id} to sleep (${tab.title})`);
        tab.sleeping = true;
        tab.element.classList.add('sleeping');

        if (tab.iframe) {
            tab.iframe.src = 'about:blank';
        }
    }

    wakeUpTab(tab) {
        if (!tab.sleeping) return;
        console.log(`[BROWSER] ☀️ Waking up tab ${tab.id} (${tab.title})`);
        tab.sleeping = false;
        tab.element.classList.remove('sleeping');
        tab.lastActive = Date.now();

        if (tab.iframe) {
            tab.iframe.src = tab.url;
        }
    }

    handleSettingsScroll() {
        if (!this.settingsScrollArea) return;

        const sections = document.querySelectorAll('.settings-content-section');
        let currentSectionId = '';

        // Focus point is 25% down the visible scroll area
        const triggerOffset = this.settingsScrollArea.clientHeight * 0.25;
        const scrollPosition = this.settingsScrollArea.scrollTop;

        // Check if we've reached the very bottom of the scroll area
        const isAtBottom = scrollPosition + this.settingsScrollArea.clientHeight >= this.settingsScrollArea.scrollHeight - 50;

        if (isAtBottom && sections.length > 0) {
            currentSectionId = sections[sections.length - 1].getAttribute('id');
        } else {
            sections.forEach(section => {
                const sectionTop = section.offsetTop - this.settingsScrollArea.offsetTop;
                // If the section's top has passed the 25% focus line
                if (scrollPosition >= sectionTop - triggerOffset) {
                    currentSectionId = section.getAttribute('id');
                }
            });
        }

        if (currentSectionId) {
            const activeNav = Array.from(this.settingsNavItems).find(item => item.getAttribute('data-target') === currentSectionId);
            if (activeNav) this.updateActiveNavItem(activeNav);
        }
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('browser_theme', theme);

        if (theme === 'custom') {
            this.applyCustomThemeVariables();
        } else {
            // Remove custom style overrides if switching back to preset
            this.clearCustomThemeVariables();
        }

        this.updateThemeActiveState();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('browser_theme') || 'cloud';
        this.setTheme(savedTheme);
    }

    // Theme Editor Logic
    openThemeEditor() {
        this.closeSettings();
        this.themeEditorModal.classList.remove('hidden');

        // Initialize inputs with current computed values
        const rootStyle = getComputedStyle(document.documentElement);
        this.colorInputs.forEach(input => {
            const varName = input.getAttribute('data-var');
            const color = rootStyle.getPropertyValue(varName).trim();
            if (color.startsWith('#')) {
                input.value = color;
            } else if (color.startsWith('rgb')) {
                // Convert rgb to hex for input[type="color"]
                input.value = this.rgbToHex(color);
            }
        });

        const savedData = JSON.parse(localStorage.getItem('custom_theme_data') || '{}');
        this.customThemeNameInput.value = savedData.name || 'Custom Theme';
    }

    closeThemeEditor() {
        this.themeEditorModal.classList.add('hidden');
        // Revert to saved state if not saved
        this.loadTheme();
    }

    resetThemeEditor() {
        if (confirm('Reset custom theme to current colors?')) {
            this.openThemeEditor();
        }
    }

    saveCustomTheme() {
        const themeData = {
            name: this.customThemeNameInput.value || 'Custom Theme',
            variables: {}
        };

        this.colorInputs.forEach(input => {
            const varName = input.getAttribute('data-var');
            themeData.variables[varName] = input.value;
        });

        // Add logo filter to the saved data
        const textPrimary = themeData.variables['--text-primary'];
        themeData.variables['--logo-filter'] = this.calculateLogoFilter(textPrimary);

        localStorage.setItem('custom_theme_data', JSON.stringify(themeData));
        this.setTheme('custom');
        this.closeThemeEditor();

        console.log('[THEME] Saved custom theme:', themeData.name);
    }

    applyCustomThemeVariables() {
        const savedData = JSON.parse(localStorage.getItem('custom_theme_data') || '{}');
        const variables = savedData.variables || {};

        for (const [name, value] of Object.entries(variables)) {
            document.documentElement.style.setProperty(name, value);
        }
    }

    clearCustomThemeVariables() {
        const vars = [
            '--bg-color', '--window-bg', '--tab-bar-bg', '--omnibox-bg',
            '--text-primary', '--text-secondary', '--accent-color', '--border-color',
            '--logo-filter'
        ];
        vars.forEach(v => document.documentElement.style.removeProperty(v));
    }

    updateLogoFilterForColor(hex) {
        const filter = this.calculateLogoFilter(hex);
        document.documentElement.style.setProperty('--logo-filter', filter);
    }

    calculateLogoFilter(hex) {
        // Simplified Logic: 
        // 1. Convert hex to brightness
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        if (brightness > 128) {
            return `brightness(0) saturate(100%) invert(100%)`; // Make White
        } else {
            return `brightness(0) saturate(100%)`; // Keep Black
        }
    }

    rgbToHex(rgb) {
        const result = rgb.match(/\d+/g);
        if (!result || result.length < 3) return '#ffffff';
        const r = parseInt(result[0]).toString(16).padStart(2, '0');
        const g = parseInt(result[1]).toString(16).padStart(2, '0');
        const b = parseInt(result[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
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
            element: null,
            lastActive: Date.now(),
            sleeping: false,
            memory: Math.floor(25 + Math.random() * 40) // Heuristic: Base 25MB + random
        };

        // Create Tab UI
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        tabEl.dataset.id = id;
        tabEl.innerHTML = `
            <div class="tab-sleep-icon">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            </div>
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

        // Hover Tooltip Events
        tabEl.addEventListener('mouseenter', () => this.showTabTooltip(tab));
        tabEl.addEventListener('mouseleave', () => this.hideTabTooltip());
        tabEl.addEventListener('mousemove', (e) => this.positionTabTooltip(e));

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

        // All pins are now stored in custom_apps to allow total customization
        const allPins = JSON.parse(localStorage.getItem('custom_apps') || '[]');

        let gridHtml = `
        <div class="home-branding">
            <h1 class="brand-title">Navigator</h1>
            <p class="brand-subtitle">by the scholar squad</p>
        </div>
        <div class="home-grid">
    `;

        // Render all pins (with Delete Button)
        allPins.forEach((app, index) => {
            let iconContent = app.icon || app.name.charAt(0).toUpperCase();
            gridHtml += `
                <div class="grid-item" data-url="${app.url}" data-index="${index}">
                    <button class="delete-pin" title="Delete Pin">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
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

        // Attach Event Listeners for Navigation
        tab.homeElement.querySelectorAll('.grid-item:not(.add-app-btn)').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore if clicking the delete button
                if (e.target.closest('.delete-pin')) return;

                const url = item.getAttribute('data-url');
                this.navigate(url);
            });
        });

        // Attach Event Listeners for Deletion
        tab.homeElement.querySelectorAll('.delete-pin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(btn.closest('.grid-item').getAttribute('data-index'));
                this.deletePin(index);
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

    deletePin(index) {
        const apps = JSON.parse(localStorage.getItem('custom_apps') || '[]');
        apps.splice(index, 1);
        localStorage.setItem('custom_apps', JSON.stringify(apps));

        // Re-render home page for all tabs on home
        this.tabs.forEach(tab => {
            if (tab.url === 'browser://home') {
                this.renderHomePage(tab);
            }
        });
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

        if (!name || !url) {
            alert('Please enter both a name and URL');
            return;
        }

        // [SECURITY] Sanitize the name to prevent XSS
        const safeName = this.sanitizeHTML(name);

        try {
            // Basic URL validation/fix
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }

            // [SECURITY] Validate URL is actually valid
            const urlObj = new URL(url);

            // [SECURITY] Only allow http/https protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                alert('Invalid URL: Only HTTP and HTTPS URLs are allowed');
                return;
            }
        } catch (e) {
            alert('Invalid URL format. Please enter a valid website address.');
            return;
        }

        const customApps = JSON.parse(localStorage.getItem('custom_apps') || '[]');

        // Store the sanitized name
        customApps.push({ name: safeName, url });
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
            newTab.lastActive = Date.now();
            if (newTab.sleeping) {
                this.wakeUpTab(newTab);
            }
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
        if (this.tabs.length <= 1) {
            this.showError('You must have at least one tab open.');
            return;
        }

        const tabIndex = this.tabs.findIndex(t => t.id === id);
        if (tabIndex === -1) return;

        const tab = this.tabs[tabIndex];

        // [PERFORMANCE] Clean up intervals to prevent memory leaks
        if (tab.__syncInterval) {
            clearInterval(tab.__syncInterval);
            tab.__syncInterval = null;
            console.log('[PERFORMANCE] Cleared sync interval for tab', id);
        }
        if (tab.__overrideInterval) {
            clearInterval(tab.__overrideInterval);
            tab.__overrideInterval = null;
            console.log('[PERFORMANCE] Cleared override interval for tab', id);
        }

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



    showError(message) {
        if (!this.errorModal || !this.errorMessage) return;
        this.errorMessage.textContent = message;
        this.errorModal.classList.remove('hidden');
    }

    hideError() {
        if (!this.errorModal) return;
        this.errorModal.classList.add('hidden');
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    // Tab Tooltip UI
    showTabTooltip(tab) {
        if (!this.tooltip.el) return;

        // Check the "Show Tab Data" setting
        const dataEnabled = this.perfToggles.showTabData && this.perfToggles.showTabData.checked;
        if (!dataEnabled) return;

        this.currentTooltipTabId = tab.id;
        this.updateTabTooltip();
        this.tooltip.el.classList.add('visible');

        if (this.tooltipUpdateInterval) clearInterval(this.tooltipUpdateInterval);
        this.tooltipUpdateInterval = setInterval(() => this.updateTabTooltip(), 1000);
    }

    hideTabTooltip() {
        if (!this.tooltip.el) return;
        this.currentTooltipTabId = null;
        this.tooltip.el.classList.remove('visible');
        if (this.tooltipUpdateInterval) {
            clearInterval(this.tooltipUpdateInterval);
            this.tooltipUpdateInterval = null;
        }
    }

    positionTabTooltip(e) {
        if (!this.tooltip.el) return;
        const x = e.clientX;
        // Y position is now locked via CSS 'top: 48px'

        // Keep tooltip inside window horizontally
        const rect = this.tooltip.el.getBoundingClientRect();
        let finalX = x - rect.width / 2;
        if (finalX < 10) finalX = 10;
        if (finalX + rect.width > window.innerWidth - 10) finalX = window.innerWidth - rect.width - 10;

        this.tooltip.el.style.left = `${finalX}px`;
    }

    updateTabTooltip() {
        if (this.currentTooltipTabId === null) return;
        const tab = this.tabs.find(t => t.id === this.currentTooltipTabId);
        if (!tab) return;

        // 1. Update Memory
        this.tooltip.memory.textContent = `${tab.memory} MB`;

        // 2. Update Sleep Timer
        const sleepEnabled = this.perfToggles.tabSleep && this.perfToggles.tabSleep.checked;
        const isNotActive = tab.id !== this.activeTabId;
        const isNotHome = tab.url !== 'browser://home';

        if (sleepEnabled && isNotActive && isNotHome && !tab.sleeping) {
            this.tooltip.sleepContainer.style.display = 'block';

            const val = parseInt(this.perfToggles.tabSleepTimer.value);
            const threshold = this.sleepThresholds[val] * 1000;
            const elapsed = Date.now() - tab.lastActive;
            const remainingMs = Math.max(0, threshold - elapsed);

            const remainingSec = Math.floor(remainingMs / 1000);
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;
            this.tooltip.sleep.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            this.tooltip.sleepContainer.style.display = 'none';
        }
    }

    handleOmniboxSubmit() {
        const input = this.omnibox.value.trim();
        if (!input) return;
        this.navigate(input);
    }

    async navigate(input) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) tab.lastActive = Date.now();

        if (!window.ProxyService.initialized) {
            alert('Proxy is still loading...');
            return;
        }

        // Proactive connection recovery for proxied navigation
        if (input !== 'browser://home') {
            // CRITICAL: Re-initialize SW before navigation (it may have been terminated during idle)
            if (window.ProxyService.sendInitSignal) {
                try {
                    await window.ProxyService.sendInitSignal();
                } catch (e) {
                    console.warn('[BROWSER] SW init signal failed:', e);
                }
            }

            // Also verify/recover WebSocket connection
            if (window.ProxyService.ensureConnection) {
                try {
                    await window.ProxyService.ensureConnection();
                } catch (e) {
                    console.warn('[BROWSER] Connection recovery attempt failed:', e);
                    // Continue anyway - the navigation might still work
                }
            }
        }

        let url = input;
        if (url === 'browser://home') {
            // Already home
        } else if (!url.startsWith('http') && !url.includes('://')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = 'https://bing.com/search?q=' + encodeURIComponent(url);
            }
        }

        // DECODE BING TRACKING (if any)
        if (url.includes('/ck/a?') || url.includes('&u=')) {
            try {
                const u = new URL(url).searchParams.get('u');
                if (u && u.length > 2) {
                    const decoded = atob(u.substring(2).replace(/_/g, '/').replace(/-/g, '+'));
                    if (decoded.includes('http') || decoded.startsWith('/')) {
                        url = decoded.startsWith('http') ? decoded : 'https://' + decoded;
                    }
                }
            } catch (err) { }
        }

        // BLOCKING CHECK
        if (this.isUrlBlocked(url)) {
            // Cancel and redirect home
            this.navigate('browser://home');
            return;
        }

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

                    // FIX: "Sandbox Detected" & Permission Issues
                    // Explicitly remove sandbox and add all common permissions
                    tab.iframe.removeAttribute('sandbox');
                    tab.iframe.allow = "autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; gamepad; geolocation; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; speaker-selection; usb; web-share";

                    this.viewportsContainer.appendChild(tab.iframe);

                    // Helper function to override window.open
                    const attachWindowOpenOverride = () => {
                        try {
                            const iframeWindow = tab.iframe.contentWindow;
                            if (!iframeWindow) return;

                            // SYNC URL BAR (Periodic poll)
                            if (!tab.__locationPollStarted) {
                                tab.__locationPollStarted = true;
                                // [PERFORMANCE] Store interval ID for cleanup
                                tab.__syncInterval = setInterval(() => this.syncTabWithIframe(tab), 1000);
                            }

                            if (!iframeWindow.__proxyTabsOverridden) {
                                // NAVIGATION INTERCEPTION
                                iframeWindow.document.addEventListener('click', (e) => {
                                    const link = e.target.closest('a');
                                    if (!link) return;

                                    let url = link.getAttribute('data-scramjet-url') || link.href;
                                    const target = link.getAttribute('target');

                                    // FIX TRUNCATED URLS (Bing Tracking Decoder)
                                    if (url.includes('/ck/a?') || url.includes('&u=')) {
                                        try {
                                            const urlObj = new URL(url);
                                            let u = urlObj.searchParams.get('u');
                                            if (u && u.length > 2) {
                                                // Bing prefix is usually 2 chars (like 'a1'). Strip BEFORE decoding.
                                                const base64 = u.substring(2).replace(/_/g, '/').replace(/-/g, '+');
                                                const decoded = atob(base64);

                                                // Basic sanity check: does it look like a URL or path?
                                                if (decoded.includes('http') || decoded.startsWith('/')) {
                                                    url = decoded.startsWith('http') ? decoded : 'https://' + decoded;
                                                    console.log('[BROWSER] 🎯 Decoded Bing result:', url);
                                                }
                                            }
                                        } catch (err) {
                                            console.warn('[BROWSER] Bing decode failed:', err);
                                        }
                                    }

                                    // PREVENT ESCAPES
                                    const isNewTab = target === '_blank' || target === '_top' || target === '_parent';
                                    const isSpecialClick = e.ctrlKey || e.metaKey || e.button === 1;

                                    if (isNewTab || isSpecialClick) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        this.createTab(url);
                                        return false;
                                    }
                                }, { capture: true });

                                // window.open override
                                iframeWindow.__originalOpen = iframeWindow.open;
                                iframeWindow.open = (url, target) => {
                                    this.createTab(url);
                                    return { focus: () => { }, blur: () => { }, close: () => { }, closed: false, location: { href: url } };
                                };

                                iframeWindow.__proxyTabsOverridden = true;
                                console.log('[BROWSER] ✅ Navigation overrides active');
                            }
                        } catch (e) {
                            // Cross-origin or security errors
                        }
                    };

                    // Attach overrides on load and periodically
                    tab.iframe.addEventListener('load', () => {
                        if (this.activeTabId === tab.id) this.setLoading(false);
                        attachWindowOpenOverride();
                    });
                    // [PERFORMANCE] Store interval ID for cleanup
                    tab.__overrideInterval = setInterval(attachWindowOpenOverride, 1000);

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
                    // [PERFORMANCE] Defer favicon fetch to not block navigation
                    setTimeout(() => this.fetchFavicon(tab, url), 100);
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
            // [SECURITY] Validate the page URL protocol first
            const pageUrl = new URL(url);
            if (!['http:', 'https:'].includes(pageUrl.protocol)) {
                console.warn('[SECURITY] Invalid page protocol for favicon fetch:', pageUrl.protocol);
                this.updateFavicon(tab, '');
                return;
            }

            const response = await fetch(url);
            const text = await response.text();

            // [SECURITY] Use DOMParser instead of regex to prevent XSS
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Look for favicon link elements
            const iconLink = doc.querySelector('link[rel~="icon"]') ||
                doc.querySelector('link[rel~="shortcut icon"]');

            if (iconLink && iconLink.href) {
                // Resolve relative URLs
                let faviconUrl = new URL(iconLink.href, url).href;

                // [SECURITY] Validate favicon URL protocol
                const faviconUrlObj = new URL(faviconUrl);
                if (['http:', 'https:', 'data:'].includes(faviconUrlObj.protocol)) {
                    this.updateFavicon(tab, faviconUrl);
                } else {
                    console.warn('[SECURITY] Blocked non-HTTP favicon protocol:', faviconUrlObj.protocol);
                    this.updateFavicon(tab, '');
                }
            } else {
                this.updateFavicon(tab, '');
            }
        } catch (e) {
            console.warn('[FAVICON] Fetch failed:', e);
            this.updateFavicon(tab, '');
        }
    }

    syncTabWithIframe(tab) {
        if (!tab || !tab.iframe || !tab.iframe.contentWindow) return;
        try {
            if (this.activeTabId !== tab.id) return;

            // If we are on the home page and not currently transitioning out of it, skip sync
            if (tab.url === 'browser://home' && tab.homeElement && !tab.homeElement.classList.contains('hidden')) return;

            const iframeWindow = tab.iframe.contentWindow;
            const rawUrl = iframeWindow.location.href;

            // Scramjet URLs look like domain.com/service/https://target.com
            if (rawUrl.includes('/service/')) {
                const realUrl = decodeURIComponent(rawUrl.split('/service/')[1]);
                if (realUrl && realUrl !== tab.url && !realUrl.endsWith('...')) {
                    console.log('[BROWSER] 🔄 Syncing UI to iframe location:', realUrl);
                    tab.url = realUrl;
                    this.omnibox.value = realUrl;

                    // Update tab title
                    try {
                        const hostname = new URL(realUrl).hostname;
                        tab.title = hostname || 'Browse';
                        if (tab.element) {
                            tab.element.querySelector('.tab-title').textContent = tab.title;
                        }
                    } catch (e) { }
                }
            }
        } catch (err) {
            // Usually cross-origin safety errors, can ignore
        }
    }

    applyDisguise() {
        const selected = this.disguiseSelect.value;
        const disguise = this.disguises[selected];

        if (disguise) {
            document.title = disguise.title;
            this.updateFaviconLink(disguise.favicon);
            localStorage.setItem('tab_disguise', selected);
            console.log('[BROWSER] Applied disguise:', selected);
        }
    }

    resetDisguise() {
        const defaultDisguise = this.disguises['default'];
        document.title = defaultDisguise.title;
        this.updateFaviconLink(defaultDisguise.favicon);
        localStorage.setItem('tab_disguise', 'default');
        this.disguiseSelect.value = 'default';
        console.log('[BROWSER] Reset to default disguise');
    }

    loadDisguise() {
        const saved = localStorage.getItem('tab_disguise') || 'default';
        const disguise = this.disguises[saved];

        if (disguise) {
            document.title = disguise.title;
            this.updateFaviconLink(disguise.favicon);
        }
    }

    updateFaviconLink(href) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = href;
    }

    openCloaked() {
        console.log('[BROWSER] 🔐 Cloak requested');

        let inFrame;
        try {
            inFrame = window !== top;
        } catch (e) {
            inFrame = true;
        }

        if (inFrame) {
            console.warn('[BROWSER] ⚠️ Already in iframe, cannot cloak');
            alert('Already running in a frame. Cloaking is not available.');
            return;
        }

        if (navigator.userAgent.includes("Firefox")) {
            console.warn('[BROWSER] ⚠️ Firefox detected, cloaking disabled');
            alert('Cloaking is not supported in Firefox. Please use Chrome, Edge, or another Chromium-based browser.');
            return;
        }

        console.log('[BROWSER] 🔐 Opening cloaked window...');
        const popup = window.open("about:blank", "_blank");

        if (!popup || popup.closed) {
            console.error('[BROWSER] ❌ Popup blocked');
            alert("Window blocked. Please allow popups for this site.");
        } else {
            console.log('[BROWSER] ✅ Popup opened, setting up cloak...');
            const doc = popup.document;
            const iframe = doc.createElement("iframe");
            const style = iframe.style;
            const link = doc.createElement("link");

            const name = localStorage.getItem("cloak_name") || "My Drive - Google Drive";
            const icon = localStorage.getItem("cloak_icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";

            doc.title = name;
            link.rel = "icon";
            link.href = icon;

            iframe.src = location.href;
            style.position = "fixed";
            style.top = style.bottom = style.left = style.right = "0";
            style.border = style.outline = "none";
            style.width = style.height = "100%";

            // FIX: "Sandbox Detected" & Permission Issues in Cloak
            iframe.removeAttribute('sandbox');
            iframe.allow = "autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; gamepad; geolocation; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; speaker-selection; usb; web-share";

            const pLink = localStorage.getItem("pLink") || "https://google.com";

            const script = doc.createElement("script");
            script.textContent = `
                window.onbeforeunload = function (event) {
                    const confirmationMessage = 'Leave Site?';
                    (event || window.event).returnValue = confirmationMessage;
                    return confirmationMessage;
                };
            `;
            doc.head.appendChild(link);
            doc.body.appendChild(iframe);
            doc.head.appendChild(script);

            console.log('[BROWSER] ✅ Cloak setup complete, redirecting original tab...');
            location.replace(pLink);
        }
    }
}

// Start
window.app = new Browser();
