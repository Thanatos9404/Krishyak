import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Globe2,
  Minus,
  Store,
} from "lucide-react";
import supportPrices from "../../data/msp_data.json";
import { farmApi } from "../../features/farms/api";
import { findCrop, findCropByName } from "../../features/product/crops";
import { CropPicker } from "./CropPicker";
import { IndiaLocationPicker } from "./IndiaLocationPicker";
import { locationFromProfile } from "../../features/product/indiaLocations";

// What a support price is paid on, where that is not the crop itself.
const PRICE_BASIS = { paddy: "Paddy", seed_cotton: "Seed cotton" };

export function supportPriceFor(crop) {
  const row = findCrop(crop);
  if (!row) return null;
  const names = [
    row.name,
    row.market_commodity,
    ...(row.aliases || []),
    ...(row.planning_names || []),
  ];
  const key = names.find((name) => name && supportPrices.crops[name]);
  return key ? { crop: key, ...supportPrices.crops[key] } : null;
}

export function useMarketPrices({ crop, state, district }) {
  const [result, setResult] = useState({ status: "idle" });
  useEffect(() => {
    if (!crop || !state) {
      setResult({ status: "idle" });
      return undefined;
    }
    const controller = new AbortController();
    setResult({ status: "loading" });
    const params = new URLSearchParams({ crop, state });
    if (district) params.set("district", district);
    farmApi(`/market/prices?${params}`, {
      signal: controller.signal,
      timeoutMs: 30000,
    })
      .then((body) => setResult(body))
      .catch((error) => {
        if (!error.cancelled)
          setResult({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [crop, state, district]);
  return result;
}

function Trend({ change }) {
  const { tx, language } = useProductLocale();
  if (!change)
    return (
      <span className="trend unknown">
        {tx("Not enough past prices for a trend")}
      </span>
    );
  const Icon =
    change.direction === "up"
      ? ArrowUpRight
      : change.direction === "down"
        ? ArrowDownRight
        : Minus;
  const value = new Intl.NumberFormat(language === "en" ? "en-IN" : language, {
    maximumFractionDigits: 1,
    signDisplay: "always",
    numberingSystem: "latn",
  }).format(change.percent);
  return (
    <span className={`trend ${change.direction}`}>
      <Icon size={16} aria-hidden="true" />
      {change.direction !== "steady"
        ? tx("{{v0}} in a week", { v0: `${value}%` })
        : Math.abs(change.percent) < 0.05
          ? tx("Steady over a week")
          : tx("Steady over a week ({{v0}}%)", { v0: value })}
    </span>
  );
}

function Spark({ series }) {
  if (series.length < 2) return null;
  const values = series.map((x) => x.modal_price);
  const low = Math.min(...values),
    high = Math.max(...values);
  const span = high - low || 1;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${28 - ((value - low) / span) * 26}`,
    )
    .join(" ");
  return (
    <svg
      className="spark"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function rupees(value, language) {
  return new Intl.NumberFormat(language === "en" ? "en-IN" : language, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(value);
}

// The all-India average: shown first when the farmer's own mandis have nothing
// as recent, and always labelled as national so it is not read as a local quote.
function NationalPrice({ national, support, lead }) {
  const { tx, language, formatDate } = useProductLocale();
  const change = national.change;
  const margin =
    support && support.unit === "quintal"
      ? ((national.per_quintal - support.msp) / support.msp) * 100
      : null;
  const Icon =
    change?.direction === "up"
      ? ArrowUpRight
      : change?.direction === "down"
        ? ArrowDownRight
        : Minus;
  return (
    <article
      className={`price-hero national ${lead ? "" : "secondary"}`}
      aria-label={tx("All-India average price")}
    >
      <span className="price-place">
        <Globe2 size={16} aria-hidden="true" /> {tx("All-India average")}
        {national.describes ? ` · ${tx(national.describes)}` : ""}
      </span>
      <strong className="price-value">
        {rupees(national.per_quintal, language)}{" "}
        <small>{tx("per quintal")}</small>
      </strong>
      <span className="price-sub">
        {tx("About {{v0}} per kg", {
          v0: rupees(national.per_quintal / 100, language),
        })}{" "}
        · {tx("Reported {{v0}}", { v0: formatDate(national.date) })}
      </span>
      {change && (
        <span className={`trend ${change.direction}`}>
          <Icon size={16} aria-hidden="true" />
          {change.direction === "steady"
            ? tx("Steady since the day before")
            : tx("{{v0}}% since the day before", {
                v0: new Intl.NumberFormat(
                  language === "en" ? "en-IN" : language,
                  {
                    maximumFractionDigits: 1,
                    signDisplay: "always",
                    numberingSystem: "latn",
                  },
                ).format(change.percent),
              })}
        </span>
      )}
      <p className="price-caution">
        {tx(
          "Average of all reporting mandis in India, not your local mandi. Your price can be quite different.",
        )}
      </p>
      {lead && margin !== null && (
        <p className="msp-compare">
          {margin >= 0
            ? tx("{{v0}} above the government support price (MSP) of {{v1}}.", {
                v0: `${Math.round(margin)}%`,
                v1: rupees(support.msp, language),
              })
            : tx(
                "{{v0}} below the government support price (MSP) of {{v1}}. Ask about procurement centres near you.",
                {
                  v0: `${Math.round(-margin)}%`,
                  v1: rupees(support.msp, language),
                },
              )}
        </p>
      )}
    </article>
  );
}

export function MarketPrices({ result, crop, compact = false }) {
  const { tx, language, formatDate } = useProductLocale();
  const support = supportPriceFor(crop);
  const national = result.national || null;
  const nationalFirst = national && result.lead === "national";
  if (result.status === "idle") return null;
  if (result.status === "loading")
    return <p role="status">{tx("Finding mandi prices…")}</p>;
  if (result.status === "error")
    return (
      <p className="inline-note" role="status">
        {tx(result.message)}
      </p>
    );
  if (!result.markets?.length)
    return (
      <div className="market-prices">
        {national && (
          <NationalPrice national={national} support={support} lead />
        )}
        <p className="inline-note">
          {result.status === "not_configured"
            ? tx("Mandi prices are not connected in this deployment.")
            : national
              ? tx(
                  "No mandi in your area has a saved price for this crop from the last 30 days.",
                )
              : tx(
                  "No mandi reported this crop in your area in the last 30 days. Try your state or a nearby district.",
                )}
        </p>
      </div>
    );
  const [best, ...others] = result.markets;
  const margin =
    support && support.unit === "quintal"
      ? ((best.latest.modal_price - support.msp) / support.msp) * 100
      : null;
  return (
    <div className="market-prices">
      {result.status === "stale" && (
        <p className="inline-note">
          {tx(
            "The price service is not responding. Showing the last saved prices.",
          )}
        </p>
      )}
      {nationalFirst && (
        <NationalPrice national={national} support={support} lead />
      )}
      {nationalFirst && !compact && (
        <h3 className="price-older">
          {tx("Last price from your area, {{v0}}", {
            v0: formatDate(best.latest.date),
          })}
        </h3>
      )}
      {(!nationalFirst || !compact) && (
        <article className={`price-hero ${nationalFirst ? "secondary" : ""}`}>
          <span className="price-place">
            {best.market}, {best.district}
            {result.scope === "state" && result.district
              ? ` · ${tx("nearest reporting mandis in your state")}`
              : ""}
          </span>
          <strong className="price-value">
            {rupees(best.latest.modal_price, language)}{" "}
            <small>{tx("per quintal")}</small>
          </strong>
          <span className="price-sub">
            {tx("About {{v0}} per kg", {
              v0: rupees(best.latest.modal_price / 100, language),
            })}{" "}
            ·{" "}
            {best.latest.age_days === 0
              ? tx("Reported today")
              : tx("Reported {{v0}}", { v0: formatDate(best.latest.date) })}
          </span>
          <Trend change={best.change_7d} />
          <Spark series={best.series} />
          {!nationalFirst && margin !== null && (
            <p className="msp-compare">
              {margin >= 0
                ? tx(
                    "{{v0}} above the government support price (MSP) of {{v1}}.",
                    {
                      v0: `${Math.round(margin)}%`,
                      v1: rupees(support.msp, language),
                    },
                  )
                : tx(
                    "{{v0}} below the government support price (MSP) of {{v1}}. Ask about procurement centres near you.",
                    {
                      v0: `${Math.round(-margin)}%`,
                      v1: rupees(support.msp, language),
                    },
                  )}
            </p>
          )}
        </article>
      )}
      {!nationalFirst && national && !compact && (
        <NationalPrice national={national} support={support} lead={false} />
      )}
      {!compact && others.length > 0 && (
        <ul className="market-list">
          {others.map((row) => (
            <li key={`${row.market}:${row.variety}:${row.grade}`}>
              <span>
                <strong>{row.market}</strong>
                <small>
                  {row.district} · {tx(row.variety)} ·{" "}
                  {formatDate(row.latest.date)}
                </small>
              </span>
              <span className="market-list-price">
                {rupees(row.latest.modal_price, language)}
                <Trend change={row.change_7d} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <details className="evidence-details">
          <summary>{tx("Source and limits")}</summary>
          <ul>
            {result.sources.map((source) => (
              <li key={source.url}>{source.name}</li>
            ))}
            {result.limitations.map((text) => (
              <li key={text}>{tx(text)}</li>
            ))}
            <li>
              {tx(
                "Prices are modal (most common) wholesale prices in rupees per quintal (100 kg).",
              )}
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}

export function MarketView({ workspace: w }) {
  const { tx, language } = useProductLocale();
  const active =
    w.cycles?.find((cycle) => cycle.status === "active") || w.cycles?.[0];
  const [crop, setCrop] = useState(active?.crop_id || ""),
    [location, setLocation] = useState(() =>
      locationFromProfile(w.farmer || {}),
    );
  const [query, setQuery] = useState({
    crop: active?.crop_id || "",
    state: location.state,
    district: location.district,
  });
  const result = useMarketPrices(query);
  // The farmer's crop and place can arrive after this screen opens. Fill them
  // in once, unless the farmer has already chosen something here.
  const known = active?.crop_id || "",
    home = locationFromProfile(w.farmer || {});
  useEffect(() => {
    if (!known && !home.state) return;
    setCrop((value) => value || known);
    setLocation((value) => (value.state ? value : home));
    setQuery((value) =>
      value.crop
        ? value
        : {
            crop: known,
            state: value.state || home.state,
            district: value.district || home.district,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, home.state, home.district]);
  return (
    <>
      <header className="product-page-heading">
        <div>
          <h1>{tx("Mandi prices")}</h1>
          <p>
            {tx(
              "Recent wholesale prices from government market records. Your actual offer depends on quality and buyer.",
            )}
          </p>
        </div>
        <Store size={30} />
      </header>
      <section className="product-card">
        <form
          className="market-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery({
              crop,
              state: location.state,
              district: location.district,
            });
          }}
        >
          <CropPicker
            value={crop}
            required={false}
            onChange={(row) => setCrop(row?.id || "")}
          />
          <IndiaLocationPicker value={location} onChange={setLocation} />
          <button
            className="button primary large"
            disabled={!crop || !location.state}
          >
            {tx("Show prices")} <ArrowRight size={18} />
          </button>
        </form>
        {(!query.crop || !query.state) && (
          <p className="inline-note">
            {tx("Choose your crop and state to see recent mandi prices.")}
          </p>
        )}
        <MarketPrices result={result} crop={query.crop} />
      </section>
      <section className="product-card" id="msp-reference">
        <h2>{tx("Government support prices (MSP)")}</h2>
        <p>
          {tx("Official publication records \xB7 verified")}{" "}
          {supportPrices.lastUpdated}
          {tx(
            ". These are reference prices, not live market offers. Check the crop, product basis, unit and year.",
          )}
        </p>
        <details>
          <summary>{tx("View all support-price records")}</summary>
          <dl className="support-price-list">
            {Object.entries(supportPrices.crops).map(([name, row]) => (
              <div key={name}>
                <dt>
                  {tx(findCropByName(name)?.label || name)} · {tx(row.variety)}{" "}
                  {row.product_basis
                    ? tx("\xB7 {{v0}}", {
                        v0: tx(
                          PRICE_BASIS[row.product_basis] || row.product_basis,
                        ),
                      })
                    : ""}
                </dt>
                <dd>
                  {rupees(row.msp, language)} / {row.unit} · {row.year} ·{" "}
                  {row.price_type}{" "}
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tx("Official source")}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </>
  );
}
