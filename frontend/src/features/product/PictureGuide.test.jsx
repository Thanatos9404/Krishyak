import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import guides from "./diseaseGuides.json";
import { PICTURES, PictureSteps, pictureFor } from "./PictureGuide";

const source = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "../backend/v2/disease_guidance.json"),
    "utf8",
  ),
);
const steps = [
  ...new Set([
    ...guides.common_steps,
    ...Object.values(guides.crops).flatMap((rows) =>
      rows.flatMap((row) => row.steps),
    ),
  ]),
];

test("the offline guide library matches the guidance the server uses", () => {
  // Run scripts/sync_disease_guides.py after editing the server guidance.
  const bundled = Object.values(guides.crops).flat();
  expect(bundled).toHaveLength(Object.keys(source.classes).length);
  for (const row of bundled) {
    const entry = source.classes[row.label];
    expect(entry).toBeDefined();
    expect(row).toMatchObject({
      name: entry.name,
      cause: entry.cause,
      urgent: Boolean(entry.urgent),
      steps: entry.steps,
    });
  }
  expect(guides.common_steps).toEqual(source.common_steps);
  expect(guides.review_status).toBe(source._meta.review_status);
});

test("every guidance step gets a drawing that exists", () => {
  for (const step of steps) expect(PICTURES).toContain(pictureFor(step));
});

test("drawings match the action, not just a keyword", () => {
  expect(pictureFor("Avoid splashing water on leaves.")).toBe("no_wet_leaves");
  expect(pictureFor("Use healthy seedlings next season.")).toBe("healthy_seed");
  expect(pictureFor("Remove badly spotted leaves.")).toBe("remove_leaves");
  expect(pictureFor("Rotate away from this crop for two seasons.")).toBe(
    "rotate",
  );
  expect(
    pictureFor(
      "Ask your local agriculture officer, Krishi Vigyan Kendra or the Kisan Call Centre (1800-180-1551) before any spraying.",
    ),
  ).toBe("call_expert");
  // An unknown step still shows a neutral drawing rather than nothing.
  expect(pictureFor("Something new")).toBe("look");
});

test("steps render as a numbered list with one drawing each", () => {
  const { container } = render(
    <PictureSteps
      steps={["Remove badly spotted leaves.", "Avoid splashing water."]}
      label="First steps"
    />,
  );
  const list = screen.getByRole("list", { name: "First steps" });
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[1]).toHaveTextContent("2");
  expect(items[1]).toHaveTextContent("Avoid splashing water.");
  expect(container.querySelectorAll("svg.pictogram")).toHaveLength(2);
  // Drawings are decoration; the text carries the meaning for screen readers.
  expect(container.querySelector("svg.pictogram")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("no steps, no list", () => {
  const { container } = render(<PictureSteps steps={[]} />);
  expect(container).toBeEmptyDOMElement();
});
