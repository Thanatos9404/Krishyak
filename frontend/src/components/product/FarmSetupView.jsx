import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  LocateFixed,
  MapPin,
  Mic,
  Mountain,
  ShieldCheck,
  Sparkles,
  Sprout,
  Thermometer,
} from "lucide-react";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";
import { farmApi } from "../../features/farms/api";
import { useProductLocale } from "../../features/product/ProductLocale";
import { workspaceSpeech } from "../../features/product/workspaceSpeech";
import { fieldChoice } from "../../features/product/sessionStorage";
import { cropLabel, findCrop } from "../../features/product/crops";
import { SOILS } from "../../features/product/soils";
import { VOICE_POLICY } from "../../features/product/useVoiceAssistant";
import { IndiaLocationPicker } from "./IndiaLocationPicker";
import { VoiceOrb } from "./VoiceOrb";

// Crops the field report can assess (backend v2/agronomy.CROP_PLANS).
export const ASSESSED_CROPS = {
  wheat: 135,
  barley: 125,
  mustard: 125,
  chickpea: 115,
  lentil: 120,
  cumin: 120,
  potato: 100,
  onion: 130,
  rice: 125,
  maize: 100,
  bajra: 85,
  jowar: 110,
  cotton: 170,
  soybean: 100,
  groundnut: 115,
  moong: 70,
  urad: 80,
  pigeon_pea: 170,
  sesame: 90,
  sugarcane: 330,
};
export { SOILS };
const UNITS = {
  hectare: "Hectare",
  acre: "Acre",
  bigha: "Bigha",
  guntha: "Guntha",
  kanal: "Kanal",
  cent: "Cent",
};
const HECTARES = {
  hectare: 1,
  acre: 0.40468564224,
  guntha: 0.40468564224 / 40,
  cent: 0.40468564224 / 100,
  kanal: 0.40468564224 / 8,
};
// Finding the farm and estimating it need these two; voice is asked for only when used.
const NEEDS = ["location_processing", "agronomic_analysis"];
const SOIL_SOURCE = {
  spoken: "You told us",
  soil_map: "From the soil map for your village",
  state_typical:
    "Rough guess for your area. Choose the right one if you know it.",
  farmer_selected: "You chose this",
};
const FARMING_KINDS = [
  ["crops", "Field crops"],
  ["crops_and_animals", "Crops and animals"],
  ["vegetables_and_fruit", "Vegetables and fruit"],
  ["mixed", "A bit of everything"],
];
const FARMING_METHODS = [
  ["conventional", "With fertilizer and sprays"],
  ["organic", "Organic"],
  ["natural", "Natural farming"],
];
const WATER = [
  ["irrigated", "Tubewell, well or canal"],
  ["rainfed", "Only rain"],
];
const STEPS = [
  "About you",
  "Where your farm is",
  "Land and water",
  "What you grow",
];
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export function hectaresFor(form) {
  const value = Number(form.area_value);
  if (!(value > 0)) return null;
  if (form.area_unit === "bigha") {
    const size = Number(form.bigha_square_metres);
    return size > 0 ? (value * size) / 10000 : null;
  }
  return HECTARES[form.area_unit] ? value * HECTARES[form.area_unit] : null;
}

const openHome = () => location.assign("/app/today");
const position = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("unsupported"));
    else
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
  });

