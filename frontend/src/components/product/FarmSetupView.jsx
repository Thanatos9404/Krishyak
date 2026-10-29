import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";
import { farmApi } from "../../features/farms/api";
import { useProductLocale } from "../../features/product/ProductLocale";
import { workspaceSpeech } from "../../features/product/workspaceSpeech";
import { fieldChoice } from "../../features/product/sessionStorage";
import { cropLabel, findCrop } from "../../features/product/crops";
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
export const SOILS = {
  Alluvial: "Alluvial (river plain)",
  Black: "Black (kali mitti)",
  Red: "Red (lal mitti)",
  Laterite: "Laterite",
  Desert: "Desert",
  Mountain: "Hill soil",
  Loamy: "Loamy (domat)",
  Clay: "Clay (chikni mitti)",
  Sandy: "Sandy (balui mitti)",
};
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
const NEEDS = [
  "speech_processing",
  "location_processing",
  "agronomic_analysis",
];
const SOIL_SOURCE = {
  spoken: "You told us",
  soil_map: "From the soil map for your village",
  state_typical:
    "Rough guess for your area. Choose the right one if you know it.",
  farmer_selected: "You chose this",
};
const today = () => new Date().toISOString().slice(0, 10);

export function hectaresFor(form) {
  const value = Number(form.area_value);
  if (!(value > 0)) return null;
  if (form.area_unit === "bigha") {
    const size = Number(form.bigha_square_metres);
    return size > 0 ? (value * size) / 10000 : null;
  }
  return HECTARES[form.area_unit] ? value * HECTARES[form.area_unit] : null;
}

const openReport = () => location.assign("/app/assessment");

