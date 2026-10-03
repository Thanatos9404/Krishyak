import { useEffect, useState } from "react";
import { CloudSun, Droplets } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { readRecord, saveRecord } from "../../features/farms/offline";
export function WeatherStrip({ plotId, owner, cache }) {
  const [record, setRecord] = useState(null),
    [savedAt, setSavedAt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setSavedAt(null);
    const load = async () => {
      try {
        const result = await farmApi(`/plots/${plotId}/weather`);
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
    };
  }, [plotId, owner, cache]);
  return (
    <section className="weather-strip" aria-label="Weather context">
      <CloudSun size={25} />
      {record ? (
        <>
          <div>
            <strong>{record.payload.current.temperature} °C</strong>
            <span>Weather-model temperature</span>
          </div>
          <div>
            <strong>
              <Droplets size={16} />
              {record.payload.precipitation_next_24h_mm.toFixed(1)} mm
            </strong>
            <span>Forecast rain · next 24 hours</span>
          </div>
          <div className="weather-source">
            <span>
              {record.source} · retrieved{" "}
              {new Date(record.created_at).toLocaleString()}
            </span>
            {savedAt && (
              <span>
                Saved on this device {new Date(savedAt).toLocaleString()}
              </span>
            )}
            <a href={`/app/farm/${plotId}`}>Source & limits</a>
          </div>
        </>
      ) : (
        <div>
          <strong>No weather observation stored.</strong>
          <span>
            Check local conditions. Your field page shows retrieval
            requirements.
          </span>
        </div>
      )}
    </section>
  );
}
