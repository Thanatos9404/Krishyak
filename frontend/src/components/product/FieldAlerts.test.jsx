import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CalendarCard, RadarCard } from "./FieldAlerts";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));

const w = {
  selected: "field-a",
  consents: ["location_processing"],
  cycles: [{ id: "cycle-1", crop_id: "wheat", status: "active" }],
  busy: false,
  offline: false,
  act: (task) => task(),
  refresh: jest.fn(),
  setNotice: jest.fn(),
};
const ALERT = {
  status: "alert",
  crop_id: "tomato",
  sharing: true,
  alerts: [
    {
      disease: "Tomato___Late_blight",
      name: "Late blight (tomato)",
      farms_at_least: 5,
      rising: true,
      urgent: true,
      steps: [
        "Remove and destroy infected plants.",
        "Avoid overhead watering.",
        "Check the field every day.",
        "A fourth step that is not shown.",
      ],
    },
  ],
};
beforeEach(() => farmApi.mockReset());

test("an alert names the disease, a rounded farm count and three first steps", () => {
  render(<RadarCard workspace={w} radar={ALERT} show="alert" />);
  expect(
    screen.getByRole("heading", { name: "Disease alert near you" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Late blight (tomato)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/5 or more farms within 10 km found this on Tomato/),
  ).toHaveTextContent(/spreading this week.*Check your crop today/);
  const steps = screen.getByRole("list", { name: "How to protect your crop" });
  expect(steps.children).toHaveLength(3);
  expect(
    screen.getByRole("link", { name: /Check my crop with a photo/ }),
  ).toHaveAttribute("href", "/app/health");
  expect(screen.getByText(/No names or places are shown/)).toBeInTheDocument();
});

test("an alert is shown once: at the top, not again lower down", () => {
  const { container } = render(
    <RadarCard workspace={w} radar={ALERT} show="status" />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("a quiet radar says so and offers to share, without a name", () => {
  const radar = { status: "watching", crop_id: "wheat", sharing: false };
  const { container, rerender } = render(
    <RadarCard workspace={w} radar={radar} show="alert" />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(<RadarCard workspace={w} radar={radar} show="status" />);
  expect(screen.getByRole("region", { name: "Pest Radar" })).toHaveTextContent(
    "No disease alerts for Wheat within 10 km.",
  );
  expect(
    screen.getByRole("button", { name: "Share to help neighbours" }),
  ).toBeEnabled();
  rerender(
    <RadarCard
      workspace={w}
      radar={{ ...radar, sharing: true }}
      show="status"
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText(/without your name/)).toBeInTheDocument();
});

test("sharing cannot be switched on while offline", () => {
  render(
    <RadarCard
      workspace={{ ...w, offline: true }}
      radar={{ status: "watching", crop_id: "wheat", sharing: false }}
      show="status"
    />,
  );
  expect(
    screen.getByRole("button", { name: "Share to help neighbours" }),
  ).toBeDisabled();
});

test("a field with no location or no crop gets a plain next step or nothing", () => {
  const { container, rerender } = render(
    <RadarCard workspace={w} radar={{ status: "needs_crop" }} show="status" />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(
    <RadarCard
      workspace={w}
      radar={{ status: "needs_location" }}
      show="status"
    />,
  );
  expect(screen.getByRole("link", { name: "Open field" })).toHaveAttribute(
    "href",
    "/app/farm/field-a",
  );
});

test("the crop calendar shows the day count, this week and what comes next", async () => {
  farmApi.mockResolvedValue({
    status: "available",
    crop_id: "wheat",
    day: 22,
    counted_from: "sowing",
    now: [{ kind: "water", task: "First watering now." }],
    next: {
      kind: "weed",
      task: "Weed the field.",
      in_days: 8,
      from: "2026-11-20",
    },
  });
  render(<CalendarCard workspace={w} />);
  await screen.findByRole("heading", { name: "This week on your Wheat" });
  expect(farmApi).toHaveBeenCalledWith(
    "/plots/field-a/calendar",
    expect.anything(),
  );
  expect(screen.getByText("Day 22 after sowing")).toBeInTheDocument();
  expect(screen.getByText("Do this week")).toBeInTheDocument();
  expect(screen.getByText("First watering now.")).toBeInTheDocument();
  expect(screen.getByText(/^In 8 days/)).toBeInTheDocument();
  expect(screen.getByText(/local agriculture officer/)).toBeInTheDocument();
});

test("the calendar stays out of the way offline or when the crop has none", async () => {
  const { container, rerender } = render(
    <CalendarCard workspace={{ ...w, offline: true }} />,
  );
  expect(farmApi).not.toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
  farmApi.mockResolvedValue({ status: "unsupported_crop" });
  rerender(<CalendarCard workspace={w} />);
  await waitFor(() => expect(farmApi).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
