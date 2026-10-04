import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AccountDetails from "./AccountDetails";
import { farmApi } from "./api";
jest.mock("./api", () => ({ farmApi: jest.fn() }));
beforeEach(() =>
  farmApi.mockImplementation(async (path) =>
    path === "/me" ? { farmer: { id: "owner" } } : { items: [] },
  ),
);
const props = {
  farmer: {
    display_name: "Farmer",
    state: "Historical state",
    district: "Old district",
  },
  language: "en",
  plots: [],
  consents: [],
  act: (action) => action(),
  onUpdated: jest.fn(),
};
test("saving a preferred name leaves a legacy location untouched", async () => {
  render(<AccountDetails {...props} />);
  fireEvent.change(screen.getByLabelText("Preferred name"), {
    target: { value: "Preferred farmer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save account details" }));
  await waitFor(() =>
    expect(farmApi).toHaveBeenCalledWith(
      "/me",
      expect.objectContaining({
        body: expect.objectContaining({ display_name: "Preferred farmer" }),
      }),
    ),
  );
  const body = farmApi.mock.calls.find(([path]) => path === "/me")[1].body;
  expect(body).not.toHaveProperty("state");
  expect(body).not.toHaveProperty("district_code");
});
test("a chosen location saves canonical names and numerical codes", async () => {
  render(<AccountDetails {...props} />);
  fireEvent.change(screen.getByLabelText("State or union territory"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("District"), {
    target: { value: "102" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save account details" }));
  await waitFor(() =>
    expect(farmApi).toHaveBeenCalledWith(
      "/me",
      expect.objectContaining({
        body: expect.objectContaining({
          state_code: 8,
          district_code: 102,
          state: "Rajasthan",
          district: "Jaipur",
        }),
      }),
    ),
  );
});
