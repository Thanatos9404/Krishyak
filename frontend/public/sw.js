// Only the public application shell is cached. Private API responses and POST
// requests are always network-only. Private field cache/outbox lives in IDB.
const CACHE = "krishyak-shell-v2-2";
const SHELL = ["/farm", "/manifest.json", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("krishyak-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    request.headers.has("authorization")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/farm")));
    return;
  }
  // Cache only immutable build assets and the declared public shell resources.
  if (!url.pathname.startsWith("/assets/") && !SHELL.includes(url.pathname))
    return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            return caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy))
              .then(() => response)
              .catch(() => response);
          }
          return response;
        }),
    ),
  );
});
