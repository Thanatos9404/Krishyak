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
const FOUND = {
  location: { latitude: 27.17, longitude: 75.72, accuracy_meters: 18 },
  place: {
    state: "Rajasthan",
    state_code: 8,
    district: "Jaipur",
    district_code: 102,
    village: "Harota",
  },
  soil: {
    soil_type: "Loamy",
    source: "soil_map",
    measurements: { sand_percent: 47, clay_percent: 26, ph: 7.3 },
  },
  climate: {
    annual_rain_mm: 581,
    season_rain_mm: { kharif: 497, rabi: 58, summer: 23 },
    monthly_high_c: [22, 26, 32, 37, 39, 38, 34, 32, 33, 33, 28, 24],
    monthly_low_c: [8, 11, 16, 22, 26, 27, 26, 25, 23, 18, 12, 9],
  },
  season: "rabi",
  common_crops: {
    rabi: [
      { crop_id: "mustard", area_share_percent: 35 },
      { crop_id: "wheat", area_share_percent: 29 },
    ],
  },
  suggested_crops: [
    { crop_id: "mustard", area_share_percent: 35 },
    { crop_id: "wheat", area_share_percent: 29 },
  ],
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
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
const bodies = () =>
  Object.fromEntries(
    farmApi.mock.calls.map(([path, options]) => [path, options?.body]),
  );

beforeEach(() => {
  farmApi.mockReset();
  global.navigator.geolocation = {
    getCurrentPosition: (resolve) =>
      resolve({
        coords: { latitude: 27.1712, longitude: 75.7204, accuracy: 18.2 },
      }),
  };
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

test("one tap on location fills the place, soil, rain record and local crops", async () => {
  farmApi.mockImplementation(async (path) => {
    if (path === "/farm-setup/locate") return FOUND;
    if (path === "/farms") return { id: "farm-1" };
    if (path === "/plots") return { id: "plot-1" };
    return {};
  });
  const onSaved = jest.fn();
  render(<FarmSetupView workspace={workspace()} onSaved={onSaved} />);
  // Step 1: a name is needed; the farming questions can be skipped.
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Ramesh Meena" },
  });
  fireEvent.click(screen.getByLabelText("Organic"));
  next();
  // Step 2: GPS.
  await screen.findByRole("heading", { name: /Step 2 of 4/ });
  fireEvent.click(screen.getByRole("button", { name: /Use my location/ }));
  const found = await screen.findByRole("region", {
    name: "Krishyak found this for your farm",
  });
  expect(found).toHaveTextContent("Harota, Jaipur, Rajasthan");
  expect(found).toHaveTextContent("27.17° N, 75.72° E");
  expect(found).toHaveTextContent("Soil: Loamy (domat)");
  expect(found).toHaveTextContent("Rain in a normal year: 581 mm");
  expect(found).toHaveTextContent("Hottest in May, about 39°C by day");
  expect(found).toHaveTextContent("Coldest in January, about 8°C at night");
  expect(found).toHaveTextContent("Farmers here grow: Mustard, Wheat");
  expect(bodies()["/farm-setup/locate"]).toEqual({
    latitude: 27.1712,
    longitude: 75.7204,
    accuracy_meters: 18,
  });
  next();
  // Step 3: only the land size is asked; soil came from the map.
  await screen.findByRole("heading", { name: /Step 3 of 4/ });
  expect(screen.getByLabelText("Soil")).toHaveValue("Loamy");
  expect(screen.getByText(/From the soil map/)).toHaveTextContent(
    "47% sand, 26% clay",
  );
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("How much land"), {
    target: { value: "2" },
  });
  next();
  // Step 4: local crops are one tap; the crop itself is optional.
  await screen.findByRole("heading", { name: /Step 4 of 4/ });
  fireEvent.click(screen.getByRole("button", { name: "Mustard" }));
  expect(screen.getByLabelText("Crop")).toHaveValue("mustard");
  expect(
    screen.getByRole("region", { name: "Check your details" }),
  ).toHaveTextContent("Harota, Jaipur, Rajasthan");
  fireEvent.click(screen.getByRole("button", { name: /Save my farm/ }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("plot-1"));
  const sent = bodies();
  expect(sent["/me"]).toEqual({
    display_name: "Ramesh Meena",
    state_code: 8,
    district_code: 102,
    village: "Harota",
    farming_kind: null,
    farming_method: "organic",
  });
  expect(sent["/plots"]).toMatchObject({
    farm_id: "farm-1",
    entered_area_hectares: 0.8094,
    approximate_location: { latitude: 27.17, longitude: 75.72 },
    irrigation_type: null,
    soil_metadata: { soil_type: "Loamy", source: "soil_map" },
  });
  expect(sent["/plots/plot-1/crop-cycles"]).toMatchObject({
    crop_id: "mustard",
    status: "active",
  });
});

test("the crop can be left for later and nothing invented is saved", async () => {
  farmApi.mockImplementation(async (path) => {
    if (path === "/farm-setup/locate")
      return { ...FOUND, soil: { soil_type: null, source: null } };
    if (path === "/farms") return { id: "farm-1" };
    if (path === "/plots") return { id: "plot-1" };
    return {};
  });
  const onSaved = jest.fn();
  render(
    <FarmSetupView
      workspace={workspace({
        farmer: { id: "farmer-a", display_name: "Sita Devi" },
      })}
      onSaved={onSaved}
    />,
  );
  next();
  await screen.findByRole("heading", { name: /Step 2 of 4/ });
  fireEvent.click(screen.getByRole("button", { name: /Use my location/ }));
  await screen.findByRole("region", {
    name: "Krishyak found this for your farm",
  });
  next();
  await screen.findByRole("heading", { name: /Step 3 of 4/ });
  fireEvent.change(screen.getByLabelText("How much land"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Land unit"), {
    target: { value: "hectare" },
  });
  next();
  await screen.findByRole("heading", { name: /Step 4 of 4/ });
  expect(screen.getByLabelText("Crop")).toHaveValue("");
  expect(screen.queryByLabelText("Sowing date")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Save my farm/ }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const sent = bodies();
  expect(sent["/plots"].soil_metadata).toBeUndefined();
  expect(sent["/plots"].name).toBe("My field");
  expect(Object.keys(sent)).not.toContain("/plots/plot-1/crop-cycles");
});

test("spoken details fill every step and land on the check screen", async () => {
  farmApi.mockImplementation(async (path) => {
    if (path === "/farm-setup/understand") return DRAFT;
    if (path === "/farms") return { id: "farm-1" };
    if (path === "/plots") return { id: "plot-1" };
    return {};
  });
  const onSaved = jest.fn();
  render(<FarmSetupView workspace={workspace()} onSaved={onSaved} />);
  fireEvent.click(
    screen.getByRole("button", { name: /Speak instead of typing/ }),
  );
  fireEvent.change(await screen.findByLabelText("Or type it"), {
    target: { value: "main Dhaulpur se hoon, 5 bigha, gehun" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Fill the form/ }));
  await screen.findByRole("heading", { name: /Step 4 of 4/ });
  const check = screen.getByRole("region", { name: "Check your details" });
  expect(check).toHaveTextContent("Ram Lal");
  expect(check).toHaveTextContent("Bari, Dholpur, Rajasthan");
  expect(check).toHaveTextContent("5 Bigha (1.26 hectares)");
  expect(check).toHaveTextContent("Tubewell, well or canal");
  expect(check).toHaveTextContent("Alluvial (river plain)");
  expect(screen.getByLabelText("Crop")).toHaveValue("wheat");
  // Any row can be corrected before saving.
  fireEvent.click(screen.getByRole("button", { name: "Change Soil" }));
  expect(
    await screen.findByText(/Rough guess for your area/),
  ).toHaveTextContent("You said your soil is dry.");
  fireEvent.click(screen.getByRole("button", { name: /What you grow/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Save my farm/ }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("plot-1"));
  expect(bodies()["/plots"]).toMatchObject({
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
});

test("a refused location explains what to do and the form still works by hand", async () => {
  global.navigator.geolocation = {
    getCurrentPosition: (_resolve, reject) => reject(new Error("denied")),
  };
  render(
    <FarmSetupView
      workspace={workspace({
        farmer: { id: "farmer-a", display_name: "Sita Devi" },
      })}
    />,
  );
  next();
  await screen.findByRole("heading", { name: /Step 2 of 4/ });
  fireEvent.click(screen.getByRole("button", { name: /Use my location/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Turn on location on your phone, or choose your district below/,
  );
  expect(farmApi).not.toHaveBeenCalled();
  expect(screen.getByText("Or choose your place")).toBeInTheDocument();
});

test("permission is asked once before anything is sent, and voice is not part of it", async () => {
  const w = workspace({ consents: [] });
  farmApi.mockResolvedValue({});
  render(<FarmSetupView workspace={w} />);
  expect(screen.queryByLabelText("Your name")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
  await waitFor(() => expect(w.loadConsents).toHaveBeenCalled());
  expect(farmApi.mock.calls.map(([, options]) => options.body.purpose)).toEqual(
    ["location_processing", "agronomic_analysis"],
  );
});

test("a farmer who is not ready can skip registration", () => {
  const onSkip = jest.fn();
  render(<FarmSetupView workspace={workspace()} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
  expect(onSkip).toHaveBeenCalled();
});
