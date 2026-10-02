import React, { useEffect, useState } from "react";
import { pendingOperations, removeOperation } from "./offline";

export default function PendingPanel({ owner, count, onChanged }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    pendingOperations(owner)
      .then((records) => {
        if (!cancelled) setItems(records);
      })
      .catch((problem) => setError(problem.message));
    return () => {
      cancelled = true;
    };
  }, [owner, count]);
  if (!count && !error) return null;
  return (
    <section className="v2-card">
      <h2>Saved observations awaiting synchronization</h2>
      <p>
        A rejected record stays here so you can review it. Restore processing
        permission or sign in again, then retry synchronization. Duplicate
        operation IDs are accepted only with identical evidence.
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((item) => (
        <article className="v2-event" key={item.operation_id}>
          <p>
            {item.body.kind.replaceAll("_", " ")} ·{" "}
            {new Date(item.body.observed_at).toLocaleString()}
          </p>
          <p>{item.body.note}</p>
          <button
            onClick={async () => {
              if (
                !window.confirm(
                  "Discard this unsynchronized observation from this device? It may not exist on the server.",
                )
              )
                return;
              try {
                await removeOperation(owner, item.operation_id);
                onChanged((await pendingOperations(owner)).length);
              } catch (problem) {
                setError(problem.message);
              }
            }}
          >
            Discard saved observation
          </button>
        </article>
      ))}
    </section>
  );
}
