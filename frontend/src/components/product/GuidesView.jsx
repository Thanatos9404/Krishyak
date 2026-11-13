import { useState } from "react";
import { AlertTriangle, BookOpenCheck, Phone } from "lucide-react";
import guides from "../../features/product/diseaseGuides.json";
import { useProductLocale } from "../../features/product/ProductLocale";
import { PictureSteps } from "../../features/product/PictureGuide";
import { cropCatalog, findCrop } from "../../features/product/crops";

// Crops grown most widely in India come first.
const ORDER = ["tomato", "potato", "maize", "pepper", "grape", "apple"];
const rank = (photo) => ORDER.indexOf(photo) + 1 || ORDER.length + 1;
const CROPS = Object.keys(guides.crops)
  .sort((a, b) => rank(a) - rank(b))
  .map(
    (photo) =>
      cropCatalog.find((row) => row.photo_name === photo) || {
        id: photo,
        label: photo,
        photo_name: photo,
      },
  );

// Picture guides: first-aid steps for common leaf diseases, as drawings. The
// whole library ships inside the app, so it opens with no signal.
export function GuidesView({ workspace: w }) {
  const { tx } = useProductLocale();
  const cycle =
    w.cycles?.find((item) => item.status === "active") || w.cycles?.[0];
  const mine = findCrop(cycle)?.photo_name;
  const [crop, setCrop] = useState(guides.crops[mine] ? mine : "tomato");
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("Picture guides")}</h1>
        <p>
          {tx(
            "First steps for common leaf diseases, shown in pictures. These guides work without internet.",
          )}
        </p>
      </header>
      <div className="guide-crops" role="group" aria-label={tx("Crop")}>
        {CROPS.map((row) => (
          <button
            key={row.photo_name}
            type="button"
            className="language-chip guide-chip"
            aria-pressed={crop === row.photo_name}
            onClick={() => setCrop(row.photo_name)}
          >
            {tx(row.label)}
          </button>
        ))}
      </div>
      {guides.crops[crop].map((entry) => (
        <section
          className="product-card guide-card"
          key={entry.label}
          aria-label={tx(entry.name)}
        >
          <h2>
            <BookOpenCheck size={22} aria-hidden="true" /> {tx(entry.name)}
          </h2>
          <p>
            {tx("Caused by:")} {tx(entry.cause)}
          </p>
          {entry.urgent && (
            <p className="urgent-note">
              <AlertTriangle size={18} aria-hidden="true" />{" "}
              {tx(
                "This disease can spread quickly. Act today and get expert advice.",
              )}
            </p>
          )}
          <PictureSteps steps={[...entry.steps, ...guides.common_steps]} />
        </section>
      ))}
      <a className="button secondary" href="tel:18001801551">
        <Phone size={18} aria-hidden="true" />{" "}
        {tx("Call Kisan Call Centre (free)")}
      </a>
      {!w.farmer && (
        <a className="button text" href="/app/today">
          {tx("Sign in to Krishyak")}
        </a>
      )}
      <p className="small muted">
        {tx(
          "General first steps that use no chemicals. They await review by an agronomist. For any spray, ask an expert first.",
        )}
      </p>
    </>
  );
}
