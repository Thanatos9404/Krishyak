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

test("without a matching crop it starts on tomato and any crop can be picked", () => {
  render(
    <GuidesView
      workspace={{ cycles: [{ crop_id: "wheat", status: "active" }] }}
    />,
  );
  expect(screen.getByRole("button", { name: "Tomato" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen
      .getAllByRole("button")
      .slice(0, 4)
      .map((node) => node.textContent),
  ).toEqual(["Tomato", "Potato", "Maize", "Capsicum"]);
  fireEvent.click(screen.getByRole("button", { name: "Grapes" }));
  expect(screen.getByRole("button", { name: "Tomato" })).toHaveAttribute(
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
