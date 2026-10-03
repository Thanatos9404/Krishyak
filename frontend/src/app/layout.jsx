import { headers } from "next/headers";
import "../design/fonts.css";
import "../design/tokens.css";
import "../design/public.css";
import "../design/product.css";
import { SITE_ORIGIN } from "../lib/seo";

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Krishyak — Field intelligence for Indian farmers",
    template: "%s | Krishyak",
  },
  description:
    "Keep your fields, crop observations, weather and next inspection steps together. Farm decisions with clear evidence and honest limits.",
  applicationName: "Krishyak",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#214b3a",
};

export default async function RootLayout({ children }) {
  // A fresh CSP nonce also ensures meaningful public HTML is rendered server-side.
  const nonce = (await headers()).get("x-nonce");
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/geologica-25d318ff54.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body data-csp-nonce={nonce}>{children}</body>
    </html>
  );
}
