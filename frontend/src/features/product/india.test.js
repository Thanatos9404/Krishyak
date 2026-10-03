import {
  normalizeIndianMobile,
  toHectares,
  fromHectares,
  formatArea,
} from "./india";
test.each(["9000000001", "90000 00001", "+91 90000 00001", "+919000000001"])(
  "formatted number %s is normalized",
  (value) => expect(normalizeIndianMobile(value)).toBe("+919000000001"),
);
test.each([
  "+19000000001",
  "5000000001",
  "09000000001",
  "919000000001",
  "900000000",
  "++919000000001",
])("invalid number %s is refused", (value) =>
  expect(() => normalizeIndianMobile(value)).toThrow(),
);
test("acre conversion is centralized, reversible and display avoids float noise", () => {
  expect(toHectares("1", "acre")).toBe(0.40468564224);
  expect(fromHectares(toHectares("2.5", "acre"), "acre")).toBeCloseTo(2.5, 9);
  expect(formatArea(toHectares("2.5", "acre"), "acre", "hi-IN")).toBe("2.5");
  for (const value of ["", "NaN", "Infinity", "-1", "501"])
    expect(() => toHectares(value, "hectare")).toThrow();
  expect(() => toHectares("1", "bigha")).toThrow();
});
