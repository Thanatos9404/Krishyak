import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AssessmentView, assessmentSpeech } from "./AssessmentView";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));

const REPORT = {
  crop_id: "wheat",
  season: "rabi",
  area_hectares: 1.265,
  soil: {
    soil_type: "Sandy",
    source: "state_typical",
    suitability_percent: 40,
  },
  water: "rainfed",
  field_score: 44,
  score_band: "needs_care",
  harvest: {
    yield_kg_per_hectare: 747,
    total_quintals: 9.4,
    cost: 43381,
    revenue: 22916,
    profit: -20465,
    profit_per_hectare: -16183,
    risk: 55,
    range_kg_per_hectare: [650, 820],
    profit_range: [-23000, -18000],
    chance_of_profit_percent: 0,
  },
  price: { per_quintal: 2425, source: "msp", market: null, date: "2025-26" },
  inputs: {
    seed_kg: 126.5,
    fertilizer_kg: { DAP: 164.9, Urea: 196.4, MOP: 84.3 },
    nutrients_kg_per_hectare: { N: 120, P2O5: 60, K2O: 40 },
    waterings: 0,
    days_to_harvest: 135,
  },
  risk: { overall: 55, weather: 70, price: 60, pest: 20, soil: 45 },
  pests: {
    level: "medium",
    active: [{ name: "Aphids", symptoms: "Curled leaves" }],
  },
  ai_plan: {
    changes: [{ kind: "seed" }, { kind: "pest_watch" }, { kind: "soil_test" }],
    profit: -15000,
    extra_profit: 5465,
  },
  better_crop: {
    crop_id: "mustard",
    profit: 681,
    risk: 46,
    total_quintals: 6.5,
    soil_suitability: 75,
  },
  alternatives: [
    {
      crop_id: "mustard",
      profit: 681,
      risk: 46,
      total_quintals: 6.5,
      soil_suitability: 75,
    },
  ],
  schemes: [
    { id: "pm-kisan" },
    { id: "pmfby", premium_percent: 1.5 },
    { id: "pmksy" },
  ],
  assumptions: { water_mm: 105 },
};
const workspace = {
  selected: "plot-1",
  plot: { id: "plot-1", name: "Wheat field" },
  consents: ["agronomic_analysis"],
  offline: false,
};

test("the report shows score, harvest, loss, inputs, risks, a better crop and schemes", async () => {
  farmApi.mockResolvedValue(REPORT);
  render(<AssessmentView workspace={workspace} />);
  expect(await screen.findByText("44")).toBeInTheDocument();
  expect(farmApi).toHaveBeenCalledWith(
    "/plots/plot-1/assessment",
    expect.objectContaining({ method: "POST" }),
  );
  expect(screen.getByText("Needs care")).toBeInTheDocument();
  expect(screen.getByText("9.4 quintals")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Expected loss" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Urea").nextSibling).toHaveTextContent("196.4 kg");
  expect(screen.getByText("Rain only")).toBeInTheDocument();
  expect(screen.getByRole("meter", { name: "Weather" })).toHaveAttribute(
    "aria-valuenow",
    "70",
  );
  expect(
    screen.getByRole("heading", { name: /A better crop for this field/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Mustard could earn about .*21,146 more than Wheat/),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Use certified seed from a trusted shop."),
  ).toBeInTheDocument();
  const schemes = screen
    .getByRole("heading", { name: /Government schemes/ })
    .closest("section");
  expect(within(schemes).getByText(/You pay only 1.5%/)).toBeInTheDocument();
  expect(
    within(schemes).getAllByRole("link", { name: /Official website/ })[0],
  ).toHaveAttribute("href", "https://pmkisan.gov.in/");
});

test("the spoken summary covers the score, harvest and a better crop", () => {
  const tx = (source, params = {}) =>
    source.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? "");
  const text = assessmentSpeech(REPORT, tx, "en");
  expect(text).toMatch(/score is 44 out of 100/);
  expect(text).toMatch(/9.4 quintals of Wheat/);
  expect(text).toMatch(/Mustard could earn/);
});

test("a field without a crop is sent to farm setup", async () => {
  farmApi.mockRejectedValue(
    Object.assign(
      new Error(
        "Add a field crop that Krishyak can assess, such as wheat, rice or mustard",
      ),
      { status: 422 },
    ),
  );
  render(<AssessmentView workspace={workspace} />);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/Add a field crop/),
  );
  expect(
    screen.getByRole("link", { name: "Tell Krishyak about your farm" }),
  ).toHaveAttribute("href", "/app/setup");
});
