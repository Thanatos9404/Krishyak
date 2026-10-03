import {
  ArrowUpRight,
  Camera,
  CloudSun,
  Sprout,
  Store,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { PublicShell } from "../components/public/PublicShell";
import { Photo } from "../components/public/Photo";
import { FieldStory } from "../components/public/FieldStory";
import { ClosingCta } from "../components/public/ClosingCta";
import { JsonLd } from "../components/public/JsonLd";
import { pageMetadata, SITE_ORIGIN } from "../lib/seo";

export const metadata = pageMetadata(
  "/",
  "A clearer view of your farm",
  "Keep your field observations, crop photos, weather and market context together. Krishyak helps Indian farmers understand what to inspect next.",
);

export default function Home() {
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Krishyak",
              url: SITE_ORIGIN,
              logo: `${SITE_ORIGIN}/icon-512.png`,
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
      <main id="main-content">
        <section className="home-hero container">
          <span className="eyebrow hero-eyebrow">
            <span className="small-leaf" /> FIELD INTELLIGENCE, ROOTED IN INDIA
          </span>
          <h1>
            Your farm.
            <br />
            <span>A clearer view.</span>
          </h1>
          <p>
            Know what needs a closer look. Bring your field notes, crop photos,
            <br className="desktop-break" /> weather and satellite evidence into
            one simple place.
          </p>
          <div className="cta-row">
            <a href="/app/today" className="button primary">
              Add my farm
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a href="/demo" className="text-link">
              Explore demo farm<span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-landscape">
            <Photo
              name="fields"
              priority
              sizes="(max-width: 600px) 100vw, 90vw"
            />
            <div className="hero-caption">
              <span className="badge">Every field has a story</span>
              <span>
                See the context.
                <br />
                Choose your next step.
              </span>
            </div>
            <a className="hero-preview" href="/demo">
              <div>
                <span className="preview-dot" /> DEMONSTRATION FARM{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </div>
              <h2>A change worth checking.</h2>
              <p>
                A closer look at vegetation, weather and your own observations.
              </p>
              <span className="preview-bottom">
                <Sprout size={16} aria-hidden="true" /> Open the example field →
              </span>
            </a>
            <span className="hero-photo-note">
              Illustrative aerial photograph · Indonesia
            </span>
          </div>
        </section>
        <section
          className="source-strip container"
          aria-label="Information brought together"
        >
          <span>
            One place.
            <br />
            <strong>More context.</strong>
          </span>
          <div>
            <Sprout size={20} aria-hidden="true" /> Field observations
          </div>
          <div>
            <Camera size={20} aria-hidden="true" /> Crop photographs
          </div>
          <div>
            <CloudSun size={20} aria-hidden="true" /> Weather
          </div>
          <div>
            <Store size={20} aria-hidden="true" /> Market information
          </div>
        </section>
        <FieldStory />
        <section className="everyday-section container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">MADE FOR THE EVERYDAY</span>
              <h2>
                A little less searching.
                <br />A little more understanding.
              </h2>
            </div>
            <p>
              Start with what matters today. The details are there when you need
              them.
            </p>
          </div>
          <div className="feature-editorial">
            <article className="feature-large">
              <Photo name="farmers" />
              <div>
                <span className="eyebrow">YOUR FIELD, IN YOUR HANDS</span>
                <h3>Built around the way you farm.</h3>
                <p>
                  Add a field, keep a crop record, and see your observations
                  through the season.
                </p>
                <a className="text-link" href="/for-farmers">
                  For farmers →
                </a>
              </div>
            </article>
            <div className="feature-stack">
              <article>
                <Photo name="tomatoes" />
                <div>
                  <Camera size={22} aria-hidden="true" />
                  <h3>When something looks different.</h3>
                  <p>
                    Check a crop photo and keep the result alongside your field
                    notes. Confirm it in the field.
                  </p>
                  <a className="text-link" href="/technology#crop-photos">
                    About crop photos →
                  </a>
                </div>
              </article>
              <article className="market-feature">
                <Photo name="market" />
                <div>
                  <h3>Context before a sale.</h3>
                  <p>
                    Reported market observations, with a source, date and unit.
                  </p>
                  <a className="text-link" href="/how-it-works#market">
                    Understand market information →
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="trust-section container">
          <div>
            <span className="eyebrow">CLEAR EVIDENCE. HONEST LIMITS.</span>
            <h2>
              Useful information.
              <br />
              Your judgement stays central.
            </h2>
            <p>
              A satellite signal is a reason to inspect. A crop-photo result
              needs confirmation. A market observation is context, not a
              promise.
            </p>
            <a className="text-link" href="/technology">
              How the evidence works →
            </a>
          </div>
          <div className="trust-notes">
            <article>
              <ShieldCheck size={24} aria-hidden="true" />
              <div>
                <h3>Your records stay yours.</h3>
                <p>
                  Choose processing permissions, download your records and clear
                  private data from your device.
                </p>
              </div>
            </article>
            <article>
              <WifiOff size={24} aria-hidden="true" />
              <div>
                <h3>Ready for a patchy connection.</h3>
                <p>
                  Save selected field information on your device. Record notes
                  offline and sync when you reconnect.
                </p>
              </div>
            </article>
            <article>
              <Sprout size={24} aria-hidden="true" />
              <div>
                <h3>Made to be checked in the field.</h3>
                <p>
                  Sources and dates stay visible. Field validation and
                  agronomist review remain essential.
                </p>
              </div>
            </article>
          </div>
        </section>
        <ClosingCta />
      </main>
    </PublicShell>
  );
}
