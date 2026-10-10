import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
export default function BenefitsPanel() {
  const { tx } = useProductLocale();
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
      <h2>{tx("Benefits and official services")}</h2>
      <p>
        {tx(
          "These programs may be relevant to your farm. Official eligibility and enrollment have not been verified.",
        )}
      </p>
      {error && (
        <p role="alert">
          {tx("Program information is unavailable.")} {error}
        </p>
      )}
      {catalog?.items.map((program) => (
        <article key={program.id} className="v2-event">
          <h3>{program.name}</h3>
          <p>{program.purpose}</p>
          <p>
            <strong>{tx("Needs official verification")}</strong>
          </p>
          <ul>
            {program.requires_verification.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            {tx("Source review:")} {program.reviewed_at} ·{" "}
            {program.review_scope}
          </p>
          <a
            href={program.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tx("Open official")} {program.name} portal
          </a>
          <details>
            <summary>{tx("Source and limits")}</summary>
            <a
              href={program.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tx("Program information source")}
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
        <p role="status">{tx("Loading public program information\u2026")}</p>
      )}
    </section>
  );
}
