import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
import { SOILS } from "../product/soils";
export default function NoticeList({ owner, act, busy, offline }) {
  const { tx, formatDate } = useProductLocale();
  const [records, setRecords] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!navigator.onLine || document.hidden) return;
      farmApi("/notifications")
        .then((result) => {
          if (!cancelled) setRecords(result.items);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [owner]);
  if (!records.length) return null;
  return (
    <section className="v2-card">
      <h2>{tx("Field updates")}</h2>
      {records.map((record) => (
        <article className="v2-event" key={record.id}>
          <h3>{tx(record.payload.title)}</h3>
          <p>{tx(record.payload.message)}</p>
          {record.kind === "soil_updated" && record.payload.soil_type && (
            <p>
              <strong>
                {tx(
                  SOILS[record.payload.soil_type] || record.payload.soil_type,
                )}
              </strong>
            </p>
          )}
          <time>{formatDate(record.created_at, { time: true })}</time>
          {record.acknowledged_at ? (
            <p>
              {tx("Acknowledged")}{" "}
              {formatDate(record.acknowledged_at, { time: true })}
            </p>
          ) : (
            <button
              disabled={busy || offline}
              onClick={() =>
                act(async () => {
                  const updated = await farmApi(
                    `/notifications/${record.id}/acknowledge`,
                    {
                      method: "POST",
                    },
                  );
                  setRecords((previous) =>
                    previous.map((value) =>
                      value.id === record.id ? updated : value,
                    ),
                  );
                })
              }
            >
              {tx("Acknowledge update")}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
