import { useEffect, useRef, useState } from "react";
import { farmApi } from "../farms/api";

export function consentFailure(problem) {
  if (problem.network)
    return "Connection interrupted. Check your connection and retry your permission choice.";
  return (
    {
      401: "Sign in again before changing your permissions.",
      403: "This permission could not be changed. Check your account and retry.",
      409: "Your permission changed elsewhere. Refresh your choices and retry.",
      429: "Too many requests. Wait a moment before retrying your permission choice.",
    }[problem.status] ||
    "Your permission could not be saved. Your previous choice is shown. Please retry."
  );
}

// Optimistic display never replaces the server-confirmed processing consents.
// Each purpose has its own lock, cancellation and recovery state.
export function useConsentChanges(w) {
  const [changes, setChanges] = useState({});
  const requests = useRef(new Map());
  const latest = useRef(w);
  latest.current = w;
  const owner = w.farmer?.id;
  useEffect(() => {
    const active = requests.current;
    return () => {
      for (const entry of active.values()) entry.controller.abort();
      active.clear();
    };
  }, [owner]);
  const change = async (purpose, granted) => {
    const current = latest.current;
    const account = current.farmer?.id;
    if (!account || current.offline || requests.current.has(purpose)) return;
    const controller = new AbortController();
    const entry = { controller, owner: account };
    requests.current.set(purpose, entry);
    const stillCurrent = () =>
      !controller.signal.aborted &&
      latest.current.farmer?.id === account &&
      (!latest.current.ownerRef || latest.current.ownerRef.current === account);
    setChanges((previous) => ({
      ...previous,
      [purpose]: { owner: account, granted, saving: true },
    }));
    try {
      await farmApi("/consents", {
        method: "POST",
        signal: controller.signal,
        body: { purpose, granted, policy_version: "2026-10-03" },
      });
      if (!stillCurrent()) return;
      await latest.current.loadConsents();
      if (!stillCurrent()) return;
      latest.current.setNotice("Your permission choice has been saved.");
      setChanges((previous) => ({ ...previous, [purpose]: undefined }));
    } catch (problem) {
      if (stillCurrent())
        setChanges((previous) => ({
          ...previous,
          [purpose]: {
            owner: account,
            granted,
            saving: false,
            error: consentFailure(problem),
          },
        }));
    } finally {
      if (requests.current.get(purpose) === entry)
        requests.current.delete(purpose);
    }
  };
  const states = Object.fromEntries(
    Object.entries(changes).filter(([, state]) => state?.owner === owner),
  );
  return { states, change };
}
