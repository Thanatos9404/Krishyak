import { formatLocalDate } from "./localDates";

test("calendar dates retain their day and show a readable Indian date", () => {
  expect(formatLocalDate("2026-09-01")).toBe("1 Sept 2026");
  expect(formatLocalDate("2026-09-01", "hi-IN")).toBe("1 सित॰ 2026");
});
test("UTC timestamps display the correct next day and time in India", () => {
  const utc = "2026-09-01T20:00:00Z";
  expect(formatLocalDate(utc, "en-IN", { time: true })).toBe(
    "2 Sept 2026, 1:30 am",
  );
  expect(utc).toBe("2026-09-01T20:00:00Z");
});
test.each([null, undefined, "", "2026-02-31", "not a date"])(
  "invalid or absent date %s never becomes a current-day claim",
  (value) => {
    expect(formatLocalDate(value)).toBe("—");
  },
);
test("Urdu dates use the selected locale without modifying the stored ISO date", () => {
  const iso = "2026-09-01";
  expect(formatLocalDate(iso, "ur-IN")).toBe(
    new Intl.DateTimeFormat("ur-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`)),
  );
  expect(formatLocalDate(iso, "ur-IN")).not.toBe(formatLocalDate(iso, "en-IN"));
  expect(iso).toBe("2026-09-01");
});
