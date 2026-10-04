import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { IndiaLocationPicker } from "./IndiaLocationPicker";
import {
  locationFromProfile,
  states,
  districts,
  searchLocations,
} from "../../features/product/indiaLocations";

let mockLanguage = "hi";
jest.mock("../../features/product/ProductLocale", () => ({
  useProductLocale: () => ({
    language: mockLanguage,
    tx: (text) =>
      ({
        Rajasthan: mockLanguage === "hi" ? "राजस्थान" : "راجستھان",
        Jaipur: mockLanguage === "hi" ? "जयपुर" : "جے پور",
      })[text] || text,
  }),
}));
beforeEach(() => {
  mockLanguage = "hi";
});

test("native search and a language change preserve the selected stable IDs", () => {
  const value = locationFromProfile({ state: "Rajsthan", district: "JAIPUR" });
  const onChange = jest.fn();
  const { rerender } = render(
    <IndiaLocationPicker value={value} onChange={onChange} />,
  );
  fireEvent.change(
    screen.getByLabelText("Search states and union territories"),
    { target: { value: "राजस्था" } },
  );
  expect(screen.getByLabelText("State or union territory")).toHaveValue("8");
  expect(screen.getByRole("option", { name: "राजस्थान" })).toHaveValue("8");
  fireEvent.change(screen.getByLabelText("Search districts"), {
    target: { value: "जय" },
  });
  expect(screen.getByLabelText("District")).toHaveValue("102");
  mockLanguage = "ur";
  rerender(<IndiaLocationPicker value={value} onChange={onChange} />);
  expect(screen.getByRole("option", { name: "راجستھان" })).toHaveValue("8");
  expect(screen.getByRole("option", { name: "جے پور" })).toHaveValue("102");
  expect(onChange).not.toHaveBeenCalled();
});

test("changing or clearing a state clears its previous district", () => {
  const onChange = jest.fn();
  render(
    <IndiaLocationPicker
      value={locationFromProfile({ state_code: 8, district_code: 102 })}
      onChange={onChange}
    />,
  );
  fireEvent.change(screen.getByLabelText("State or union territory"), {
    target: { value: "27" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    state_code: 27,
    state: "Maharashtra",
    district_code: null,
    district: "",
  });
  fireEvent.change(screen.getByLabelText("State or union territory"), {
    target: { value: "" },
  });
  expect(onChange).toHaveBeenLastCalledWith({
    state_code: null,
    state: "",
    district_code: null,
    district: "",
  });
});

test("legacy names remain visible until an explicit replacement and district needs a state", () => {
  render(
    <IndiaLocationPicker
      value={locationFromProfile({
        state: "Historical state",
        district: "Historical district",
      })}
      onChange={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("State or union territory")).toHaveValue(
    "legacy",
  );
  expect(screen.getByLabelText("District")).toBeDisabled();
  expect(
    screen.getByRole("option", { name: "Historical district" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Your saved location is preserved.",
  );
});

test("every official district resolves only with its parent, including repeated names", () => {
  for (const row of districts) {
    const parent = states.find((state) => state.code === row.state_code);
    expect(
      locationFromProfile({ state: parent.name, district: row.name })
        .district_code,
    ).toBe(row.code);
  }
  expect(searchLocations(states, " Rajsthan ")[0].code).toBe(8);
  expect(searchLocations(states, "महाराष्ट्र")[0].code).toBe(27);
  expect(
    locationFromProfile({ state_code: 8, district_code: 487 }).district_code,
  ).toBeNull();
});
