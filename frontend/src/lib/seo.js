export const SITE_ORIGIN = "https://krishyak.vercel.app";
export const PUBLIC_ROUTES = [
  "/",
  "/how-it-works",
  "/technology",
  "/for-farmers",
  "/for-partners",
  "/about",
  "/faq",
  "/privacy",
  "/terms",
];
export const preview =
  process.env.VERCEL_ENV === "preview" ||
  process.env.KRISHYAK_DEPLOYMENT === "staging";

export function canonical(path) {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("A local absolute path is required");
  return `${SITE_ORIGIN}${path === "/" ? "" : path.replace(/\/$/, "")}`;
}

export function pageMetadata(path, title, description, index = true) {
  return {
    title: { absolute: `${title} | Krishyak` },
    description,
    alternates: { canonical: canonical(path) },
    robots: { index: index && !preview, follow: index && !preview },
    openGraph: {
      title: `${title} · Krishyak`,
      description,
      url: canonical(path),
      siteName: "Krishyak",
      type: "website",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Krishyak — a clearer view of your farm",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Krishyak`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", href: "/" }, ...items].map(
      (item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: canonical(item.href),
      }),
    ),
  };
}
