import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useState } from "react";
import { CloudSun, Droplets } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { readRecord, saveRecord } from "../../features/farms/offline";
import { cancelReadsOnExit } from "../../features/product/readCancellation";
export function WeatherStrip({ plotId, owner, cache }) {
  const { tx } = useProductLocale();
  const [record, setRecord] = useState(null),
    [savedAt, setSavedAt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const endReads = cancelReadsOnExit(controller);
    setRecord(null);
    setSavedAt(null);
    const load = async () => {
      try {
        const result = await farmApi(`/plots/${plotId}/weather`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        setRecord(result.observation);
        if (cache) await saveRecord(owner, `weather:${plotId}`, result);
      } catch (problem) {
        if (!cache || !problem.network) return;
        const saved = await readRecord(owner, `weather:${plotId}`).catch(
          () => null,
        );
        if (saved && !cancelled) {
          setRecord(saved.data.observation);
          setSavedAt(saved.saved_at);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      endReads();
    };
  }, [plotId, owner, cache]);
  return (
    <section className="weather-strip" aria-label={tx("Weather context")}>
      <CloudSun size={25} />
      {record ? (
        <>
          <div>
            <strong>
              {record.payload.current.temperature} {tx("\xB0C")}
            </strong>
            <span>{tx("Weather-model temperature")}</span>
          </div>
          <div>
            <strong>
              <Droplets size={16} />
              {record.payload.precipitation_next_24h_mm.toFixed(1)} mm
            </strong>
            <span>{tx("Forecast rain \xB7 next 24 hours")}</span>
          </div>
          <div className="weather-source">
            <span>
              {record.source} {tx("\xB7 retrieved")}{" "}
              {new Date(record.created_at).toLocaleString()}
            </span>
            {savedAt && (
              <span>
                {tx("Saved on this device")}{" "}
                {new Date(savedAt).toLocaleString()}
              </span>
            )}
            <a href={`/app/farm/${plotId}`}>{tx("Source & limits")}</a>
          </div>
        </>
      ) : (
        <div>
          <strong>{tx("No weather observation stored.")}</strong>
          <span>
            {tx(
              "Check local conditions. Your field page shows retrieval requirements.",
            )}
          </span>
        </div>
      )}
    </section>
  );
}
