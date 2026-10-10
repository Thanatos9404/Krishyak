import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeatherStrip, weatherConclusions } from "./WeatherStrip";
import { farmApi } from "../../features/farms/api";
import { readRecord, saveRecord } from "../../features/farms/offline";
jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/farms/offline", () => ({
  readRecord: jest.fn(),
  saveRecord: jest.fn(),
}));
const hourly = (temperature, rain = 0.05, wind = 8) =>
  Array.from({ length: 48 }, (_, hour) => ({
    timestamp: new Date(Date.UTC(2026, 9, 3, hour)).toISOString(),
    temperature,
    humidity: 50,
    wind_speed: wind,
    precipitation: rain,
  }));
const observation = (
  temperature,
  { created = new Date().toISOString(), rain = 1.2 } = {},
) => ({
  source: "Synthetic weather source",
  created_at: created,
  payload: {
    current: { temperature, humidity: 50, wind_speed: 8 },
    hourly: hourly(temperature),
    precipitation_next_24h_mm: rain,
  },
});
const located = {
  id: "field-a",
  approximate_location: { latitude: 26.9, longitude: 75.8 },
};
beforeEach(() => jest.clearAllMocks());

test("late weather from a previously selected field cannot replace current evidence", async () => {
  let resolvePrevious;
  farmApi.mockImplementation((path) =>
    path.includes("old-field")
      ? new Promise((resolve) => {
          resolvePrevious = resolve;
        })
      : Promise.resolve({ observation: observation(28) }),
  );
  const view = render(
    <WeatherStrip plotId="old-field" owner="owner-a" cache={false} />,
  );
  view.rerender(
    <WeatherStrip plotId="current-field" owner="owner-a" cache={false} />,
  );
  expect((await screen.findAllByText("28 °C")).length).toBeGreaterThan(0);
  await act(async () => resolvePrevious({ observation: observation(50) }));
  expect(screen.queryByText("50 °C")).not.toBeInTheDocument();
  expect(saveRecord).not.toHaveBeenCalled();
});

test("network fallback reads only opted-in owner records and labels their age", async () => {
  farmApi.mockRejectedValue({ network: true });
  readRecord.mockResolvedValue({
    data: { observation: observation(26) },
    saved_at: "2026-10-02T12:00:00Z",
  });
  render(<WeatherStrip plotId="field-a" owner="owner-a" cache />);
  expect((await screen.findAllByText("26 °C")).length).toBeGreaterThan(0);
  expect(readRecord).toHaveBeenCalledWith("owner-a", "weather:field-a");
  expect(screen.getByText(/Saved on this device/)).toBeInTheDocument();
});

test("an authorization failure cannot expose cached weather as a successful result", async () => {
  farmApi.mockRejectedValue({
    network: false,
    status: 403,
    message: "Consent required",
  });
  render(<WeatherStrip plotId="field-a" owner="owner-a" cache />);
  await screen.findByText("Consent required");
  expect(readRecord).not.toHaveBeenCalled();
  expect(screen.queryByText(/°C/)).not.toBeInTheDocument();
});

test("stale weather refreshes automatically for a located, permitted field", async () => {
  farmApi.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.resolve(observation(31))
      : Promise.resolve({
          observation: observation(20, { created: "2026-01-01T00:00:00Z" }),
        }),
  );
  render(
    <WeatherStrip
      plotId="field-a"
      plot={located}
      owner="owner-a"
      workspace={{ consents: ["location_processing", "agronomic_analysis"] }}
    />,
  );
  expect((await screen.findAllByText("31 °C")).length).toBeGreaterThan(0);
  expect(farmApi).toHaveBeenCalledWith(
    "/plots/field-a/weather/refresh",
    expect.objectContaining({ method: "POST" }),
  );
});

test("without permission the farmer is asked in context and nothing is fetched", async () => {
  farmApi.mockResolvedValue({ observation: null });
  render(
    <WeatherStrip
      plotId="field-a"
      plot={located}
      owner="owner-a"
      workspace={{ consents: [], act: jest.fn(), loadConsents: jest.fn() }}
    />,
  );
  await screen.findByText("Show local weather for this field");
  expect(farmApi).toHaveBeenCalledTimes(1);
});

test("an unlocated field explains how to get local weather", async () => {
  farmApi.mockResolvedValue({ observation: null });
  render(
    <WeatherStrip
      plotId="field-a"
      plot={{ id: "field-a" }}
      owner="owner-a"
      workspace={{ consents: [] }}
    />,
  );
  await screen.findByText("Add your field's location to see local weather.");
});

test("conclusions describe rain, heat and wind without prescribing products", () => {
  const heavy = weatherConclusions({
    ...observation(39).payload,
    precipitation_next_24h_mm: 14,
  });
  expect(heavy.items.map((x) => x.kind)).toEqual(["rain", "heat"]);
  const dry = weatherConclusions({
    current: { temperature: 30, wind_speed: 25 },
    hourly: hourly(30, 0, 25),
    precipitation_next_24h_mm: 0,
  });
  expect(dry.items.map((x) => x.kind)).toEqual(["dry", "wind"]);
  const text = JSON.stringify([heavy, dry]);
  expect(text).not.toMatch(/\d+\s*(ml|g|kg)\s*(per|\/)/i);
});
