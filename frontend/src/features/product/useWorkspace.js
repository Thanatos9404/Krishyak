import { useState } from "react";
import { farmApi } from "../farms/api";
import {
  clearOwner,
  pendingOperations,
  queueOperation,
} from "../farms/offline";
import { useMutation } from "./useMutation";
import { useAccountSession, revokeDeviceSession } from "./useAccountSession";
import { useFieldRecords } from "./useFieldRecords";
import { useOfflineConnection } from "./useOfflineConnection";

export const OUTCOMES = {
  harvest: ["quantity_kg", "kg"],
  actual_cost: ["cost_inr", "INR"],
  market_sale: ["sale_price_inr_per_kg", "INR/kg"],
  crop_loss: ["loss_percent", "%"],
  irrigation: ["water_litres", "L"],
  fertilizer_action: ["fertilizer_kg", "kg"],
  satisfaction: ["rating", "1–5"],
  advisory_usefulness: ["rating", "1–5"],
};

export function useWorkspace() {
  const mutation = useMutation();
  const [offline, setOffline] = useState(!navigator.onLine),
    [pending, setPending] = useState(0);
  const account = useAccountSession(mutation);
  const fields = useFieldRecords({
    ...account,
    setError: mutation.setError,
    setOffline,
  });
  const connection = useOfflineConnection({
    account,
    fields,
    offline,
    setOffline,
    pending,
    setPending,
    ...mutation,
  });
  const signOut = () =>
    mutation.act(async () => {
      if (
        pending &&
        !window.confirm(
          "Pending observations on this device will be removed. Continue signing out?",
        )
      )
        return;
      const owner = account.ownerRef.current;
      let revokeError;
      try {
        document.cookie = `krishyak_logout_pending=yes; Path=/; Max-Age=604800; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        if (navigator.onLine) await revokeDeviceSession();
      } catch (problem) {
        revokeError = problem;
      }
      account.clearSession();
      setPending(0);
      if (window.BroadcastChannel) {
        const channel = new BroadcastChannel("krishyak-v2-session-events");
        channel.postMessage({ kind: "signed_out", owner });
        channel.close();
      }
      await clearOwner(owner, true);
      if (!navigator.onLine || revokeError)
        mutation.setNotice(
          "Private data was cleared from this device. Reconnect to revoke the server session; sign-in resumes after revocation.",
        );
    });
  const recordObservation = async ({ kind, note, value }) => {
    const owner = account.ownerRef.current,
      field = fields.selectedRef.current;
    if (!owner || !field || !note.trim())
      throw new Error("Choose a field and describe your update.");
    const id = crypto.randomUUID();
    const operation = {
      operation_id: id,
      path: `/plots/${field}/observations`,
      body: {
        operation_id: id,
        kind,
        note: note.trim(),
        observed_at: new Date().toISOString(),
        ...(OUTCOMES[kind] && value !== ""
          ? {
              measurements: { [OUTCOMES[kind][0]]: Number(value) },
              unit: OUTCOMES[kind][1],
            }
          : {}),
      },
    };
    try {
      if (offline || !navigator.onLine) {
        const problem = new Error();
        problem.network = true;
        throw problem;
      }
      await farmApi(operation.path, { method: "POST", body: operation.body });
      if (
        account.ownerRef.current === owner &&
        fields.selectedRef.current === field
      )
        await fields.refreshEvidence();
      mutation.setNotice("Your field update was saved.");
    } catch (problem) {
      if (!problem.network || !account.offlineOpt) throw problem;
      if (account.ownerRef.current !== owner) return;
      await queueOperation(owner, operation);
      setPending((await pendingOperations(owner)).length);
      setOffline(true);
      mutation.setNotice(
        "Saved on this device. Your update will sync when the connection returns.",
      );
    }
  };
  return {
    ...mutation,
    ...account,
    ...fields,
    ...connection,
    offline,
    pending,
    setPending,
    signOut,
    recordObservation,
  };
}
