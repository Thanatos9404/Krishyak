const hosted = process.env.VERCEL === "1";
const apiOrigin =
  process.env.KRISHYAK_API_ORIGIN ||
  (hosted ? "https://krishyak-api.vercel.app" : "http://127.0.0.1:8000");
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self)",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

export default {
  poweredByHeader: false,
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Only public, explicitly named values may enter the old preserved widgets.
  env: { REACT_APP_API_URL: "/api/public", VITE_MAP_STYLE_URL: "" },
  async rewrites() {
    return [
      { source: "/api/v2/:path*", destination: `${apiOrigin}/api/v2/:path*` },
      { source: "/api/public/:path*", destination: `${apiOrigin}/:path*` },
    ];
  },
  async redirects() {
    return [
      ["/farm", "/app/today"],
      ["/today", "/app/today"],
      ["/my-farm", "/app/farm"],
      ["/register", "/app/today"],
      ["/planning", "/app/more/planning"],
      ["/field-intelligence", "/app/farm"],
      ["/crop-health", "/app/health"],
      ["/market", "/app/market"],
      ["/benefits", "/app/more/benefits"],
      ["/partners", "/for-partners"],
    ].map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};
