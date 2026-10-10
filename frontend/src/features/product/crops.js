import catalog from "./cropCatalog.json";

export const cropCatalog = catalog;
export function findCrop(value) {
  if (!value) return null;
  const key =
    typeof value === "object" ? value.crop_id || value.crop || value.id : value;
  return (
    catalog.find((row) => row.id === key || row.aliases.includes(key)) || null
  );
}
export function cropLabel(value, tx = (text) => text) {
  const row = findCrop(value);
  return row
    ? tx(row.label)
    : (typeof value === "object" ? value?.crop : value) || "";
}
export function searchCrops(query, tx = (text) => text) {
  const term = query.normalize("NFKC").trim().toLocaleLowerCase();
  return catalog.filter((row) =>
    [tx(row.label), row.label, ...row.aliases].some((label) =>
      label.normalize("NFKC").toLocaleLowerCase().includes(term),
    ),
  );
}
