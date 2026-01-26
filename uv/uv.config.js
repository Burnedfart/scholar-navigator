/*
 * Ultraviolet Configuration
 * This tells UV how to proxy URLs
 */
self.__uv$config = {
    prefix: location.pathname.substr(0, location.pathname.lastIndexOf('/')) + '/service/',
    bare: 'https://practice-problems-99.vercel.app/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js',
};
