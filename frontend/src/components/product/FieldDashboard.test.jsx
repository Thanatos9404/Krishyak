import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FieldNumbers, WeekAhead, riskBand } from "./FieldDashboard";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));

const w = {
  selected: "field-a",
  farmer: { id: "farmer-a", district: "Jaipur", state: "Rajasthan" },
  consents: ["agronomic_analysis", "location_processing"],
  cycles: [{ id: "cycle-1", crop_id: "wheat", status: "active" }],
  plot: { revision: 1 },
  busy: false,
  offline: false,
  act: (task) => task(),
};
const REPORT = {
  crop_id: "wheat",
  field_score: 76,
  score_band: "good",
  harvest: {
    total_quintals: 53,
    yield_kg_per_hectare: 4191,
    profit: 94137,
    profit_range: [82083, 95254],
    basis: { level: "district", kg_per_hectare: 3718 },
  },
  risk: { overall: 34, weather: 20, pest: 35, price: 60, soil: 10 },
};
const OUTLOOK = {
  forecast: {
    days: [
      {
        date: "2026-11-20",
        high_c: 25.4,
        low_c: 14.8,
        rain_mm: 0,
        rain_chance_percent: 0,
        sky: "clear",
      },
      {
        date: "2026-11-21",
        high_c: 24.6,
        low_c: 14.1,
        rain_mm: 6.2,
        rain_chance_percent: 80,
        sky: "rain",
      },
    ],
  },
  climate: { annual_rain_mm: 581 },
  recent_rain: {
    last_90_days: { rain_mm: 78.7, normal_mm: 151, percent_of_normal: 52 },
  },
};

test("risk scores read as low, medium or high", () => {
  expect(riskBand(20)[0]).toBe("Low");
  expect(riskBand(35)[0]).toBe("Medium");
  expect(riskBand(60)[0]).toBe("High");
});

test("the four field numbers lead the dashboard with where they come from", () => {
  render(
    <FieldNumbers workspace={w} report={{ status: "ready", data: REPORT }} />,
  );
  expect(
    screen.getByRole("heading", { name: "Your Wheat field at a glance" }),
  ).toBeInTheDocument();
  const harvest = screen
    .getByRole("heading", { name: "Expected harvest" })
    .closest("article");
  expect(harvest).toHaveTextContent("53 quintals");
  expect(harvest).toHaveTextContent("About 4,191 kg per hectare");
  const profit = screen
    .getByRole("heading", { name: "Expected profit" })
    .closest("article");
  expect(profit).toHaveTextContent("₹94,137");
  expect(profit).toHaveTextContent("Likely between ₹82,083 and ₹95,254");
  expect(
    screen.getByRole("heading", { name: "Risk" }).closest("article"),
  ).toHaveTextContent("34 / 100Low");
  expect(
    screen.getByRole("heading", { name: "Field score" }).closest("article"),
  ).toHaveTextContent("76 / 100Good");
  const risks = screen
    .getByRole("heading", { name: "Where the risk comes from" })
    .closest("div");
  expect(within(risks).getAllByRole("listitem")).toHaveLength(4);
  expect(
    within(risks).getByRole("img", { name: "Price: 60 / 100" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/From Jaipur district records\. Estimates, not promises/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Full field report/ }),
  ).toHaveAttribute("href", "/app/assessment");
});

test("a loss is called a loss", () => {
  const report = {
    ...REPORT,
    harvest: {
      ...REPORT.harvest,
      profit: -12000,
      profit_range: [-20000, 4000],
    },
  };
  render(
    <FieldNumbers workspace={w} report={{ status: "ready", data: report }} />,
  );
  expect(
    screen.getByRole("heading", { name: "Expected loss" }).closest("article"),
  ).toHaveTextContent("₹12,000");
});

test("with no price at all, profit is withheld instead of invented", () => {
  const report = {
    ...REPORT,
    price: null,
    harvest: { ...REPORT.harvest, profit: null, profit_range: null },
  };
  render(
    <FieldNumbers workspace={w} report={{ status: "ready", data: report }} />,
  );
  const card = screen
    .getByRole("heading", { name: "Expected profit" })
    .closest("article");
  expect(card).toHaveTextContent("No price yet");
  expect(card).toHaveTextContent(/profit is not estimated/);
  expect(card).not.toHaveTextContent("₹");
});

test("a field without a crop says what to add instead of showing numbers", () => {
  render(
    <FieldNumbers
      workspace={w}
      report={{ status: "incomplete", message: "Add a field crop" }}
    />,
  );
  expect(
    screen.getByText(/Add your crop, land size and soil/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Complete my field/ }),
  ).toHaveAttribute("href", "/app/farm/field-a");
  expect(screen.queryByText("Expected harvest")).toBeNull();
});

test("without permission the farmer is asked, not shown an error", () => {
  render(
    <FieldNumbers
      workspace={{ ...w, consents: [] }}
      report={{ status: "idle" }}
    />,
  );
  expect(
    screen.getByText("See your expected harvest, profit and risk"),
  ).toBeInTheDocument();
});

test("the week ahead counts rainy days and compares recent rain with normal", () => {
  render(
    <WeekAhead workspace={w} outlook={{ status: "ready", data: OUTLOOK }} />,
  );
  expect(
    screen.getByText("Rain is likely on 1 of the next 7 days."),
  ).toBeInTheDocument();
  const days = screen.getAllByRole("listitem").slice(0, 2);
  expect(days[0]).toHaveTextContent("Today");
  expect(days[0]).toHaveTextContent("25°");
  expect(days[0]).toHaveTextContent("0%");
  expect(days[1]).toHaveTextContent("6.2 mm");
  expect(
    screen.getByText("Rain here in a normal year: 581 mm"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Last 90 days: 78.7 mm of rain, 52% of normal"),
  ).toBeInTheDocument();
});

test("no forecast and no permission both mean no card", () => {
  const { container, rerender } = render(
    <WeekAhead workspace={w} outlook={{ status: "unavailable" }} />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(
    <WeekAhead
      workspace={{ ...w, consents: [] }}
      outlook={{ status: "ready", data: OUTLOOK }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
