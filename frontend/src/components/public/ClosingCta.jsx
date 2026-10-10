import { ArrowUpRight } from "lucide-react";

export function ClosingCta({
  title = "Your next step starts with a clearer picture.",
}) {
  return (
    <section className="closing-cta container">
      <span className="eyebrow">YOUR FARM. YOUR DECISIONS.</span>
      <h2>{title}</h2>
      <p>
        Take a look around a demonstration farm, or start keeping your own field
        records when farm accounts are available.
      </p>
      <div className="cta-row">
        <a className="button light" href="/demo">
          Explore demo farm
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
        <a className="text-link" href="/app/today">
          Add my farm →
        </a>
      </div>
    </section>
  );
}
