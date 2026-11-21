import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GuidesView } from "./GuidesView";

test("the guide library opens on the crop the farmer grows when it has guides", () => {
  render(
    <GuidesView
      workspace={{ cycles: [{ crop_id: "potato", status: "active" }] }}
    />,
  );
  expect(screen.getByRole("button", { name: "Potato" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("region", { name: "Late blight (potato)" }),
  ).toHaveTextContent(/spread quickly/);
});

test("without a matching crop it starts on rice and any crop can be picked", () => {
  render(
    <GuidesView
      workspace={{ cycles: [{ crop_id: "mustard", status: "active" }] }}
    />,
  );
  expect(screen.getByRole("button", { name: "Rice" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("region", { name: "Rice blast" })).toHaveTextContent(
    /Keep water standing in the field/,
  );
  expect(
    screen
      .getAllByRole("button")
      .slice(0, 5)
      .map((node) => node.textContent),
  ).toEqual(["Rice", "Wheat", "Cotton", "Sugarcane", "Maize"]);
  fireEvent.click(screen.getByRole("button", { name: "Grapes" }));
  expect(screen.getByRole("button", { name: "Rice" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen
      .getAllByRole("region")
      .map((node) => node.getAttribute("aria-label")),
  ).toEqual(expect.arrayContaining([expect.stringMatching(/grape/i)]));
  // Every card ends with the two general steps; the helpline is one tap away.
  expect(screen.getAllByText(/before any spraying/).length).toBeGreaterThan(1);
  expect(
    screen.getByRole("link", { name: /Kisan Call Centre/ }),
  ).toHaveAttribute("href", "tel:18001801551");
  expect(screen.getByText(/await review by an agronomist/)).toBeInTheDocument();
});
