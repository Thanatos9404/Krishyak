import { useProductLocale } from "./ProductLocale";

// Picture Guides: every care step gets one large, simple drawing so a farmer
// who does not read can still follow it. The drawings are line pictograms in
// the page's own colours; they ship with the app, so they also work offline.

const LEAF = "M18 42C18 24 32 14 48 14c0 18-10 30-30 28Z";
const P = {
  remove_leaves: (
    <>
      <path d={LEAF} />
      <path d="M22 38 44 18" />
      <path d="M38 46h18l-2 12H40Z" />
      <path d="M36 46h22" />
      <path d="M30 50c2 4 5 5 9 5" strokeDasharray="3 4" />
    </>
  ),
  remove_plant: (
    <>
      <path d="M32 44V20" />
      <path d="M32 30c-8 0-12-4-12-10 8 0 12 4 12 10Z" />
      <path d="M32 26c8 0 12-4 12-10-8 0-12 4-12 10Z" />
      <path d="M32 44c-3 4-6 6-10 7M32 44c3 4 6 6 10 7M32 44v10" />
      <path d="M52 30V12m-6 6 6-6 6 6" />
      <path d="M8 44h14m20 0h14" />
    </>
  ),
  no_wet_leaves: (
    <>
      <path d={LEAF} transform="translate(-4 8) scale(0.85)" />
      <path d="M40 10c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8Z" />
      <path d="M52 20c-2 3-3 5-3 6a3 3 0 0 0 6 0c0-1-1-3-3-6Z" />
      <circle cx="32" cy="32" r="26" />
      <path d="M14 14 50 50" />
    </>
  ),
  air_flow: (
    <>
      <path d="M12 54V34M52 54V34" />
      <path d="M12 40c-6 0-8-3-8-8 6 0 8 3 8 8ZM52 40c6 0 8-3 8-8-6 0-8 3-8 8Z" />
      <path d="M22 22h14a5 5 0 1 0-5-5M22 32h20a5 5 0 1 1-5 5M22 27h8" />
      <path d="M4 54h56" />
    </>
  ),
  prune: (
    <>
      <circle cx="16" cy="48" r="7" />
      <circle cx="36" cy="52" r="7" />
      <path d="M21 43 50 12M31 47 54 26" />
      <path d="M40 8v14M33 15h14" strokeDasharray="2 4" />
    </>
  ),
  mulch: (
    <>
      <path d="M32 40V18" />
      <path d="M32 28c-8 0-12-4-12-10 8 0 12 4 12 10ZM32 24c8 0 12-4 12-10-8 0-12 4-12 10Z" />
      <path d="M6 44h52" />
      <path d="M10 50l6-4m2 8 8-6m2 6 8-6m2 6 8-6m2 4 6-4" />
    </>
  ),
  rotate: (
    <>
      <path d="M50 26A20 20 0 0 0 14 22" />
      <path d="M14 12v10h10" />
      <path d="M14 38a20 20 0 0 0 36 4" />
      <path d="M50 52V42H40" />
      <path d="M32 38V28m0 4c-4 0-6-2-6-5 4 0 6 2 6 5Zm0-2c4 0 6-2 6-5-4 0-6 2-6 5Z" />
    </>
  ),
  healthy_seed: (
    <>
      <path d="M24 54V34" />
      <path d="M24 42c-8 0-12-4-12-10 8 0 12 4 12 10ZM24 38c8 0 12-4 12-10-8 0-12 4-12 10Z" />
      <path d="M10 54h28" />
      <circle cx="46" cy="20" r="12" />
      <path d="m40 20 4 4 8-8" />
    </>
  ),
  clean_tools: (
    <>
      <path d="M14 50 40 24l6 6-26 26Z" />
      <path d="m40 24 8-12 10 10-12 8" />
      <path d="M16 10c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8ZM30 6c-2 3-3 5-3 6a3 3 0 0 0 6 0c0-1-1-3-3-6Z" />
      <circle cx="52" cy="46" r="3" />
      <circle cx="44" cy="54" r="2" />
    </>
  ),
  residue: (
    <>
      <path d="M4 36h56" />
      <path d="M12 36V26m10 10V22m10 14V26m10 10V22m10 14V26" />
      <path d="M32 40v16m-7-7 7 7 7-7" />
      <path d="M6 48c6-4 10-4 14 0m24 0c4-4 8-4 14 0" />
    </>
  ),
  look: (
    <>
      <circle cx="28" cy="28" r="18" />
      <path d="m41 41 15 15" />
      <path d="M19 33c0-9 7-14 15-14 0 9-5 15-15 14Zm2-2 11-10" />
    </>
  ),
  call_expert: (
    <>
      <path d="M18 8h10l4 12-6 4c3 6 8 11 14 14l4-6 12 4v10c0 3-3 6-6 6C28 50 12 34 12 14c0-3 3-6 6-6Z" />
      <path d="M40 10c7 1 12 6 13 13M40 18c3 1 5 3 6 6" />
    </>
  ),
  act_fast: (
    <>
      <circle cx="34" cy="34" r="20" />
      <path d="M34 22v12l8 6" />
      <path d="M28 6h12M4 26h8M2 36h8M6 46h8" />
    </>
  ),
  feed_water: (
    <>
      <path d="M8 26h22v22H8Z" />
      <path d="M30 32 46 20l4 4-14 16" />
      <path d="M12 26c0-8 14-8 14 0" />
      <path d="M52 30v4m4 2v4m-8 0v4" />
      <path d="M40 56h20M50 56V46" />
    </>
  ),
  photo: (
    <>
      <path d="M8 20h10l4-6h20l4 6h10v32H8Z" />
      <circle cx="32" cy="35" r="10" />
      <path d="M28 38c0-5 3-8 8-8 0 5-3 8-8 8Z" />
    </>
  ),
};

