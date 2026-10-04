import { useEffect, useRef, useState } from "react";
import { farmApi } from "../../features/farms/api";
import { useProductLocale } from "../../features/product/ProductLocale";
import { locationFromProfile } from "../../features/product/indiaLocations";
import { IndiaLocationPicker } from "./IndiaLocationPicker";
import { CropPicker } from "./CropPicker";
import { findCrop } from "../../features/product/crops";
const SOURCE_LABELS = {
  success: "Available",
  fallback: "Fallback",
  stale: "Stale",
  disabled: "Disabled",
  partial: "Partial",
  unavailable: "Unavailable",
};

export function FarmContextCard({ workspace: w, onReviewed }) {
  const { tx, formatDate } = useProductLocale();
  const [area, setArea] = useState(() => locationFromProfile(w.farmer));
  const [crop, setCrop] = useState("");
  const [quoteIndex, setQuoteIndex] = useState("");
  const requestedContext = useRef(null);
  const [context, setContext] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [publicAllowed, setPublicAllowed] = useState(false),
    [gpsAllowed, setGpsAllowed] = useState(false);
  const active = useRef(null),
    generation = useRef(0);
  const identity = w.farmer?.id,
    publicConsent = w.consents.includes("government_integration"),
    locationConsent = w.consents.includes("location_processing");
  const previousPermissions = useRef({
    identity,
    publicConsent,
    locationConsent,
  });
  useEffect(() => {
    const old = previousPermissions.current;
    previousPermissions.current = { identity, publicConsent, locationConsent };
    if (
      old.identity !== identity ||
      (old.publicConsent && !publicConsent) ||
      (old.locationConsent && !locationConsent)
    ) {
      generation.current++;
      active.current?.abort();
      setContext(null);
      requestedContext.current = null;
      setQuoteIndex("");
      setBusy(false);
    }
  }, [identity, publicConsent, locationConsent]);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );
  const cancel = () => {
    generation.current++;
    active.current?.abort();
    setBusy(false);
  };
  const load = async (gps) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const id = ++generation.current;
    setError("");
    setContext(null);
    setQuoteIndex("");
    requestedContext.current = null;
    setBusy(true);
    try {
      if (
        (!publicConsent && !publicAllowed) ||
        (gps && !locationConsent && !gpsAllowed)
      )
        return;
      const purposes = [
        ...(!publicConsent ? ["government_integration"] : []),
        ...(gps && !locationConsent ? ["location_processing"] : []),
      ];
      for (const purpose of purposes)
        await farmApi("/consents", {
          method: "POST",
          retry: false,
          signal: controller.signal,
          body: { purpose, granted: true, policy_version: "2026-10-03" },
        });
      if (purposes.length) await w.loadConsents();
      let coordinates = {};
      if (gps) {
        if (!navigator.geolocation) throw new Error("LOCATION_UNAVAILABLE");
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0,
          }),
        );
        if (id !== generation.current || controller.signal.aborted) return;
        coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy,
        };
      }
      const requestBody = {
        state_code: gps ? null : area.state_code,
        district_code: gps ? null : area.district_code,
        crop_id: crop || null,
        ...coordinates,
      };
      const result = await farmApi("/farm-context", {
        method: "POST",
        retry: false,
        signal: controller.signal,
        timeoutMs: 35000,
        body: requestBody,
      });
      if (id !== generation.current || controller.signal.aborted) return;
      setContext(result);
      requestedContext.current = requestBody;
    } catch (failure) {
      if (id === generation.current && !controller.signal.aborted)
        setError(
          tx(
            gps
              ? "Location or public data is unavailable. Choose your area manually or retry."
              : "Public data is unavailable. Your saved farm records are still available.",
          ),
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  };
  const confirm = () => {
    const detected = context?.location?.data;
    if (!detected?.state_lgd_code) return;
    w.act(async () => {
      const result = await farmApi("/me", {
        method: "PATCH",
        body: {
          state_code: detected.state_lgd_code,
          district_code: detected.district_lgd_code,
          state: detected.state_name,
          district: detected.district_name,
        },
      });
      w.setFarmer(result.farmer);
      setArea(locationFromProfile(result.farmer));
      w.setNotice("Your confirmed area was saved.");
    });
  };
  const weather = context?.weather?.data,
    soil = context?.soil?.data,
    quotes = context?.market?.data || [];
  return (
    <section className="product-card farm-context-card">
      <h2>{tx("Public context for your farm")}</h2>
      <p>
        {tx(
          "Choose an area and crop, or use your device location. Confirm detected details before saving. You can skip this and add your field now.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(false);
        }}
      >
        <IndiaLocationPicker
          value={area}
          disabled={busy}
          onChange={(value) => {
            cancel();
            setContext(null);
            setArea(value);
          }}
        />
        <CropPicker
          value={crop}
          required={false}
          onChange={(value) => {
            cancel();
            setContext(null);
            setCrop(value?.id || "");
          }}
        />
        {!publicConsent && (
          <label className="v2-check">
            <input
              type="checkbox"
              checked={publicAllowed}
              onChange={(event) => {
                cancel();
                setContext(null);
                setPublicAllowed(event.target.checked);
              }}
            />
            {tx("Allow public agricultural context for my chosen area")}
          </label>
        )}
        <p className="small">
          {tx(
            "Area coordinates are rounded before public-provider requests. Device coordinates are not saved in your account. Soil estimates are not laboratory tests.",
          )}
        </p>
        {!locationConsent && (
          <label className="v2-check">
            <input
              type="checkbox"
              checked={gpsAllowed}
              onChange={(event) => {
                cancel();
                setContext(null);
                setGpsAllowed(event.target.checked);
              }}
            />
            {tx("Allow my device location for this lookup")}
          </label>
        )}
        <div className="context-actions">
          <button
            className="button secondary"
            disabled={
              busy ||
              w.offline ||
              !area.state_code ||
              (!publicConsent && !publicAllowed)
            }
          >
            {tx("Load area context")}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={
              busy ||
              w.offline ||
              (!publicConsent && !publicAllowed) ||
              (!locationConsent && !gpsAllowed)
            }
            onClick={() => void load(true)}
          >
            {tx("Use device location")}
          </button>
          {busy && (
            <button type="button" className="button secondary" onClick={cancel}>
              {tx("Cancel lookup")}
            </button>
          )}
        </div>
      </form>
      {busy && <p role="status">{tx("Loading public sources")}</p>}
      {error && <p role="alert">{error}</p>}
      {context && (
        <div aria-live="polite">
          <p>
            {tx("Generated")}: {formatDate(context.generated_at)}
          </p>
          <p>
            {tx("Detected area")}:{" "}
            {context.location.data?.state_name || tx("Unavailable")} /{" "}
            {context.location.data?.district_name || tx("Unavailable")}
          </p>
          <p>
            {tx("Village codes and land ownership have not been verified.")}
          </p>
          {context.location.data?.resolution === "name_mapping" &&
            context.location.data.state_lgd_code && (
              <button
                type="button"
                className="button secondary"
                disabled={w.busy || w.offline}
                onClick={confirm}
              >
                {tx("Confirm and save this area")}
              </button>
            )}
          <h3>{tx("Weather")}</h3>
          {weather && (
            <p>
              {weather.temperature_c ?? tx("Unavailable")} °C ·{" "}
              {weather.humidity_percent ?? tx("Unavailable")} % ·{" "}
              {weather.wind_kmh ?? tx("Unavailable")} km/h
            </p>
          )}
          {weather?.daily_forecast?.slice(0, 3).map((day) => (
            <p key={day.date}>
              {formatDate(day.date)} · {day.minimum_c} / {day.maximum_c} °C ·{" "}
              {day.description}
            </p>
          ))}
          <h3>{tx("Soil")}</h3>
          {soil && (
            <p>
              {tx("Estimated")}: pH {soil.ph ?? tx("Unavailable")} ·{" "}
              {tx("Nitrogen")} {soil.nitrogen_g_kg ?? tx("Unavailable")} g/kg
            </p>
          )}
          <h3>{tx("Market prices")}</h3>
          {quotes.slice(0, 5).map((quote) => (
            <p key={`${quote.market}:${quote.variety}:${quote.observed_date}`}>
              {quote.market} · {quote.commodity} ({quote.variety}) · ₹
              {quote.modal_price}/{tx("quintal")} ·{" "}
              {formatDate(quote.observed_date)}
            </p>
          ))}
          {onReviewed && (
            <div>
              <label className="v2-label">
                {tx("Market quote for this scenario")}
                <select
                  value={quoteIndex}
                  onChange={(event) => setQuoteIndex(event.target.value)}
                >
                  <option value="">{tx("Keep my price assumption")}</option>
                  {context.market.source.status === "success" &&
                    quotes.slice(0, 5).map((quote, index) => (
                      <option key={quote.quote_id} value={index}>
                        {quote.market} · ₹{quote.modal_price}/{tx("quintal")} ·{" "}
                        {formatDate(quote.observed_date)}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="button secondary"
                disabled={
                  w.busy ||
                  w.offline ||
                  !crop ||
                  !findCrop(crop)?.planning_names?.length ||
                  !w.consents.includes("agronomic_analysis")
                }
                onClick={() =>
                  onReviewed({
                    context: requestedContext.current,
                    market_quote_index:
                      quoteIndex === "" ? null : Number(quoteIndex),
                    expected_quote_id:
                      quoteIndex === ""
                        ? null
                        : quotes[Number(quoteIndex)]?.quote_id,
                    crop_name: findCrop(crop)?.planning_names[0],
                    price:
                      quoteIndex === ""
                        ? null
                        : quotes[Number(quoteIndex)]?.modal_price,
                  })
                }
              >
                {tx("Use reviewed context in scenario")}
              </button>
              {!w.consents.includes("agronomic_analysis") && (
                <p>
                  {tx(
                    "Enable field analysis permission to use public context in a scenario.",
                  )}
                </p>
              )}
            </div>
          )}
          <details>
            <summary>{tx("Sources and availability")}</summary>
            {[
              context.location,
              context.weather,
              context.soil,
              context.geospatial,
              context.market,
            ].map((section) => (
              <div key={section.source.provider} className="context-source">
                <strong>{section.source.provider}</strong> ·{" "}
                {tx(SOURCE_LABELS[section.source.status] || "Unavailable")}
                <p>
                  {tx(
                    section.source.message ||
                      "Source returned public information",
                  )}
                </p>
                <p>
                  {tx("Retrieved")}: {formatDate(section.source.retrieved_at)}
                  {section.source.observed_at && (
                    <>
                      {" "}
                      · {tx("Observed")}:{" "}
                      {formatDate(section.source.observed_at)}
                    </>
                  )}
                </p>
                <a
                  href={section.source.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tx("Official source")}
                </a>
              </div>
            ))}
          </details>
          <p>
            {tx(
              "Scheme information is not benefit approval. Check current official rules before applying.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
