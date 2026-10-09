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

test("Indian area units convert through hectares and bigha needs a confirmed size", () => {
  const {
    BIGHA_SQUARE_METRES,
    readAreaPreference,
    saveAreaPreference,
  } = require("./india");
  expect(toHectares("40", "guntha")).toBeCloseTo(toHectares("1", "acre"), 9);
  expect(toHectares("8", "kanal")).toBeCloseTo(toHectares("1", "acre"), 9);
  expect(toHectares("100", "cent")).toBeCloseTo(toHectares("1", "acre"), 9);
  expect(() => toHectares("1", "bigha")).toThrow(/square metres/);
  const westBengal = BIGHA_SQUARE_METRES["West Bengal"];
  expect(westBengal).toBeCloseTo(1337.8, 0);
  expect(toHectares("3", "bigha", westBengal)).toBeCloseTo(0.4013, 3);
  expect(
    fromHectares(toHectares("2", "bigha", 2529), "bigha", 2529),
  ).toBeCloseTo(2, 9);
  saveAreaPreference({ unit: "bigha", bigha: 1338 });
  expect(readAreaPreference()).toEqual({ unit: "bigha", bigha: 1338 });
  saveAreaPreference({ unit: "bigha", bigha: 5 });
  expect(readAreaPreference()).toEqual({ unit: "acre", bigha: null });
});
