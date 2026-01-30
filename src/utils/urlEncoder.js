/**
 * Encodes a URL using URL-safe Base64 encoding
 * 
 * Why Base64?
 * - Converts any string to a safe ASCII representation
 * - Avoids issues with special characters in query strings
 * - Easy to decode back to the original
 * 
 * @param {string} url - The URL to encode
 * @returns {string} - URL-safe Base64 encoded string
 */
function encodeUrl(url) {
    if (!url) return '';

    // Step 1: Convert string to Base64
    // Buffer.from() creates a binary buffer from the string
    // .toString('base64') converts that buffer to Base64
    const base64 = Buffer.from(url, 'utf-8').toString('base64');

    // Step 2: Make it URL-safe
    // Standard Base64 uses '+' and '/' which have special meaning in URLs
    // We replace them with URL-safe alternatives
    const urlSafe = base64
        .replace(/\+/g, '-')  // Replace + with -
        .replace(/\//g, '_')  // Replace / with _
        .replace(/=+$/, '');  // Remove trailing = padding

    return urlSafe;
}

/**
 * Decodes a URL-safe Base64 encoded string back to the original URL
 * 
 * @param {string} encoded - The URL-safe Base64 encoded string
 * @returns {string} - The original URL
 */
function decodeUrl(encoded) {
    if (!encoded) return '';

    // Step 1: Reverse the URL-safe replacements
    let base64 = encoded
        .replace(/-/g, '+')   // Restore +
        .replace(/_/g, '/');  // Restore /

    // Step 2: Add back padding if needed
    // Base64 strings should have length divisible by 4
    while (base64.length % 4) {
        base64 += '=';
    }

    // Step 3: Decode from Base64 back to the original string
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');

    return decoded;
}

/**
 * Validates whether a string is a valid URL
 * 
 * EDUCATIONAL NOTE:
 * URL validation is crucial for security. Without it, attackers could:
 * - Inject malicious scripts
 * - Access internal network resources
 * - Perform SSRF (Server-Side Request Forgery) attacks
 * 
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if the URL is valid
 */
function isValidUrl(url) {
    if (!url) return false;

    try {
        // The URL constructor will throw if the URL is invalid
        const parsed = new URL(url);

        // Only allow HTTP and HTTPS protocols
        // This prevents attacks using file://, javascript:, data: URLs
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
            return false;
        }

        // Block localhost and private IPs to prevent SSRF
        // In a real application, you'd want more comprehensive checks
        const hostname = parsed.hostname.toLowerCase();
        const blockedHosts = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '::1'
        ];

        if (blockedHosts.includes(hostname)) {
            return false;
        }

        // Check for private IP ranges (basic check)
        if (hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.')) {
            return false;
        }

        return true;
    } catch (error) {
        // URL constructor threw - not a valid URL
        return false;
    }
}

/**
 * Sanitizes query parameters from a URL
 * Removes potentially dangerous parameters
 * 
 * @param {string} url - The URL to sanitize
 * @returns {string} - The sanitized URL
 */
function sanitizeUrl(url) {
    if (!url) return '';

    try {
        const parsed = new URL(url);

        // List of parameters that might be sensitive
        const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];

        sensitiveParams.forEach(param => {
            if (parsed.searchParams.has(param)) {
                parsed.searchParams.set(param, '[REDACTED]');
            }
        });

        return parsed.toString();
    } catch (error) {
        return url;
    }
}

/**
 * Extracts the domain from a URL
 * Useful for logging and display purposes
 * 
 * @param {string} url - The URL to extract domain from
 * @returns {string} - The domain name
 */
function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch (error) {
        return 'unknown';
    }
}

module.exports = {
    encodeUrl,
    decodeUrl,
    isValidUrl,
    sanitizeUrl,
    extractDomain
};
