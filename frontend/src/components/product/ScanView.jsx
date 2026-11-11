import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  HelpCircle,
  Phone,
  Upload,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../../features/product/deferredProductFeature";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { preparePhoto } from "../../features/farms/photo";
import guides from "../../features/product/diseaseGuides.json";
import {
  queueScan,
  removeScan,
  waitingScans,
} from "../../features/farms/scanQueue";
import { cropCatalog, cropLabel, findCrop } from "../../features/product/crops";
import { PictureSteps } from "../../features/product/PictureGuide";
const ScanHistory = deferredFeature(
  () => import("../../features/farms/ScanHistory"),
);

function ScanResult({ scan, w }) {
  const { tx, formatDate } = useProductLocale();
  const result = scan.result;
  const guidance = result.guidance || { steps: [] };
  const [answered, setAnswered] = useState(false);
  const heading =
    result.status === "detected" && guidance.name
      ? tx("Looks like {{v0}}", { v0: tx(guidance.name) })
      : result.status === "healthy"
        ? tx("No common disease seen in this photo")
        : tx("We could not tell from this photo");
  const Icon =
    result.status === "detected"
      ? AlertTriangle
      : result.status === "healthy"
        ? CheckCircle2
        : HelpCircle;
  return (
    <article
      className={`scan-result status-${result.status}`}
      aria-live="polite"
    >
      <h2>
        <Icon size={26} aria-hidden="true" /> {heading}
      </h2>
      {guidance.urgent && (
        <p className="urgent-note" role="alert">
          {tx(
            "This disease can spread quickly. Act today and get expert advice.",
          )}
        </p>
      )}
      {guidance.cause && (
        <p>
          {tx("Caused by:")} {tx(guidance.cause)}
        </p>
      )}
      <h3>{tx("What you can do now")}</h3>
      <PictureSteps steps={guidance.steps} />
      <a className="button secondary" href="tel:18001801551">
        <Phone size={18} /> {tx("Call Kisan Call Centre (free)")}
      </a>
      <p className="small muted">
        {tx(
          "This is a photo suggestion, not a diagnosis. Check the field and confirm with an expert before buying or spraying anything.",
        )}
      </p>
      {!answered ? (
        <>
          <h3>{tx("Does this match what you see?")}</h3>
          <div className="button-row">
            {[
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Not sure"],
            ].map(([verdict, label]) => (
              <button
                key={verdict}
                type="button"
                className="button secondary"
                disabled={w.busy || w.offline}
                onClick={() =>
                  w.act(async () => {
                    await farmApi("/feedback", {
                      method: "POST",
                      body: {
                        operation_id: crypto.randomUUID(),
                        image_id: scan.image_id,
                        verdict,
                      },
                    });
                    setAnswered(true);
                    w.setNotice("Your feedback was saved.");
                  })
                }
              >
                {tx(label)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="status-panel">
          {tx("Thank you. Your answer helps improve photo checks.")}
        </p>
      )}
      <details className="evidence-details">
        <summary>{tx("Technical details")}</summary>
        <p>
          {tx("Model label:")} {result.predicted_class || tx("none")} ·{" "}
          {tx("Status:")} {result.status}
        </p>
        {result.model_score != null && (
          <p>
            {tx("Raw model score:")} {Number(result.model_score).toFixed(3)}
            {tx(". This is not a calibrated probability of disease.")}
          </p>
        )}
        <p>
          {result.model_id} · {formatDate(result.observed_at, { time: true })}
        </p>
        <ul>
          {result.limitations.map((limit) => (
            <li key={limit}>{tx(limit)}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export function ScanView({ workspace: w }) {
  const { tx } = useProductLocale();
  const [model, setModel] = useState(null),
    [crop, setCrop] = useState(""),
    [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(null),
    [result, setResult] = useState(null),
    [problem, setProblem] = useState(""),
    [waiting, setWaiting] = useState([]);
  const owner = w.farmer?.id;
  useEffect(() => {
    if (!owner) return;
    waitingScans(owner)
      .then(setWaiting)
      .catch(() => setWaiting([]));
  }, [owner]);
  const camera = useRef(null),
    upload = useRef(null),
    chosen = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    farmApi("/model", { signal: controller.signal })
      .then(setModel)
      .catch((error) =>
        // With no signal, offer the crops the bundled guide library covers,
        // so a photo can still be saved to check later.
        setModel({
          supported_crops: error?.network ? Object.keys(guides.crops) : [],
        }),
      );
    return () => controller.abort();
  }, []);
  const supported = cropCatalog.filter((row) =>
    model?.supported_crops?.includes(row.photo_name),
  );
  const cycle =
    w.cycles.find((item) => item.status === "active") || w.cycles[0];
  const cycleCrop = findCrop(cycle);
  const cycleSupported = supported.some((row) => row.id === cycleCrop?.id);
  const previousField = useRef(w.selected);
  useEffect(() => {
    // Only switching between two fields clears the draft; the first field
    // selection while the workspace loads must not discard a chosen photo.
    if (previousField.current && previousField.current !== w.selected) {
      setResult(null);
      setPhoto(null);
      chosen.current = false;
    }
    previousField.current = w.selected;
  }, [w.selected]);
  const loaded = supported.length > 0;
  useEffect(() => {
    // A farmer's explicit choice wins; otherwise follow this field's crop.
    // Without a supported field crop, ask instead of guessing one.
    if (!loaded || chosen.current) return;
    setCrop(cycleSupported ? cycleCrop.id : "");
  }, [loaded, cycleSupported, cycleCrop?.id, w.selected]);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const choose = (event) => {
    const file = event.target.files?.[0];
    setResult(null);
    setProblem("");
    if (
      file &&
      (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 25000000)
    ) {
      setProblem("Choose a JPEG, PNG or WebP photograph smaller than 25 MB.");
      setPhoto(null);
    } else setPhoto(file || null);
    event.target.value = "";
  };
  const submit = () =>
    w.act(async () => {
      setProblem("");
      try {
        if (!photo || !w.selected)
          throw new Error("Choose a field and a photograph first.");
        const owner = w.ownerRef.current,
          field = w.selected;
        const data = new FormData();
        data.set("operation_id", crypto.randomUUID());
        data.set("plot_id", field);
        data.set("crop", findCrop(crop)?.name || crop);
        data.set("image", await preparePhoto(photo));
        const scan = await farmApi("/disease-scans", {
          method: "POST",
          body: data,
          timeoutMs: 60000,
        });
        if (w.ownerRef.current === owner && w.selectedRef.current === field) {
          setResult(scan);
          await w.refreshEvidence();
        }
      } catch (error) {
        setProblem(error.message);
        throw error;
      }
    });
  // No signal in the field: keep the photo on this phone and check it later.
  const saveForLater = () =>
    w.act(async () => {
      setProblem("");
      try {
        await queueScan(owner, {
          plot_id: w.selected,
          crop: findCrop(crop)?.name || crop,
          photo: await preparePhoto(photo),
        });
        setWaiting(await waitingScans(owner));
        setPhoto(null);
        w.setNotice(
          "Photo saved on this phone. Open this page when you are online to check it.",
        );
      } catch (error) {
        setProblem(error.message);
      }
    });
  const checkWaiting = () =>
    w.act(async () => {
      setProblem("");
      for (const item of waiting) {
        const data = new FormData();
        data.set("operation_id", item.id);
        data.set("plot_id", item.plot_id);
        data.set("crop", item.crop);
        data.set("image", item.photo, "leaf.jpg");
        try {
          const scan = await farmApi("/disease-scans", {
            method: "POST",
            body: data,
            timeoutMs: 60000,
          });
          await removeScan(owner, item.id);
          if (item.plot_id === w.selected) setResult(scan);
        } catch (error) {
          // A photo the server will never accept is dropped; anything else waits.
          if ([404, 409, 422].includes(error.status))
            await removeScan(owner, item.id);
          else {
            setProblem(error.message);
            break;
          }
        }
      }
      setWaiting(await waitingScans(owner));
      await w.refreshEvidence?.();
    });
  return (
    <>
      <header className="product-page-heading">
        <div>
          <h1>{tx("Check a sick plant")}</h1>
          <p>
            {tx(
              "Take a clear photo of one affected leaf. You will get a likely cause and first steps.",
            )}
          </p>
        </div>
      </header>
      {!w.plot && (
        <p className="status-panel">
          {tx("Add a field in")} <a href="/app/farm">{tx("Farm")}</a>{" "}
          {tx("before saving a crop photograph.")}
        </p>
      )}
      {/* Permissions cannot be read or changed without a connection. */}
      {!w.offline && (
        <ConsentPrompt
          workspace={w}
          purposes={["agronomic_analysis"]}
          title="Allow photo checks"
          reason="Your photo is checked by Krishyak's crop model and saved privately with this field. You can delete it at any time."
        />
      )}
      {waiting.length > 0 && (
        <section className="scan-waiting" role="status">
          <p>
            <strong>
              {waiting.length === 1
                ? tx("1 saved photo is waiting to be checked.")
                : tx("{{v0}} saved photos are waiting to be checked.", {
                    v0: waiting.length,
                  })}
            </strong>{" "}
            {w.offline
              ? tx("Open this page when you are online to check.")
              : tx("You are online now.")}
          </p>
          {!w.offline && (
            <button
              type="button"
              className="button primary"
              disabled={w.busy}
              onClick={checkWaiting}
            >
              {tx("Check saved photos now")}
            </button>
          )}
        </section>
      )}
      {w.offline && (
        <p className="inline-note">
          {tx(
            "You are offline. You can save a photo to check later, or open the picture guides.",
          )}{" "}
          <a href="/app/guides">{tx("Picture guides")}</a>
        </p>
      )}
      <div className="scan-layout">
        <section className="product-card camera-card">
          <label className="v2-label">
            {tx("Crop")}
            <select
              value={crop}
              onChange={(event) => {
                chosen.current = true;
                setCrop(event.target.value);
                setResult(null);
              }}
            >
              <option value="" disabled>
                {model ? tx("Choose your crop") : tx("Loading crops…")}
              </option>
              {supported.map((row) => (
                <option key={row.id} value={row.id}>
                  {tx(row.label)}
                </option>
              ))}
            </select>
          </label>
          {cycleCrop && !cycleSupported && model && (
            <p className="inline-note">
              {tx(
                "Photo check is not yet available for {{v0}}. You can still note what you see in your field record.",
                { v0: cropLabel(cycleCrop, tx) },
              )}
            </p>
          )}
          <div className={`camera-frame ${preview ? "has-photo" : ""}`}>
            {preview ? (
              <img src={preview} alt={tx("Selected crop photograph")} />
            ) : (
              <>
                <Camera size={54} strokeWidth={1.3} />
                <h2>{tx("Show one leaf clearly.")}</h2>
                <p>
                  {tx(
                    "Use daylight. Fill the photo with the leaf and keep it in focus.",
                  )}
                </p>
              </>
            )}
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button primary large"
              onClick={() => camera.current.click()}
            >
              <Camera size={20} />
              {tx("Take a photo")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => upload.current.click()}
            >
              <Upload size={19} />
              {tx("Upload a photo")}
            </button>
          </div>
          <input
            className="sr-only"
            tabIndex={-1}
            ref={camera}
            type="file"
            aria-label={tx("Take crop photo")}
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={choose}
          />
          <input
            className="sr-only"
            tabIndex={-1}
            ref={upload}
            type="file"
            aria-label={tx("Choose crop photo")}
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
          />
          <button
            type="button"
            className="button primary large"
            disabled={
              w.busy ||
              w.offline ||
              !w.selected ||
              !photo ||
              !crop ||
              !w.consents.includes("agronomic_analysis")
            }
            onClick={submit}
          >
            {tx("Check this photograph")} <ArrowRight size={18} />
          </button>
          {w.offline && owner && (
            <button
              type="button"
              className="button secondary large"
              // Permission is confirmed by the server when the photo is sent.
              disabled={w.busy || !w.selected || !photo || !crop}
              onClick={saveForLater}
            >
              {tx("Save photo and check it later")}
            </button>
          )}
          {problem && (
            <p role="alert" className="error-panel inline">
              {tx(problem)}
            </p>
          )}
        </section>
        <section className="product-card scan-details">
          {result ? (
            <ScanResult scan={result} w={w} />
          ) : (
            <>
              <h2>{tx("What you will get")}</h2>
              <ul className="care-steps">
                <li>{tx("The likely problem, in plain words")}</li>
                <li>{tx("First steps you can take today")}</li>
                <li>{tx("Who to call to confirm before spraying")}</li>
              </ul>
              {model && supported.length > 0 && (
                <p className="small muted">
                  {tx("Photo check works for:")}{" "}
                  {supported.map((row) => tx(row.label)).join(", ")}
                </p>
              )}
            </>
          )}
          {model?.release && (
            <details className="evidence-details">
              <summary>{tx("How accurate is this?")}</summary>
              <p>
                {tx(
                  "On a public test set of field photos, the model was right about {{v0}}% of the time. It has not been validated on Indian farms, so treat it as a first opinion.",
                  {
                    v0: Math.round(
                      model.release.metrics.external_test.accuracy * 100,
                    ),
                  },
                )}
              </p>
              <a href="/technology">{tx("Read the model evidence")}</a>
            </details>
          )}
        </section>
      </div>
      <section className="product-card">
        <ScanHistory
          plotId={w.selected}
          refresh={result?.image_id}
          act={w.act}
          busy={w.busy}
          offline={w.offline}
        />
      </section>
    </>
  );
}
