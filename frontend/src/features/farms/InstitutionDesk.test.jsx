import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UsageDesk } from "./InstitutionDesk";
import { farmApi } from "./api";

jest.mock("./api", () => ({ farmApi: jest.fn() }));

const statement = (live) => ({
  billing: {
    live,
    currency: "INR",
    gst: "excluded",
    effective_from: "2026-11-01",
    farmers_pay: false,
  },
  prices: {
    verify_report: { name: "Krishyak Verify", price: 150 },
    fpo_workspace: { name: "FPO workspace", price: 4000 },
    programme_licence: { name: "Programme licence", price: 1200000 },
  },
  months: [
    {
      month: "2026-11",
      verify: {
        requested: 5,
        delivered: 3,
        waiting_for_farmer: 1,
        withdrawn: 1,
      },
      workspace: true,
      at_list_price: { verify: 450, workspace: 4000, total: 4450 },
    },
    {
      month: "2026-10",
      verify: {
        requested: 0,
        delivered: 0,
        waiting_for_farmer: 0,
        withdrawn: 0,
      },
      workspace: false,
      at_list_price: { verify: 0, workspace: 0, total: 0 },
    },
  ],
  rules: ["A report the farmer has withdrawn is not counted."],
});

test("the usage card shows each month at the list price and says nothing is invoiced in a pilot", async () => {
  farmApi.mockResolvedValue(statement(false));
  render(<UsageDesk />);
  expect(
    await screen.findByText(/Pilot period: your usage is counted here/),
  ).toBeInTheDocument();
  expect(farmApi).toHaveBeenCalledWith("/admin/usage?months=6");
  const november = screen.getByRole("row", { name: /November 2026/ });
  expect(within(november).getByText("₹4,450")).toBeInTheDocument();
  expect(within(november).getByText("In use")).toBeInTheDocument();
  expect(
    within(november).getByText("5 requested, 1 waiting for the farmer"),
  ).toBeInTheDocument();
  expect(
    within(november).getByRole("link", { name: /Download CSV/ }),
  ).toHaveAttribute("href", "/api/v2/admin/usage/2026-11.csv");
  const october = screen.getByRole("row", { name: /October 2026/ });
  expect(within(october).queryByRole("link")).toBeNull();
  expect(screen.getByText("₹150")).toBeInTheDocument();
  expect(screen.getByText("per delivered report")).toBeInTheDocument();
  expect(screen.getByText("₹12,00,000")).toBeInTheDocument();
  expect(
    screen.getByText("A report the farmer has withdrawn is not counted."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Farmers never pay/)).toBeInTheDocument();
});

test("once billing is live the card says invoices follow the agreement, not the app", async () => {
  farmApi.mockResolvedValue(statement(true));
  render(<UsageDesk />);
  expect(
    await screen.findByText(/No payment is taken in the app/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Pilot period/)).toBeNull();
});

test("an account without an institutional role is told so", async () => {
  farmApi.mockRejectedValue({ status: 403, message: "Forbidden" });
  render(<UsageDesk />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This account does not have an institutional role.",
  );
});
