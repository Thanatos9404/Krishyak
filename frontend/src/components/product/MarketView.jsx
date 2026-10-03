import { useState } from "react";
import { Store } from "lucide-react";
import { deferredFeature } from "../deferredFeature";
import supportPrices from "../../data/msp_data.json";
const MandiPriceCard = deferredFeature(() => import("../MandiPriceCard"));
const MSPRateCard = deferredFeature(() => import("../MSPRateCard"));
export function MarketView({ workspace: w }) {
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
          <span className="eyebrow">KNOW THE MARKET CONTEXT</span>
          <h1>Prices with a place and a date.</h1>
          <p>
            Compare reported mandi prices and reference MSP. Actual offers can
            differ.
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
            Crop
            <input
              value={commodity}
              onChange={(event) => setCommodity(event.target.value)}
              placeholder="e.g. Tomato"
              maxLength={100}
            />
          </label>
          <label className="v2-label">
            State
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder="e.g. Maharashtra"
              maxLength={100}
            />
          </label>
          <label className="v2-label">
            District
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="e.g. Nashik"
              maxLength={100}
            />
          </label>
          <button className="button primary">Find reported prices</button>
        </form>
      </section>
      <div className="legacy-tools market-results">
        <MandiPriceCard {...filters} />
        <MSPRateCard primaryCrop={filters.commodity} />
      </div>
      <p className="status-panel">
        Check the reported date, unit, variety and market. Missing data is shown
        as unavailable. A reference price is not a guaranteed selling price.
      </p>
      <section className="product-card" id="msp-reference">
        <h2>Published support prices</h2>
        <p>
          Official publication records · verified {supportPrices.lastUpdated}.
          These are reference prices, not live market offers. Check the crop,
          product basis, unit and year.
        </p>
        <details>
          <summary>View all support-price records</summary>
          <dl className="support-price-list">
            {Object.entries(supportPrices.crops).map(([crop, row]) => (
              <div key={crop}>
                <dt>
                  {crop} · {row.variety}{" "}
                  {row.product_basis ? `· ${row.product_basis}` : ""}
                </dt>
                <dd>
                  ₹{row.msp.toLocaleString("en-IN")} / {row.unit} · {row.year} ·{" "}
                  {row.price_type}{" "}
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official source
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
