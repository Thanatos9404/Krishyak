import { FarmerLanding } from "../components/landing/FarmerLanding";
import { JsonLd } from "../components/public/JsonLd";
import { pageMetadata, SITE_ORIGIN } from "../lib/seo";

export const metadata = pageMetadata(
  "/",
  "Your farming helper that listens",
  "Ask about rain, mandi prices and sick plants by speaking in your own language. Krishyak is free for Indian farmers and answers aloud in 22 Indian languages and English.",
);

export default function Home() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Krishyak",
              url: SITE_ORIGIN,
              logo: `${SITE_ORIGIN}/krishyak_logo.png`,
              sameAs: ["https://github.com/Thanatos9404/Krishyak"],
            },
            {
              "@type": "WebSite",
              name: "Krishyak",
              url: SITE_ORIGIN,
              inLanguage: "en",
            },
          ],
        }}
      />
      <FarmerLanding />
    </>
  );
}
