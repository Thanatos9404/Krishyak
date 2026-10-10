import {
  CloudSun,
  MapPin,
  ShieldCheck,
  WifiOff,
  Sprout,
  Languages,
  NotebookPen,
  ArrowUpRight,
} from "lucide-react";
import { PublicShell } from "./PublicShell";
import { PageIntro } from "./PageIntro";
import { ClosingCta } from "./ClosingCta";
import { JsonLd } from "./JsonLd";

export const FAQ = [
  [
    "What is Krishyak?",
    "Krishyak brings field records, crop photographs, weather, satellite observations and market context into a farmer workspace. It helps you understand what to inspect next and keep a record of what you find.",
  ],
  [
    "Does a crop photo confirm a disease?",
    "No. The image classifier suggests a possible condition for supported crops. It can be wrong, especially with field photographs. Confirm symptoms with an agronomist before choosing a treatment or dose.",
  ],
  [
    "What can a satellite observation tell me?",
    "Usable Sentinel-2 observations can show vegetation, moisture-context and crop-canopy changes. Clouds, mixed pixels, field size and boundary accuracy affect the result. A vegetation index does not establish disease, soil nutrients or yield.",
  ],
  [
    "Can I use Krishyak without a mapped boundary?",
    "Yes. Start with your field name and area, add your crop, and keep observations. Satellite processing needs a mapped boundary and your processing permissions.",
  ],
  [
    "What happens when the connection drops?",
    "If you choose to save fields on your device, downloaded information remains available for up to seven days. Field notes can wait in a local queue and synchronize when you reconnect and your account is verified. Photo analysis and new market or satellite retrieval still need a connection.",
  ],
  [
    "Does Krishyak access Aadhaar or decide scheme eligibility?",
    "No. Public program information links to official portals. Krishyak does not access Aadhaar, bank accounts or restricted land registries, and cannot approve benefits or establish your eligibility.",
  ],
  [
    "Which crops can the photo model handle?",
    "The current model covers 38 image labels across 14 crop categories: Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Bell pepper, Potato, Raspberry, Soybean, Squash, Strawberry and Tomato. Supported labels are limited; unsupported crops are explicitly identified.",
  ],
  [
    "Is Krishyak free to use?",
    "The demonstration is free and requires no account. There is no checkout or paid farmer subscription in this product. Availability of live accounts depends on the operator configuring production services. No lifetime service or provider availability is promised.",
  ],
  [
    "Can I download or remove my records?",
    "Yes. Account controls provide a metadata export and authenticated photo downloads. Account deletion removes records and queues private photo cleanup. You can separately clear saved information from your device.",
  ],
  [
    "Is this a field-validated advisory service?",
    "Not yet. The engineering and synthetic tests are documented, but real farmer trials, agronomic review and physical-device testing are separate release requirements. Krishyak does not replace local expertise.",
  ],
];

const intros = {
  "how-it-works": {
    eyebrow: "A FIELD-TO-DECISION WORKFLOW",
    title: "From what you notice to what you do next.",
    description:
      "Farming rarely comes with a complete picture. Keep the observations you have together, understand what they mean, and make the next inspection a little more informed.",
    photo: "terraces",
    breadcrumb: "How it works",
  },
  technology: {
    eyebrow: "THE EVIDENCE BEHIND THE EXPERIENCE",
    title: "More context. Clearer limits.",
    description:
      "Different sources answer different questions. Krishyak keeps their dates, methods and limitations visible, so a useful clue is never presented as a certainty.",
    photo: "tomatoes",
    breadcrumb: "Technology",
  },
  "for-farmers": {
    eyebrow: "BUILT AROUND YOUR FIELD",
    title: "Less time finding information. More time in your field.",
    description:
      "A simple place for your fields, crop seasons and the things you notice. Start with one field. Add more detail when it is useful.",
    photo: "farmers",
    breadcrumb: "For farmers",
    cta: "Add my farm",
    href: "/app/today",
  },
  "for-partners": {
    eyebrow: "FOR FPOS, AGRONOMISTS & PILOT TEAMS",
    title: "A shared purpose. Clear boundaries.",
    description:
      "Help farmers connect observations to field inspections. Explore consent-based pilot infrastructure, source-aware evidence and a separate institutional workspace.",
    photo: "community",
    breadcrumb: "For partners",
  },
  about: {
    eyebrow: "THE IDEA BEHIND KRISHYAK",
    title: "Better questions start with a clearer picture.",
    description:
      "Krishyak started with farm-decision simulations. It is growing into a connected record of a field: what changed, what the farmer saw, and what happened next.",
    photo: "fieldwork",
    breadcrumb: "Our story",
  },
  faq: {
    eyebrow: "GOOD TO KNOW BEFORE YOU START",
    title: "A few answers, in plain language.",
    description:
      "What the product can do, what the evidence means, and where your judgement and local expertise matter most.",
    photo: "market",
    breadcrumb: "Questions & answers",
  },
};

