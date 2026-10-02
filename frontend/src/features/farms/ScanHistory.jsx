import React, { useEffect, useState } from "react";
import { farmApi } from "./api";

export default function ScanHistory({ plotId, refresh, act, busy, offline }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setItems([]);
    if (plotId)
      farmApi(`/disease-scans?plot_id=${plotId}`)
        .then((result) => {
          if (!cancelled) {
            setItems(result.items);
            setMore(result.items.length === 20);
          }
        })
        .catch((problem) => {
          if (!cancelled) setError(problem.message);
        });
    return () => {
      cancelled = true;
    };
  }, [plotId, refresh]);
  return (
    <section>
      <h3>Saved crop photographs</h3>
      <p>
        Photographs require a connection. They are not saved in offline storage.
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((item) => (
        <article className="v2-event" key={item.id}>
          <p>
            {new Date(item.created_at).toLocaleString()} · {item.result.status}{" "}
            · {item.result.predicted_class || "No supported classification"}
          </p>
          <button
            disabled={busy || offline}
            onClick={() =>
              act(async () => {
                const blob = await farmApi(`/disease-scans/${item.id}/image`, {
                  binary: true,
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "krishyak-crop-photo.jpg";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            Download private photograph
          </button>
          <button
            className="v2-danger"
            disabled={busy || offline}
            onClick={() =>
              act(async () => {
                if (
                  !window.confirm(
                    "Delete this photograph and its feedback? The timeline keeps the classification record.",
                  )
                )
                  return;
                await farmApi(`/disease-scans/${item.id}`, {
                  method: "DELETE",
                });
                setItems((values) =>
                  values.filter((value) => value.id !== item.id),
                );
              })
            }
          >
            Delete photograph
          </button>
        </article>
      ))}
      {!items.length && <p>No stored photographs for the selected field.</p>}
      {more && (
        <button
          disabled={busy || offline}
          onClick={() =>
            act(async () => {
              const result = await farmApi(
                `/disease-scans?plot_id=${plotId}&offset=${items.length}`,
              );
              setItems((values) => [...values, ...result.items]);
              setMore(result.items.length === 20);
            })
          }
        >
          Load earlier photographs
        </button>
      )}
    </section>
  );
}
