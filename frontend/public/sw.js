// Cache only public assets and the explicitly anonymous Next app shell.
// Account data, RSC payloads, private photographs and mutations stay network-only.
const CACHE = "krishyak-shell-v3-4";
const SHELL = [
  "/app/today",
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const path of SHELL) {
        const response = await fetch(path, { cache: "reload" });
        if (
          response.ok &&
          (!path.startsWith("/app/") ||
            response.headers.get("X-Krishyak-Shell") === "public")
        )
          await cache.put(path, response);
      }
    }),
  ),
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
    request.headers.has("authorization") ||
    request.headers.has("RSC") ||
    url.searchParams.has("_rsc")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (
            url.pathname === "/app/today" &&
            response.ok &&
            response.headers.get("X-Krishyak-Shell") === "public"
          ) {
            const cache = await caches.open(CACHE);
            await cache.put("/app/today", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const farmerRoute =
            /^\/app\/(today|farm(?:\/[a-f0-9-]{36})?|health|market|more(?:\/(settings|planning|benefits))?)$/.test(
              url.pathname,
            );
          return (
            (await caches.match(farmerRoute ? "/app/today" : "/offline")) ||
            new Response("You are offline. Reconnect to open Krishyak.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }),
    );
    return;
  }
  // Cache only immutable build assets and the declared public shell resources.
  if (
    !url.pathname.startsWith("/_next/static/") &&
    !url.pathname.startsWith("/images/") &&
    !url.pathname.startsWith("/fonts/") &&
    !/^\/locales\/workspace\/(hi|ur|gu|bn|mr|kn|ta|te|ml|pa)\.json$/.test(
      url.pathname,
    ) &&
    !SHELL.includes(url.pathname)
  )
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
