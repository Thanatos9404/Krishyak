import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarketView, MarketPrices, supportPriceFor } from "./MarketView";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/product/ProductLocale", () => ({
  useProductLocale: () => ({
    language: "hi",
    formatDate: (value) => value,
    tx: (text, values = {}) =>
      (({ Maharashtra: "महाराष्ट्र", Nashik: "नाशिक" })[text] || text).replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => values[key],
      ),
  }),
}));

const market = (overrides = {}) => ({
  market: "Lasalgaon",
  district: "Nashik",
  state: "Maharashtra",
  variety: "Red",
  grade: "FAQ",
  latest: {
    date: "2026-10-08",
    modal_price: 2600,
    min_price: 2400,
    max_price: 2800,
    age_days: 1,
  },
  change_7d: {
    from_date: "2026-10-01",
    from_price: 2400,
    percent: 8.3,
    direction: "up",
  },
  series: [
    { date: "2026-10-01", modal_price: 2400 },
    { date: "2026-10-08", modal_price: 2600 },
  ],
  ...overrides,
});
const body = (overrides = {}) => ({
  status: "available",
  scope: "district",
  district: "Nashik",
  markets: [market()],
  sources: [{ name: "AGMARKNET", url: "https://api.data.gov.in" }],
  limitations: ["Reported wholesale mandi prices"],
  ...overrides,
});
beforeEach(() => farmApi.mockReset());

test("translated choices query canonical names and clear a district when its state changes", async () => {
  farmApi.mockResolvedValue(body());
  render(
    <MarketView
      workspace={{
        cycles: [{ crop_id: "onion", status: "active" }],
        farmer: { state_code: 8, district_code: 102 },
      }}
    />,
  );
  await waitFor(() => expect(farmApi).toHaveBeenCalledTimes(1));
  expect(farmApi.mock.calls[0][0]).toBe(
    "/market/prices?crop=onion&state=Rajasthan&district=Jaipur",
  );
  fireEvent.change(screen.getByLabelText("State or union territory"), {
    target: { value: "27" },
  });
  expect(screen.getByLabelText("District")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("District"), {
    target: { value: "487" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Show prices/ }));
  await waitFor(() =>
    expect(farmApi.mock.calls.at(-1)[0]).toBe(
      "/market/prices?crop=onion&state=Maharashtra&district=Nashik",
    ),
  );
  await screen.findByText(/in a week/);
});

test("a real week-on-week trend, per-kg price and source details are shown", () => {
  render(<MarketPrices result={body()} crop="onion" />);
  expect(screen.getByText(/Lasalgaon, Nashik/)).toBeInTheDocument();
  expect(screen.getByText("+8.3% in a week")).toBeInTheDocument();
  expect(screen.getByText(/per kg/)).toBeInTheDocument();
  expect(screen.getByText("AGMARKNET")).toBeInTheDocument();
});

test("missing history is stated, never invented", () => {
  render(
    <MarketPrices
      result={body({ markets: [market({ change_7d: null })] })}
      crop="onion"
    />,
  );
  expect(
    screen.getByText("Not enough past prices for a trend"),
  ).toBeInTheDocument();
});

test("stale and unconfigured states are explicit", () => {
  const { rerender } = render(
    <MarketPrices result={body({ status: "stale" })} crop="onion" />,
  );
  expect(screen.getByText(/Showing the last saved prices/)).toBeInTheDocument();
  rerender(
    <MarketPrices
      result={body({ status: "not_configured", markets: [] })}
      crop="onion"
    />,
  );
  expect(screen.getByText(/not connected/)).toBeInTheDocument();
});

test("MSP comparison uses the published support price for the crop", () => {
  const msp = supportPriceFor("wheat");
  expect(msp.unit).toBe("quintal");
  render(
    <MarketPrices
      result={body({
        markets: [
          market({
            latest: { ...market().latest, modal_price: msp.msp * 0.9 },
          }),
        ],
      })}
      crop="wheat"
    />,
  );
  expect(
    screen.getByText(/10% below the government support price/),
  ).toBeInTheDocument();
});

const national = (overrides = {}) => ({
  per_quintal: 2818.46,
  date: "2026-11-19",
  age_days: 2,
  commodity: "Wheat",
  describes: null,
  change: {
    from_date: "2026-11-18",
    from_price: 2799.92,
    percent: 0.7,
    direction: "steady",
  },
  series: [],
  source: { name: "Agmarknet 2.0", url: "https://agmarknet.gov.in/" },
  ...overrides,
});

test("with no local price the all-India average is shown and labelled as national", () => {
  render(
    <MarketPrices
      result={body({
        status: "unavailable",
        markets: [],
        national: national(),
        lead: "national",
      })}
      crop="wheat"
    />,
  );
  const card = screen.getByRole("article", { name: "All-India average price" });
  expect(card).toHaveTextContent("All-India average");
  expect(card).toHaveTextContent("₹2,818");
  expect(card).toHaveTextContent("Reported 2026-11-19");
  expect(card).toHaveTextContent("Steady since the day before");
  expect(card).toHaveTextContent(/not your local mandi/);
  expect(card).toHaveTextContent(/government support price \(MSP\)/);
  expect(
    screen.getByText(/No mandi in your area has a saved price/),
  ).toBeInTheDocument();
});

test("an older local price follows the all-India average instead of leading", () => {
  const older = market({
    latest: { ...market().latest, date: "2026-11-10", age_days: 11 },
  });
  const result = body({
    status: "stale",
    markets: [older],
    national: national({ describes: "Paddy (common)" }),
    lead: "national",
  });
  const { rerender } = render(<MarketPrices result={result} crop="rice" />);
  const cards = screen.getAllByRole("article");
  expect(cards[0]).toHaveTextContent("All-India average · Paddy (common)");
  expect(cards[1]).toHaveTextContent("Lasalgaon, Nashik");
  expect(
    screen.getByRole("heading", {
      name: "Last price from your area, 2026-11-10",
    }),
  ).toBeInTheDocument();
  // The Home card has room for one figure: the one that leads.
  rerender(<MarketPrices result={result} crop="rice" compact />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByText(/Lasalgaon/)).toBeNull();
});

test("a fresh local price leads and the all-India average sits below it for comparison", () => {
  const result = body({ national: national(), lead: "local" });
  const { rerender } = render(<MarketPrices result={result} crop="wheat" />);
  const cards = screen.getAllByRole("article");
  expect(cards[0]).toHaveTextContent("Lasalgaon, Nashik");
  expect(cards[1]).toHaveTextContent("All-India average");
  rerender(<MarketPrices result={result} crop="wheat" compact />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText(/Lasalgaon, Nashik/)).toBeInTheDocument();
});
test("the farmer's crop and place are filled in when they arrive after the screen opens", async () => {
  farmApi.mockResolvedValue(body());
  const { rerender } = render(<MarketView workspace={{ cycles: [] }} />);
  expect(farmApi).not.toHaveBeenCalled();
  rerender(
    <MarketView
      workspace={{
        cycles: [{ crop_id: "onion", status: "active" }],
        farmer: { state_code: 8, district_code: 102 },
      }}
    />,
  );
  await waitFor(() =>
    expect(farmApi.mock.calls[0]?.[0]).toBe(
      "/market/prices?crop=onion&state=Rajasthan&district=Jaipur",
    ),
  );
  await screen.findByText(/Lasalgaon, Nashik/);
});
