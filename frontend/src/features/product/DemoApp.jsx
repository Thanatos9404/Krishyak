"use client";
import { useEffect, useState } from "react";
import { ArrowRight, IndianRupee, MapPin } from "lucide-react";
import { ProductLocaleProvider, useProductLocale } from "./ProductLocale";
import { farmApi } from "../farms/api";
import { ProductShell } from "../../components/product/ProductShell";
import { CalendarCard } from "../../components/product/FieldAlerts";
import {
  FieldNumbers,
  WeekAhead,
} from "../../components/product/FieldDashboard";
import { rupees } from "../../components/product/MarketView";
import { cropLabel, findCrop } from "./crops";
import { SOILS } from "./soils";

// The example field is fixed; everything shown for it is computed live by the
// same code a farmer's own field uses (district records, rain archive,
// forecast, prices). No account is read or written.
function Demo() {
  const { tx, formatDate } = useProductLocale();
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    farmApi("/example/field", {
      signal: controller.signal,
      retry: false,
      timeoutMs: 45000,
    })
      .then((data) => setState({ status: "ready", data }))
      .catch((error) => {
        if (!error.cancelled) setState({ status: "unavailable" });
      });
    return () => controller.abort();
  }, []);
  const shell = { farmer: null, plots: [], offline: false, pending: 0 };
  const data = state.data;
  const field = data?.example;
  const view = {
    farmer: field ? { district: field.district, state: field.state } : {},
    consents: ["agronomic_analysis", "location_processing"],
    selected: null,
    offline: false,
    busy: false,
  };
  const price = data?.report.price;
  return (
    <ProductShell workspace={shell} pathname="/demo">
      <section className="demo-notice" role="status">
        <strong>{tx("Example field")}</strong>
        <p>
          {tx(
            "The weather, rain record, prices and district forecast below are real and current. The field itself is an example, not a real farm.",
          )}
        </p>
        <a className="button primary" href="/app/today">
          {tx("Register my farm")} <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>
      {state.status === "loading" && (
        <div className="workspace-loading" role="status">
          <span className="loading-leaf" />
          <p>{tx("Working out the example field…")}</p>
        </div>
      )}
      {state.status === "unavailable" && (
        <section className="dash-empty">
          <p>
            {tx(
              "The example field could not be loaded just now. You can still register your own farm.",
            )}
          </p>
        </section>
      )}
      {state.status === "ready" && (
        <>
          <header className="home-greeting">
            <span className="home-date">
              <MapPin size={16} aria-hidden="true" />{" "}
              {[field.village, field.district, field.state].join(", ")}
            </span>
            <h1>
              {tx("A {{v0}} field, as Krishyak shows it", {
                v0: cropLabel(findCrop(field.crop_id), tx),
              })}
            </h1>
            <p>
              {tx(
                "{{v0}} hectare, tubewell water, {{v1}} soil, sown on {{v2}}.",
                {
                  v0: field.area_hectares,
                  v1: tx(SOILS[field.soil_type]),
                  v2: formatDate(field.sowing_date),
                },
              )}
            </p>
          </header>
          <FieldNumbers
            workspace={view}
            report={{ status: "ready", data: data.report }}
            reportHref={null}
          />
          <WeekAhead
            workspace={view}
            outlook={{ status: "ready", data: data.outlook }}
          />
          <CalendarCard workspace={view} plan={data.calendar} />
          {price && (
            <section className="product-card demo-price">
              <h2>
                <IndianRupee size={22} aria-hidden="true" />{" "}
                {tx("Price used for the profit estimate")}
              </h2>
              <p className="dash-value">
                {rupees(price.per_quintal)} <small>{tx("per quintal")}</small>
              </p>
              <p>
                {price.source === "mandi"
                  ? tx("Latest price at {{v0}} mandi on {{v1}}.", {
                      v0: price.market,
                      v1: formatDate(price.date),
                    })
                  : price.source === "national_average"
                    ? tx(
                        "All-India average on {{v0}}. A local mandi can differ.",
                        { v0: formatDate(price.date) },
                      )
                    : tx("Government support price (MSP) for {{v0}}.", {
                        v0: price.date,
                      })}
              </p>
            </section>
          )}
          <section className="demo-close">
            <h2>{tx("See this for your own field")}</h2>
            <p>
              {tx(
                "Registration takes four short steps. One tap on your location fills in the place, soil and rain record.",
              )}
            </p>
            <a className="button primary large" href="/app/today">
              {tx("Register my farm")}{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </section>
        </>
      )}
    </ProductShell>
  );
}

export default function DemoApp() {
  return (
    <ProductLocaleProvider>
      <Demo />
    </ProductLocaleProvider>
  );
}
