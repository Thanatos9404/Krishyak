import catalog from "./indiaLocations.json";

export const states = catalog.states;
export const districts = catalog.districts;
export const normalizeLocation = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");
const aliases = { 8: ["Rajsthan", "राजस्थान"] };
const rowAliases = (row) => (row.state_code ? [] : aliases[row.code] || []);
const matchesName = (row, name) =>
  [row.name, row.local_name, ...rowAliases(row)].some(
    (word) => normalizeLocation(word) === normalizeLocation(name),
  );

export function locationFromProfile(profile = {}) {
  const state = states.find((row) =>
    profile.state_code
      ? row.code === profile.state_code
      : profile.state && matchesName(row, profile.state),
  );
  const district =
    state &&
    districts.find(
      (row) =>
        row.state_code === state.code &&
        (profile.district_code
          ? row.code === profile.district_code
          : profile.district && matchesName(row, profile.district)),
    );
  return {
    state_code: state?.code || null,
    district_code: district?.code || null,
    state: state?.name || profile.state || "",
    district: district?.name || profile.district || "",
  };
}

export function searchLocations(rows, query, tx = (text) => text) {
  const term = normalizeLocation(query);
  return rows.filter(
    (row) =>
      !term ||
      [row.name, row.local_name, tx(row.name), ...rowAliases(row)].some(
        (word) => normalizeLocation(word).includes(term),
      ),
  );
}