function Steps() {
  return (
    <>
      <section className="content-section container">
        <h2>One field, through the season.</h2>
        <div className="explainer-list">
          {[
            [
              "Add the field you know.",
              "Name a farm and field. Draw its boundary on the map, or simply enter its area. Add the crop and season when you are ready.",
            ],
            [
              "Bring observations together.",
              "Keep crop photographs, sourced soil readings and field notes beside usable satellite observations and weather context. Each source keeps its own limitations.",
            ],
            [
              "Start with today’s attention.",
              "See a small set of conservative inspection prompts when available evidence supports them. Expand a prompt to understand its source, date and quality.",
            ],
            [
              "Check in the field.",
              "A signal points to a question. Look at the crop, compare symptoms and involve a local expert before making a treatment or spending decision.",
            ],
            [
              "Record what happened.",
              "Add an irrigation, harvest, sale, cost or field note. Your timeline helps the next observation make sense.",
            ],
          ].map(([title, text], i) => (
            <article key={title} className="explainer-row">
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="content-section container" id="market">
        <h2>Put a market observation in context.</h2>
        <p>
          Compare a reported price with its market, commodity, unit and
          observation date. Missing or old observations stay labelled. There is
          no invented “best price today” or instruction to sell.
        </p>
        <div className="plain-panel">
          <h3>Keep the decision with the farmer.</h3>
          <p>
            Weather models are not field rain gauges. Satellite signals are not
            diagnoses. Photo-model scores are not disease severity. A useful
            product makes these distinctions easy to see.
          </p>
          <a className="text-link" href="/technology">
            Explore the evidence sources →
          </a>
        </div>
      </section>
    </>
  );
}

function Technology() {
  return (
    <>
      <section className="content-section container">
        <h2>Every source has a job.</h2>
        <div className="content-grid">
          {[
            [
              Sprout,
              "Satellite context",
              "Stored Sentinel-2 observations support vegetation, moisture-context and crop-canopy trends. Cloud and valid-pixel quality checks come before an inspection prompt. A changed boundary makes earlier evidence historical.",
            ],
            [
              CloudSun,
              "Weather and soil",
              "Weather is modelled context for an approximate field location. Soil evidence keeps its reported method, date, depth and units. Krishyak does not infer soil nutrients from satellite colours.",
            ],
            [
              NotebookPen,
              "Farmer observations",
              "Your field notes and recorded actions stay attached to the field and crop season. They are farmer-entered evidence, not automatically verified measurements.",
            ],
          ].map(([Icon, title, text]) => (
            <article key={title}>
              <Icon size={26} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="content-section container" id="crop-photos">
        <h2>A crop photo is a starting point.</h2>
        <p>
          For a supported crop, the classifier suggests an image label and
          records a raw model score. It does not measure severity, prove a field
          diagnosis or choose a chemical dose. Farmers can mark a result useful,
          incorrect or uncertain, and research review follows separate consent
          and role checks.
        </p>
        <details className="plain-panel">
          <summary>About the current model and its validation</summary>
          <h3>38 labels across 14 crop categories</h3>
          <p>
            The active release is <code>publisher-efficientnet-colab-v1</code>,
            using an EfficientNet classifier and a verified compact inference
            artifact.
          </p>
          <p>
            Recorded internal test accuracy is 93.71% on 8,566 examples.
            External PlantDoc accuracy is 57.21% on 229 examples. That external
            result is a material limitation for field photographs; neither
            number establishes local field performance.
          </p>
          <p>
            The 95% Wilson interval for the external result is approximately
            50.73%–63.44%. Real field validation and label-by-label agronomic
            review remain required.
          </p>
          <a
            className="text-link"
            href="https://github.com/Thanatos9404/Krishyak/blob/feat/krishyak-v2-field-intelligence/docs/v2/MODEL_GOVERNANCE.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read model governance <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </details>
      </section>
      <section className="content-section container">
        <h2>Private records, by design.</h2>
        <div className="explainer-list">
          <article className="explainer-row">
            <span>01</span>
            <h3>Account ownership</h3>
            <p>
              Farm and plot records are checked against the signed-in account.
              Opaque sessions, origin checks and request quotas remain in the
              existing FastAPI backend.
            </p>
          </article>
          <article className="explainer-row">
            <span>02</span>
            <h3>Private photographs</h3>
            <p>
              Uploaded images are validated, normalized and stored behind
              authenticated access. Metadata export does not expose private
              object keys.
            </p>
          </article>
          <article className="explainer-row">
            <span>03</span>
            <h3>Purpose-based permissions</h3>
            <p>
              Location, satellite processing, agronomic analysis and optional
              research purposes are separate controls. Withdrawing permission
              affects future processing.
            </p>
          </article>
        </div>
        <a className="text-link" href="/privacy">
          Read the privacy details →
        </a>
      </section>
    </>
  );
}

function Farmers() {
  return (
    <>
      <section className="content-section container">
        <h2>Five places. One familiar rhythm.</h2>
        <div className="explainer-list">
          {[
            [
              "Today",
              "A few things to pay attention to, with a clear reason and an optional evidence view.",
            ],
            [
              "My Farm",
              "Your fields and crop seasons. Start with an area, map a boundary later, and keep records together.",
            ],
            [
              "Crop Health",
              "Take or upload a crop photo when you see a change. Read the result as a suggestion to verify.",
            ],
            [
              "Market",
              "Reported mandi observations and sourced MSP information, with units and dates.",
            ],
            [
              "More",
              "Planning tools, government information and your account settings, without crowding your daily work.",
            ],
          ].map(([title, text], i) => (
            <article className="explainer-row" key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="content-section container">
        <div className="content-grid">
          <article>
            <WifiOff size={25} aria-hidden="true" />
            <h3>A connection can wait.</h3>
            <p>
              Choose to save fields on your own device. Downloaded information
              has a saved time, and field notes can wait to synchronize.
            </p>
          </article>
          <article>
            <Languages size={25} aria-hidden="true" />
            <h3>Room for your language.</h3>
            <p>
              The language selector preserves Indian-language packs. New farm
              workflows currently have English and draft Hindi; other new
              strings use an explicit English fallback until reviewed.
            </p>
          </article>
          <article>
            <ShieldCheck size={25} aria-hidden="true" />
            <h3>You choose what to share.</h3>
            <p>
              Set processing permissions and optional research consent
              separately. Account controls offer downloads, device cleanup and
              deletion.
            </p>
          </article>
        </div>
      </section>
      <section className="plain-panel container">
        <h2>Try the workflow before adding your farm.</h2>
        <p>
          The demonstration uses clearly labelled, synthetic examples. It does
          not ask for a phone number, a field location or a payment.
        </p>
        <a className="text-link" href="/demo">
          Open the demonstration →
        </a>
      </section>
    </>
  );
}

function Partners() {
  return (
    <>
      <section className="content-section container">
        <h2>Prepared for a careful pilot.</h2>
        <div className="content-grid">
          <article>
            <NotebookPen size={26} aria-hidden="true" />
            <h3>A useful field record</h3>
            <p>
              Capture dated observations, farmer actions and reported outcomes.
              Keep provenance available for an agronomist’s review.
            </p>
          </article>
          <article>
            <ShieldCheck size={26} aria-hidden="true" />
            <h3>A consented cohort</h3>
            <p>
              Enroll selected fields with pilot permission. Organisation-scoped
              summaries suppress small groups and do not manufacture impact or
              model-accuracy metrics.
            </p>
          </article>
          <article>
            <MapPin size={26} aria-hidden="true" />
            <h3>A separate workspace</h3>
            <p>
              Authorised agronomists and organisation administrators use a
              dedicated institutional shell. Farmer navigation stays focused on
              the field.
            </p>
          </article>
        </div>
      </section>
      <section className="content-section container">
        <h2>What a pilot should establish.</h2>
        <div className="explainer-list">
          {[
            [
              "Usability",
              "Can farmers identify the next inspection, understand freshness, and record an observation under a poor connection?",
            ],
            [
              "Agronomic usefulness",
              "Do the prompts make sense for local crop stages and conditions? What false or missed signals appear?",
            ],
            [
              "Measured outcomes",
              "Record actual costs, harvests and decisions with consent. Design comparison and attribution before claiming income or yield improvements.",
            ],
            [
              "Operational readiness",
              "Agree on support, permissions, data retention, incident response and production infrastructure before inviting real farmers.",
            ],
          ].map(([title, text], i) => (
            <article className="explainer-row" key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="plain-panel container">
        <h2>No implied affiliation.</h2>
        <p>
          Krishyak is not presented as a government-approved service or as
          having established FPO, university or commercial partnerships.
          Official program information is separate from authorised integrations.
        </p>
        <a
          className="text-link"
          href="https://github.com/Thanatos9404/Krishyak"
          target="_blank"
          rel="noopener noreferrer"
        >
          Review the open project <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <br />
        <a className="text-link" href="/institution">
          Open the authorised institutional workspace →
        </a>
      </section>
    </>
  );
}

function About() {
  return (
    <>
      <section className="content-section container">
        <h2>Keep the question close to the field.</h2>
        <p>
          The first Krishyak tools explored how changing rainfall, inputs and
          market assumptions could change a farm’s simulated outcome. Those
          tools remain available under Planning, with their assumptions visible.
        </p>
        <p>
          The field workspace connects that thinking to a record farmers can
          maintain: a named field, a crop season, an observation, an inspection
          and an outcome. The aim is understandable context, with clear limits
          on what a model or data source can establish.
        </p>
      </section>
      <section className="founder-panel container">
        <div className="founder-monogram" aria-hidden="true">
          YT
        </div>
        <div>
          <span className="eyebrow">THE DEVELOPER BEHIND THE PROJECT</span>
          <h2>Yashvardhan Thanvi</h2>
          <p>
            Yashvardhan maintains the Krishyak repository. His public profile
            describes his work with C, Python, interactive learning, cloud and
            AI. The project’s source and engineering reports are available for
            review.
          </p>
          <p>
            This is a developer-led product under validation. There is no
            invented team, farmer testimonial, institutional endorsement or
            measured impact.
          </p>
          <a
            className="text-link"
            href="https://github.com/Thanatos9404"
            target="_blank"
            rel="noopener noreferrer"
          >
            View the public developer profile{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>
      <section className="content-section container">
        <h2>What we can show, and what still needs proof.</h2>
        <div className="content-grid">
          <article>
            <h3>Implemented</h3>
            <p>
              Private plot records, evidence timelines, offline queues,
              crop-photo handling, source-aware signals and consent-based pilot
              infrastructure.
            </p>
          </article>
          <article>
            <h3>Under validation</h3>
            <p>
              Farmer usability, local agronomic relevance, field-image
              performance and real-device operation.
            </p>
          </article>
          <article>
            <h3>Not claimed</h3>
            <p>
              Guaranteed yield, higher income, confirmed disease diagnoses,
              automatic scheme eligibility or government approval.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}

export function PublicPage({ kind }) {
  const intro = intros[kind];
  return (
    <PublicShell>
      <main id="main-content">
        <PageIntro {...intro} path={`/${kind}`} />
        {kind === "how-it-works" ? (
          <Steps />
        ) : kind === "technology" ? (
          <Technology />
        ) : kind === "for-farmers" ? (
          <Farmers />
        ) : kind === "for-partners" ? (
          <Partners />
        ) : kind === "about" ? (
          <About />
        ) : (
          <>
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map(([q, a]) => ({
                  "@type": "Question",
                  name: q,
                  acceptedAnswer: { "@type": "Answer", text: a },
                })),
              }}
            />
            <section className="content-section container faq-layout">
              <div>
                <h2>Start with the essentials.</h2>
                <p>
                  Still exploring? The <a href="/demo">demonstration farm</a>{" "}
                  shows the workflow without sharing personal information.
                </p>
              </div>
              <div className="faq-list">
                {FAQ.map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}
        <ClosingCta />
      </main>
    </PublicShell>
  );
}
