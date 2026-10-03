import { act, renderHook } from "@testing-library/react";
import {
  ProductLocaleProvider,
  useProductLocale,
  interpolate,
} from "./ProductLocale";
import version from "./locales/version.json";
const wrapper = ({ children }) => (
  <ProductLocaleProvider>{children}</ProductLocaleProvider>
);
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.useRealTimers();
  document.documentElement.dir = "ltr";
});

test("English startup needs no locale or translation API request", async () => {
  const { result } = renderHook(useProductLocale, { wrapper });
  expect(result.current.tx("Field {{name}}", { name: "कृषक <script>" })).toBe(
    "Field कृषक <script>",
  );
  expect(global.fetch).not.toHaveBeenCalled();
  expect(await result.current.changeLanguage("unsupported")).toBe(false);
  expect(await result.current.changeLanguage("or")).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("selected language loads only its static pack, caches it and preserves placeholders", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ Today: "आज", "Field {{name}}": "खेत {{name}}" }),
  });
  const { result } = renderHook(useProductLocale, { wrapper });
  await act(async () => {
    expect(await result.current.changeLanguage("hi")).toBe(true);
  });
  expect(fetch.mock.calls[0][0]).toBe(
    `/locales/workspace/hi.json?v=${version.source_sha256}`,
  );
  expect(result.current.tx("Today")).toBe("आज");
  expect(result.current.tx(" Field {{name}} ", { name: "अनिल" })).toBe(
    " खेत अनिल ",
  );
  await act(async () => {
    await result.current.changeLanguage("en");
    await result.current.changeLanguage("hi");
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.documentElement.lang).toBe("hi-IN");
});
test("RTL languages update the document and do not translate user supplied field names", async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ Today: "آج" }) });
  const { result } = renderHook(useProductLocale, { wrapper });
  await act(async () => {
    await result.current.changeLanguage("ur");
  });
  expect(document.documentElement.dir).toBe("rtl");
  expect(result.current.tx("अनिल का खेत")).toBe("अनिल का खेत");
});
test.each(["network", "not-found", "invalid"])(
  "%s failure retains the previous language and a retryable message",
  async (kind) => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Today: "आज" }),
    });
    const { result } = renderHook(useProductLocale, { wrapper });
    await act(async () => {
      await result.current.changeLanguage("hi");
    });
    if (kind === "network")
      fetch.mockRejectedValueOnce(new Error("private transport details"));
    else
      fetch.mockResolvedValueOnce({
        ok: kind !== "not-found",
        json: async () => ({ Today: 99 }),
      });
    await act(async () => {
      expect(await result.current.changeLanguage("ur")).toBe(false);
    });
    expect(result.current.language).toBe("hi");
    expect(result.current.tx("Today")).toBe("आज");
    expect(result.current.error).toMatch(/Reconnect and retry/);
    expect(result.current.error).not.toContain("private transport");
  },
);
test("a late response cannot overwrite a newer language choice", async () => {
  let finish;
  fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ Today: "آج" }),
  });
  const { result } = renderHook(useProductLocale, { wrapper });
  let pending;
  act(() => {
    pending = result.current.changeLanguage("hi");
  });
  await act(async () => {
    await result.current.changeLanguage("ur");
  });
  await act(async () => {
    finish({ ok: true, json: async () => ({ Today: "आज" }) });
    await pending;
  });
  expect(result.current.language).toBe("ur");
});
test("timeout is bounded and permits retry without changing language", async () => {
  jest.useFakeTimers();
  fetch.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("abort"))),
      ),
  );
  const { result } = renderHook(useProductLocale, { wrapper });
  let pending;
  act(() => {
    pending = result.current.changeLanguage("hi");
  });
  await act(async () => {
    jest.advanceTimersByTime(10001);
    await pending;
  });
  expect(result.current.language).toBe("en");
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toMatch(/Reconnect and retry/);
});
test("interpolation preserves unknown placeholders and zero values", () => {
  expect(interpolate("{{number}} {{unknown}}", { number: 0 })).toBe(
    "0 {{unknown}}",
  );
});
