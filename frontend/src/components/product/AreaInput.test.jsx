import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AreaInput } from "./AreaInput";
function Entry() {
  const [value, setValue] = useState("1"),
    [unit, setUnit] = useState("acre");
  return (
    <AreaInput
      value={value}
      onChange={setValue}
      unit={unit}
      onUnitChange={setUnit}
    />
  );
}
test("farmers can enter acres and switching to hectares preserves area", () => {
  render(<Entry />);
  expect(screen.getByLabelText("Field area (acres)")).toHaveValue(1);
  fireEvent.change(screen.getByLabelText("Area unit"), {
    target: { value: "hectare" },
  });
  expect(screen.getByLabelText("Field area (hectares)")).toHaveValue(0.404686);
  fireEvent.change(screen.getByLabelText("Area unit"), {
    target: { value: "acre" },
  });
  expect(screen.getByLabelText("Field area (acres)").valueAsNumber).toBeCloseTo(
    1,
    5,
  );
});
