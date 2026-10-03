import { useProductLocale } from "../../features/product/ProductLocale";
import { fromHectares, toHectares } from "../../features/product/india";
export function AreaInput({
  value,
  onChange,
  unit,
  onUnitChange,
  label = "Field area",
  required = true,
}) {
  const { tx } = useProductLocale();
  return (
    <div className="area-input">
      <label className="v2-label">
        {tx(label)} ({unit === "acre" ? tx("acres") : tx("hectares")})
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0.0001"
          max={unit === "acre" ? fromHectares(500, "acre") : 500}
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
            if (value !== "") {
              try {
                onChange(
                  String(
                    Number(
                      fromHectares(toHectares(value, unit), next).toFixed(6),
                    ),
                  ),
                );
              } catch {
                /* Preserve invalid entry for native validation, never invent area. */
              }
            }
            onUnitChange(next);
          }}
        >
          <option value="acre">{tx("Acres")}</option>
          <option value="hectare">{tx("Hectares")}</option>
        </select>
      </label>
      <p className="small muted">
        {tx(
          "Choose the unit you use. Changing units keeps the same field area. A mapped boundary can provide an approximate area.",
        )}
      </p>
    </div>
  );
}
