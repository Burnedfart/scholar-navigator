importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.codecs.js");
importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.bundle.js");
importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.wasm.js");

const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
    await scramjet.loadConfig();
    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }
    return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});
