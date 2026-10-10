import { renderHook, act, waitFor } from "@testing-library/react";
import { useFieldRecords } from "./useFieldRecords";
import { farmApi } from "../farms/api";
import { readRecord, saveRecord } from "../farms/offline";
jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../farms/offline", () => ({
  readRecord: jest.fn(),
  saveRecord: jest.fn(),
}));
const ownerRef = { current: "owner-a" },
  setError = jest.fn(),
  setOffline = jest.fn();
const plots = [
  { id: "field-a", name: "A" },
  { id: "field-b", name: "B" },
];
const response = (path) =>
  path.startsWith("/farms")
    ? { items: [{ id: "farm-a" }] }
    : path.startsWith("/plots?")
      ? { items: plots }
      : path.endsWith("/today")
        ? { actions: [{ title: path }] }
        : { items: [] };
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  ownerRef.current = "owner-a";
  farmApi.mockImplementation(async (path) => response(path));
});
test("a late previous field cannot replace current field evidence", async () => {
  const pending = [];
  farmApi.mockImplementation((path) =>
    path.startsWith("/plots/field-")
      ? new Promise((resolve) => pending.push({ path, resolve }))
      : Promise.resolve(response(path)),
  );
  const { result } = renderHook(() =>
    useFieldRecords({
      farmer: { id: "owner-a" },
      ownerRef,
      offlineOpt: false,
      setError,
      setOffline,
    }),
  );
  await waitFor(() => expect(pending).toHaveLength(3));
  act(() => result.current.setSelected("field-b"));
  await waitFor(() => expect(pending).toHaveLength(6));
  await act(async () =>
    pending
      .filter((item) => item.path.includes("field-b"))
      .forEach((item) => item.resolve(response(item.path))),
  );
  expect(result.current.today.actions[0].title).toContain("field-b");
  await act(async () =>
    pending
      .filter((item) => item.path.includes("field-a"))
      .forEach((item) => item.resolve(response(item.path))),
  );
  expect(result.current.today.actions[0].title).toContain("field-b");
});
test("sign-out invalidates a pending private evidence response", async () => {
  let done;
  farmApi.mockImplementation((path) =>
    path.endsWith("/today")
      ? new Promise((resolve) => {
          done = resolve;
        })
      : Promise.resolve(response(path)),
  );
  const { result, rerender } = renderHook(
    ({ farmer }) =>
      useFieldRecords({
        farmer,
        ownerRef,
        offlineOpt: false,
        setError,
        setOffline,
      }),
    { initialProps: { farmer: { id: "owner-a" } } },
  );
  await waitFor(() => expect(done).toBeDefined());
  ownerRef.current = null;
  rerender({ farmer: null });
  await act(async () => done({ actions: [{ title: "PRIVATE OLD RESULT" }] }));
  expect(result.current.today).toBeNull();
  expect(result.current.plots).toEqual([]);
  expect(saveRecord).not.toHaveBeenCalled();
});
test("field choice is owner-scoped and is restored across product routes", async () => {
  sessionStorage.setItem(
    "krishyak_v2_field_choice",
    JSON.stringify({ owner: "owner-a", field: "field-b" }),
  );
  const { result } = renderHook(() =>
    useFieldRecords({
      farmer: { id: "owner-a" },
      ownerRef,
      offlineOpt: false,
      setError,
      setOffline,
    }),
  );
  await waitFor(() => expect(result.current.selected).toBe("field-b"));
});
test("another account's remembered field is ignored", async () => {
  sessionStorage.setItem(
    "krishyak_v2_field_choice",
    JSON.stringify({ owner: "owner-b", field: "field-b" }),
  );
  const { result } = renderHook(() =>
    useFieldRecords({
      farmer: { id: "owner-a" },
      ownerRef,
      offlineOpt: false,
      setError,
      setOffline,
    }),
  );
  await waitFor(() => expect(result.current.selected).toBe("field-a"));
});
test("offline snapshots load only after opt-in and a connection failure", async () => {
  farmApi.mockRejectedValue(
    Object.assign(new Error("offline"), { network: true }),
  );
  readRecord.mockImplementation(async (_owner, key) =>
    key === "fields"
      ? { data: { farms: [], plots, selected: "field-b" } }
      : {
          saved_at: "2026-10-03T00:00:00Z",
          data: {
            attention: { actions: [] },
            events: { items: [] },
            cropCycles: { items: [] },
          },
        },
  );
  const { result } = renderHook(() =>
    useFieldRecords({
      farmer: { id: "owner-a" },
      ownerRef,
      offlineOpt: true,
      setError,
      setOffline,
    }),
  );
  await waitFor(() =>
    expect(result.current.savedAt).toBe("2026-10-03T00:00:00Z"),
  );
  expect(setOffline).toHaveBeenCalledWith(true);
});
test("server rejection never falls back to a saved private snapshot", async () => {
  farmApi.mockRejectedValue(
    Object.assign(new Error("account revoked"), { status: 403 }),
  );
  renderHook(() =>
    useFieldRecords({
      farmer: { id: "owner-a" },
      ownerRef,
      offlineOpt: true,
      setError,
      setOffline,
    }),
  );
  await waitFor(() => expect(setError).toHaveBeenCalledWith("account revoked"));
  expect(readRecord).not.toHaveBeenCalled();
});
