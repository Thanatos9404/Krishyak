import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import NoticeList from "./NoticeList";
import { farmApi } from "./api";

jest.mock("./api", () => ({ farmApi: jest.fn() }));

test("a soil update names the new soil in words farmers use", async () => {
  farmApi.mockResolvedValue({
    items: [
      {
        id: "n1",
        kind: "soil_updated",
        created_at: "2026-11-13T10:00:00Z",
        acknowledged_at: null,
        payload: {
          title: "Soil estimate updated",
          message:
            "The soil map now gives an estimate for this field. Check it in My fields and change it if your soil is different.",
          soil_type: "Loamy",
          previous: "Sandy",
        },
      },
    ],
  });
  render(
    <NoticeList
      owner="o"
      act={(task) => task()}
      busy={false}
      offline={false}
    />,
  );
  expect(
    await screen.findByRole("heading", { name: "Soil estimate updated" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Loamy (domat)")).toBeInTheDocument();
  expect(
    screen.getByText(/change it if your soil is different/),
  ).toBeInTheDocument();
});
