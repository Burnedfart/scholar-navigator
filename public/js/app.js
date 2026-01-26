/**
 * Practice Problems - Frontend Application
 * 
 * This file handles all client-side logic for the interactive environment.
 * 
 * EDUCATIONAL CONCEPTS DEMONSTRATED:
 * - Fetch API for making HTTP requests
 * - DOM manipulation
 * - Event handling
 * - State management
 * - Error handling
 * - Local session management
 */

// ============================================================================
// APPLICATION STATE
// Centralized state management for the application
// ============================================================================

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

const CONFIG = {
    // When hosting on GitHub Pages, change this to your production Vercel URL
    // example: 'https://practice-problems-99.vercel.app'
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? ''
        : 'https://practice-problems-99.vercel.app'
};

const state = {
    sessionId: null,
    isLoading: false,
    currentUrl: null,
    currentContent: null,
    isEncodingVisible: false,
    activeTab: 'rendered'
};

// ============================================================================
// DOM ELEMENTS
// Cache DOM references for performance
// ============================================================================

const elements = {
    // Header elements
    serverStatus: document.getElementById('serverStatus'),
    sessionInfo: document.getElementById('sessionInfo'),

    // Form elements
    proxyForm: document.getElementById('proxyForm'),
    urlInput: document.getElementById('urlInput'),
    fetchButton: document.getElementById('fetchButton'),
    protocolIndicator: document.getElementById('protocolIndicator'),

    // Encoding display elements
    encodingDisplay: document.getElementById('encodingDisplay'),
    toggleEncoding: document.getElementById('toggleEncoding'),
    encodingDetails: document.getElementById('encodingDetails'),
    originalUrl: document.getElementById('originalUrl'),
    encodedUrl: document.getElementById('encodedUrl'),

    // Metadata elements
    metadataPanel: document.getElementById('metadataPanel'),
    toggleMetadata: document.getElementById('toggleMetadata'),
    metadataContent: document.getElementById('metadataContent'),
    metaStatus: document.getElementById('metaStatus'),
    metaDomain: document.getElementById('metaDomain'),
    metaContentType: document.getElementById('metaContentType'),
    metaSize: document.getElementById('metaSize'),
    metaTime: document.getElementById('metaTime'),

    // Content display elements
    contentDisplay: document.getElementById('contentDisplay'),
    emptyState: document.getElementById('emptyState'),
    renderedTab: document.getElementById('renderedTab'),
    sourceTab: document.getElementById('sourceTab'),
    contentFrame: document.getElementById('contentFrame'),
    sourceCode: document.getElementById('sourceCode'),
    errorDisplay: document.getElementById('errorDisplay'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    errorDetails: document.getElementById('errorDetails'),

    // Action buttons
    copySource: document.getElementById('copySource'),
    openExternal: document.getElementById('openExternal'),

    // Tab buttons
    tabButtons: document.querySelectorAll('.tab-button')
};

// ============================================================================
// API FUNCTIONS
// Functions that communicate with the proxy server
// ============================================================================

/**
 * Checks if the server is running and healthy
 * 
 * @returns {Promise<Object>} Server health status
 */
async function checkServerHealth() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
        const data = await response.json();
        return { connected: true, data };
    } catch (error) {
        return { connected: false, error: error.message };
    }
}

/**
 * Encodes a URL using the server's encoding service
 * 
 * @param {string} url - The URL to encode
 * @returns {Promise<Object>} Encoding result
 */
async function encodeUrl(url) {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    return response.json();
}

/**
 * Fetches content through the proxy
 * 
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} Proxy response
 */
async function fetchThroughProxy(url) {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/proxy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': state.sessionId
        },
        body: JSON.stringify({
            url: url,
            encoded: false
        })
    });

    // Store session ID from response if provided
    const sessionId = response.headers.get('X-Session-ID');
    if (sessionId) {
        state.sessionId = sessionId;
        updateSessionDisplay();
    }

    return response.json();
}

// ============================================================================
// UI UPDATE FUNCTIONS
// Functions that update the user interface
// ============================================================================

/**
 * Updates the server connection status indicator
 * 
 * @param {boolean} connected - Whether the server is connected
 * @param {Object} [data] - Additional health data
 */
