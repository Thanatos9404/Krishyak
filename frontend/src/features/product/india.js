export const ACRE_HECTARES = 0.40468564224;
export function normalizeIndianMobile(value) {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^[+0-9 ()-]+$/.test(value)
  )
    throw new Error("Enter a valid Indian mobile number.");
  let compact = value.replace(/[ ()-]/g, "");
  if (/^[6-9][0-9]{9}$/.test(compact)) compact = `+91${compact}`;
  if (!/^\+91[6-9][0-9]{9}$/.test(compact))
    throw new Error("Enter a valid Indian mobile number.");
  return compact;
}
// Hectares per unit. Guntha, cent and kanal have fixed legal sizes; a bigha
// differs between (and within) states, so the farmer confirms its size.
export const AREA_UNITS = {
  acre: ACRE_HECTARES,
  hectare: 1,
  guntha: ACRE_HECTARES / 40,
  cent: ACRE_HECTARES / 100,
  kanal: ACRE_HECTARES / 8,
  bigha: null,
};
const SQ_FT = 0.09290304;
// Widely used standard sizes only, in square metres. Elsewhere, ask.
export const BIGHA_SQUARE_METRES = {
  "West Bengal": 14400 * SQ_FT,
  Assam: 14400 * SQ_FT,
  Tripura: 14400 * SQ_FT,
  Rajasthan: 27225 * SQ_FT,
};
export function unitHectares(unit, bighaSquareMetres) {
  if (unit === "bigha") {
    const size = Number(bighaSquareMetres);
    if (!Number.isFinite(size) || size < 100 || size > 20000)
      throw new Error(
        "Enter how many square metres make one bigha in your area.",
      );
    return size / 10000;
  }
  if (!(unit in AREA_UNITS)) throw new Error("Choose an area unit.");
  return AREA_UNITS[unit];
}
export function toHectares(value, unit, bighaSquareMetres) {
  const number = Number(value);
  const converted = number * unitHectares(unit, bighaSquareMetres);
  if (!Number.isFinite(converted) || converted <= 0 || converted > 500)
    throw new Error("Enter a field area between zero and 500 hectares.");
  return Number(converted.toFixed(11));
}
export function fromHectares(value, unit, bighaSquareMetres) {
  return Number(value) / unitHectares(unit, bighaSquareMetres);
}
export function formatArea(value, unit, locale = "en-IN", bighaSquareMetres) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    numberingSystem: "latn",
  }).format(fromHectares(value, unit, bighaSquareMetres));
}
const PREFERENCE = "krishyak-area-unit";
// A per-device convenience only; records are always stored in hectares.
export function readAreaPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCE) || "null");
    if (saved && saved.unit in AREA_UNITS) {
      if (saved.unit === "bigha") unitHectares("bigha", saved.bigha);
      return saved;
    }
  } catch {
    /* Storage can be blocked; fall back to acres. */
  }
  return { unit: "acre", bigha: null };
}
export function saveAreaPreference(preference) {
  try {
    localStorage.setItem(PREFERENCE, JSON.stringify(preference));
  } catch {
    /* Preference is optional. */
  }
}
