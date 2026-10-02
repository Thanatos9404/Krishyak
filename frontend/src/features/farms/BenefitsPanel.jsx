import React, { useEffect, useState } from "react";
import { farmApi } from "./api";

export default function BenefitsPanel() {
  const [catalog, setCatalog] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    farmApi("/benefits/catalog")
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="v2-card">
      <h2>Benefits and official services</h2>
      <p>
        These programs may be relevant to your farm. Official eligibility and
        enrollment have not been verified.
      </p>
      {error && <p role="alert">Program information is unavailable. {error}</p>}
      {catalog?.items.map((program) => (
        <article key={program.id} className="v2-event">
          <h3>{program.name}</h3>
          <p>{program.purpose}</p>
          <p>
            <strong>Needs official verification</strong>
          </p>
          <ul>
            {program.requires_verification.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Source review: {program.reviewed_at} · {program.review_scope}
          </p>
          <a
            href={program.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open official {program.name} portal
          </a>
          <details>
            <summary>Source and limits</summary>
            <a
              href={program.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Program information source
            </a>
            <ul>
              {catalog.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </article>
      ))}
      {!catalog && !error && (
        <p role="status">Loading public program information…</p>
      )}
    </section>
  );
}
