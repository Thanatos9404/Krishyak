import { useEffect, useState } from "react";
import { farmApi } from "../../features/farms/api";
import { useProductLocale } from "../../features/product/ProductLocale";

export function GovernmentLogin({ workspace: w, link = false }) {
  const { tx } = useProductLocale();
  const [status, setStatus] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    farmApi("/government/auth/status", {
      signal: controller.signal,
      retry: false,
    })
      .then((result) => {
        if (!controller.signal.aborted) setStatus(result);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  // MeriPehchaan needs an approved partner registration. Until it is
  // configured, say nothing rather than advertise a sign-in that cannot work.
  if (!status?.available) return null;
  const start = () =>
    w.act(async () => {
      setError("");
      try {
        const result = await farmApi("/government/auth/start", {
          method: "POST",
          retry: false,
          body: { mode: link ? "link" : "login" },
        });
        const url = new URL(result.authorization_url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "digilocker.meripehchaan.gov.in" ||
          url.pathname !== "/public/oauth2/1/authorize" ||
          url.username ||
          url.password
        )
          throw new Error("Invalid redirect");
        window.location.assign(url.toString());
      } catch {
        setError(
          tx("Government login could not be started. Use your usual sign-in."),
        );
      }
    });
  return (
    <div className="government-login">
      <p>
        {tx(
          link
            ? "Link your MeriPehchaan account to this Krishyak account. No government documents are requested."
            : "Already linked MeriPehchaan to your Krishyak account? You can use it to sign in. No government documents are requested.",
        )}
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={
          w.busy ||
          w.offline ||
          (link && !w.consents.includes("government_identity"))
        }
        onClick={start}
      >
        {tx(link ? "Link government sign-in" : "Continue with MeriPehchaan")}
      </button>
      {link && (
        <button
          type="button"
          className="button secondary"
          disabled={w.busy || w.offline}
          onClick={() =>
            w.act(() =>
              farmApi("/government/auth/link", {
                method: "DELETE",
                retry: false,
              }),
            )
          }
        >
          {tx("Unlink government sign-in")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
