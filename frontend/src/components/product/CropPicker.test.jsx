import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CropPicker } from "./CropPicker";

let mockLanguage = "hi";
jest.mock("../../features/product/ProductLocale", () => ({
  useProductLocale: () => ({
    language: mockLanguage,
    tx: (text, values = {}) => {
      const words = {
        Tomato: mockLanguage === "hi" ? "टमाटर" : "ٹماٹر",
        Wheat: "गेहूं",
      };
      return (words[text] || text).replace("{{v0}}", values.v0 ?? "");
    },
  }),
}));

test("native-language search selects a stable identity and keeps it across language changes", () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <CropPicker value="tomato" onChange={onChange} />,
  );
  expect(screen.getByLabelText("Crop", { exact: true })).toBe(
    screen.getByRole("combobox"),
  );
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "टमा" } });
  expect(screen.getByRole("option", { name: "टमाटर" })).toHaveValue("tomato");
  expect(
    screen.queryByRole("option", { name: "गेहूं" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "tomato" },
  });
  expect(onChange.mock.calls[0][0]).toMatchObject({
    id: "tomato",
    name: "Tomato",
  });
  mockLanguage = "ur";
  rerender(<CropPicker value="tomato" onChange={onChange} />);
  expect(screen.getByRole("combobox")).toHaveValue("tomato");
  expect(screen.getByRole("option", { name: "ٹماٹر" })).toBeInTheDocument();
});
