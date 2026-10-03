import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { PlanningView } from "./PlanningView";
import farmingApi from "../../api/farmingApi";

jest.mock("../../i18n", () => ({
  useTranslation: () => ({ t: (key) => key, language: "en" }),
}));
jest.mock("../../api/farmingApi", () => ({
  __esModule: true,
  default: {
    getCrops: jest.fn(),
    getSoilTypes: jest.fn(),
    simulate: jest.fn(),
    compareScenarios: jest.fn(),
    getRecommendations: jest.fn(),
  },
}));
jest.mock(
  "../VoiceInputModal",
  () =>
    ({ isOpen, onClose, onApply }) =>
      isOpen ? (
        <div role="dialog" aria-label="Voice input">
          <button onClick={onClose}>Close voice</button>
          <button
            onClick={() => {
              onApply({ crop: "Wheat" });
              onClose();
            }}
          >
            Apply spoken crop
          </button>
        </div>
      ) : null,
);
jest.mock("../Dashboard", () => ({ simulationData }) => (
  <div data-testid="result">{simulationData?.profit ?? "empty"}</div>
));
jest.mock(
  "../Sidebar",
  () =>
    ({ formData, setFormData, onSimulate, loading, onOpenVoice }) => {
      const [note, setNote] = require("react").useState("");
      return (
        <>
          <input
            aria-label="Sidebar local state"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button onClick={onSimulate} disabled={loading}>
            Run test
          </button>
          <button onClick={() => setFormData({ ...formData, crop: "Wheat" })}>
            Change crop
          </button>
          <button onClick={onOpenVoice}>Voice input</button>
        </>
      );
    },
);
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  farmingApi.getCrops.mockResolvedValue({ crops: ["Rice", "Wheat"] });
  farmingApi.getSoilTypes.mockResolvedValue({ soil_types: ["Alluvial"] });
  farmingApi.compareScenarios.mockResolvedValue({ success: true, data: {} });
  farmingApi.getRecommendations.mockResolvedValue({ success: true, data: {} });
});
test("planning opens directly without a separate guest or registration workflow", async () => {
  render(<PlanningView />);
  await screen.findByRole("button", { name: "Run test" });
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "season",
  );
  expect(screen.queryByText("landing.explore")).toBeNull();
});
test("planning navigation keeps the user within the current product route", async () => {
  window.history.replaceState({}, "", "/app/more/planning");
  render(<PlanningView />);
  fireEvent.click(await screen.findByRole("button", { name: "Change crop" }));
  expect(window.location.pathname).toBe("/app/more/planning");
});
test("parent updates preserve mounted sidebar local state", async () => {
  render(<PlanningView />);
  fireEvent.change(await screen.findByLabelText("Sidebar local state"), {
    target: { value: "keep input state" },
  });
  fireEvent.click(screen.getByText("Change crop"));
  expect(screen.getByLabelText("Sidebar local state").value).toBe(
    "keep input state",
  );
});
test("unavailable catalogs do not show a global yellow retry notice", async () => {
  farmingApi.getCrops.mockRejectedValue(new Error("offline"));
  farmingApi.getSoilTypes.mockRejectedValue(new Error("offline"));
  render(<PlanningView />);
  await act(async () => {});
  expect(screen.queryByText("common.retry")).toBeNull();
  expect(document.querySelector(".bg-amber-50")).toBeNull();
});
test("voice input applies reviewed values and closes", async () => {
  farmingApi.simulate.mockResolvedValue({
    success: true,
    data: { profit: 123 },
  });
  render(<PlanningView />);
  fireEvent.click(await screen.findByRole("button", { name: "Voice input" }));
  await screen.findByRole("dialog", { name: "Voice input" });
  fireEvent.click(screen.getByText("Apply spoken crop"));
  expect(screen.queryByRole("dialog", { name: "Voice input" })).toBeNull();
  fireEvent.click(screen.getByText("Run test"));
  await waitFor(() =>
    expect(farmingApi.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ crop: "Wheat" }),
      500,
    ),
  );
});
test("a response for old inputs cannot populate results or storage", async () => {
  let resolve;
  farmingApi.simulate.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<PlanningView />);
  fireEvent.click(await screen.findByText("Run test"));
  fireEvent.click(screen.getByText("Change crop"));
  await act(async () => resolve({ success: true, data: { profit: 123 } }));
  expect(screen.getByTestId("result").textContent).toBe("empty");
  expect(localStorage.getItem("krishyak_sim_cache")).toBeNull();
  expect(screen.getByText("Run test").disabled).toBe(false);
});
test("changing inputs clears displayed results", async () => {
  farmingApi.simulate.mockResolvedValue({
    success: true,
    data: { profit: 123 },
  });
  render(<PlanningView />);
  fireEvent.click(await screen.findByText("Run test"));
  await waitFor(() =>
    expect(screen.getByTestId("result").textContent).toBe("123"),
  );
  fireEvent.click(screen.getByText("Change crop"));
  expect(screen.getByTestId("result").textContent).toBe("empty");
});
test("leaving planning invalidates a pending response", async () => {
  let resolve;
  farmingApi.simulate.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { unmount } = render(<PlanningView />);
  fireEvent.click(await screen.findByText("Run test"));
  unmount();
  await act(async () => resolve({ success: true, data: { profit: 123 } }));
  expect(localStorage.getItem("krishyak_sim_cache")).toBeNull();
});
test("catalog recovers on reconnect without a global retry notice", async () => {
  farmingApi.getCrops
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ crops: ["Rice"] });
  render(<PlanningView />);
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "common.retry" })).toBeNull();
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(farmingApi.getCrops).toHaveBeenCalledTimes(2);
});
