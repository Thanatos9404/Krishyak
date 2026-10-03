import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Leaf, ArrowRight } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../deferredFeature";
const ScanHistory = deferredFeature(
  () => import("../../features/farms/ScanHistory"),
);
const LIMIT =
  "A photo suggestion is not a diagnosis. Lighting, background and unsupported symptoms can change the result. Verify in the field or with an agronomist before choosing a treatment.";

export function ScanView({ workspace: w }) {
  const [crop, setCrop] = useState(w.cycles[0]?.crop || "Tomato"),
    [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(null),
    [result, setResult] = useState(null),
    [model, setModel] = useState(null);
  const camera = useRef(null),
    upload = useRef(null);
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
  }, [w.selected]);
  const cycleCrop = w.cycles[0]?.crop;
  useEffect(() => {
    setCrop(cycleCrop || "Tomato");
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
          <span className="eyebrow">A CLOSER LOOK AT YOUR CROP</span>
          <h1>Start with a clear photograph.</h1>
          <p>
            Capture a leaf or upload a photo. Get a suggestion, then check what
            you see.
          </p>
        </div>
        <span className="badge neutral">
          <Leaf size={15} />
          Field verification needed
        </span>
      </header>
      {!w.plot && (
        <p className="status-panel">
          Add a field in <a href="/app/farm">Farm</a> before saving a crop
          photograph.
        </p>
      )}
      <div className="scan-layout">
        <section className="product-card camera-card">
          <div className={`camera-frame ${preview ? "has-photo" : ""}`}>
            {preview ? (
              <img src={preview} alt="Selected crop photograph" />
            ) : (
              <>
                <Camera size={54} strokeWidth={1.3} />
                <h2>Show the leaf clearly.</h2>
                <p>
                  Use natural light. Keep the leaf in focus and avoid a busy
                  background.
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
              Take a photo
            </button>
            <button
              className="button secondary"
              onClick={() => upload.current.click()}
            >
              <Upload size={19} />
              Upload a photo
            </button>
          </div>
          <input
            className="sr-only"
            tabIndex={-1}
            ref={camera}
            type="file"
            aria-label="Take crop photo"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={choose}
          />
          <input
            className="sr-only"
            tabIndex={-1}
            ref={upload}
            type="file"
            aria-label="Choose crop photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
          />
          <p className="small muted">
            JPEG, PNG or WebP · under 4 MB · saved privately to your field
          </p>
        </section>
        <section className="product-card scan-details">
          <h2>A suggestion you can verify.</h2>
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
              Crop
              {model ? (
                <select
                  required
                  value={crop}
                  onChange={(event) => {
                    setCrop(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Choose a supported crop</option>
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
                  onChange={(event) => setCrop(event.target.value)}
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
              Check this photograph <ArrowRight size={18} />
            </button>
            {!w.consents.includes("agronomic_analysis") && (
              <p className="small">
                Enable field analysis in{" "}
                <a href="/app/more/settings">Settings</a> to use photo analysis.
              </p>
            )}
          </form>
          {result && (
            <article className="scan-result" aria-live="polite">
              <span className="eyebrow">PHOTO SUGGESTION</span>
              <h3>
                {result.result.predicted_class?.replaceAll("_", " ") ||
                  "No supported classification"}
              </h3>
              <p>{String(result.result.status).replaceAll("_", " ")}</p>
              <p>{LIMIT}</p>
              <details>
                <summary>Model score & limitations</summary>
                {result.result.model_score != null && (
                  <p>
                    Raw model score: {result.result.model_score.toFixed(3)}.
                    This is not a calibrated probability of disease.
                  </p>
                )}
              </details>
              <h3>Does this match what you see?</h3>
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
              <summary>Supported crops & validation</summary>
              <p>{model.supported_crops.join(", ")}</p>
              <p>
                {model.release.architecture} · {model.release.classes} classes.
                Internal test{" "}
                {(model.release.metrics.test.accuracy * 100).toFixed(2)}%;
                external PlantDoc{" "}
                {(model.release.metrics.external_test.accuracy * 100).toFixed(
                  2,
                )}
                %. These datasets do not establish accuracy on your farm.
              </p>
              <a href="/technology">Read the model evidence</a>
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
