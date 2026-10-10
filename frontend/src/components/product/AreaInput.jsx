import { useEffect, useState } from "react";
import { useProductLocale } from "../../features/product/ProductLocale";
import {
  BIGHA_SQUARE_METRES,
  formatArea,
  fromHectares,
  readAreaPreference,
  saveAreaPreference,
  toHectares,
} from "../../features/product/india";

export const UNIT_NAMES = {
  acre: "acres",
  hectare: "hectares",
  guntha: "guntha",
  cent: "cents",
  kanal: "kanal",
  bigha: "bigha",
};

// The farmer's preferred unit for this device. Records stay in hectares.
export function useAreaUnit() {
  const [preference, setPreference] = useState({ unit: "acre", bigha: null });
  useEffect(() => setPreference(readAreaPreference()), []);
  const update = (next) => {
    setPreference(next);
    saveAreaPreference(next);
  };
  return [preference, update];
}

export function useAreaText() {
  const { tx, language } = useProductLocale();
  const [preference] = useAreaUnit();
  return (hectares) => {
    if (hectares === null || hectares === undefined)
      return tx("Area not recorded");
    try {
      return `${formatArea(hectares, preference.unit, language === "en" ? "en-IN" : language, preference.bigha)} ${tx(UNIT_NAMES[preference.unit])}`;
    } catch {
      return `${formatArea(hectares, "acre")} ${tx("acres")}`;
    }
  };
}

export function AreaInput({
  value,
  onChange,
  unit,
  onUnitChange,
  bigha,
  onBighaChange,
  state,
  label = "Field area",
  required = true,
}) {
  const { tx } = useProductLocale();
  const suggested = BIGHA_SQUARE_METRES[state];
  const convert = (next, nextBigha) => {
    if (value === "") return;
    try {
      onChange(
        String(
          Number(
            fromHectares(
              toHectares(value, unit, bigha),
              next,
              nextBigha,
            ).toFixed(6),
          ),
        ),
      );
    } catch {
      /* Preserve the entry for native validation; never invent an area. */
    }
  };
  return (
    <div className="area-input">
      <label className="v2-label">
        {tx(label)} ({tx(UNIT_NAMES[unit])})
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0.0001"
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <label className="v2-label">
        {tx("Area unit")}
        <select
          value={unit}
          onChange={(event) => {
            const next = event.target.value;
            const nextBigha =
              next === "bigha" ? bigha || suggested || null : bigha;
            if (next === "bigha" && !bigha && suggested)
              onBighaChange?.(Math.round(suggested));
            if (next !== "bigha" || nextBigha) convert(next, nextBigha);
            onUnitChange(next);
          }}
        >
          <option value="acre">{tx("Acres")}</option>
          <option value="hectare">{tx("Hectares")}</option>
          <option value="bigha">{tx("Bigha")}</option>
          <option value="guntha">{tx("Guntha (40 = 1 acre)")}</option>
          <option value="kanal">{tx("Kanal (8 = 1 acre)")}</option>
          <option value="cent">{tx("Cent (100 = 1 acre)")}</option>
        </select>
      </label>
      {unit === "bigha" && (
        <label className="v2-label">
          {tx("One bigha in your area (square metres)")}
          <input
            type="number"
            inputMode="numeric"
            min="100"
            max="20000"
            required
            value={bigha || ""}
            aria-describedby="bigha-hint"
            onChange={(event) =>
              onBighaChange?.(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </label>
      )}
      {unit === "bigha" && (
        <small id="bigha-hint" className="field-hint">
          {suggested
            ? tx(
                "Common size in your state. Change it if your village uses a different bigha.",
              )
            : tx(
                "Bigha size differs between places. Check your land record or ask your patwari.",
              )}
        </small>
      )}
      <p className="small muted">
        {tx(
          "Choose the unit you use. Changing units keeps the same field area. A mapped boundary can provide an approximate area.",
        )}
      </p>
    </div>
  );
}
