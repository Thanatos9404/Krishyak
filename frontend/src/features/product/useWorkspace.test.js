import { act, renderHook } from "@testing-library/react";
import { useWorkspace } from "./useWorkspace";
import { farmApi } from "../farms/api";
import { queueOperation, pendingOperations } from "../farms/offline";
jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../farms/offline", () => ({
  clearOwner: jest.fn(),
  queueOperation: jest.fn(),
  pendingOperations: jest.fn(),
}));
jest.mock("./useAccountSession", () => ({
  useAccountSession: () => ({
    farmer: { id: "a" },
    ownerRef: { current: "a" },
    offlineOpt: true,
  }),
  revokeDeviceSession: jest.fn(),
}));
jest.mock("./useFieldRecords", () => ({
  useFieldRecords: () => ({
    selectedRef: { current: "plot" },
    refreshEvidence: jest.fn(),
  }),
}));
jest.mock("./useOfflineConnection", () => ({
  useOfflineConnection: () => ({}),
}));

test("known service outage queues immediately even when the browser reports connectivity", async () => {
  pendingOperations.mockResolvedValue([{}]);
  farmApi.mockRejectedValue(
    Object.assign(new Error("Origin down"), { network: true }),
  );
  const { result } = renderHook(useWorkspace);
  await act(async () =>
    result.current.recordObservation({
      kind: "field_observation",
      note: "Synthetic first outage",
      value: "",
    }),
  );
  expect(result.current.offline).toBe(true);
  farmApi.mockClear();
  await act(async () =>
    result.current.recordObservation({
      kind: "field_observation",
      note: "Synthetic offline note",
      value: "",
    }),
  );
  expect(farmApi).not.toHaveBeenCalled();
  expect(queueOperation).toHaveBeenLastCalledWith(
    "a",
    expect.objectContaining({
      body: expect.objectContaining({ note: "Synthetic offline note" }),
    }),
  );
  expect(result.current.notice).toContain("sync when the connection returns");
});
