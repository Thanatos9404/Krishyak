import { renderHook, act } from "@testing-library/react";
import { useOfflineConnection } from "./useOfflineConnection";
import { saveRecord, clearOwner, pendingOperations } from "../farms/offline";
jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("./useAccountSession", () => ({ revokeDeviceSession: jest.fn() }));
jest.mock("../farms/offline", () => ({
  saveRecord: jest.fn(),
  clearOwner: jest.fn(),
  pendingOperations: jest.fn(),
  synchronize: jest.fn(),
}));
let options, operation;
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  pendingOperations.mockResolvedValue([]);
  clearOwner.mockResolvedValue();
  options = {
    account: {
      farmer: { id: "owner-a", display_name: "Example" },
      ownerRef: { current: "owner-a" },
      setFarmer: jest.fn(),
      loadConsents: jest.fn(),
      offlineOpt: false,
      setOfflineOpt: jest.fn(),
    },
    fields: {
      farms: [],
      plots: [],
      selected: "",
      today: null,
      loadFields: jest.fn(),
      refreshEvidence: jest.fn(),
    },
    offline: false,
    setOffline: jest.fn(),
    pending: 0,
    setPending: jest.fn(),
    setError: jest.fn(),
    setNotice: jest.fn(),
    act: (callback) => {
      operation = callback();
      operation.catch(() => {});
    },
  };
});
test("offline opt-in responds immediately but confirms only after storage commits", async () => {
  let finish;
  saveRecord.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useOfflineConnection(options));
  act(() => result.current.enableOffline(true));
  expect(options.account.setOfflineOpt).toHaveBeenCalledWith(true);
  expect(options.setNotice).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await operation;
  });
  expect(options.setNotice).toHaveBeenCalledWith(
    "Offline records saved on this device.",
  );
  expect(
    JSON.parse(sessionStorage.getItem("krishyak_v2_offline_owner")).owner,
  ).toBe("owner-a");
});
test("an account change during storage cannot recreate the old device marker", async () => {
  let finish;
  saveRecord.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useOfflineConnection(options));
  act(() => result.current.enableOffline(true));
  options.account.ownerRef.current = "owner-b";
  await act(async () => {
    finish();
    await operation;
  });
  expect(clearOwner).toHaveBeenCalledWith("owner-a", true);
  expect(sessionStorage.getItem("krishyak_v2_offline_owner")).toBeNull();
  expect(options.setNotice).not.toHaveBeenCalled();
});
test("storage failure restores the unchecked state and propagates the error", async () => {
  saveRecord.mockRejectedValue(new Error("Storage unavailable"));
  const { result } = renderHook(() => useOfflineConnection(options));
  await act(async () => {
    result.current.enableOffline(true);
    await expect(operation).rejects.toThrow("Storage unavailable");
  });
  expect(options.account.setOfflineOpt.mock.calls).toEqual([[true], [false]]);
  expect(sessionStorage.getItem("krishyak_v2_offline_owner")).toBeNull();
});
test("declining pending-record removal leaves opt-in and the outbox intact", () => {
  options.pending = 1;
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { result } = renderHook(() => useOfflineConnection(options));
  act(() => result.current.enableOffline(false));
  expect(options.account.setOfflineOpt).not.toHaveBeenCalled();
  expect(clearOwner).not.toHaveBeenCalled();
  confirm.mockRestore();
});
