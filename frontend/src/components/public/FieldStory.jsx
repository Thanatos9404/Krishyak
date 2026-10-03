"use client";
import { useState } from "react";
import { MapPin, Leaf, ClipboardCheck } from "lucide-react";
import { Photo } from "./Photo";

const steps = [
  {
    icon: MapPin,
    label: "Your field",
    title: "Start with the place you know.",
    text: "A field boundary, a crop and your observations. Keep the season connected to the land it belongs to.",
    detail: "Draw a boundary or start with an area. Mapping can wait.",
  },
  {
    icon: Leaf,
    label: "A change",
    title: "See a change. Understand the source.",
    text: "Usable satellite observations can show a vegetation change. Weather and your field notes add context.",
    detail:
      "An observation has a date, a source and a quality label. Missing data never means a healthy field.",
  },
  {
    icon: ClipboardCheck,
    label: "Your next step",
    title: "Take a look. Keep a record.",
    text: "Use the evidence to decide what to inspect. Record what you found and what you did, so the next decision has more context.",
    detail:
      "Inspection comes before a diagnosis, a treatment or a spending decision.",
  },
];

export function FieldStory() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <section className="field-story container" aria-labelledby="story-title">
      <div className="section-heading">
        <span className="eyebrow">FROM A SIGNAL TO A SENSIBLE NEXT STEP</span>
        <h2 id="story-title">Keep the whole field story together.</h2>
      </div>
      <div className="story-layout">
        <div className="story-image">
          <Photo name="terraces" sizes="(max-width: 760px) 100vw, 60vw" />
          <span className="story-image-label">
            Illustrative landscape · not a satellite observation
          </span>
          <svg
            className={`story-boundary story-boundary-${active}`}
            viewBox="0 0 600 400"
            aria-hidden="true"
          >
            <path d="M140 80L480 115L440 330L105 275Z" />
            <path className="story-zone" d="M140 80L247 91L215 294L105 275Z" />
          </svg>
          <div className="story-float">
            <span className="badge amber">Product walkthrough</span>
            <strong>
              {active === 0
                ? "One field. One season."
                : active === 1
                  ? "A change worth checking."
                  : "A note that stays with your field."}
            </strong>
            <span>
              {active === 0
                ? "Field records, all in one place"
                : active === 1
                  ? "Illustrative evidence, not a real alert"
                  : "Observe → inspect → record"}
            </span>
          </div>
        </div>
        <div className="story-copy">
          <div className="story-tabs" aria-label="Field story steps">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            <span className="story-number">0{active + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <p className="story-detail">{step.detail}</p>
          </div>
          <a className="text-link" href="/how-it-works">
            See how it works →
          </a>
        </div>
      </div>
    </section>
  );
}
