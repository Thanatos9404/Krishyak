import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SettingsView } from "./SettingsView";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../i18n", () => ({ useTranslation: () => ({ language: "en" }) }));
jest.mock("../../features/product/deferredProductFeature", () => ({
  deferredFeature: () => () => null,
}));

function workspace() {
  return {
    farmer: { id: "synthetic-owner" },
    consents: [],
    plots: [],
    busy: false,
    offline: false,
    offlineOpt: false,
    setNotice: jest.fn(),
    loadConsents: jest.fn().mockResolvedValue(),
    act: (action) => action().catch(() => {}),
  };
}

test("pending permission responds immediately without granting processing access", async () => {
  let finish;
  farmApi.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const w = workspace();
  render(<SettingsView workspace={w} />);
  const control = screen.getByRole("checkbox", { name: /Analyse my field/ });
  fireEvent.click(control);
  expect(control).toBeChecked();
  expect(control).toBeDisabled();
  expect(w.consents).toEqual([]);
  expect(w.setNotice).not.toHaveBeenCalled();
  await act(async () => finish({}));
});

test("failed permission save rolls the control back and never confirms success", async () => {
  farmApi.mockRejectedValue(new Error("Unavailable"));
  const w = workspace();
  render(<SettingsView workspace={w} />);
  const control = screen.getByRole("checkbox", { name: /Analyse my field/ });
  await act(async () => fireEvent.click(control));
  expect(control).not.toBeChecked();
  expect(control).toBeEnabled();
  expect(w.loadConsents).not.toHaveBeenCalled();
  expect(w.setNotice).not.toHaveBeenCalled();
});

test("confirmed permission remains checked only after server state refresh", async () => {
  farmApi.mockResolvedValue({});
  const w = workspace();
  w.loadConsents.mockImplementation(async () => {
    w.consents = ["agronomic_analysis"];
  });
  render(<SettingsView workspace={w} />);
  const control = screen.getByRole("checkbox", { name: /Analyse my field/ });
  await act(async () => fireEvent.click(control));
  expect(control).toBeChecked();
  expect(control).toBeEnabled();
  expect(w.setNotice).toHaveBeenCalledWith(
    "Your permission choice has been saved.",
  );
});
