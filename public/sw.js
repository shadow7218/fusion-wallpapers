// Minimal service worker: lets browsers treat Fusion as an installable app.
// It does not cache anything, so the site always loads fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
