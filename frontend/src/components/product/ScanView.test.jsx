import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ScanView } from "./ScanView";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/product/deferredProductFeature", () => ({
  deferredFeature: () => () => null,
}));

const MODEL = {
  supported_crops: ["tomato", "potato", "maize"],
  release: { metrics: { external_test: { accuracy: 0.5721 } } },
};
const initial = {
  selected: "field-a",
  plot: {},
  cycles: [],
  consents: ["agronomic_analysis"],
  busy: false,
  act: (task) => task(),
};
beforeEach(() => {
  farmApi.mockReset();
  farmApi.mockImplementation((path) =>
    path === "/model" ? Promise.resolve(MODEL) : new Promise(() => {}),
  );
});
const crop = () => screen.getByRole("combobox", { name: "Crop" });

test("only crops the photo model supports can be chosen", async () => {
  render(<ScanView workspace={initial} />);
  await waitFor(() => expect(crop().options.length).toBe(4));
  expect(
    [...crop().options]
      .map((o) => o.value)
      .filter(Boolean)
      .sort(),
  ).toEqual(["maize", "potato", "tomato"]);
  // Without a supported field crop the farmer is asked, not given a guess.
  expect(crop()).toHaveValue("");
  expect(screen.getByText(/right about 57% of the time/)).toBeInTheDocument();
});

test("late crop-cycle evidence preserves the crop explicitly chosen by the farmer", async () => {
  const { rerender } = render(<ScanView workspace={initial} />);
  await waitFor(() => expect(crop().options.length).toBe(4));
  fireEvent.change(crop(), { target: { value: "potato" } });
  rerender(
    <ScanView
      workspace={{
        ...initial,
        cycles: [{ crop_id: "tomato", status: "active" }],
      }}
    />,
  );
  expect(crop()).toHaveValue("potato");
});

test("a new field uses its own crop cycle rather than the previous field choice", async () => {
  const { rerender } = render(<ScanView workspace={initial} />);
  await waitFor(() => expect(crop().options.length).toBe(4));
  fireEvent.change(crop(), { target: { value: "tomato" } });
  rerender(
    <ScanView
      workspace={{
        ...initial,
        selected: "field-b",
        cycles: [{ crop_id: "maize", status: "active" }],
      }}
    />,
  );
  await waitFor(() => expect(crop()).toHaveValue("maize"));
});

test("an unsupported field crop is explained instead of silently guessed", async () => {
  render(
    <ScanView
      workspace={{
        ...initial,
        cycles: [{ crop_id: "wheat", status: "active" }],
      }}
    />,
  );
  await screen.findByText(/Photo check is not yet available for Wheat/);
});

test("results lead with a plain name, urgent warning and care steps", async () => {
  farmApi.mockImplementation((path) =>
    path === "/model"
      ? Promise.resolve(MODEL)
      : Promise.resolve({
          image_id: "image-1",
          result: {
            status: "detected",
            predicted_class: "Potato___Late_blight",
            model_score: 0.91,
            model_id: "model-x",
            observed_at: "2026-10-09T10:00:00Z",
            limitations: ["Model score is not calibrated disease probability"],
            guidance: {
              name: "Late blight (potato)",
              cause: "fungus-like organism",
              urgent: true,
              steps: ["Remove and destroy infected plants."],
            },
          },
        }),
  );
  const w = {
    ...initial,
    ownerRef: { current: "o" },
    selectedRef: { current: "field-a" },
    refreshEvidence: jest.fn(),
  };
  render(<ScanView workspace={w} />);
  await waitFor(() => expect(crop().options.length).toBe(4));
  fireEvent.change(crop(), { target: { value: "potato" } });
  const file = new File(["x"], "leaf.jpg", { type: "image/jpeg" });
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
  global.URL.revokeObjectURL = jest.fn();
  fireEvent.change(screen.getByLabelText("Choose crop photo"), {
    target: { files: [file] },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Check this photograph/ }),
  );
  await screen.findByRole("heading", {
    name: "Looks like Late blight (potato)",
  });
  expect(screen.getByRole("alert")).toHaveTextContent(/spread quickly/);
  expect(
    screen.getByText("Remove and destroy infected plants."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Kisan Call Centre/ }),
  ).toHaveAttribute("href", "tel:18001801551");
});

test("a photo chosen while the field is still loading is kept", async () => {
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
  global.URL.revokeObjectURL = jest.fn();
  const { rerender } = render(
    <ScanView workspace={{ ...initial, selected: null, plot: null }} />,
  );
  await waitFor(() => expect(crop().options.length).toBe(4));
  fireEvent.change(crop(), { target: { value: "tomato" } });
  fireEvent.change(screen.getByLabelText("Choose crop photo"), {
    target: { files: [new File(["x"], "leaf.jpg", { type: "image/jpeg" })] },
  });
  rerender(<ScanView workspace={{ ...initial, selected: "field-a" }} />);
  expect(crop()).toHaveValue("tomato");
  expect(screen.getByAltText("Selected crop photograph")).toBeInTheDocument();
});
