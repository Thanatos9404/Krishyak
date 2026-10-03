import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Leaf, ArrowRight } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../../features/product/deferredProductFeature";
const ScanHistory = deferredFeature(
  () => import("../../features/farms/ScanHistory"),
);
const LIMIT =
  "A photo suggestion is not a diagnosis. Lighting, background and unsupported symptoms can change the result. Verify in the field or with an agronomist before choosing a treatment.";
export function ScanView({ workspace: w }) {
  const { tx } = useProductLocale();
  const [crop, setCrop] = useState(w.cycles[0]?.crop || "Tomato"),
    [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(null),
    [result, setResult] = useState(null),
    [model, setModel] = useState(null);
  const camera = useRef(null),
    upload = useRef(null);
  const cropChosen = useRef(false);
  useEffect(() => {
    let cancelled = false;
    farmApi("/model")
      .then((value) => {
        if (!cancelled) setModel(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    setResult(null);
    setPhoto(null);
    cropChosen.current = false;
  }, [w.selected]);
  const cycleCrop = w.cycles[0]?.crop;
  useEffect(() => {
    if (!cropChosen.current) setCrop(cycleCrop || "Tomato");
  }, [w.selected, cycleCrop]);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const choose = (event) => {
    const file = event.target.files?.[0];
    setResult(null);
    if (
      file &&
      (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4000000)
    ) {
      w.setError("Choose a JPEG, PNG or WebP photograph smaller than 4 MB.");
      setPhoto(null);
    } else {
      setPhoto(file || null);
      w.setError("");
    }
    event.target.value = "";
  };
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">{tx("A CLOSER LOOK AT YOUR CROP")}</span>
          <h1>{tx("Start with a clear photograph.")}</h1>
          <p>
            {tx(
              "Capture a leaf or upload a photo. Get a suggestion, then check what you see.",
            )}
          </p>
        </div>
        <span className="badge neutral">
          <Leaf size={15} />
          {tx("Field verification needed")}
        </span>
      </header>
      {!w.plot && (
        <p className="status-panel">
          {tx("Add a field in")} <a href="/app/farm">{tx("Farm")}</a>{" "}
          {tx("before saving a crop photograph.")}
        </p>
      )}
      <div className="scan-layout">
        <section className="product-card camera-card">
          <div className={`camera-frame ${preview ? "has-photo" : ""}`}>
            {preview ? (
              <img src={preview} alt={tx("Selected crop photograph")} />
            ) : (
              <>
                <Camera size={54} strokeWidth={1.3} />
                <h2>{tx("Show the leaf clearly.")}</h2>
                <p>
                  {tx(
                    "Use natural light. Keep the leaf in focus and avoid a busy background.",
                  )}
                </p>
              </>
            )}
          </div>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => camera.current.click()}
            >
              <Camera size={19} />
              {tx("Take a photo")}
            </button>
            <button
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
          <p className="small muted">
            {tx(
              "JPEG, PNG or WebP \xB7 under 4 MB \xB7 saved privately to your field",
            )}
          </p>
        </section>
        <section className="product-card scan-details">
          <h2>{tx("A suggestion you can verify.")}</h2>
          <p>{LIMIT}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              w.act(async () => {
                if (!photo || !w.selected)
                  throw new Error("Choose a field and a photograph first.");
                const owner = w.ownerRef.current,
                  field = w.selected;
                const data = new FormData();
                data.set("operation_id", crypto.randomUUID());
                data.set("plot_id", field);
                data.set("crop", crop);
                data.set("image", photo);
                const scan = await farmApi("/disease-scans", {
                  method: "POST",
                  body: data,
                });
                if (
                  w.ownerRef.current === owner &&
                  w.selectedRef.current === field
                ) {
                  setResult(scan);
                  await w.refreshEvidence();
                }
              });
            }}
          >
            <label className="v2-label">
              {tx("Crop")}
              {model ? (
                <select
                  required
                  value={crop}
                  onChange={(event) => {
                    cropChosen.current = true;
                    setCrop(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">{tx("Choose a supported crop")}</option>
                  <option value="Unsupported">Other / not listed</option>
                  {model.supported_crops.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  maxLength={100}
                  value={crop}
                  onChange={(event) => {
                    cropChosen.current = true;
                    setCrop(event.target.value);
                  }}
                />
              )}
            </label>
            <button
              className="button primary"
              disabled={
                w.busy ||
                w.offline ||
                !w.selected ||
                !photo ||
                !w.consents.includes("agronomic_analysis")
              }
            >
              {tx("Check this photograph")} <ArrowRight size={18} />
            </button>
            {!w.consents.includes("agronomic_analysis") && (
              <p className="small">
                {tx("Enable field analysis in")}{" "}
                <a href="/app/more/settings">{tx("Settings")}</a>{" "}
                {tx("to use photo analysis.")}
              </p>
            )}
          </form>
          {result && (
            <article className="scan-result" aria-live="polite">
              <span className="eyebrow">{tx("PHOTO SUGGESTION")}</span>
              <h3>
                {result.result.predicted_class?.replaceAll("_", " ") ||
                  tx("No supported classification")}
              </h3>
              <p>{String(result.result.status).replaceAll("_", " ")}</p>
              <p>{LIMIT}</p>
              <details>
                <summary>{tx("Model score & limitations")}</summary>
                {result.result.model_score != null && (
                  <p>
                    {tx("Raw model score:")}{" "}
                    {result.result.model_score.toFixed(3)}
                    {tx(". This is not a calibrated probability of disease.")}
                  </p>
                )}
              </details>
              <h3>{tx("Does this match what you see?")}</h3>
              <div className="button-row">
                {[
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["unsure", "Not sure"],
                ].map(([verdict, label]) => (
                  <button
                    key={verdict}
                    className="button secondary"
                    disabled={w.busy || w.offline}
                    onClick={() =>
                      w.act(async () => {
                        await farmApi("/feedback", {
                          method: "POST",
                          body: {
                            operation_id: crypto.randomUUID(),
                            image_id: result.image_id,
                            verdict,
                          },
                        });
                        w.setNotice("Your feedback was saved.");
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          )}
          {model && (
            <details className="model-details">
              <summary>{tx("Supported crops & validation")}</summary>
              <p>{model.supported_crops.join(", ")}</p>
              <p>
                {model.release.architecture} · {model.release.classes}{" "}
                {tx("classes. Internal test")}{" "}
                {(model.release.metrics.test.accuracy * 100).toFixed(2)}
                {tx("%; external PlantDoc")}{" "}
                {(model.release.metrics.external_test.accuracy * 100).toFixed(
                  2,
                )}
                {tx(
                  "%. These datasets do not establish accuracy on your farm.",
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
