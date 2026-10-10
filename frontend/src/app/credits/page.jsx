import provenance from "../../../public/asset-provenance.json";
import { PublicShell } from "../../components/public/PublicShell";
import { Photo } from "../../components/public/Photo";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/credits",
  "Photography & type credits",
  "Sources and licenses for the real illustrative photographs and self-hosted typefaces used by Krishyak.",
  false,
);
export default function Credits() {
  return (
    <PublicShell>
      <main id="main-content" className="container legal-content">
        <span className="eyebrow">REAL PHOTOGRAPHS, SOURCED WITH CARE</span>
        <h1>The people behind the pictures.</h1>
        <p>
          These photographs illustrate farming and fieldwork. They are not
          photographs of Krishyak customers, verified field evidence or product
          endorsements.
        </p>
        <div className="credits-list">
          {provenance.photos.map((photo) => (
            <article key={photo.name}>
              <Photo name={photo.name} />
              <h2>{photo.author}</h2>
              <p>{photo.alt}</p>
              <a
                className="text-link"
                href={photo.page}
                target="_blank"
                rel="noopener noreferrer"
              >
                Original on Pexels ↗
              </a>
            </article>
          ))}
        </div>
        <h2>Photography license</h2>
        <p>
          Used under the{" "}
          <a href="https://www.pexels.com/license/">Pexels license</a>. Only
          optimized derivatives are served by Krishyak.
        </p>
        <h2>Typography</h2>
        <p>
          Geologica and the Noto Sans script families are self-hosted Google
          Fonts under the SIL Open Font License. Font license files are
          available with the site assets.
        </p>
        <a className="text-link" href="/licenses/geologica-OFL.txt">
          Geologica font license →
        </a>
        <br />
        <a className="text-link" href="/asset-provenance.json">
          Complete asset provenance →
        </a>
      </main>
    </PublicShell>
  );
}
