import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProductShell } from "./ProductShell";
import { useVoiceLauncher } from "../../features/product/voiceLauncher";

jest.mock("../../features/product/deferredProductFeature", () => ({
  deferredFeature: () =>
    function Deferred() {
      return <div role="dialog" aria-label="Voice mode stub" />;
    },
}));

const signedIn = {
  farmer: { id: "farmer-a", display_name: "Asha" },
  plots: [{ id: "field-a", name: "North field" }],
  selected: "field-a",
  setSelected: jest.fn(),
  consents: [],
  pending: 0,
  offline: false,
};

function OpenFromHome() {
  const open = useVoiceLauncher();
  return (
    <button type="button" onClick={open}>
      Home mic
    </button>
  );
}

test("signed-out visitors see sign-in without workspace navigation", () => {
  render(
    <ProductShell workspace={{ plots: [] }} pathname="/app/today">
      <h1>Sign in</h1>
    </ProductShell>,
  );
  expect(
    screen.queryByRole("navigation", { name: "Workspace navigation" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: /Ask Krishyak/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Home page" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("signed-in farmers get plain navigation and a voice button everywhere", () => {
  render(
    <ProductShell workspace={signedIn} pathname="/app/market">
      <OpenFromHome />
    </ProductShell>,
  );
  const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Home", "Plant check", "Mandi prices", "My fields", "More"]);
  expect(
    within(nav).getByRole("link", { name: "Mandi prices" }),
  ).toHaveAttribute("aria-current", "page");
  const mobile = screen.getByRole("navigation", {
    name: "Mobile workspace navigation",
  });
  expect(
    within(mobile).getByRole("button", { name: "Ask Krishyak" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Home mic" }));
  expect(
    screen.getByRole("dialog", { name: "Voice mode stub" }),
  ).toBeInTheDocument();
});

test("the connection banner appears only when something needs attention", () => {
  const { rerender } = render(
    <ProductShell workspace={signedIn} pathname="/app/today" />,
  );
  expect(screen.queryByText(/Offline/)).toBeNull();
  rerender(
    <ProductShell
      workspace={{ ...signedIn, offline: true }}
      pathname="/app/today"
    />,
  );
  expect(
    screen.getByText("Offline · showing saved records"),
  ).toBeInTheDocument();
});