// First match wins; the order puts specific actions before general ones.
const RULES = [
  [/officer|kisan call|expert|krishi vigyan/i, "call_expert"],
  [/another photo|clear photo/i, "photo"],
  [/act quickly|spread across/i, "act_fast"],
  [/rotate/i, "rotate"],
  [/variety|seed|seedling/i, "healthy_seed"],
  [/wash|clean/i, "clean_tools"],
  [/mulch/i, "mulch"],
  [/residue|plough/i, "residue"],
  [/overhead|splash|wetting|wet\b|humidity/i, "no_wet_leaves"],
  [
    /pull out|infected plants|badly affected plants|juniper|cedar/i,
    "remove_plant",
  ],
  [/cut out|dead wood|prune crowded|prune to let|mark affected/i, "prune"],
  [/air flow|space|canopy|prune/i, "air_flow"],
  [/well fed|water stress/i, "feed_water"],
  [/remove|collect|destroy/i, "remove_leaves"],
  [/check|look|watch|note|keep checking/i, "look"],
];
export const PICTURES = Object.keys(P);

export function pictureFor(step) {
  return RULES.find(([pattern]) => pattern.test(step))?.[1] || "look";
}

export function Pictogram({ name, size = 64 }) {
  return (
    <svg
      className="pictogram"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name] || P.look}
    </svg>
  );
}

// Numbered step cards: a big drawing first, a short line of text below.
export function PictureSteps({ steps, label }) {
  const { tx } = useProductLocale();
  if (!steps?.length) return null;
  return (
    <ol
      className="picture-steps"
      aria-label={label || tx("What you can do now")}
    >
      {steps.map((step, index) => (
        <li key={step}>
          <span className="picture-step-number" aria-hidden="true">
            {index + 1}
          </span>
          <Pictogram name={pictureFor(step)} />
          <p>{tx(step)}</p>
        </li>
      ))}
    </ol>
  );
}
