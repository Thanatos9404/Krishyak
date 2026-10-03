import { PublicShell } from "./PublicShell";
import V2LegalNotice from "../../features/farms/V2LegalNotice";
import { JsonLd } from "./JsonLd";
import { breadcrumbSchema } from "../../lib/seo";

export function LegalPage({ kind }) {
  const privacy = kind === "privacy";
  return (
    <PublicShell>
      <JsonLd
        data={breadcrumbSchema([
          {
            name: privacy ? "Privacy" : "Terms",
            href: privacy ? "/privacy" : "/terms",
          },
        ])}
      />
      <main id="main-content" className="legal-content container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{privacy ? "Privacy" : "Terms"}</span>
        </nav>
        <span className="eyebrow">POLICY VERSION · 3 OCTOBER 2026</span>
        <h1>
          {privacy
            ? "Your information, with clear choices."
            : "Understand the product before relying on it."}
        </h1>
        <p className="badge amber">Draft policy · legal review required</p>
        <p>
          {privacy
            ? "Krishyak keeps farm-account records separate from public product pages. The following describes the implemented v2 controls; it is not a certification of regulatory compliance."
            : "Krishyak provides farm records, source-aware inspection context and simulations. These terms describe product limits and need accountable legal review before commercial release."}
        </p>
        <V2LegalNotice terms={kind === "terms"} />
        {privacy ? (
          <>
            <h2>Public site and photography</h2>
            <p>
              The public website uses self-hosted fonts and licensed
              illustrative stock photographs. It does not include advertising,
              analytics trackers or embedded chat widgets. Photograph credits
              identify the sources; people pictured are not claimed as Krishyak
              users.
            </p>
            <h2>Contact and requests</h2>
            <p>
              Use authenticated Settings for account export and deletion. For
              public project questions, consult the{" "}
              <a href="https://github.com/Thanatos9404/Krishyak">repository</a>.
              Do not post private field boundaries, photographs, phone numbers
              or credentials in public issues.
            </p>
          </>
        ) : (
          <>
            <h2>Illustrative demonstration</h2>
            <p>
              The demo uses synthetic fields, dates, weather, prices and
              photo-result examples. It does not make real farmer API writes or
              establish actual field conditions, market offers or product
              impact.
            </p>
            <h2>No transaction or eligibility decision</h2>
            <p>
              There is no payment flow in this release. Reported price context
              is not a purchase or sale recommendation. Official schemes remain
              subject to their current rules and authorised verification.
            </p>
          </>
        )}
      </main>
    </PublicShell>
  );
}
