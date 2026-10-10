import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { FarmContextCard } from "./FarmContextCard";
import { farmApi } from "../../features/farms/api";
jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("./IndiaLocationPicker", () => ({
  IndiaLocationPicker: ({ onChange }) => (
    <button
      type="button"
      onClick={() => onChange({ state_code: 8, district_code: 102 })}
    >
      Choose Rajasthan
    </button>
  ),
}));
jest.mock("./CropPicker", () => ({
  CropPicker: ({ onChange }) => (
    <button type="button" onClick={() => onChange({ id: "wheat" })}>
      Choose wheat
    </button>
  ),
}));
const source = {
  provider: "fixture",
  status: "unavailable",
  source_url: "https://example.test",
  retrieved_at: new Date().toISOString(),
};
const context = {
  generated_at: new Date().toISOString(),
  location: {
    source: { ...source, provider: "LGD" },
    data: {
      state_name: "Rajasthan",
      district_name: "Jaipur",
      state_lgd_code: 8,
      district_lgd_code: 102,
      resolution: "manual",
    },
  },
  weather: { source: { ...source, provider: "weather" }, data: null },
  soil: { source: { ...source, provider: "soil" }, data: null },
  geospatial: { source: { ...source, provider: "maps" }, data: null },
  market: { source: { ...source, provider: "market" }, data: [] },
};
const workspace = () => ({
  farmer: { id: "owner", state_code: 8, district_code: 102 },
  consents: [],
  loadConsents: jest.fn().mockResolvedValue(undefined),
  offline: false,
});
beforeEach(() => {
  jest.clearAllMocks();
  farmApi.mockResolvedValue(context);
});
test("lookup waits for explicit consent and renders partial data with a manual fallback", async () => {
  const w = workspace();
  render(<FarmContextCard workspace={w} />);
  expect(
    screen.getByRole("button", { name: "Load area context" }),
  ).toBeDisabled();
  expect(farmApi).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByLabelText(
      "Allow public agricultural context for my chosen area",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Load area context" }));
  await screen.findByText(/Jaipur/);
  expect(farmApi.mock.calls[0][0]).toBe("/consents");
  expect(w.loadConsents).toHaveBeenCalledTimes(1);
  expect(farmApi.mock.calls[1][1].body).not.toHaveProperty("latitude");
  expect(screen.queryByRole("status")).toBeNull();
});
test("GPS permission denial ends loading and permits a manual retry", async () => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_success, fail) => fail({ code: 1 }) },
  });
  const w = {
    ...workspace(),
    consents: ["government_integration", "location_processing"],
  };
  render(<FarmContextCard workspace={w} />);
  fireEvent.click(screen.getByRole("button", { name: "Use device location" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Choose your area manually",
  );
  expect(farmApi).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load area context" }));
  await screen.findByText(/Jaipur/);
});
test("withdrawal cancels a lookup and ignores a late response", async () => {
  let resolve;
  farmApi.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const w = { ...workspace(), consents: ["government_integration"] };
  const { rerender } = render(<FarmContextCard workspace={w} />);
  fireEvent.click(screen.getByRole("button", { name: "Load area context" }));
  await waitFor(() => expect(farmApi).toHaveBeenCalled());
  const signal = farmApi.mock.calls[0][1].signal;
  rerender(<FarmContextCard workspace={{ ...w, consents: [] }} />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(context));
  expect(screen.queryByText(/Jaipur/)).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});
test("reviewed context preserves manual price unless a fresh quote was selected", async () => {
  const onReviewed = jest.fn();
  const w = {
    ...workspace(),
    consents: ["government_integration", "agronomic_analysis"],
  };
  render(<FarmContextCard workspace={w} onReviewed={onReviewed} />);
  fireEvent.click(screen.getByText("Choose wheat"));
  fireEvent.click(screen.getByRole("button", { name: "Load area context" }));
  await screen.findByRole("button", {
    name: "Use reviewed context in scenario",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Use reviewed context in scenario" }),
  );
  expect(onReviewed).toHaveBeenCalledWith(
    expect.objectContaining({
      crop_name: "Wheat",
      price: null,
      market_quote_index: null,
      context: expect.objectContaining({ crop_id: "wheat" }),
    }),
  );
});
