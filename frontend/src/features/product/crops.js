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
// A crop named by any of its names ("Gram", "Bajra", "Tur"), for data that
// carries a name rather than a catalogue id.
export function findCropByName(name) {
  const key = String(name || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();
  if (!key) return null;
  return (
    catalog.find((row) =>
      [
        row.id,
        row.name,
        row.label,
        row.market_commodity,
        ...(row.aliases || []),
        ...(row.planning_names || []),
      ]
        .filter(Boolean)
        .some((value) => value.normalize("NFKC").toLocaleLowerCase() === key),
    ) || null
  );
}
// What a crop cycle's status means to a farmer.
export const CYCLE_STATUS = {
  planned: "Planned",
  active: "Growing now",
  completed: "Harvested",
  cancelled: "Cancelled",
};
export function cycleStatus(status, tx = (text) => text) {
  return CYCLE_STATUS[status] ? tx(CYCLE_STATUS[status]) : status || "";
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
