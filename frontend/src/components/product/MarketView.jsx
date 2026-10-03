import { useProductLocale } from "../../features/product/ProductLocale";
import { useState } from "react";
import { Store } from "lucide-react";
import { deferredFeature } from "../deferredFeature";
import supportPrices from "../../data/msp_data.json";
import { I18nProvider } from "../../i18n";
const MandiPriceCard = deferredFeature(() => import("../MandiPriceCard"));
const MSPRateCard = deferredFeature(() => import("../MSPRateCard"));
export function MarketView({ workspace: w }) {
  const { tx, language } = useProductLocale();
  const [commodity, setCommodity] = useState(w.cycles[0]?.crop || ""),
    [state, setState] = useState(w.farmer?.state || ""),
    [district, setDistrict] = useState(w.farmer?.district || "");
  const [filters, setFilters] = useState({
    commodity: commodity || null,
    state: state || null,
    district: district || null,
  });
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">{tx("KNOW THE MARKET CONTEXT")}</span>
          <h1>{tx("Prices with a place and a date.")}</h1>
          <p>
            {tx(
              "Compare reported mandi prices and reference MSP. Actual offers can differ.",
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
            setFilters({
              commodity: commodity.trim() || null,
              state: state.trim() || null,
              district: district.trim() || null,
            });
          }}
        >
          <label className="v2-label">
            {tx("Crop")}
            <input
              value={commodity}
              onChange={(event) => setCommodity(event.target.value)}
              placeholder={tx("e.g. Tomato")}
              maxLength={100}
            />
          </label>
          <label className="v2-label">
            {tx("State")}
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder={tx("e.g. Maharashtra")}
              maxLength={100}
            />
          </label>
          <label className="v2-label">
            {tx("District")}
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder={tx("e.g. Nashik")}
              maxLength={100}
            />
          </label>
          <button className="button primary">
            {tx("Find reported prices")}
          </button>
        </form>
      </section>
      <div className="legacy-tools market-results">
        <I18nProvider preferredLanguage={language}>
          <MandiPriceCard {...filters} />
          <MSPRateCard primaryCrop={filters.commodity} />
        </I18nProvider>
      </div>
      <p className="status-panel">
        {tx(
          "Check the reported date, unit, variety and market. Missing data is shown as unavailable. A reference price is not a guaranteed selling price.",
        )}
      </p>
      <section className="product-card" id="msp-reference">
        <h2>{tx("Published support prices")}</h2>
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
            {Object.entries(supportPrices.crops).map(([crop, row]) => (
              <div key={crop}>
                <dt>
                  {crop} · {row.variety}{" "}
                  {row.product_basis
                    ? tx("\xB7 {{v0}}", {
                        v0: row.product_basis,
                      })
                    : ""}
                </dt>
                <dd>
                  ₹{row.msp.toLocaleString("en-IN")} / {row.unit} · {row.year} ·{" "}
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
