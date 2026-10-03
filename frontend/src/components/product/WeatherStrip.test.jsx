import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeatherStrip } from "./WeatherStrip";
import { farmApi } from "../../features/farms/api";
import { readRecord, saveRecord } from "../../features/farms/offline";
jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/farms/offline", () => ({
  readRecord: jest.fn(),
  saveRecord: jest.fn(),
}));
const observation = (temperature) => ({
  source: "Synthetic weather source",
  created_at: "2026-10-03T12:00:00Z",
  payload: { current: { temperature }, precipitation_next_24h_mm: 1.2 },
});
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
  await screen.findByText("28 °C");
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
  await screen.findByText("26 °C");
  expect(readRecord).toHaveBeenCalledWith("owner-a", "weather:field-a");
  expect(screen.getByText(/Saved on this device/)).toBeInTheDocument();
});
test("an authorization failure cannot expose cached weather as a successful result", async () => {
  farmApi.mockRejectedValue({ network: false, status: 403 });
  render(<WeatherStrip plotId="field-a" owner="owner-a" cache />);
  await waitFor(() => expect(farmApi).toHaveBeenCalled());
  expect(readRecord).not.toHaveBeenCalled();
  expect(
    screen.getByText("No weather observation stored."),
  ).toBeInTheDocument();
});
