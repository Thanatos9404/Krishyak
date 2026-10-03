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

test("the read timeout remains a retryable network failure", async () => {
  const original = global.fetch;
  jest.useFakeTimers();
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
    jest.advanceTimersByTime(20000);
    await expect(request).rejects.toMatchObject({ network: true });
  } finally {
    global.fetch = original;
    jest.useRealTimers();
  }
});
