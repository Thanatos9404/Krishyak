import { renderHook, waitFor } from "@testing-library/react";
import { useAccountSession } from "./useAccountSession";
import { farmApi, restoreFarmSession } from "../farms/api";
import { readRecord } from "../farms/offline";

jest.mock("../farms/api", () => ({
  farmApi: jest.fn(),
  restoreFarmSession: jest.fn(),
  setCsrfToken: jest.fn(),
}));
jest.mock("../farms/offline", () => ({
  activateOwner: jest.fn(),
  clearOwner: jest.fn(),
  readRecord: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

test("a missing account-service route gives anonymous unavailable entry without a technical error", async () => {
  farmApi.mockRejectedValue(
    Object.assign(new Error("Not Found"), { status: 404 }),
  );
  const setError = jest.fn(),
    setNotice = jest.fn();
  const { result } = renderHook(() =>
    useAccountSession({ setError, setNotice }),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.status).toEqual({ enabled: false });
  expect(result.current.farmer).toBeNull();
  expect(restoreFarmSession).not.toHaveBeenCalled();
  expect(setError).not.toHaveBeenCalled();
});

test("a fresh anonymous visitor skips restoration only when the server explicitly reports no session cookie", async () => {
  farmApi.mockResolvedValue({ enabled: true, session_cookie_present: false });
  const callbacks = { setError: jest.fn(), setNotice: jest.fn() };
  const { result } = renderHook(() => useAccountSession(callbacks));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.farmer).toBeNull();
  expect(restoreFarmSession).not.toHaveBeenCalled();
});

test.each([true, undefined])(
  "cookie hints never authenticate a visitor (%s)",
  async (hint) => {
    farmApi.mockResolvedValue({ enabled: true, session_cookie_present: hint });
    restoreFarmSession.mockRejectedValue(
      Object.assign(new Error("Sign in required"), { status: 401 }),
    );
    const callbacks = { setError: jest.fn(), setNotice: jest.fn() };
    const { result } = renderHook(() => useAccountSession(callbacks));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(restoreFarmSession).toHaveBeenCalledTimes(1);
    expect(result.current.farmer).toBeNull();
  },
);

test("authorization failure remains an error and cannot restore private cached data", async () => {
  sessionStorage.setItem(
    "krishyak_v2_offline_owner",
    JSON.stringify({ owner: "synthetic-old-owner", display_name: "Synthetic" }),
  );
  farmApi.mockRejectedValue(
    Object.assign(new Error("Access denied"), { status: 403 }),
  );
  const setError = jest.fn(),
    setNotice = jest.fn();
  const { result } = renderHook(() =>
    useAccountSession({ setError, setNotice }),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.farmer).toBeNull();
  expect(setError).toHaveBeenCalledWith("Access denied");
  expect(readRecord).not.toHaveBeenCalled();
});