// What Krishyak learned from the place, shown so the farmer can trust or correct it.
function FoundPanel({ found, place, village }) {
  const { tx, info } = useProductLocale();
  const month = (index) =>
    new Intl.DateTimeFormat(info.speechCode, { month: "long" }).format(
      new Date(2026, index, 15),
    );
  const climate = found.climate;
  const hottest = climate
    ? climate.monthly_high_c.indexOf(Math.max(...climate.monthly_high_c))
    : null;
  const coldest = climate
    ? climate.monthly_low_c.indexOf(Math.min(...climate.monthly_low_c))
    : null;
  const grown = (found.common_crops?.[found.season] || [])
    .map((row) => cropLabel(findCrop(row.crop_id), tx))
    .filter(Boolean)
    .slice(0, 4);
  const where = [village, place.district, place.state]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="setup-found" aria-labelledby="setup-found-heading">
      <h3 id="setup-found-heading">
        <CheckCircle2 size={22} aria-hidden="true" />{" "}
        {tx("Krishyak found this for your farm")}
      </h3>
      <ul>
        <li>
          <MapPin size={20} aria-hidden="true" />
          <span>
            <strong>{where || tx("Place name not found")}</strong>
            <small>
              {tx("{{v0}}° N, {{v1}}° E, rounded to about 1 km", {
                v0: found.location.latitude,
                v1: found.location.longitude,
              })}
            </small>
          </span>
        </li>
        {found.soil?.soil_type && (
          <li>
            <Mountain size={20} aria-hidden="true" />
            <span>
              <strong>
                {tx("Soil: {{v0}}", { v0: tx(SOILS[found.soil.soil_type]) })}
              </strong>
              <small>{tx(SOIL_SOURCE[found.soil.source] || "")}</small>
            </span>
          </li>
        )}
        {climate && (
          <li>
            <CloudRain size={20} aria-hidden="true" />
            <span>
              <strong>
                {tx("Rain in a normal year: {{v0}} mm", {
                  v0: climate.annual_rain_mm,
                })}
              </strong>
              <small>
                {tx("{{v0}} mm of it falls from June to September.", {
                  v0: climate.season_rain_mm.kharif,
                })}
              </small>
            </span>
          </li>
        )}
        {climate && (
          <li>
            <Thermometer size={20} aria-hidden="true" />
            <span>
              <strong>
                {tx("Hottest in {{v0}}, about {{v1}}°C by day", {
                  v0: month(hottest),
                  v1: Math.round(climate.monthly_high_c[hottest]),
                })}
              </strong>
              <small>
                {tx("Coldest in {{v0}}, about {{v1}}°C at night", {
                  v0: month(coldest),
                  v1: Math.round(climate.monthly_low_c[coldest]),
                })}
              </small>
            </span>
          </li>
        )}
        {grown.length > 0 && (
          <li>
            <Sprout size={20} aria-hidden="true" />
            <span>
              <strong>
                {tx("Farmers here grow: {{v0}}", { v0: grown.join(", ") })}
              </strong>
              <small>{tx("From district crop records.")}</small>
            </span>
          </li>
        )}
      </ul>
      <p className="small muted">
        {tx("You can change any of this now or later in My fields.")}
      </p>
    </section>
  );
}

