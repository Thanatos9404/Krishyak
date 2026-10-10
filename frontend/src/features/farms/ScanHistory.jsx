import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
export default function ScanHistory({ plotId, refresh, act, busy, offline }) {
  const { tx, formatDate } = useProductLocale();
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
      <h3>{tx("Saved crop photographs")}</h3>
      <p>
        {tx(
          "Photographs require a connection. They are not saved in offline storage.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((item) => (
        <article className="v2-event" key={item.id}>
          <p>
            {formatDate(item.created_at, { time: true })} · {item.result.status}{" "}
            · {item.result.predicted_class || tx("No supported classification")}
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
            {tx("Download private photograph")}
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
            {tx("Delete photograph")}
          </button>
        </article>
      ))}
      {!items.length && (
        <p>{tx("No stored photographs for the selected field.")}</p>
      )}
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
          {tx("Load earlier photographs")}
        </button>
      )}
    </section>
  );
}