function updateServerStatus(connected, data = null) {
    const statusText = elements.serverStatus.querySelector('.status-text');

    if (connected) {
        elements.serverStatus.classList.add('connected');
        elements.serverStatus.classList.remove('disconnected');
        statusText.textContent = 'Connected';

        // Update session ID if available
        if (data?.sessionId) {
            state.sessionId = data.sessionId;
            updateSessionDisplay();
        }
    } else {
        elements.serverStatus.classList.remove('connected');
        elements.serverStatus.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

/**
 * Updates the session ID display
 */
function updateSessionDisplay() {
    const sessionIdElement = elements.sessionInfo.querySelector('.session-id');
    if (state.sessionId) {
        // Show shortened session ID
        sessionIdElement.textContent = state.sessionId.substring(0, 8) + '...';
        sessionIdElement.title = state.sessionId;
    }
}

/**
 * Sets the loading state of the fetch button
 * 
 * @param {boolean} isLoading - Whether loading is in progress
 */
function setLoading(isLoading) {
    state.isLoading = isLoading;
    elements.fetchButton.disabled = isLoading;
    elements.fetchButton.classList.toggle('loading', isLoading);
}

/**
 * Updates the encoding display with URL information
 * 
 * @param {string} original - The original URL
 * @param {string} encoded - The encoded URL
 */
function updateEncodingDisplay(original, encoded) {
    elements.originalUrl.textContent = original;
    elements.encodedUrl.textContent = encoded;
}

/**
 * Toggles visibility of the encoding details panel
 */
function toggleEncodingDetails() {
    state.isEncodingVisible = !state.isEncodingVisible;
    elements.encodingDetails.classList.toggle('open', state.isEncodingVisible);
    elements.toggleEncoding.querySelector('span').textContent =
        state.isEncodingVisible ? 'Hide Details' : 'Show Details';
}

/**
 * Updates the metadata panel with response information
 * 
 * @param {Object} metadata - Response metadata
 */
function updateMetadata(metadata) {
    elements.metaStatus.textContent = metadata.statusCode || '--';
    elements.metaDomain.textContent = metadata.domain || '--';
    elements.metaContentType.textContent = formatContentType(metadata.contentType) || '--';
    elements.metaSize.textContent = formatBytes(metadata.contentLength) || '--';
    elements.metaTime.textContent = metadata.fetchTimeMs ? `${metadata.fetchTimeMs}ms` : '--';

    // Add status color
    if (metadata.statusCode) {
        elements.metaStatus.className = 'metadata-value ' + getStatusClass(metadata.statusCode);
    }
}

/**
 * Formats a content type string for display
 * 
 * @param {string} contentType - The full content type
 * @returns {string} Shortened content type
 */
function formatContentType(contentType) {
    if (!contentType) return '';
    return contentType.split(';')[0].trim();
}

/**
 * Formats bytes to human-readable size
 * 
 * @param {number} bytes - The byte count
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Returns a CSS class based on HTTP status code
 * 
 * @param {number} status - HTTP status code
 * @returns {string} CSS class name
 */
function getStatusClass(status) {
    if (status >= 200 && status < 300) return 'status-success';
    if (status >= 300 && status < 400) return 'status-redirect';
    if (status >= 400) return 'status-error';
    return '';
}

/**
 * Displays content in the appropriate tab
 * 
 * @param {string} content - HTML content to display
 */
function displayContent(content) {
    state.currentContent = content;

    // Hide empty state
    elements.emptyState.classList.add('hidden');

    // Hide error display
    elements.errorDisplay.classList.remove('visible');

    // Update iframe with content
    const iframe = elements.contentFrame;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    // Update source code view
    elements.sourceCode.textContent = content;
}

/**
 * Displays an error message
 * 
 * @param {Object} error - Error object from the API
 */
function displayError(error) {
    elements.emptyState.classList.add('hidden');
    elements.errorDisplay.classList.add('visible');

    elements.errorTitle.textContent = error.code || 'Error';
    elements.errorMessage.textContent = error.message || 'An unexpected error occurred';

    // Build error details
    if (error.details) {
        let detailsHtml = '';

        if (error.details.explanation) {
            detailsHtml += `<p>${error.details.explanation}</p>`;
        }

        if (error.details.suggestions && error.details.suggestions.length > 0) {
            detailsHtml += '<strong>Suggestions:</strong><ul>';
            error.details.suggestions.forEach(suggestion => {
                detailsHtml += `<li>${suggestion}</li>`;
            });
            detailsHtml += '</ul>';
        }

        elements.errorDetails.innerHTML = detailsHtml;
    } else {
        elements.errorDetails.innerHTML = '';
    }
}

/**
 * Switches between content tabs (rendered/source)
 * 
 * @param {string} tabName - The tab to activate
 */
function switchTab(tabName) {
    state.activeTab = tabName;

    // Update tab button states
    elements.tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab content visibility
    elements.renderedTab.classList.toggle('active', tabName === 'rendered');
    elements.sourceTab.classList.toggle('active', tabName === 'source');
}

// ============================================================================
// URL HELPERS
// Functions for URL manipulation and validation
// ============================================================================

/**
 * Normalizes a URL input to include protocol
 * 
 * @param {string} input - The user's URL input
 * @returns {string} Normalized URL with protocol
 */
function normalizeUrl(input) {
    input = input.trim();

    // If it already has a protocol, return as-is
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }

    // Default to https://
    return 'https://' + input;
}

/**
 * Updates the protocol indicator based on the URL input
 * 
 * @param {string} url - The current URL
 */
function updateProtocolIndicator(url) {
    const indicator = elements.protocolIndicator.querySelector('span');
    if (url.startsWith('http://')) {
        indicator.textContent = 'http://';
    } else {
        indicator.textContent = 'https://';
    }
}

// ============================================================================
// EVENT HANDLERS
// Functions that handle user interactions
// ============================================================================

/**
 * Handles the proxy form submission
 * 
 * @param {Event} event - The form submit event
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    if (state.isLoading) return;

    const input = elements.urlInput.value.trim();
    if (!input) return;

    const url = normalizeUrl(input);
    state.currentUrl = url;

    updateProtocolIndicator(url);
    setLoading(true);

    try {
        // First, get the encoded URL for display
        const encodeResult = await encodeUrl(url);
        updateEncodingDisplay(url, encodeResult.encoded);

        // Then fetch through proxy
        const proxyResult = await fetchThroughProxy(url);

        if (proxyResult.success) {
            if (proxyResult.type === 'redirect') {
                // Handle redirects
                updateMetadata({
                    statusCode: proxyResult.statusCode,
                    domain: new URL(proxyResult.redirectUrl).hostname,
                    contentType: 'redirect',
                    contentLength: 0,
                    fetchTimeMs: 0
                });

                // Show redirect info
                displayContent(`
                    <html>
                    <head><style>
                        body { font-family: Inter, sans-serif; padding: 40px; background: #1a1a2e; color: #fff; }
                        h2 { color: #6366f1; }
                        code { background: #22222e; padding: 8px 16px; border-radius: 6px; display: block; margin: 16px 0; }
                    </style></head>
                    <body>
                        <h2>🔄 Redirect Detected</h2>
                        <p>The server requested a redirect to:</p>
                        <code>${proxyResult.redirectUrl}</code>
                        <p style="color: #a1a1aa;">In a full proxy implementation, this redirect would be followed automatically.</p>
                    </body>
                    </html>
                `);
            } else {
                // Display content
                updateMetadata(proxyResult.metadata);
                displayContent(proxyResult.content);
            }
        } else {
            displayError(proxyResult.error);
        }

    } catch (error) {
        displayError({
            code: 'FETCH_ERROR',
            message: 'Failed to communicate with the proxy server',
            details: {
                explanation: 'Could not reach the proxy server. Make sure it is running.',
                suggestions: [
                    'Check that the server is running (npm run dev)',
                    'Check your browser console for errors'
                ]
            }
        });
    } finally {
        setLoading(false);
    }
}

/**
 * Copies the source code to clipboard
 */
async function handleCopySource() {
    if (state.currentContent) {
        try {
            await navigator.clipboard.writeText(state.currentContent);
            elements.copySource.title = 'Copied!';
            setTimeout(() => {
                elements.copySource.title = 'Copy source';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }
}

/**
 * Opens the current URL in a new tab
 */
function handleOpenExternal() {
    if (state.currentUrl) {
        window.open(state.currentUrl, '_blank', 'noopener,noreferrer');
    }
}

// ============================================================================
// INITIALIZATION
// Application startup and event binding
// ============================================================================

/**
 * Initializes the application
 */
async function initialize() {
    console.log('🚀 Initializing Practice Problems Frontend');

    // Check server connection
    const health = await checkServerHealth();
    updateServerStatus(health.connected, health.data);

    // Bind form events
    elements.proxyForm.addEventListener('submit', handleFormSubmit);

    // Bind toggle events
    elements.toggleEncoding.addEventListener('click', toggleEncodingDetails);

    elements.toggleMetadata.addEventListener('click', () => {
        elements.toggleMetadata.classList.toggle('collapsed');
        elements.metadataContent.classList.toggle('hidden');
    });

    // Bind tab events
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // Bind action buttons
    elements.copySource.addEventListener('click', handleCopySource);
    elements.openExternal.addEventListener('click', handleOpenExternal);

    // Update URL input dynamically
    elements.urlInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value.startsWith('http://')) {
            elements.protocolIndicator.querySelector('span').textContent = 'http://';
        } else {
            elements.protocolIndicator.querySelector('span').textContent = 'https://';
        }
    });

    // Periodically check server health
    setInterval(async () => {
        const health = await checkServerHealth();
        updateServerStatus(health.connected, health.data);
    }, 30000); // Every 30 seconds

    console.log('✅ Frontend initialized');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