export function FarmSetupView({ workspace: w, onSaved = openHome, onSkip }) {
  const { tx, info, language } = useProductLocale();
  const speech = useSarvamRecognition({
    speechCode: info.speechCode,
    transport: workspaceSpeech,
  });
  const [step, setStep] = useState(0),
    [text, setText] = useState(""),
    [speaking, setSpeaking] = useState(false),
    [found, setFound] = useState(null),
    [phase, setPhase] = useState("idle"),
    [problem, setProblem] = useState("");
  const [form, setForm] = useState(() => ({
    name:
      w.farmer?.display_name === "Farmer" ? "" : w.farmer?.display_name || "",
    farming_kind: w.farmer?.farming_kind || "",
    farming_method: w.farmer?.farming_method || "",
    village: w.farmer?.village || "",
    place: {
      state_code: w.farmer?.state_code ?? null,
      district_code: w.farmer?.district_code ?? null,
      state: w.farmer?.state || null,
      district: w.farmer?.district || null,
    },
    location: null,
    area_value: "",
    area_unit: "acre",
    bigha_square_metres: "",
    water: "",
    soil_type: "",
    soil_source: null,
    soil_measurements: null,
    condition: null,
    seed: null,
    crop_id: "",
    sowing_date: today(),
  }));
  const missing = NEEDS.filter((purpose) => !w.consents.includes(purpose));
  const update = (patch) => setForm((value) => ({ ...value, ...patch }));
  const hectares = useMemo(() => hectaresFor(form), [form]);
  const busy = phase !== "idle" || w.busy;

  const grant = async (purposes) => {
    for (const purpose of purposes)
      if (!w.consents.includes(purpose))
        await farmApi("/consents", {
          method: "POST",
          body: { purpose, granted: true, policy_version: VOICE_POLICY },
        });
    await w.loadConsents();
  };

  // Everything Krishyak can fetch for a place: names, soil, rain record, local crops.
  const applyFound = (result) => {
    setFound(result);
    setForm((value) => ({
      ...value,
      village: value.village || result.place.village || "",
      place: result.place.state_code
        ? {
            state_code: result.place.state_code,
            district_code: result.place.district_code,
            state: result.place.state,
            district: result.place.district,
          }
        : value.place,
      location: result.location,
      ...(value.soil_source === "farmer_selected" ||
      value.soil_source === "spoken" ||
      !result.soil?.soil_type
        ? {}
        : {
            soil_type: result.soil.soil_type,
            soil_source: result.soil.source,
            soil_measurements: result.soil.measurements,
          }),
    }));
  };
  const locate = async (body) => {
    setProblem("");
    setPhase("locating");
    try {
      applyFound(
        await farmApi("/farm-setup/locate", {
          method: "POST",
          body,
          retry: false,
          timeoutMs: 45000,
        }),
      );
      return true;
    } catch (error) {
      setProblem(
        error.status === 422
          ? error.message
          : error.status === 429
            ? "Please wait a minute and try again."
            : "Krishyak could not look up this place right now. You can still fill it in by hand.",
      );
      return false;
    } finally {
      setPhase("idle");
    }
  };
  const useMyLocation = async () => {
    setProblem("");
    setPhase("locating");
    let fix;
    try {
      fix = await position();
    } catch {
      setPhase("idle");
      setProblem(
        "Krishyak could not read your location. Turn on location on your phone, or choose your district below.",
      );
      return;
    }
    await locate({
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracy_meters: Math.min(100000, Math.round(fix.coords.accuracy || 0)),
    });
  };
  const findChosenPlace = () =>
    locate({
      state_code: form.place.state_code,
      district_code: form.place.district_code,
      village: form.village.trim() || null,
    });

  const understand = async (spoken) => {
    const value = (spoken ?? text).trim();
    if (value.length < 3) return;
    setProblem("");
    setPhase("understanding");
    try {
      const draft = await farmApi("/farm-setup/understand", {
        method: "POST",
        body: { text: value.slice(0, 1000), language },
        retry: false,
        timeoutMs: 50000,
      });
      setForm((current) => ({
        ...current,
        name: draft.name || current.name,
        village: draft.village || current.village,
        place: draft.state_code
          ? {
              state_code: draft.state_code,
              district_code: draft.district_code,
              state: draft.state,
              district: draft.district,
            }
          : current.place,
        area_value: draft.area_value ?? current.area_value,
        area_unit: draft.area_unit || current.area_unit,
        bigha_square_metres:
          draft.bigha_square_metres || current.bigha_square_metres,
        crop_id: ASSESSED_CROPS[draft.crop_id]
          ? draft.crop_id
          : current.crop_id,
        soil_type: draft.soil_type || current.soil_type,
        soil_source: draft.soil_type ? draft.soil_source : current.soil_source,
        soil_measurements: draft.soil_measurements || current.soil_measurements,
        condition: draft.soil_condition || current.condition,
        seed: draft.seed || current.seed,
        water: draft.water || current.water,
        location: draft.location || current.location,
      }));
      setSpeaking(false);
      setStep(3);
    } catch (error) {
      setProblem(
        error.status === 429
          ? "Please wait a minute and try again."
          : error.network
            ? "You seem to be offline. Please try again when connected."
            : "Krishyak could not understand that. Please try again or fill the form.",
      );
    } finally {
      setPhase("idle");
    }
  };
  useEffect(() => {
    if (speech.transcript) {
      setText(speech.transcript);
      const spoken = speech.transcript;
      speech.resetTranscript();
      understand(spoken);
    }
  }, [speech.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = [
    form.name.trim().length > 0,
    Boolean(form.place.state_code),
    Boolean(hectares),
    true,
  ];
  const next = async () => {
    setProblem("");
    // A district picked by hand still gets its soil, rain record and map point.
    if (step === 1 && !form.location && form.place.district_code)
      await findChosenPlace();
    setProblem("");
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const save = () =>
    w.act(async () => {
      setProblem("");
      if (!ready[0] || !ready[1] || !ready[2]) {
        setStep(ready.indexOf(false));
        throw new Error("Add your name, your place and your land size first.");
      }
      setPhase("saving");
      try {
        await farmApi("/me", {
          method: "PATCH",
          body: {
            display_name: form.name.trim(),
            state_code: form.place.state_code,
            district_code: form.place.district_code ?? null,
            village: form.village.trim() || null,
            farming_kind: form.farming_kind || null,
            farming_method: form.farming_method || null,
          },
        });
        const farm =
          w.farms[0] ||
          (await farmApi("/farms", {
            method: "POST",
            body: {
              operation_id: crypto.randomUUID(),
              name: form.village.trim() || form.place.district || tx("My farm"),
            },
          }));
        const plot = await farmApi("/plots", {
          method: "POST",
          body: {
            operation_id: crypto.randomUUID(),
            farm_id: farm.id,
            name: form.crop_id
              ? tx("{{v0}} field", {
                  v0: cropLabel(findCrop(form.crop_id), tx),
                })
              : tx("My field"),
            entered_area_hectares: Number(hectares.toFixed(4)),
            ...(form.location
              ? {
                  approximate_location: {
                    latitude: form.location.latitude,
                    longitude: form.location.longitude,
                  },
                }
              : {}),
            irrigation_type: form.water || null,
            ...(form.soil_type
              ? {
                  soil_metadata: {
                    soil_type: form.soil_type,
                    source: form.soil_source || "farmer_selected",
                    condition: form.condition || null,
                    seed: form.seed || null,
                  },
                }
              : {}),
          },
        });
        if (form.crop_id) {
          const sown = new Date(`${form.sowing_date}T00:00:00Z`);
          const harvest = new Date(
            sown.getTime() + ASSESSED_CROPS[form.crop_id] * 86400000,
          );
          await farmApi(`/plots/${plot.id}/crop-cycles`, {
            method: "POST",
            body: {
              operation_id: crypto.randomUUID(),
              crop_id: form.crop_id,
              sowing_date: form.sowing_date,
              expected_harvest: harvest.toISOString().slice(0, 10),
              status: form.sowing_date > today() ? "planned" : "active",
            },
          });
        }
        fieldChoice(w.farmer.id, plot.id);
        onSaved(plot.id);
      } catch (error) {
        setPhase("idle");
        throw error;
      }
    });

  const suggested = (found?.suggested_crops || []).filter(
    (row) => ASSESSED_CROPS[row.crop_id],
  );
  const summary = [
    [0, "Your name", form.name.trim()],
    [
      1,
      "Place",
      [form.village.trim(), form.place.district, form.place.state]
        .filter(Boolean)
        .join(", "),
    ],
    [
      2,
      "Land",
      hectares
        ? `${form.area_value} ${tx(UNITS[form.area_unit])} (${hectares.toFixed(2)} ${tx("hectares")})`
        : "",
    ],
    [
      2,
      "Water for the field",
      form.water ? tx(Object.fromEntries(WATER)[form.water]) : "",
    ],
    [2, "Soil", form.soil_type ? tx(SOILS[form.soil_type]) : ""],
    [
      3,
      "Crop",
      form.crop_id ? cropLabel(findCrop(form.crop_id), tx) : tx("Add it later"),
    ],
  ];

  return (
    <>
      <header className="home-greeting">
        <h1>{tx("Register your farm")}</h1>
        <p>
          {tx(
            "Four short steps. Use your location and Krishyak fills in the place, soil and rain record for you.",
          )}
        </p>
        {onSkip && (
          <button type="button" className="button text" onClick={onSkip}>
            {tx("Skip for now")}
          </button>
        )}
      </header>
      {missing.length > 0 ? (
        <section className="product-card setup-consent">
          <ShieldCheck size={30} aria-hidden="true" />
          <h2>{tx("Allow Krishyak to set up your farm")}</h2>
          <p>
            {tx(
              "Krishyak uses your farm's rough location (about 1 km) to find its village, soil, rain record and weather, and your field details to estimate harvest and risk. You can turn this off in Settings.",
            )}
          </p>
          <button
            type="button"
            className="button primary large"
            disabled={w.busy || w.offline}
            onClick={() => w.act(() => grant(NEEDS))}
          >
            {tx("Allow and continue")}
          </button>
        </section>
      ) : (
        <>
          <section
            className={`setup-speak ${speaking ? "is-open" : ""}`}
            data-voice-controls="own"
            aria-labelledby="setup-speak"
          >
            <button
              type="button"
              className="setup-speak-toggle"
              aria-expanded={speaking}
              onClick={() =>
                w.act(async () => {
                  if (!speaking) await grant(["speech_processing"]);
                  setSpeaking(!speaking);
                })
              }
            >
              <Mic size={26} aria-hidden="true" />
              <span>
                <strong id="setup-speak">
                  {tx("Speak instead of typing")}
                </strong>
                <small>
                  {tx("Say it all in one go. Krishyak fills the form.")}
                </small>
              </span>
            </button>
            {speaking && w.consents.includes("speech_processing") && (
              <div className="setup-voice">
                <p className="setup-example">
                  {tx(
                    "For example: “I am Ramlal from Bari village in Dholpur. I have 5 bigha of land with a tubewell. I grow wheat. My soil is dry.”",
                  )}
                </p>
                <VoiceOrb
                  size={120}
                  phase={
                    speech.isListening
                      ? "listening"
                      : speech.status === "processing" ||
                          phase === "understanding"
                        ? "thinking"
                        : "idle"
                  }
                  disabled={busy || speech.isSupported === false}
                  label={
                    speech.isListening
                      ? tx("Stop and send")
                      : tx("Tap to speak")
                  }
                  onClick={() =>
                    speech.isListening
                      ? speech.stopListening()
                      : speech.startListening()
                  }
                />
                <p className="setup-status" role="status">
                  {phase === "understanding"
                    ? tx(
                        "Filling in your details… finding your soil can take up to 20 seconds.",
                      )
                    : speech.isListening
                      ? tx("Listening… tap again when you finish")
                      : speech.status === "processing"
                        ? tx("Understanding your words…")
                        : speech.isSupported === false
                          ? tx(
                              "Voice is not available on this phone. Please type.",
                            )
                          : tx("Tap the mic and speak")}
                </p>
                <label className="v2-label setup-text">
                  {tx("Or type it")}
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || text.trim().length < 3}
                  onClick={() => understand()}
                >
                  <Sparkles size={18} aria-hidden="true" />{" "}
                  {tx("Fill the form")}
                </button>
              </div>
            )}
          </section>

          <ol className="setup-steps" aria-label={tx("Registration steps")}>
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={
                  index === step ? "is-current" : index < step ? "is-done" : ""
                }
                aria-current={index === step ? "step" : undefined}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep(index)}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {tx(label)}
                </button>
              </li>
            ))}
          </ol>

          <form
            className="product-card setup-form"
            data-voice-controls="own"
            onSubmit={(event) => {
              event.preventDefault();
              if (step < STEPS.length - 1) next();
              else save();
            }}
          >
            <h2>
              {tx("Step {{v0}} of {{v1}}: {{v2}}", {
                v0: step + 1,
                v1: STEPS.length,
                v2: tx(STEPS[step]),
              })}
            </h2>

            {step === 0 && (
              <>
                <label className="v2-label">
                  {tx("Your name")}
                  <input
                    value={form.name}
                    maxLength={100}
                    autoComplete="name"
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                <fieldset className="setup-choice">
                  <legend>{tx("What kind of farming do you do?")}</legend>
                  {FARMING_KINDS.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="farming_kind"
                        value={value}
                        checked={form.farming_kind === value}
                        onChange={() => update({ farming_kind: value })}
                      />
                      {tx(label)}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="setup-choice">
                  <legend>{tx("How do you farm?")}</legend>
                  {FARMING_METHODS.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="farming_method"
                        value={value}
                        checked={form.farming_method === value}
                        onChange={() => update({ farming_method: value })}
                      />
                      {tx(label)}
                    </label>
                  ))}
                </fieldset>
                <p className="small muted">
                  {tx("You can skip the two questions about your farming.")}
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <button
                  type="button"
                  className="button primary large setup-locate"
                  disabled={busy || w.offline}
                  onClick={useMyLocation}
                >
                  <LocateFixed size={22} aria-hidden="true" />{" "}
                  {tx("Use my location")}
                </button>
                <p className="small muted">
                  {tx(
                    "Stand in or near your field. Krishyak reads the place once and keeps only a rough point, about 1 km.",
                  )}
                </p>
                {phase === "locating" && (
                  <p className="setup-status" role="status">
                    {tx("Finding your village, soil and rain record…")}
                  </p>
                )}
                {found && (
                  <FoundPanel
                    found={found}
                    place={form.place}
                    village={form.village.trim()}
                  />
                )}
                <details className="setup-manual" open={!found}>
                  <summary>{tx("Or choose your place")}</summary>
                  <IndiaLocationPicker
                    value={form.place}
                    disabled={busy}
                    onChange={(place) => {
                      update({ place, location: null });
                      setFound(null);
                    }}
                  />
                  <label className="v2-label">
                    {tx("Village")}
                    <input
                      value={form.village}
                      maxLength={100}
                      onChange={(event) =>
                        update({ village: event.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || w.offline || !form.place.district_code}
                    onClick={findChosenPlace}
                  >
                    <MapPin size={18} aria-hidden="true" />{" "}
                    {tx("Find this place")}
                  </button>
                </details>
              </>
            )}

            {step === 2 && (
              <>
                <fieldset className="setup-area">
                  <legend>{tx("Your land")}</legend>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    aria-label={tx("How much land")}
                    value={form.area_value}
                    onChange={(event) =>
                      update({ area_value: event.target.value })
                    }
                  />
                  <select
                    aria-label={tx("Land unit")}
                    value={form.area_unit}
                    onChange={(event) =>
                      update({ area_unit: event.target.value })
                    }
                  >
                    {Object.entries(UNITS).map(([unit, label]) => (
                      <option key={unit} value={unit}>
                        {tx(label)}
                      </option>
                    ))}
                  </select>
                  {form.area_unit === "bigha" && (
                    <label className="v2-label">
                      {tx("Square metres in one bigha in your area")}
                      <input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="any"
                        value={form.bigha_square_metres}
                        onChange={(event) =>
                          update({ bigha_square_metres: event.target.value })
                        }
                      />
                    </label>
                  )}
                  {hectares && (
                    <p className="inline-note">
                      {tx("= {{v0}} hectares", { v0: hectares.toFixed(2) })}
                    </p>
                  )}
                </fieldset>
                <fieldset className="setup-choice">
                  <legend>{tx("Water for the field")}</legend>
                  {WATER.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="water"
                        value={value}
                        checked={form.water === value}
                        onChange={() => update({ water: value })}
                      />
                      {tx(label)}
                    </label>
                  ))}
                </fieldset>
                <label className="v2-label">
                  {tx("Soil")}
                  <select
                    value={form.soil_type}
                    onChange={(event) =>
                      update({
                        soil_type: event.target.value,
                        soil_source: event.target.value
                          ? "farmer_selected"
                          : null,
                        soil_measurements: null,
                      })
                    }
                  >
                    <option value="">
                      {tx("Not sure. Let Krishyak estimate")}
                    </option>
                    {Object.entries(SOILS).map(([soil, label]) => (
                      <option key={soil} value={soil}>
                        {tx(label)}
                      </option>
                    ))}
                  </select>
                </label>
                {form.soil_type && form.soil_source && (
                  <p className="inline-note">
                    {tx(SOIL_SOURCE[form.soil_source])}
                    {form.soil_measurements &&
                      ` · ${tx("{{v0}}% sand, {{v1}}% clay", {
                        v0: form.soil_measurements.sand_percent,
                        v1: form.soil_measurements.clay_percent,
                      })}`}
                    {form.condition === "dry" &&
                      ` · ${tx("You said your soil is dry.")}`}
                  </p>
                )}
              </>
            )}

            {step === 3 && (
              <>
                {suggested.length > 0 && (
                  <div className="setup-suggested">
                    <p>
                      {tx(
                        "Farmers in {{v0}} grow these in this season. Tap yours.",
                        { v0: form.place.district || tx("your district") },
                      )}
                    </p>
                    <div role="group" aria-label={tx("Common crops here")}>
                      {suggested.map((row) => (
                        <button
                          key={row.crop_id}
                          type="button"
                          className="language-chip guide-chip"
                          aria-pressed={form.crop_id === row.crop_id}
                          onClick={() => update({ crop_id: row.crop_id })}
                        >
                          {cropLabel(findCrop(row.crop_id), tx)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="v2-label">
                  {tx("Crop")}
                  <select
                    value={form.crop_id}
                    onChange={(event) =>
                      update({ crop_id: event.target.value })
                    }
                  >
                    <option value="">{tx("I will add my crop later")}</option>
                    {Object.keys(ASSESSED_CROPS).map((id) => (
                      <option key={id} value={id}>
                        {cropLabel(findCrop(id), tx)}
                      </option>
                    ))}
                  </select>
                </label>
                {form.crop_id && (
                  <label className="v2-label">
                    {tx("Sowing date")}
                    <input
                      type="date"
                      value={form.sowing_date}
                      onChange={(event) =>
                        update({ sowing_date: event.target.value })
                      }
                    />
                  </label>
                )}
                <section
                  className="setup-summary"
                  aria-labelledby="setup-summary-heading"
                >
                  <h3 id="setup-summary-heading">
                    <CheckCircle2 size={22} aria-hidden="true" />{" "}
                    {tx("Check your details")}
                  </h3>
                  <dl>
                    {summary.map(([target, label, value]) => (
                      <div key={label}>
                        <dt>{tx(label)}</dt>
                        <dd>
                          {value || (
                            <span className="setup-missing">
                              {tx("Not added yet")}
                            </span>
                          )}
                        </dd>
                        <button
                          type="button"
                          className="text-link"
                          aria-label={tx("Change {{v0}}", { v0: tx(label) })}
                          onClick={() => setStep(target)}
                        >
                          {tx("Change")}
                        </button>
                      </div>
                    ))}
                  </dl>
                </section>
              </>
            )}

            {problem && (
              <p role="alert" className="error-panel inline">
                {tx(problem)}
              </p>
            )}
            <div className="setup-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setProblem("");
                    setStep(step - 1);
                  }}
                >
                  <ArrowLeft size={18} aria-hidden="true" /> {tx("Back")}
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  className="button primary large"
                  disabled={busy || !ready[step]}
                >
                  {tx("Next")} <ArrowRight size={18} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className="button primary large"
                  disabled={
                    busy || w.offline || !ready[0] || !ready[1] || !ready[2]
                  }
                >
                  {phase === "saving" ? tx("Saving…") : tx("Save my farm")}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </>
  );
}
