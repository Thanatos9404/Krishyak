import { NextResponse } from "next/server";

const hosted = process.env.VERCEL === "1";
const encoder = new TextEncoder();

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Same-origin API forwarding. Cookies stay first-party, the API learns the
// farmer's real address through a short-lived signed header (so per-person
// limits are not shared by everyone behind this proxy), and protected preview
// APIs receive the deployment-protection bypass only from server config.
async function forward(request) {
  const origin =
    process.env.KRISHYAK_API_ORIGIN ||
    (hosted ? "https://krishyak-api.vercel.app" : "http://127.0.0.1:8000");
  const path = request.nextUrl.pathname;
  const target = new URL(
    path.startsWith("/api/public/") ? path.slice("/api/public".length) : path,
    origin,
  );
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete("x-krishyak-client");
  headers.delete("x-vercel-protection-bypass");
  const secret = process.env.KRISHYAK_PROXY_SECRET;
  if (secret) {
    const address = (
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      ""
    ).trim();
    if (address) {
      const value = `${address}|${Math.floor(Date.now() / 1000)}`;
      headers.set("x-krishyak-client", `${value}|${await sign(secret, value)}`);
    }
  }
  if (process.env.KRISHYAK_API_PROTECTION_BYPASS)
    headers.set(
      "x-vercel-protection-bypass",
      process.env.KRISHYAK_API_PROTECTION_BYPASS,
    );
  return NextResponse.rewrite(target, { request: { headers } });
}

export async function proxy(request) {
  const route = request.nextUrl.pathname;
  if (route.startsWith("/api/v2/") || route.startsWith("/api/public/"))
    return forward(request);
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tiles.openfreemap.org",
    "font-src 'self' https://tiles.openfreemap.org",
    `connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://api.open-meteo.com${development ? " ws://localhost:3000 ws://127.0.0.1:3000" : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  const path = request.nextUrl.pathname;
  if (path === "/demo" || path === "/credits")
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (
    path.startsWith("/app/") ||
    path === "/app" ||
    path.startsWith("/institution") ||
    path === "/offline"
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    // These server-rendered shells contain no account data. Private data is
    // fetched by the client, never rendered or placed in a shared HTML cache.
    response.headers.set("X-Krishyak-Shell", "public");
  }
  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.KRISHYAK_DEPLOYMENT === "staging"
  )
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/api/v2/:path*",
    "/api/public/:path*",
    "/((?!api/|_next/|images/|fonts/|map/|licenses/|.*\\.(?:png|svg|webp|ico|js|json|txt|xml)$).*)",
  ],
};
