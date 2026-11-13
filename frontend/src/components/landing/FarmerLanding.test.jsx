import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FarmerLanding } from "./FarmerLanding";

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

test("the landing page leads with voice help and a direct sign-in", () => {
  render(<FarmerLanding />);
  expect(
    screen.getByRole("heading", { level: 1, name: /Your farming helper/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/app/today",
  );
  for (const link of screen.getAllByRole("link", { name: /Start free/ }))
    expect(link).toHaveAttribute("href", "/app/today");
  expect(
    screen.getByRole("heading", { name: "Ask by voice" }),
  ).toBeInTheDocument();
  // English needs no language download.
  expect(fetch).not.toHaveBeenCalled();
});

test("choosing a language translates the page and remembers the choice", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      "Your farming helper that listens.": "आपका खेती सहायक, जो सुनता है।",
      "Sign in": "साइन इन करें",
    }),
  });
  render(<FarmerLanding />);
  fireEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { level: 1, name: /आपका खेती सहायक/ }),
    ).toBeInTheDocument(),
  );
  expect(fetch.mock.calls[0][0]).toMatch(/^\/locales\/workspace\/hi\.json\?v=/);
  expect(screen.getByRole("button", { name: "हिन्दी" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("link", { name: "साइन इन करें" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("krishyak_language")).toBe("hi");
  expect(document.documentElement.lang).toBe("hi-IN");
});
