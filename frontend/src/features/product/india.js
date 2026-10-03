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
export function toHectares(value, unit) {
  if (!["acre", "hectare"].includes(unit))
    throw new Error("Choose acres or hectares.");
  const number = Number(value);
  const converted = unit === "acre" ? number * ACRE_HECTARES : number;
  if (!Number.isFinite(converted) || converted <= 0 || converted > 500)
    throw new Error("Enter a field area between zero and 500 hectares.");
  return Number(converted.toFixed(11));
}
export function fromHectares(value, unit) {
  return unit === "acre" ? Number(value) / ACRE_HECTARES : Number(value);
}
export function formatArea(value, unit, locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    numberingSystem: "latn",
  }).format(fromHectares(value, unit));
}
