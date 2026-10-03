import { useCallback, useEffect } from "react";
import { farmApi } from "../farms/api";
import {
  clearOwner,
  pendingOperations,
  saveRecord,
  synchronize,
} from "../farms/offline";
import { deviceSession } from "./sessionStorage";
import { revokeDeviceSession } from "./useAccountSession";

export function useOfflineConnection({
  account,
  fields,
  offline,
  setOffline,
  pending,
  setPending,
  act,
  setError,
  setNotice,
}) {
  const {
    farmer,
    ownerRef,
    setFarmer,
    loadConsents,
    offlineOpt,
    setOfflineOpt,
  } = account;
  const { loadFields, refreshEvidence } = fields;
  const sync = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner) return;
    await revokeDeviceSession();
    const session = await farmApi("/me");
    if (session.farmer.id !== owner)
      throw new Error(
        "The signed-in account changed. Sign out before synchronizing.",
      );
    if (ownerRef.current !== owner) return;
    setFarmer(session.farmer);
    await loadConsents();
    if (ownerRef.current !== owner) return;
    const response = await synchronize(owner, (path, options) => {
      if (ownerRef.current !== owner)
        throw new Error("The account changed before synchronization.");
      return farmApi(path, options);
    });
    if (ownerRef.current !== owner) return;
    setPending(response.pending);
    setOffline(false);
    if (response.error) throw response.error;
    await loadFields();
    await refreshEvidence();
  }, [
    ownerRef,
    setFarmer,
    loadConsents,
    loadFields,
    refreshEvidence,
    setPending,
    setOffline,
  ]);
  useEffect(() => {
    let cancelled = false;
    if (!farmer?.id) {
      setPending(0);
      return;
    }
    pendingOperations(farmer.id)
      .then((items) => {
        if (!cancelled) setPending(items.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [farmer?.id, setPending]);
  useEffect(() => {
    const lost = () => setOffline(true);
    const connected = () =>
      sync().catch((problem) => {
        if (!problem.network) setError(problem.message);
      });
    window.addEventListener("offline", lost);
    window.addEventListener("online", connected);
    return () => {
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", connected);
    };
  }, [sync, setOffline, setError]);
  useEffect(() => {
    if (!farmer || (!offline && !pending)) return;
    let checking = false;
    const retry = async () => {
      if (checking || document.hidden || ownerRef.current !== farmer.id) return;
      checking = true;
      try {
        await sync();
      } catch (problem) {
        if (!problem.network) setError(problem.message);
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(retry, 10000);
    window.addEventListener("focus", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", retry);
    };
  }, [farmer, ownerRef, offline, pending, sync, setError]);
  const enableOffline = (enabled) => {
    if (
      !enabled &&
      pending &&
      !window.confirm(
        "Turning off offline storage removes pending observations. Continue?",
      )
    )
      return;
    act(async () => {
      const owner = ownerRef.current;
      if (!owner) return;
      setOfflineOpt(enabled);
      try {
        if (enabled) {
          await saveRecord(owner, "fields", {
            farms: fields.farms,
            plots: fields.plots,
            selected: fields.selected,
          });
          if (fields.selected && fields.today)
            await saveRecord(owner, `plot:${fields.selected}`, {
              attention: fields.today,
              events: { items: fields.timeline },
              cropCycles: { items: fields.cycles },
            });
          if (ownerRef.current !== owner) {
            await clearOwner(owner, true);
            return;
          }
          deviceSession("set", { owner, display_name: farmer.display_name });
        } else {
          await clearOwner(owner);
          deviceSession("clear");
          setPending(0);
        }
        if (ownerRef.current === owner)
          setNotice(
            enabled
              ? "Offline records saved on this device."
              : "Offline records removed from this device.",
          );
      } catch (problem) {
        if (ownerRef.current === owner) setOfflineOpt(!enabled);
        throw problem;
      }
    });
  };
  return { sync, enableOffline, offlineOpt };
}
