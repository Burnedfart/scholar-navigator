// Scramjet Configuration wrapper to handle GitHub Pages subdirectories
(function () {
    // Dynamic base path detection that works in both window and service worker contexts
    const pathname = self.location.pathname;
    let rootPath;

    // If we're in a service worker (sw.js at root) or in a /js/ subfolder
    if (pathname.endsWith('/sw.js')) {
        // Service worker context: /repo-name/sw.js -> /repo-name/
        rootPath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    } else if (pathname.includes('/js/')) {
        // Window context loading from /js/ folder: /repo-name/js/file.js -> /repo-name/
        const pathParts = pathname.split('/');
        pathParts.pop(); // Remove filename
        if (pathParts[pathParts.length - 1] === 'js') {
            pathParts.pop(); // Remove 'js' folder
        }
        rootPath = pathParts.join('/') + '/';
    } else {
        // Fallback: just use the directory of the current file
        rootPath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    }

    // Ensure rootPath is not empty (fallback to /)
    if (!rootPath || rootPath === '') {
        rootPath = '/';
    }

    self.__scramjet$config = {
        // Dynamic prefix that includes the repo name if present
        prefix: rootPath + 'service/',
        // The Bare server URL
        bare: 'https://my-site.boxathome.net/bare/',
        // Use the directory where the files are hosted (CDN)
        directory: 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/',
        // Codec for encoding URLs
        codec: self.__scramjet$codecs.xor,
        // File paths
        bundle: 'scramjet.bundle.js',
        worker: 'scramjet.worker.js',
        client: 'scramjet.client.js',
        codecs: 'scramjet.codecs.js',
        // Config file path relative to root - this needs to be accessible from both contexts
        config: rootPath + 'js/scramjet.config.js'
    };

    console.log('configured scramjet with prefix:', self.__scramjet$config.prefix, 'rootPath:', rootPath);
})();
