import {
  ArrowUpRight,
  Calculator,
  BadgeHelp,
  Settings,
  Building2,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
const ITEMS = [
  [
    "/app/more/planning",
    Calculator,
    "Plan a season",
    "Explore assumptions with the farm decision simulator.",
  ],
  [
    "/app/more/benefits",
    BadgeHelp,
    "Benefits & official services",
    "Find official portals and verify eligibility with the source.",
  ],
  [
    "/app/more/settings",
    Settings,
    "Account & settings",
    "Your profile, permissions, offline records and data rights.",
  ],
  [
    "/how-it-works",
    BookOpen,
    "How Krishyak works",
    "Understand the records, evidence and limits.",
  ],
  [
    "/privacy",
    ShieldCheck,
    "Privacy & terms",
    "Read how your information is handled.",
  ],
];
export function MoreView({ workspace: w }) {
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">EVERYTHING ELSE, IN ONE PLACE</span>
          <h1>A little more for your farm.</h1>
          <p>
            Planning tools, official services and settings, when you need them.
          </p>
        </div>
      </header>
      <div className="more-grid">
        {ITEMS.map(([href, Icon, title, description]) => (
          <a className="more-card" key={href} href={href}>
            <Icon size={28} />
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <ArrowUpRight size={20} />
          </a>
        ))}
        {["admin", "organisation_admin", "agronomist"].includes(
          w.farmer?.role,
        ) && (
          <a className="more-card" href="/institution">
            <Building2 size={28} />
            <div>
              <h2>Institutional workspace</h2>
              <p>Consented cohort evidence and research review.</p>
            </div>
            <ArrowUpRight size={20} />
          </a>
        )}
      </div>
      <p className="small muted">
        Krishyak supports your judgement. It does not replace a field visit or
        official eligibility verification.
      </p>
    </>
  );
}
