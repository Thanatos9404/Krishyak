import { cancelReadsOnExit } from "../product/readCancellation";
const BASE = "/api/v2";
let csrf = null;
let refreshPromise = null;

export const setCsrfToken = (token) => {
  csrf = token;
};

export async function restoreFarmSession() {
  try {
    return await farmApi("/me");
  } catch (error) {
    if (error.status !== 401) throw error;
    await farmApi("/auth/session", { retry: false });
    await farmApi("/auth/refresh", { method: "POST", retry: false });
    return farmApi("/me", { retry: false });
  }
}

// How long an ordinary read waits before it is tried once more.
const QUICK_READ_MS = 8000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One attempt. Resolves with the response and its parsed body, or rejects with
// an error marked `cancelled` (the caller or a navigation stopped it) or
// `network` (dropped, unreachable or, with `timedOut`, too slow).
async function attempt(path, { method, body, binary, signal }, limitMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limitMs);
  const endRead = method === "GET" ? cancelReadsOnExit(controller) : null;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  try {
    const headers = {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    };
    const response = await fetch(BASE + path, {
      method,
      credentials: "include",
      headers,
      signal: controller.signal,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    const result =
      response.ok && binary
        ? await response.blob()
        : await response.json().catch((error) => {
            if (controller.signal.aborted) throw error;
            return {};
          });
    return { response, result };
  } catch {
    if (signal?.aborted || (!timedOut && controller.signal.aborted)) {
      const error = new Error("The previous read was cancelled.");
      error.cancelled = true;
      throw error;
    }
    const error = new Error(
      "The connection failed. Saved observations remain on this device. Retry when connected.",
    );
    error.network = true;
    error.timedOut = timedOut;
    throw error;
  } finally {
    clearTimeout(timeout);
    endRead?.();
    signal?.removeEventListener("abort", cancel);
  }
}

export async function farmApi(
  path,
  {
    method = "GET",
    body,
    retry = true,
    binary = false,
    signal,
    timeoutMs,
  } = {},
) {
  const full = Number.isFinite(timeoutMs)
    ? Math.min(70000, Math.max(1000, timeoutMs))
    : 20000;
  // Reads change nothing on the server, so a read that is dropped on the way
  // (weak signal, a lost reply) is tried once more before the farmer sees an
  // error. An ordinary read also gives up its first try early, so a reply that
  // went missing costs seconds, not the whole wait. Reads the caller knows to
  // be slow keep their full wait and are repeated only if the connection
  // drops. Anything that changes data is sent exactly once.
  const waits =
    method !== "GET"
      ? [full]
      : timeoutMs === undefined
        ? [Math.min(QUICK_READ_MS, full), full]
        : [full, full];
  let response, result;
  for (let turn = 0; turn < waits.length; turn++) {
    try {
      ({ response, result } = await attempt(
        path,
        { method, body, binary, signal },
        waits[turn],
      ));
      break;
    } catch (error) {
      const last = turn === waits.length - 1;
      const slowByDesign = timeoutMs !== undefined && error.timedOut;
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      if (error.cancelled || last || slowByDesign || offline) throw error;
      if (!error.timedOut) await pause(300);
      if (signal?.aborted) {
        const cancelled = new Error("The previous read was cancelled.");
        cancelled.cancelled = true;
        throw cancelled;
      }
    }
  }
  if (response.status === 401 && retry && csrf && path !== "/auth/refresh") {
    if (!refreshPromise)
      refreshPromise = farmApi("/auth/refresh", {
        method: "POST",
        retry: false,
      })
        .then((result) => {
          csrf = result.csrf_token;
        })
        .finally(() => {
          refreshPromise = null;
        });
    await refreshPromise;
    return farmApi(path, {
      method,
      body,
      retry: false,
      binary,
      signal,
      timeoutMs,
    });
  }
  if (response.ok && binary) return result;
  if (!response.ok) {
    const error = new Error(
      result.error?.message ||
        result.detail ||
        "The request could not be completed. Please retry.",
    );
    error.status = response.status;
    throw error;
  }
  if (result.csrf_token) csrf = result.csrf_token;
  return result;
}
