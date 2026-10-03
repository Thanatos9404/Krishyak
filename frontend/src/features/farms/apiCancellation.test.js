import { farmApi, setCsrfToken } from "./api";
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
