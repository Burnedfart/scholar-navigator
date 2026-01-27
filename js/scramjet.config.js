// Scramjet Configuration wrapper to handle GitHub Pages subdirectories
(function () {
    // 1. Determine the base path (e.g., "/repo-name/" or "/")
    // This handles both local dev and GitHub Pages subdirectory deployments
    const currentPath = self.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/js/'));
    // ^ Assumes this config is running from /js/scramjet.config.js or imported there
    // If imported by SW at root, logic might differ. 
    // Safer: Just use the Service Worker's scope or location if available, 
    // but for a config file imported by window, we need to be careful.

    // Let's use a simpler "relative to root" detection based on where index.html likely is.
    // If we are in /repo/js/scramjet.config.js, we want /repo/service/

    // Improved dynamic base path detection:
    const pathParts = self.location.pathname.split('/');
    // Remove the last segment (filename)
    pathParts.pop();
    // If we are in 'js' folder, go up one level
    if (pathParts[pathParts.length - 1] === 'js') {
        pathParts.pop();
    }
    const rootPath = pathParts.join('/') + '/';

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
        // Config file path relative to root
        config: 'js/scramjet.config.js'
    };

    console.log('configured scramjet with prefix:', self.__scramjet$config.prefix);
})();
