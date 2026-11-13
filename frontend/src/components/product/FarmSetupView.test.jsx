import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FarmSetupView, hectaresFor } from "./FarmSetupView";
import { farmApi } from "../../features/farms/api";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/product/workspaceSpeech", () => ({
  workspaceSpeech: {
    capabilities: jest.fn().mockResolvedValue({ configured: false }),
  },
}));
jest.mock("./IndiaLocationPicker", () => ({
  IndiaLocationPicker: ({ value }) => (
    <p>
      Place: {value.district}, {value.state}
    </p>
  ),
}));

const DRAFT = {
  name: "Ram Lal",
  village: "Bari",
  state: "Rajasthan",
  state_code: 8,
  district: "Dholpur",
  district_code: 98,
  area_value: 5,
  area_unit: "bigha",
  bigha_square_metres: 2529.3,
  crop_id: "wheat",
  soil_type: "Alluvial",
  soil_source: "state_typical",
  soil_condition: "dry",
  water: "irrigated",
  location: { latitude: 26.7, longitude: 77.9, matched: "district" },
};
const workspace = (overrides = {}) => ({
  farmer: { id: "farmer-a", display_name: "Farmer" },
  consents: ["speech_processing", "location_processing", "agronomic_analysis"],
  farms: [],
  busy: false,
  offline: false,
  act: (task) => task(),
  loadConsents: jest.fn(),
  ...overrides,
});

test("land in local units becomes hectares", () => {
  expect(
    hectaresFor({
      area_value: 5,
      area_unit: "bigha",
      bigha_square_metres: 2529.3,
    }),
  ).toBeCloseTo(1.2647, 3);
  expect(hectaresFor({ area_value: 2, area_unit: "acre" })).toBeCloseTo(
    0.809,
    3,
  );
  expect(
    hectaresFor({ area_value: 5, area_unit: "bigha", bigha_square_metres: "" }),
  ).toBeNull();
});

test("spoken details fill the form, then save as profile, farm, field and crop", async () => {
  farmApi.mockImplementation(async (path) => {
    if (path === "/farm-setup/understand") return DRAFT;
    if (path === "/farms") return { id: "farm-1" };
    if (path === "/plots") return { id: "plot-1" };
    return {};
  });
  const onSaved = jest.fn();
  render(<FarmSetupView workspace={workspace()} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Or type it"), {
    target: { value: "main Dhaulpur se hoon, 5 bigha, gehun" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Fill the form/ }));
  expect(await screen.findByDisplayValue("Ram Lal")).toBeInTheDocument();
  expect(screen.getByText("Place: Dholpur, Rajasthan")).toBeInTheDocument();
  expect(screen.getByLabelText("Crop")).toHaveValue("wheat");
  expect(screen.getByLabelText("Soil")).toHaveValue("Alluvial");
  expect(screen.getByText(/Rough guess for your area/)).toBeInTheDocument();
  expect(screen.getByText("= 1.26 hectares")).toBeInTheDocument();
  expect(screen.getByLabelText("Tubewell, well or canal")).toBeChecked();
  fireEvent.click(
    screen.getByRole("button", { name: /Save and see my field report/ }),
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("plot-1"));
  const calls = Object.fromEntries(
    farmApi.mock.calls.map(([path, options]) => [path, options?.body]),
  );
  expect(calls["/me"]).toEqual({
    display_name: "Ram Lal",
    state_code: 8,
    district_code: 98,
    village: "Bari",
  });
  expect(calls["/plots"]).toMatchObject({
    farm_id: "farm-1",
    entered_area_hectares: 1.2647,
    approximate_location: { latitude: 26.7, longitude: 77.9 },
    irrigation_type: "irrigated",
    soil_metadata: {
      soil_type: "Alluvial",
      source: "state_typical",
      condition: "dry",
      seed: null,
    },
  });
  expect(calls["/plots/plot-1/crop-cycles"]).toMatchObject({
    crop_id: "wheat",
    status: "active",
  });
});

test("permission is asked once before anything is sent", async () => {
  const w = workspace({ consents: ["speech_processing"] });
  farmApi.mockResolvedValue({});
  render(<FarmSetupView workspace={w} />);
  expect(screen.queryByLabelText("Or type it")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
  await waitFor(() => expect(w.loadConsents).toHaveBeenCalled());
  expect(farmApi.mock.calls.map(([, options]) => options.body.purpose)).toEqual(
    ["location_processing", "agronomic_analysis"],
  );
});