export function FarmSetupView({ workspace: w, onSaved = openReport }) {
  const { tx, info, language } = useProductLocale();
  const speech = useSarvamRecognition({
    speechCode: info.speechCode,
    transport: workspaceSpeech,
  });
  const [text, setText] = useState(""),
    [form, setForm] = useState(null),
    [phase, setPhase] = useState("idle"),
    [problem, setProblem] = useState("");
  const missing = NEEDS.filter((purpose) => !w.consents.includes(purpose));
  const update = (patch) => setForm((value) => ({ ...value, ...patch }));
  const hectares = useMemo(() => (form ? hectaresFor(form) : null), [form]);

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
      setForm({
        name: draft.name || w.farmer?.display_name || "",
        village: draft.village || "",
        place: {
          state_code: draft.state_code,
          district_code: draft.district_code,
          state: draft.state,
          district: draft.district,
        },
        area_value: draft.area_value ?? "",
        area_unit: draft.area_unit || "acre",
        bigha_square_metres: draft.bigha_square_metres || "",
        crop_id: ASSESSED_CROPS[draft.crop_id] ? draft.crop_id : "",
        soil_type: draft.soil_type || "",
        soil_source: draft.soil_source,
        soil_measurements: draft.soil_measurements,
        condition: draft.soil_condition,
        seed: draft.seed,
        water: draft.water || "",
        location: draft.location,
        sowing_date: today(),
      });
      setPhase("review");
    } catch (error) {
      setProblem(
        error.status === 429
          ? "Please wait a minute and try again."
          : error.network
            ? "You seem to be offline. Please try again when connected."
            : "Krishyak could not understand that. Please try again or fill the form.",
      );
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

  const allow = () =>
    w.act(async () => {
      for (const purpose of missing)
        await farmApi("/consents", {
          method: "POST",
          body: { purpose, granted: true, policy_version: VOICE_POLICY },
        });
      await w.loadConsents();
    });

  const save = () =>
    w.act(async () => {
      setProblem("");
      if (
        !hectares ||
        !form.crop_id ||
        !form.soil_type ||
        !form.place.state_code
      )
        throw new Error("Add your place, land, crop and soil first.");
      setPhase("saving");
      try {
        await farmApi("/me", {
          method: "PATCH",
          body: {
            display_name: form.name.trim() || w.farmer.display_name,
            state_code: form.place.state_code,
            district_code: form.place.district_code ?? null,
            village: form.village.trim() || null,
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
            name: tx("{{v0}} field", {
              v0: cropLabel(findCrop(form.crop_id), tx),
            }),
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
            soil_metadata: {
              soil_type: form.soil_type,
              source: form.soil_source || "farmer_selected",
              condition: form.condition || null,
              seed: form.seed || null,
            },
          },
        });
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
        fieldChoice(w.farmer.id, plot.id);
        onSaved(plot.id);
      } catch (error) {
        setPhase("review");
        throw error;
      }
    });

  const busy = phase === "understanding" || phase === "saving" || w.busy;
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("Tell Krishyak about your farm")}</h1>
        <p>
          {tx(
            "Speak once. Krishyak fills in your village, land, crop and soil. You check it before saving.",
          )}
        </p>
      </header>
      {missing.length > 0 ? (
        <section className="product-card setup-consent">
          <ShieldCheck size={30} aria-hidden="true" />
          <h2>{tx("Allow Krishyak to set up your farm")}</h2>
          <p>
            {tx(
              "Your words go to Sarvam AI to be understood, your village name goes to OpenStreetMap to find it, and its rough location is used for a soil map and your field report. Your recording is not stored.",
            )}
          </p>
          <button
            type="button"
            className="button primary large"
            disabled={w.busy || w.offline}
            onClick={allow}
          >
            {tx("Allow and continue")}
          </button>
        </section>
      ) : (
        <section className="setup-voice" aria-labelledby="setup-speak">
          <h2 id="setup-speak">{tx("Speak about your farm")}</h2>
          <p className="setup-example">
            {tx(
              "For example: “I am Ramlal from Bari village in Dholpur. I have 5 bigha of land with a tubewell. I grow wheat. My soil is dry.”",
            )}
          </p>
          <VoiceOrb
            size={132}
            phase={
              speech.isListening
                ? "listening"
                : speech.status === "processing" || phase === "understanding"
                  ? "thinking"
                  : "idle"
            }
            disabled={busy || speech.isSupported === false}
            label={
              speech.isListening ? tx("Stop and send") : tx("Tap to speak")
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
                    ? tx("Voice is not available on this phone. Please type.")
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
            <Sparkles size={18} aria-hidden="true" /> {tx("Fill the form")}
          </button>
        </section>
      )}
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}
        </p>
      )}
      {form && (
        <form
          className="product-card setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2>
            <CheckCircle2 size={24} aria-hidden="true" />{" "}
            {tx("Check your details")}
          </h2>
          <label className="v2-label">
            {tx("Your name")}
            <input
              value={form.name}
              maxLength={100}
              autoComplete="name"
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label className="v2-label">
            {tx("Village")}
            <input
              value={form.village}
              maxLength={100}
              onChange={(event) => update({ village: event.target.value })}
            />
          </label>
          <IndiaLocationPicker
            value={form.place}
            disabled={busy}
            onChange={(place) => update({ place, location: null })}
          />
          {form.location ? (
            <p className="inline-note">
              <MapPin size={16} aria-hidden="true" />{" "}
              {form.location.matched === "village"
                ? tx("Village found on the map.")
                : tx(
                    "Village not found on the map; the district centre will be used for weather.",
                  )}
            </p>
          ) : null}
          <fieldset className="setup-area">
            <legend>{tx("Your land")}</legend>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              aria-label={tx("How much land")}
              value={form.area_value}
              onChange={(event) => update({ area_value: event.target.value })}
            />
            <select
              aria-label={tx("Land unit")}
              value={form.area_unit}
              onChange={(event) => update({ area_unit: event.target.value })}
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
          <label className="v2-label">
            {tx("Crop")}
            <select
              value={form.crop_id}
              onChange={(event) => update({ crop_id: event.target.value })}
            >
              <option value="" disabled>
                {tx("Choose your crop")}
              </option>
              {Object.keys(ASSESSED_CROPS).map((id) => (
                <option key={id} value={id}>
                  {cropLabel(findCrop(id), tx)}
                </option>
              ))}
            </select>
          </label>
          <label className="v2-label">
            {tx("Soil")}
            <select
              value={form.soil_type}
              onChange={(event) =>
                update({
                  soil_type: event.target.value,
                  soil_source: "farmer_selected",
                })
              }
            >
              <option value="" disabled>
                {tx("Choose your soil")}
              </option>
              {Object.entries(SOILS).map(([soil, label]) => (
                <option key={soil} value={soil}>
                  {tx(label)}
                </option>
              ))}
            </select>
          </label>
          {form.soil_source && (
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
          <fieldset className="setup-choice">
            <legend>{tx("Water for the field")}</legend>
            {[
              ["irrigated", "Tubewell, well or canal"],
              ["rainfed", "Only rain"],
            ].map(([value, label]) => (
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
            {tx("Sowing date")}
            <input
              type="date"
              value={form.sowing_date}
              onChange={(event) => update({ sowing_date: event.target.value })}
            />
          </label>
          <button
            className="button primary large"
            disabled={
              busy ||
              w.offline ||
              !hectares ||
              !form.crop_id ||
              !form.soil_type ||
              !form.place.state_code
            }
          >
            {phase === "saving"
              ? tx("Saving…")
              : tx("Save and see my field report")}{" "}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      )}
    </>
  );
}
