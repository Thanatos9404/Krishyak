import { act, renderHook, waitFor } from "@testing-library/react";
import { useSimulation } from "./useSimulation";
import { farmApi } from "../farms/api";
import farmingApi from "../../api/farmingApi";

jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../api/farmingApi", () => ({
  __esModule: true,
  default: {
    simulate: jest.fn(),
    compareScenarios: jest.fn(),
    getRecommendations: jest.fn(),
  },
}));
const selection = {
  context: { crop_id: "rice", state_code: 8 },
  crop_name: "Rice",
  price: null,
  market_quote_index: null,
};
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test("reviewed context uses one private request and never saves private evidence in browser storage", async () => {
  farmApi.mockResolvedValue({
    success: true,
    data: { simulation: { profit: 24 }, comparison: {}, recommendations: {} },
  });
  const { result } = renderHook(() =>
    useSimulation({ contextSelection: selection }),
  );
  await act(async () => {
    await result.current.run();
  });
  expect(farmApi).toHaveBeenCalledWith(
    "/farm-context/planning",
    expect.objectContaining({
      retry: false,
      body: expect.objectContaining({ context: selection.context }),
    }),
  );
  expect(result.current.data.simulation.profit).toBe(24);
  expect(farmingApi.simulate).not.toHaveBeenCalled();
  expect(localStorage.getItem("krishyak_sim_cache")).toBeNull();
});

test("withdrawing reviewed context aborts and clears loading, then ignores a late response", async () => {
  let resolve;
  farmApi.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result, rerender } = renderHook(
    ({ contextSelection }) => useSimulation({ contextSelection }),
    { initialProps: { contextSelection: selection } },
  );
  let request;
  act(() => {
    request = result.current.run();
  });
  expect(result.current.loading).toBe(true);
  const signal = farmApi.mock.calls[0][1].signal;
  rerender({ contextSelection: null });
  expect(signal.aborted).toBe(true);
  expect(result.current.loading).toBe(false);
  await act(async () => {
    resolve({ success: true, data: { simulation: { profit: 99 } } });
    await request;
  });
  expect(result.current.data).toBeNull();
});

test("changed crop requires fresh review before provider contact", async () => {
  const { result } = renderHook(() =>
    useSimulation({ contextSelection: selection }),
  );
  act(() => {
    result.current.setFormData({ ...result.current.formData, crop: "Wheat" });
  });
  await act(async () => {
    await result.current.run();
  });
  await waitFor(() => expect(result.current.error).toContain("Review"));
  expect(farmApi).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
});
