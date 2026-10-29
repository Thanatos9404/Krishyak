import { useProductLocale } from "../../features/product/ProductLocale";
import {
  BookOpen,
  Building2,
  Calculator,
  Landmark,
  Phone,
  Settings,
  ShieldCheck,
} from "lucide-react";
const ITEMS = [
  [
    "/app/more/benefits",
    Landmark,
    "Government schemes",
    "Official links to check what help you can get.",
    "plum",
  ],
  [
    "/app/more/planning",
    Calculator,
    "Plan my season",
    "Try different crops and costs before you sow.",
    "amber",
  ],
  [
    "/app/more/settings",
    Settings,
    "My account and settings",
    "Name, place, language, sign-in and permissions.",
    "leaf",
  ],
  [
    "tel:18001801551",
    Phone,
    "Call Kisan helpline",
    "Free advice from experts: 1800-180-1551.",
    "brick",
  ],
  [
    "/how-it-works",
    BookOpen,
    "How Krishyak works",
    "What Krishyak can and cannot tell you.",
    "sky",
  ],
  [
    "/privacy",
    ShieldCheck,
    "Privacy and terms",
    "How your information is kept safe.",
    "earth",
  ],
];
export function MoreView({ workspace: w }) {
  const { tx } = useProductLocale();
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("More help and settings")}</h1>
        <p>
          {tx(
            "Government schemes, season planning and your account, in one place.",
          )}
        </p>
      </header>
      <nav className="home-tiles more-tiles" aria-label={tx("More")}>
        {ITEMS.map(([href, Icon, title, description, tone]) => (
          <a className={`home-tile tone-${tone}`} key={href} href={href}>
            <Icon size={30} aria-hidden="true" />
            <strong>{tx(title)}</strong>
            <small>{tx(description)}</small>
          </a>
        ))}
        {["admin", "organisation_admin", "agronomist"].includes(
          w.farmer?.role,
        ) && (
          <a className="home-tile tone-sky" href="/institution">
            <Building2 size={30} aria-hidden="true" />
            <strong>{tx("Institutional workspace")}</strong>
            <small>
              {tx("Consented cohort evidence and research review.")}
            </small>
          </a>
        )}
      </nav>
      <p className="small muted">
        {tx(
          "Krishyak supports your judgement. It does not replace a field visit or official eligibility verification.",
        )}
      </p>
    </>
  );
}
