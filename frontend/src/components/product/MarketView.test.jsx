import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarketView } from "./MarketView";
jest.mock("../../features/product/ProductLocale", () => ({
  useProductLocale: () => ({
    language: "hi",
    tx: (text) =>
      ({ Maharashtra: "महाराष्ट्र", Nashik: "नाशिक" })[text] || text,
  }),
}));
jest.mock("../../i18n", () => ({ I18nProvider: ({ children }) => children }));
jest.mock("../deferredFeature", () => ({
  deferredFeature: () =>
    function Deferred(props) {
      return Object.hasOwn(props, "state") ? (
        <output data-testid="market-query">{JSON.stringify(props)}</output>
      ) : null;
    },
}));
test("translated market choices submit canonical provider names and clear a district when its state changes", () => {
  render(
    <MarketView
      workspace={{ cycles: [], farmer: { state_code: 8, district_code: 102 } }}
    />,
  );
  fireEvent.change(screen.getByLabelText("State or union territory"), {
    target: { value: "27" },
  });
  expect(screen.getByLabelText("District")).toHaveValue("");
  expect(screen.getByRole("option", { name: "महाराष्ट्र" })).toHaveValue("27");
  fireEvent.change(screen.getByLabelText("Search districts"), {
    target: { value: "नाशिक" },
  });
  fireEvent.change(screen.getByLabelText("District"), {
    target: { value: "487" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find reported prices" }));
  expect(JSON.parse(screen.getByTestId("market-query").textContent)).toEqual({
    commodity: null,
    state: "Maharashtra",
    district: "Nashik",
  });
});
