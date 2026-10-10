import { useId, useState } from "react";
import { useProductLocale } from "../../features/product/ProductLocale";
import {
  states,
  districts,
  searchLocations,
} from "../../features/product/indiaLocations";

export function IndiaLocationPicker({ value, onChange, disabled = false }) {
  const { tx, language } = useProductLocale();
  const id = useId();
  const [stateSearch, setStateSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const state = states.find((row) => row.code === value.state_code);
  const district = districts.find(
    (row) => row.code === value.district_code && row.state_code === state?.code,
  );
  const availableDistricts = districts.filter(
    (row) => row.state_code === state?.code,
  );
  const visible = (rows, search, selected) => {
    const result = searchLocations(rows, search, tx);
    return selected && !result.includes(selected)
      ? [selected, ...result]
      : result;
  };
  const legacyState = !state && value.state;
  const legacyDistrict = !district && value.district;
  return (
    <div className="india-location-picker" lang={language}>
      <label className="v2-label" htmlFor={`${id}-state-search`}>
        {tx("Search states and union territories")}
        <input
          id={`${id}-state-search`}
          type="search"
          maxLength={100}
          disabled={disabled}
          value={stateSearch}
          onChange={(event) => setStateSearch(event.target.value)}
          placeholder={tx("Search in your language")}
        />
      </label>
      <div className="v2-label">
        <label htmlFor={`${id}-state`}>{tx("State or union territory")}</label>
        <select
          id={`${id}-state`}
          name="state_code"
          disabled={disabled}
          value={state?.code || (legacyState ? "legacy" : "")}
          onChange={(event) => {
            const next = states.find(
              (row) => row.code === Number(event.target.value),
            );
            setDistrictSearch("");
            onChange({
              state_code: next?.code || null,
              state: next?.name || "",
              district_code: null,
              district: "",
            });
          }}
        >
          <option value="">
            {tx("Choose a state or union territory (optional)")}
          </option>
          {legacyState && <option value="legacy">{value.state}</option>}
          {visible(states, stateSearch, state).map((row) => (
            <option value={row.code} key={row.code}>
              {tx(row.name)}
            </option>
          ))}
        </select>
      </div>
      <label className="v2-label" htmlFor={`${id}-district-search`}>
        {tx("Search districts")}
        <input
          id={`${id}-district-search`}
          type="search"
          maxLength={100}
          disabled={disabled || !state}
          value={districtSearch}
          onChange={(event) => setDistrictSearch(event.target.value)}
          placeholder={tx("Search in your language")}
        />
      </label>
      <div className="v2-label">
        <label htmlFor={`${id}-district`}>{tx("District")}</label>
        <select
          id={`${id}-district`}
          name="district_code"
          disabled={disabled || !state}
          value={district?.code || (legacyDistrict ? "legacy" : "")}
          onChange={(event) => {
            const next = availableDistricts.find(
              (row) => row.code === Number(event.target.value),
            );
            onChange({
              ...value,
              district_code: next?.code || null,
              district: next?.name || "",
            });
          }}
        >
          <option value="">
            {state
              ? tx("Choose a district (optional)")
              : tx("Choose a state first")}
          </option>
          {legacyDistrict && <option value="legacy">{value.district}</option>}
          {visible(availableDistricts, districtSearch, district).map((row) => (
            <option value={row.code} key={row.code}>
              {tx(row.name)}
            </option>
          ))}
        </select>
      </div>
      {(legacyState || legacyDistrict) && (
        <p role="status" className="small muted">
          {tx(
            "Your saved location is preserved. Choose a listed location to update it, or clear the selection.",
          )}
        </p>
      )}
      <p className="small muted">
        {tx(
          "Location is optional. Directory names may change; this selection does not verify your address or field ownership.",
        )}
      </p>
    </div>
  );
}
