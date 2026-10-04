import { cropCatalog, cropLabel, findCrop, searchCrops } from "./crops";
import fs from "node:fs";
import path from "node:path";
import pilot from "../../i18n/pilotLanguages.json";

test("record names and canonical IDs resolve to the same crop", () => {
  expect(findCrop("Tomato")).toBe(findCrop("tomato"));
  expect(findCrop("Gram")).toBe(findCrop("Chickpea"));
  expect(findCrop("Tur")).toBe(findCrop("Arhar"));
  expect(findCrop("unlisted")).toBeNull();
  expect(cropLabel({ crop: "Historical custom record" })).toBe(
    "Historical custom record",
  );
});

test("search uses the selected language and preserves English aliases", () => {
  const tx = (label) => (label === "Tomato" ? "टमाटर" : label);
  expect(searchCrops("टमा", tx).map((row) => row.id)).toEqual(["tomato"]);
  expect(searchCrops("  TOMATO ", tx).map((row) => row.id)).toEqual(["tomato"]);
  expect(searchCrops("Arhar", tx).map((row) => row.id)).toEqual(["pigeon_pea"]);
  expect(cropLabel({ crop_id: "tomato", crop: "Tomato" }, tx)).toBe("टमाटर");
  expect(searchCrops("nothing matching", tx)).toEqual([]);
});

test("India pilot priorities precede other record crops", () => {
  expect(cropCatalog.slice(0, 3).map((row) => row.id)).toEqual([
    "wheat",
    "rice",
    "mustard",
  ]);
});

test("every pilot pack has searchable native labels for every record crop", () => {
  for (const code of pilot.codes.filter((value) => value !== "en")) {
    const pack = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), `public/locales/workspace/${code}.json`),
        "utf8",
      ),
    );
    const tx = (label) => pack[label];
    const labels = cropCatalog.map((row) =>
      tx(row.label).normalize("NFKC").trim().toLocaleLowerCase(),
    );
    expect(new Set(labels).size).toBe(cropCatalog.length);
    for (const row of cropCatalog) {
      expect(typeof tx(row.label)).toBe("string");
      expect(tx(row.label)).not.toBe(row.label);
      expect(searchCrops(tx(row.label), tx).map((entry) => entry.id)).toContain(
        row.id,
      );
    }
  }
});
