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

export async function farmApi(
  path,
  { method = "GET", body, retry = true, binary = false, signal } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  let response, result;
  try {
    const headers = {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    };
    response = await fetch(BASE + path, {
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
    if (response.ok && binary) result = await response.blob();
    else
      result = await response.json().catch((error) => {
        if (controller.signal.aborted) throw error;
        return {};
      });
  } catch {
    if (signal?.aborted) {
      const error = new Error("The previous read was cancelled.");
      error.cancelled = true;
      throw error;
    }
    const error = new Error(
      "The connection failed. Saved observations remain on this device. Retry when connected.",
    );
    error.network = true;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
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
    return farmApi(path, { method, body, retry: false, binary, signal });
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
