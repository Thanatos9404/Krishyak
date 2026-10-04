import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ScanView } from "./ScanView";

jest.mock("../../features/farms/api", () => ({
  farmApi: () => new Promise(() => {}),
}));
jest.mock("../../features/product/deferredProductFeature", () => ({
  deferredFeature: () => () => null,
}));

const initial = { selected: "field-a", plot: {}, cycles: [], consents: [] };

test("late crop-cycle evidence preserves the crop explicitly chosen by the farmer", () => {
  const { rerender } = render(<ScanView workspace={initial} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Crop" }), {
    target: { value: "wheat" },
  });
  rerender(
    <ScanView workspace={{ ...initial, cycles: [{ crop: "Tomato" }] }} />,
  );
  expect(screen.getByRole("combobox", { name: "Crop" })).toHaveValue("wheat");
});

test("a new field uses its own crop cycle rather than the previous field choice", () => {
  const { rerender } = render(<ScanView workspace={initial} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Crop" }), {
    target: { value: "tomato" },
  });
  rerender(
    <ScanView
      workspace={{
        ...initial,
        selected: "field-b",
        cycles: [{ crop: "Wheat" }],
      }}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Crop" })).toHaveValue("wheat");
});
