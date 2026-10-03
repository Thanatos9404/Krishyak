import { useCallback, useEffect, useRef, useState } from "react";
import { farmApi, restoreFarmSession, setCsrfToken } from "../farms/api";
import { activateOwner, clearOwner, readRecord } from "../farms/offline";
import { deviceSession } from "./sessionStorage";

export async function revokeDeviceSession() {
  if (!document.cookie.split("; ").includes("krishyak_logout_pending=yes"))
    return;
  try {
    await farmApi("/auth/session", { retry: false });
    await farmApi("/auth/logout", { method: "POST", retry: false });
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  document.cookie = "krishyak_logout_pending=; Path=/; Max-Age=0; SameSite=Lax";
  setCsrfToken(null);
}

export function useAccountSession({ setError, setNotice }) {
  const [farmer, setFarmer] = useState(null),
    [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true),
    [consents, setConsents] = useState([]);
  const [offlineOpt, setOfflineOpt] = useState(false);
  const ownerRef = useRef(null),
    alive = useRef(true);
  const establish = useCallback(async (session) => {
    const stored = deviceSession("get");
    if (stored?.owner && stored.owner !== session.farmer.id) {
      await clearOwner(stored.owner, true);
      deviceSession("clear");
    }
    if (!alive.current) return;
    ownerRef.current = session.farmer.id;
    activateOwner(session.farmer.id);
    setFarmer(session.farmer);
    setCsrfToken(session.csrf_token);
    setOfflineOpt(stored?.owner === session.farmer.id);
  }, []);
  const loadConsents = useCallback(async () => {
    const owner = ownerRef.current;
    const result = await farmApi("/consents");
    if (alive.current && ownerRef.current === owner)
      setConsents(
        result.items
          .filter((item) => !item.withdrawn_at)
          .map((item) => item.purpose),
      );
  }, []);
  const clearSession = useCallback(() => {
    ownerRef.current = null;
    setFarmer(null);
    setConsents([]);
    setOfflineOpt(false);
    deviceSession("clear");
    setCsrfToken(null);
  }, []);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const initialise = async () => {
      try {
        const provider = await farmApi("/status").catch((problem) => {
          // An older public backend may not yet expose farm-account routes.
          // Treat only missing service as unavailable; preserve auth/errors.
          if (problem.status === 404) return { enabled: false };
          throw problem;
        });
        if (cancelled) return;
        setStatus(provider);
        if (provider.enabled) {
          await revokeDeviceSession();
          try {
            const session = await restoreFarmSession();
            if (cancelled) return;
            await establish(session);
            await loadConsents();
          } catch (problem) {
            if (problem.status !== 401) throw problem;
          }
        }
      } catch (problem) {
        const saved = deviceSession("get");
        if (problem.network && saved?.owner) {
          const fields = await readRecord(saved.owner, "fields").catch(
            () => null,
          );
          if (fields && !cancelled) {
            ownerRef.current = saved.owner;
            activateOwner(saved.owner);
            setFarmer({ id: saved.owner, display_name: saved.display_name });
            setOfflineOpt(true);
            setNotice(
              "Showing records saved on this device. Reconnect to confirm your account and current conditions.",
            );
          } else if (!cancelled)
            setError(
              "No saved farm is available on this device. Reconnect to sign in.",
            );
        } else if (!cancelled) setError(problem.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initialise();
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [establish, loadConsents, setError, setNotice]);
  useEffect(() => {
    if (!window.BroadcastChannel) return;
    const channel = new BroadcastChannel("krishyak-v2-session-events");
    channel.onmessage = async (event) => {
      if (
        event.data?.kind === "signed_out" &&
        event.data.owner === ownerRef.current
      ) {
        const owner = ownerRef.current;
        clearSession();
        await clearOwner(owner, true).catch(() =>
          setError(
            "Private offline storage could not be cleared. Clear this site’s storage in your browser.",
          ),
        );
      }
    };
    return () => channel.close();
  }, [clearSession, setError]);
  return {
    farmer,
    setFarmer,
    status,
    loading,
    consents,
    setConsents,
    offlineOpt,
    setOfflineOpt,
    ownerRef,
    establish,
    clearSession,
    loadConsents,
  };
}
