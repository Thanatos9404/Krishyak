import { farmApi, setCsrfToken } from "./api";
beforeEach(() => window.dispatchEvent(new Event("pageshow")));
test("cancelled field reads are not classified as offline failures or retried", async () => {
  setCsrfToken(null);
  const original = global.fetch;
  global.fetch = jest.fn(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  try {
    const ownerRead = new AbortController();
    const request = farmApi("/plots/synthetic/today", {
      signal: ownerRead.signal,
    });
    ownerRead.abort();
    await expect(request).rejects.toMatchObject({ cancelled: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = original;
  }
});

test("all passive API reads cancel on navigation without needing a caller signal", async () => {
  const original = global.fetch;
  global.fetch = jest.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  try {
    const request = farmApi("/notifications");
    window.dispatchEvent(new Event("beforeunload"));
    await expect(request).rejects.toMatchObject({ cancelled: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = original;
  }
});

test("navigation does not interrupt an already submitted mutation", async () => {
  const original = global.fetch;
  let finish, requestSignal;
  global.fetch = jest.fn((_url, { signal }) => {
    requestSignal = signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  try {
    const request = farmApi("/observations", { method: "POST", body: {} });
    window.dispatchEvent(new Event("beforeunload"));
    expect(requestSignal.aborted).toBe(false);
    finish({ ok: true, status: 200, json: async () => ({ saved: true }) });
    await expect(request).resolves.toEqual({ saved: true });
  } finally {
    global.fetch = original;
  }
});

const hanging = () =>
  jest.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("a read whose reply goes missing is tried once more after a short wait", async () => {
  const original = global.fetch;
  jest.useFakeTimers();
  global.fetch = hanging();
  try {
    const request = farmApi("/notifications");
    const outcome = expect(request).rejects.toMatchObject({ network: true });
    await jest.advanceTimersByTimeAsync(8000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(20000);
    await outcome;
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    global.fetch = original;
    jest.useRealTimers();
  }
});

test("the second try of a dropped read succeeds without the farmer seeing an error", async () => {
  const original = global.fetch;
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(ok({ items: [1] }));
  try {
    await expect(farmApi("/plots")).resolves.toEqual({ items: [1] });
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    global.fetch = original;
  }
});

test("a read known to be slow keeps its full wait and is not repeated when it times out", async () => {
  const original = global.fetch;
  jest.useFakeTimers();
  global.fetch = hanging();
  try {
    const request = farmApi("/plots/x/assessment", { timeoutMs: 40000 });
    const outcome = expect(request).rejects.toMatchObject({
      network: true,
      timedOut: true,
    });
    await jest.advanceTimersByTimeAsync(8000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(32000);
    await outcome;
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = original;
    jest.useRealTimers();
  }
});

test("a dropped write is never sent twice, and nothing is retried while offline", async () => {
  const original = global.fetch;
  const online = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  try {
    await expect(
      farmApi("/observations", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ network: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    Object.defineProperty(Navigator.prototype, "onLine", {
      configurable: true,
      get: () => false,
    });
    await expect(farmApi("/plots")).rejects.toMatchObject({ network: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    Object.defineProperty(Navigator.prototype, "onLine", online);
    global.fetch = original;
  }
});
