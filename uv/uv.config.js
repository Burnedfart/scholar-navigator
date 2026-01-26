/*
 * Ultraviolet Configuration
 * This tells UV how to proxy URLs
 */
// Dynamically determine the base path
// This handles:
// - /project/index.html
// - /project/
// - /project (implicit index)
const currentPath = self.location.pathname;
const basePath = currentPath.endsWith('/')
    ? currentPath
    : currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

self.__uv$config = {
    prefix: basePath + 'service/',
    bare: 'https://uv.studentportal.lol/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: basePath + 'uv/uv.handler.js',
    client: basePath + 'uv/uv.client.js',
    bundle: basePath + 'uv/uv.bundle.js',
    config: basePath + 'uv/uv.config.js',
    sw: basePath + 'uv/uv.sw.js',
};
