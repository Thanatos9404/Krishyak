import { NextResponse } from "next/server";

export function proxy(request) {
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
    "/((?!api/|_next/|images/|fonts/|map/|licenses/|.*\\.(?:png|svg|webp|ico|js|json|txt|xml)$).*)",
  ],
};
