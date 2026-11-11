import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bug,
  Camera,
  CloudHail,
  CloudRain,
  Flame,
  MapPin,
  Mountain,
  Phone,
  Printer,
  Satellite,
  Sun,
  Trash2,
  Waves,
  Wheat,
  Wind,
  CircleHelp,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { preparePhoto } from "../../features/farms/photo";
import { useProductLocale } from "../../features/product/ProductLocale";
import { cropLabel, findCrop } from "../../features/product/crops";

export const CAUSES = {
  hailstorm: [CloudHail, "Hail"],
  flood: [Waves, "Flooding"],
  heavy_rain: [CloudRain, "Heavy rain"],
  drought: [Sun, "Dry spell"],
  pest_disease: [Bug, "Pest or disease"],
  fire: [Flame, "Fire"],
  storm: [Wind, "Storm or wind"],
  landslide: [Mountain, "Landslide"],
  rain_after_harvest: [Wheat, "Rain on cut crop"],
  other: [CircleHelp, "Something else"],
};
const AMOUNTS = [
  [25, "A little"],
  [50, "About half"],
  [75, "Most of it"],
  [100, "All of it"],
];
const localDay = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

function Helpline({ official, hours, individual }) {
  const { tx } = useProductLocale();
  return (
    <aside
      className={`claim-helpline ${individual && hours > 0 ? "urgent" : ""}`}
    >
      <Phone size={26} aria-hidden="true" />
      <div>
        <strong>
          {individual
            ? hours > 0
              ? tx("Tell your insurer within {{v0}} hours.", { v0: hours })
              : tx(
                  "The 72-hour window to tell your insurer has passed. Call the helpline now and ask what to do.",
                )
            : tx(
                "Losses over a wide area are assessed by the government for the whole area.",
              )}
        </strong>
        <p>
          {tx(
            "If your crop is insured under PMFBY, report the loss on the free crop insurance helpline, in the Crop Insurance app, or at your bank or agriculture office.",
          )}
        </p>
        <a className="button primary large" href={`tel:${official.helpline}`}>
          <Phone size={20} aria-hidden="true" />
          {tx("Call {{v0}} (free)", { v0: official.helpline })}
        </a>
      </div>
    </aside>
  );
}

