/* Mars Combat Academy service worker.
   Strategy:
     - HTML / JS / CSS  -> network-first, fall back to cache when offline.
     - icons / manifest -> cache-first (they rarely change).
   This removes the "wait 10 minutes, refresh in Safari, force-quit the app"
   ritual: a fresh build is picked up on the next launch that has any network. */

const VERSION = "2.1.0";                 // <-- bump this on every deploy
const CACHE = "mars-academy-" + VERSION;
const SHELL = [
  "./", "./index.html", "./styles.css", "./content.js", "./app.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isFresh = url =>
  url.pathname.endsWith("/") ||
  /\.(html|js|css|webmanifest)$/.test(url.pathname);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // don't touch cross-origin

  if (isFresh(url) || req.mode === "navigate") {
    // network-first
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // cache-first for everything else (icons, images)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
