import React from "react";
import { act, render, screen } from "@testing-library/react";
import MandiPriceCard from "./MandiPriceCard";
import { fetchMandiPrices } from "../services/govApiService";

const mockTranslate = (key) => key;
jest.mock("../i18n", () => ({
  useTranslation: () => ({
    t: mockTranslate,
    languageInfo: { speechCode: "en-IN" },
  }),
}));
jest.mock("../services/govApiService", () => ({
  fetchMandiPrices: jest.fn(),
  formatIndianPrice: (value) => String(value),
}));
beforeEach(() => {
  fetchMandiPrices.mockReset();
  window.dispatchEvent(new Event("pageshow"));
});

test("full-document navigation cancels the outstanding market read", async () => {
  let finish;
  fetchMandiPrices.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { unmount } = render(<MandiPriceCard commodity="Tomato" />);
  const signal = fetchMandiPrices.mock.calls[0][1].signal;
  expect(signal.aborted).toBe(false);
  act(() => window.dispatchEvent(new Event("beforeunload")));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ success: false }));
  expect(screen.queryByText("mandi.fetchError")).toBeNull();
  unmount();
});

test("a stale result cannot replace the latest crop filter result", async () => {
  let finish;
  fetchMandiPrices
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ success: false });
  const { rerender } = render(<MandiPriceCard commodity="Tomato" />);
  const firstSignal = fetchMandiPrices.mock.calls[0][1].signal;
  rerender(<MandiPriceCard commodity="Wheat" />);
  expect(firstSignal.aborted).toBe(true);
  await screen.findByText("mandi.fetchError");
  await act(async () => finish({ success: true, prices: [] }));
  expect(screen.getByText("mandi.fetchError")).toBeTruthy();
});