// Step one: say what happened. A few taps, no typing needed.
export function ClaimView({ workspace: w }) {
  const { tx, formatDate } = useProductLocale();
  const [cause, setCause] = useState(""),
    [day, setDay] = useState(localDay()),
    [amount, setAmount] = useState(0),
    [note, setNote] = useState(""),
    [list, setList] = useState(null);
  useEffect(() => {
    setList(null);
    if (!w.selected) return undefined;
    const controller = new AbortController();
    farmApi(`/plots/${w.selected}/loss-reports`, { signal: controller.signal })
      .then(setList)
      .catch(() => setList({ items: [], official: { helpline: "14447" } }));
    return () => controller.abort();
  }, [w.selected]);
  const save = () =>
    w.act(async () => {
      const report = await farmApi(`/plots/${w.selected}/loss-reports`, {
        method: "POST",
        body: {
          operation_id: crypto.randomUUID(),
          cause,
          occurred_on: day,
          affected_percent: amount,
          note: note.trim(),
        },
      });
      location.assign(`/app/claim/${report.id}`);
    });
  if (!w.plot)
    return (
      <section className="product-card welcome-card">
        <h1>{tx("Report crop loss")}</h1>
        <p>
          {tx(
            "Add your field first, so the report knows which crop was damaged.",
          )}
        </p>
        <a className="button primary large" href="/app/setup">
          {tx("Tell Krishyak about your farm")} <ArrowRight size={18} />
        </a>
      </section>
    );
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("Report crop loss")}</h1>
        <p>
          {tx(
            "Make a pack of photos and details for {{v0}} that you can show your crop insurer.",
            { v0: w.plot.name },
          )}
        </p>
      </header>
      <form
        className="product-card claim-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset>
          <legend>{tx("What damaged the crop?")}</legend>
          <div className="claim-causes">
            {Object.entries(CAUSES).map(([key, [Icon, label]]) => (
              <label key={key} className={cause === key ? "chosen" : ""}>
                <input
                  type="radio"
                  name="cause"
                  value={key}
                  checked={cause === key}
                  onChange={() => setCause(key)}
                />
                <Icon size={28} aria-hidden="true" />
                {tx(label)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="v2-label">
          {tx("When did it happen?")}
          <input
            type="date"
            value={day}
            max={localDay()}
            required
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>{tx("How much of the field is damaged?")}</legend>
          <div className="claim-amounts">
            {AMOUNTS.map(([value, label]) => (
              <label key={value} className={amount === value ? "chosen" : ""}>
                <input
                  type="radio"
                  name="amount"
                  value={value}
                  checked={amount === value}
                  onChange={() => setAmount(value)}
                />
                <span className="claim-amount-bar" aria-hidden="true">
                  <i style={{ height: `${value}%` }} />
                </span>
                {tx(label)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="v2-label">
          {tx("Anything else to add? (optional)")}
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button
          className="button primary large"
          disabled={w.busy || w.offline || !cause || !amount || !day}
        >
          {tx("Next: take photos")} <ArrowRight size={18} aria-hidden="true" />
        </button>
        {w.offline && (
          <p className="inline-note">
            {tx("You are offline. Connect to save the report.")}
          </p>
        )}
      </form>
      {list?.items.length > 0 && (
        <section className="product-card" aria-labelledby="past-claims">
          <h2 id="past-claims">{tx("Your loss reports")}</h2>
          <ul className="claim-list">
            {list.items.map((item) => {
              const [Icon, label] = CAUSES[item.cause] || CAUSES.other;
              return (
                <li key={item.id}>
                  <a href={`/app/claim/${item.id}`}>
                    <Icon size={24} aria-hidden="true" />
                    <span>
                      <strong>{tx(label)}</strong>
                      {formatDate(item.occurred_on)} ·{" "}
                      {item.photo_count === 1
                        ? tx("1 photo")
                        : tx("{{v0}} photos", { v0: item.photo_count })}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function Evidence({ photo }) {
  const { tx, formatDate } = useProductLocale();
  const [url, setUrl] = useState("");
  useEffect(() => {
    let current = "";
    const controller = new AbortController();
    farmApi(`/disease-scans/${photo.id}/image`, {
      binary: true,
      signal: controller.signal,
    })
      .then((blob) => {
        current = URL.createObjectURL(blob);
        setUrl(current);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (current) URL.revokeObjectURL(current);
    };
  }, [photo.id]);
  return (
    <figure className="claim-photo">
      {url ? (
        <img src={url} alt={tx("Photo of the damaged crop")} />
      ) : (
        <span className="claim-photo-wait" />
      )}
      <figcaption>
        {formatDate(photo.captured_at, { time: true })}
        {photo.location ? (
          <span>
            <MapPin size={14} aria-hidden="true" /> {photo.location.latitude},{" "}
            {photo.location.longitude}
            {photo.distance_to_field_metres != null &&
              ` · ${tx("{{v0}} m from the field", { v0: photo.distance_to_field_metres })}`}
          </span>
        ) : (
          <span>{tx("No location saved")}</span>
        )}
      </figcaption>
    </figure>
  );
}

function position() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

// Steps two and three: photos in the field, then the pack to show or print.
export function ClaimKitView({ workspace: w, reportId }) {
  const { tx, formatDate } = useProductLocale();
  const [kit, setKit] = useState(null),
    [missing, setMissing] = useState(false),
    [problem, setProblem] = useState("");
  const picker = useRef(null);
  const locate = w.consents.includes("location_processing");
  const load = useCallback(async () => {
    try {
      setKit(await farmApi(`/loss-reports/${reportId}`));
    } catch (error) {
      if (error.status === 404) setMissing(true);
    }
  }, [reportId]);
  useEffect(() => {
    load();
  }, [load]);
  const add = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    w.act(async () => {
      setProblem("");
      try {
        const coords = locate ? await position() : null;
        const body = new FormData();
        body.set("operation_id", crypto.randomUUID());
        body.set("captured_at", new Date().toISOString());
        if (coords) {
          body.set("latitude", coords.latitude.toFixed(5));
          body.set("longitude", coords.longitude.toFixed(5));
          body.set("accuracy_metres", Math.round(coords.accuracy));
        }
        body.set("image", await preparePhoto(file));
        await farmApi(`/loss-reports/${reportId}/photos`, {
          method: "POST",
          body,
          timeoutMs: 60000,
        });
        await load();
        if (locate && !coords)
          setProblem(
            "The photo was saved, but your phone did not give a location. Turn on location and take the next one.",
          );
      } catch (error) {
        setProblem(error.message);
        throw error;
      }
    });
  };
  if (missing)
    return (
      <section className="product-card">
        <h1>{tx("This loss report was not found.")}</h1>
        <a className="button primary" href="/app/claim">
          {tx("Report crop loss")}
        </a>
      </section>
    );
  if (!kit)
    return (
      <div className="product-card report-loading" role="status">
        <span className="loading-leaf" />
        {tx("Opening your claim pack…")}
      </div>
    );
  const { report, satellite } = kit;
  const [CauseIcon, causeLabel] = CAUSES[report.cause] || CAUSES.other;
  const crop = cropLabel(findCrop(kit.crop.crop_id), tx) || kit.crop.name;
  return (
    <>
      <header className="home-greeting claim-screen-only">
        <h1>{tx("Your claim pack")}</h1>
        <p>
          {tx(
            "Take photos in the field, tell your insurer, then show or print this pack.",
          )}
        </p>
      </header>
      <div className="claim-screen-only">
        <Helpline
          official={kit.official}
          hours={report.intimation_hours_left}
          individual={report.individual_intimation}
        />
      </div>
      <section
        className="product-card claim-screen-only"
        aria-labelledby="claim-photos"
      >
        <h2 id="claim-photos">
          <Camera size={24} aria-hidden="true" />{" "}
          {tx("Photos of the damage ({{v0}} of 8)", { v0: kit.photos.length })}
        </h2>
        <p>
          {tx(
            "Stand in the field. Take one wide photo of the damaged area and a few close ones. Each photo is saved with the time and place.",
          )}
        </p>
        {!locate && (
          <ConsentPrompt
            workspace={w}
            purposes={["location_processing"]}
            title="Save the place with each photo"
            reason="An insurer trusts a photo more when it shows where it was taken. Krishyak saves your phone's location with each claim photo."
          />
        )}
        <input
          ref={picker}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label={tx("Take a claim photo")}
          onChange={add}
        />
        <button
          type="button"
          className="button primary large"
          disabled={w.busy || w.offline || kit.photos.length >= 8}
          onClick={() => picker.current.click()}
        >
          <Camera size={20} aria-hidden="true" /> {tx("Take a photo")}
        </button>
        {problem && (
          <p role="alert" className="error-panel inline">
            {tx(problem)}
          </p>
        )}
      </section>
      <article className="claim-sheet" aria-labelledby="claim-sheet-title">
        <header>
          <h2 id="claim-sheet-title">{tx("Crop loss evidence pack")}</h2>
          <p>
            {tx("Prepared with Krishyak on {{v0}}", {
              v0: formatDate(kit.generated_at, { time: true }),
            })}
          </p>
        </header>
        <dl className="claim-facts">
          <div>
            <dt>{tx("Farmer")}</dt>
            <dd>{kit.farmer.name}</dd>
          </div>
          <div>
            <dt>{tx("Village, district")}</dt>
            <dd>
              {[kit.farmer.village, kit.farmer.district, kit.farmer.state]
                .filter(Boolean)
                .join(", ") || tx("Not recorded")}
            </dd>
          </div>
          {kit.farmer.mobile && (
            <div>
              <dt>{tx("Mobile")}</dt>
              <dd dir="ltr">{kit.farmer.mobile}</dd>
            </div>
          )}
          <div>
            <dt>{tx("Field")}</dt>
            <dd>
              {kit.field.name}
              {kit.field.area_hectares != null &&
                ` · ${tx("{{v0}} hectares", { v0: kit.field.area_hectares })}`}
            </dd>
          </div>
          {kit.field.location && (
            <div>
              <dt>{tx("Field location")}</dt>
              <dd dir="ltr">
                {kit.field.location.latitude}, {kit.field.location.longitude}
              </dd>
            </div>
          )}
          <div>
            <dt>{tx("Crop")}</dt>
            <dd>
              {crop || tx("Not recorded")}
              {kit.crop.sowing_date &&
                ` · ${tx("sown {{v0}}", { v0: formatDate(kit.crop.sowing_date) })}`}
            </dd>
          </div>
          <div>
            <dt>{tx("What happened")}</dt>
            <dd>
              <CauseIcon size={18} aria-hidden="true" /> {tx(causeLabel)} ·{" "}
              {formatDate(report.occurred_on)}
            </dd>
          </div>
          <div>
            <dt>{tx("Damaged part of the field")}</dt>
            <dd>
              {tx("About {{v0}}%", { v0: Math.round(report.affected_percent) })}
            </dd>
          </div>
          {report.note && report.note !== "Crop loss reported" && (
            <div className="wide">
              <dt>{tx("Farmer's note")}</dt>
              <dd>{report.note}</dd>
            </div>
          )}
        </dl>
        <h3>
          <Satellite size={20} aria-hidden="true" />{" "}
          {tx("Satellite view, before and after")}
        </h3>
        {satellite.status === "available" ? (
          <div className="claim-satellite">
            {[
              ["before", "Before"],
              ["after", "After"],
            ].map(([key, label]) => (
              <div key={key}>
                <span className="claim-satellite-bar" aria-hidden="true">
                  <i
                    style={{
                      height: `${Math.max(4, Math.min(100, satellite[key].mean * 100))}%`,
                    }}
                  />
                </span>
                <strong>{tx(label)}</strong>
                <span>
                  {formatDate(satellite[key].from)} –{" "}
                  {formatDate(satellite[key].to)}
                </span>
                <span>
                  {tx("Greenness {{v0}}", { v0: satellite[key].mean })}
                </span>
              </div>
            ))}
            <p>
              {satellite.change <= -0.1
                ? tx("The field became much less green after the loss day.")
                : satellite.change < -0.03
                  ? tx(
                      "The field became a little less green after the loss day.",
                    )
                  : tx(
                      "The satellite does not show a clear drop in greenness.",
                    )}{" "}
              {tx(
                "Source: Sentinel-2. Greenness also falls at ripening and harvest.",
              )}
            </p>
          </div>
        ) : (
          <p className="inline-note">
            {satellite.status === "needs_boundary"
              ? tx(
                  "Draw this field's outline in My fields to add the satellite view.",
                )
              : satellite.status === "waiting_for_clear_view"
                ? tx(
                    "The satellite has not had a clear view since the loss day. Open this pack again in a few days.",
                  )
                : tx(
                    "There is no clear satellite view from before the loss day. Refresh the satellite view in My fields.",
                  )}{" "}
            <a
              className="claim-screen-only"
              href={`/app/farm/${report.plot_id}`}
            >
              {tx("Open field")}
            </a>
          </p>
        )}
        <h3>
          <Camera size={20} aria-hidden="true" /> {tx("Photos")}
        </h3>
        {kit.photos.length ? (
          <div className="claim-photos">
            {kit.photos.map((photo) => (
              <Evidence key={photo.id} photo={photo} />
            ))}
          </div>
        ) : (
          <p className="inline-note">
            {tx("No photos yet. Take them in the field.")}
          </p>
        )}
        <footer>
          <p>
            {tx(
              "Prepared by the farmer. Photo time and place come from the farmer's phone. Not verified by Krishyak, an insurer or the government. Only the insurer decides a claim.",
            )}
          </p>
          <p>
            {tx("Report ID")}: <span dir="ltr">{report.id}</span>
          </p>
        </footer>
      </article>
      <div className="button-row claim-screen-only">
        <button
          type="button"
          className="button primary large"
          onClick={() => window.print()}
        >
          <Printer size={20} aria-hidden="true" /> {tx("Print or save as PDF")}
        </button>
        <button
          type="button"
          className="button text"
          disabled={w.busy}
          onClick={() => {
            if (window.confirm(tx("Delete this loss report and its photos?")))
              w.act(async () => {
                await farmApi(`/loss-reports/${reportId}`, {
                  method: "DELETE",
                });
                location.assign("/app/claim");
              });
          }}
        >
          <Trash2 size={18} aria-hidden="true" /> {tx("Delete this report")}
        </button>
      </div>
    </>
  );
}
