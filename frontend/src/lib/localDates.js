// UTC timestamps remain unchanged in storage. Calendar dates have no timezone.
export function formatLocalDate(
  value,
  locale = "en-IN",
  { time = false } = {},
) {
  if (value === null || value === undefined || value === "") return "—";
  const calendar =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(calendar ? `${value}T00:00:00Z` : value);
  if (
    !Number.isFinite(date.getTime()) ||
    (calendar && date.toISOString().slice(0, 10) !== value)
  )
    return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: calendar ? "UTC" : "Asia/Kolkata",
    ...(time && !calendar ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}
