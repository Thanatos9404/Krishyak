import { headers } from "next/headers";

export async function JsonLd({ data }) {
  const nonce = (await headers()).get("x-nonce");
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
