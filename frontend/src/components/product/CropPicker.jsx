import { useId, useState } from "react";
import { useProductLocale } from "../../features/product/ProductLocale";
import { findCrop, searchCrops } from "../../features/product/crops";

export function CropPicker({
  value = "",
  onChange,
  required = true,
  name = "crop_id",
}) {
  const { tx, language } = useProductLocale();
  const [search, setSearch] = useState("");
  const id = useId();
  const selected = findCrop(value);
  const matches = searchCrops(search, tx);
  // Keep the selected record visible while searching. Switching language never
  // changes the identity or silently discards a draft selection.
  const rows =
    selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  return (
    <div className="crop-picker" lang={language}>
      <label className="v2-label" htmlFor={`${id}-search`}>
        {tx("Search crops")}
        <input
          id={`${id}-search`}
          type="search"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tx("Search in your language")}
          aria-describedby={`${id}-results`}
        />
      </label>
      <label className="v2-label" htmlFor={`${id}-crop`}>
        {tx("Crop")}
        <select
          id={`${id}-crop`}
          name={name}
          required={required}
          value={selected?.id || ""}
          onChange={(event) => onChange(findCrop(event.target.value))}
        >
          <option value="">
            {required ? tx("Choose a crop") : tx("All crops")}
          </option>
          {rows.map((row) => (
            <option value={row.id} key={row.id}>
              {tx(row.label)}
            </option>
          ))}
        </select>
      </label>
      <p id={`${id}-results`} className="small muted" role="status">
        {matches.length
          ? tx("{{v0}} crops match your search", { v0: matches.length })
          : tx("No matching crops. Try another spelling.")}
      </p>
      {selected && (
        <div className="small muted">
          <p>{tx("Farm records: this crop can be saved to your field.")}</p>
          <p>
            {tx(
              "Photo suggestions: check Scan for this crop's current coverage.",
            )}
          </p>
          <p>
            {tx(
              "Market prices: available only when a source returns dated data.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
