import { act, renderHook } from "@testing-library/react";
import { useConsentChanges } from "./useConsentChanges";
import { farmApi } from "../farms/api";
jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));
const workspace = () => ({
  farmer: { id: "owner-a" },
  ownerRef: { current: "owner-a" },
  offline: false,
  consents: [],
  loadConsents: jest.fn().mockResolvedValue(),
  setNotice: jest.fn(),
});
beforeEach(() => jest.resetAllMocks());

test.each([true, false])(
  "grant=%s reconciles only after server confirmation",
  async (granted) => {
    const w = workspace();
    farmApi.mockResolvedValue({});
    const { result } = renderHook(() => useConsentChanges(w));
    await act(async () =>
      result.current.change("location_processing", granted),
    );
    expect(farmApi).toHaveBeenCalledWith(
      "/consents",
      expect.objectContaining({
        body: expect.objectContaining({
          purpose: "location_processing",
          granted,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(w.loadConsents).toHaveBeenCalledTimes(1);
    expect(w.setNotice).toHaveBeenCalledTimes(1);
    expect(result.current.states).toEqual({});
  },
);

test.each([401, 403, 409, 429, 500, "network", "timeout"])(
  "failure %s retains requested retry without changing actual permissions",
  async (status) => {
    const w = workspace();
    farmApi.mockRejectedValue(
      Object.assign(
        new Error("private provider body"),
        typeof status === "number" ? { status } : { network: true },
      ),
    );
    const { result } = renderHook(() => useConsentChanges(w));
    await act(async () => result.current.change("agronomic_analysis", true));
    expect(result.current.states.agronomic_analysis).toMatchObject({
      granted: true,
      saving: false,
      error: expect.any(String),
    });
    expect(result.current.states.agronomic_analysis.error).not.toContain(
      "private provider body",
    );
    expect(w.consents).toEqual([]);
    expect(w.loadConsents).not.toHaveBeenCalled();
    expect(w.setNotice).not.toHaveBeenCalled();
    farmApi.mockResolvedValue({});
    await act(async () => result.current.change("agronomic_analysis", true));
    expect(result.current.states).toEqual({});
  },
);

test("rapid/double activation is suppressed per purpose while another purpose can save", async () => {
  const w = workspace();
  const finishes = [];
  farmApi.mockImplementation(
    () => new Promise((resolve) => finishes.push(resolve)),
  );
  const { result } = renderHook(() => useConsentChanges(w));
  let first, other;
  act(() => {
    first = result.current.change("agronomic_analysis", true);
  });
  expect(result.current.states.agronomic_analysis.saving).toBe(true);
  await act(async () => {
    await result.current.change("agronomic_analysis", false);
    await result.current.change("agronomic_analysis", true);
  });
  act(() => {
    other = result.current.change("location_processing", true);
  });
  expect(farmApi).toHaveBeenCalledTimes(2);
  await act(async () => {
    finishes.forEach((finish) => finish({}));
    await Promise.all([first, other]);
  });
  expect(w.consents).toEqual([]);
});

test("account change aborts old request and cannot reconcile or announce it to new account", async () => {
  let finish;
  farmApi.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const w = workspace();
  const { result, rerender } = renderHook(
    ({ current }) => useConsentChanges(current),
    { initialProps: { current: w } },
  );
  let pending;
  act(() => {
    pending = result.current.change("agronomic_analysis", true);
  });
  const signal = farmApi.mock.calls[0][1].signal;
  const next = {
    ...workspace(),
    farmer: { id: "owner-b" },
    ownerRef: { current: "owner-b" },
  };
  rerender({ current: next });
  expect(signal.aborted).toBe(true);
  expect(result.current.states).toEqual({});
  await act(async () => {
    finish({});
    await pending;
  });
  expect(w.loadConsents).not.toHaveBeenCalled();
  expect(next.loadConsents).not.toHaveBeenCalled();
  expect(next.setNotice).not.toHaveBeenCalled();
});

test("offline consent writes are refused and are never queued", async () => {
  const w = { ...workspace(), offline: true };
  const { result } = renderHook(() => useConsentChanges(w));
  await act(async () => result.current.change("agronomic_analysis", true));
  expect(farmApi).not.toHaveBeenCalled();
  expect(result.current.states).toEqual({});
});
