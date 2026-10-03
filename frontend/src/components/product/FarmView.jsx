import { useEffect, useState } from "react";
import { Plus, ArrowRight, MapPin, Sprout, Layers } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../deferredFeature";
import { BoundaryEditor } from "./BoundaryEditor";
import { Dialog } from "./Dialog";
const FieldMap = deferredFeature(() => import("../FieldMap"));
const PlotHealth = deferredFeature(
  () => import("../../features/farms/PlotHealth"),
);
const PlotContext = deferredFeature(
  () => import("../../features/farms/PlotContext"),
);
const FieldManagement = deferredFeature(
  () => import("../../features/farms/FieldManagement"),
);

function AddField({ w, onClose }) {
  const [name, setName] = useState(""),
    [farmId, setFarmId] = useState(w.farms[0]?.id || ""),
    [farmName, setFarmName] = useState(""),
    [area, setArea] = useState(""),
    [boundary, setBoundary] = useState(null);
  return (
    <Dialog
      title={w.farms.length ? "Add a field" : "Start your first farm"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          w.act(async () => {
            let id = farmId;
            if (!id) {
              const saved = await farmApi("/farms", {
                method: "POST",
                body: { operation_id: crypto.randomUUID(), name: farmName },
              });
              id = saved.id;
              setFarmId(id);
              await w.loadFields();
            }
            const saved = await farmApi("/plots", {
              method: "POST",
              body: {
                operation_id: crypto.randomUUID(),
                farm_id: id,
                name,
                entered_area_hectares: area ? Number(area) : null,
                boundary,
                boundary_quality: boundary ? "approximate" : "manual",
              },
            });
            await w.loadFields();
            w.setSelected(saved.id);
            w.setNotice(
              "Your field was added. Add a crop cycle when you are ready.",
            );
            onClose();
          });
        }}
      >
        {w.farms.length ? (
          <label className="v2-label">
            Farm
            <select
              value={farmId}
              onChange={(event) => setFarmId(event.target.value)}
            >
              <option value="">Create a new farm</option>
              {w.farms.map((farm) => (
                <option value={farm.id} key={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>A farm groups your fields. Give it a name you will recognise.</p>
        )}
        {!farmId && (
          <label className="v2-label">
            Farm name
            <input
              required
              maxLength={100}
              value={farmName}
              onChange={(event) => setFarmName(event.target.value)}
              placeholder="e.g. Family farm"
            />
          </label>
        )}
        <label className="v2-label">
          Field name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. North field"
          />
        </label>
        <BoundaryEditor value={boundary} onChange={setBoundary} />
        <label className="v2-label">
          Field area (hectares)
          {boundary && (
            <span className="small muted">
              Optional when a boundary is drawn.
            </span>
          )}
          <input
            type="number"
            step="any"
            min="0.0001"
            max="500"
            required={!boundary}
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder="e.g. 1.5"
          />
        </label>
        <p className="small muted">
          1 hectare is approximately 2.47 acres. You can edit the area later.
        </p>
        {w.error && (
          <p className="error-panel" role="alert">
            {w.error}
          </p>
        )}
        <button className="button primary" disabled={w.busy || w.offline}>
          Save field <ArrowRight size={18} />
        </button>
      </form>
    </Dialog>
  );
}
function AddCycle({ w, onClose }) {
  return (
    <Dialog title="Add a crop cycle" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          w.act(async () => {
            await farmApi(`/plots/${w.selected}/crop-cycles`, {
              method: "POST",
              body: {
                operation_id: crypto.randomUUID(),
                crop: data.get("crop"),
                sowing_date: data.get("sowing"),
                expected_harvest: data.get("harvest"),
              },
            });
            await w.refreshEvidence();
            onClose();
          });
        }}
      >
        <p>
          Keep the planting and expected harvest dates together for{" "}
          {w.plot.name}.
        </p>
        <label className="v2-label">
          Crop
          <input
            name="crop"
            required
            maxLength={100}
            placeholder="e.g. Tomato"
          />
        </label>
        <label className="v2-label">
          Sowing date
          <input name="sowing" type="date" required />
        </label>
        <label className="v2-label">
          Expected harvest
          <input name="harvest" type="date" required />
        </label>
        {w.error && (
          <p role="alert" className="error-panel">
            {w.error}
          </p>
        )}
        <button className="button primary" disabled={w.busy || w.offline}>
          Save crop cycle
        </button>
      </form>
    </Dialog>
  );
}
export function FarmView({ workspace: w, plotId }) {
  const { plots, setSelected } = w;
  const [adding, setAdding] = useState(false),
    [cycle, setCycle] = useState(false),
    [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (plotId && plots.some((plot) => plot.id === plotId)) setSelected(plotId);
  }, [plotId, plots, setSelected]);
  const plot = w.plot;
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">THE PLACE IT ALL STARTS</span>
          <h1>{plotId && plot ? plot.name : "Your farm, field by field."}</h1>
          <p>Boundaries, crop cycles and observations in one place.</p>
        </div>
        <button
          className="button primary"
          disabled={w.offline}
          onClick={() => setAdding(true)}
        >
          <Plus size={18} />
          Add a field
        </button>
      </header>
      {plotId && !w.plots.some((item) => item.id === plotId) && !w.loading && (
        <p className="status-panel">
          This field is not available in your account. Choose a saved field
          below.
        </p>
      )}
      <div className="farm-layout">
        <section className="field-list product-card">
          <div className="section-heading">
            <h2>My fields</h2>
            <span className="badge neutral">{w.plots.length}</span>
          </div>
          {w.plots.length ? (
            w.plots.map((field) => (
              <button
                key={field.id}
                className={`field-list-item ${w.selected === field.id ? "selected" : ""}`}
                onClick={() => {
                  w.setSelected(field.id);
                  setMapOpen(false);
                }}
                aria-pressed={w.selected === field.id}
              >
                <span className="field-icon">
                  <MapPin size={21} />
                </span>
                <span>
                  <strong>{field.name}</strong>
                  <small>
                    {Number(
                      field.area_hectares || field.entered_area_hectares,
                    ).toLocaleString()}{" "}
                    ha · {field.boundary ? "Boundary mapped" : "Manual area"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))
          ) : (
            <div className="empty-inline">
              <Sprout size={34} />
              <p>No fields yet. Start with a name and an area.</p>
            </div>
          )}
          {w.plots.length > 0 && w.plots.length % 100 === 0 && (
            <button
              className="button secondary"
              disabled={w.busy || w.offline}
              onClick={() =>
                w.act(async () => {
                  const result = await farmApi(
                    `/plots?offset=${w.plots.length}&limit=100`,
                  );
                  w.setPlots((values) => [...values, ...result.items]);
                })
              }
            >
              Load more fields
            </button>
          )}
        </section>
        <section className="product-card field-overview">
          <div className="section-heading">
            <h2>{plot?.name || "A home for your field records"}</h2>
            <Layers size={23} />
          </div>
          {plot ? (
            <>
              <div className="field-facts">
                <div>
                  <span>Field area</span>
                  <strong>
                    {Number(
                      plot.area_hectares || plot.entered_area_hectares,
                    ).toLocaleString()}{" "}
                    <small>ha</small>
                  </strong>
                </div>
                <div>
                  <span>Current crop</span>
                  <strong>{w.cycles[0]?.crop || "Not recorded"}</strong>
                </div>
                <div>
                  <span>Boundary</span>
                  <strong>{plot.boundary ? "Mapped" : "Manual area"}</strong>
                </div>
              </div>
              {plot.boundary ? (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setMapOpen(!mapOpen)}
                  >
                    <MapPin size={18} />
                    {mapOpen ? "Close field map" : "Open field map"}
                  </button>
                  <p className="small muted">
                    Opening the map contacts the basemap provider.
                  </p>
                  {mapOpen && (
                    <FieldMap
                      vertices={plot.boundary.coordinates[0].slice(0, -1)}
                      onVertices={() => {}}
                      drawing={false}
                      editing={false}
                      center={plot.centroid?.coordinates}
                      instructions={`Boundary of ${plot.name}`}
                      unavailable="Map unavailable. Your saved boundary is preserved."
                    />
                  )}
                </>
              ) : (
                <div className="manual-map">
                  <MapPin size={34} />
                  <h3>Area recorded. Boundary optional.</h3>
                  <p>
                    Draw this field in the management section to enable
                    satellite requests when available.
                  </p>
                </div>
              )}
              <div className="button-row">
                <a className="button secondary" href="/app/today">
                  View next steps <ArrowRight size={16} />
                </a>
                <button
                  className="button secondary"
                  disabled={w.offline}
                  onClick={() => setCycle(true)}
                >
                  <Plus size={18} />
                  Add crop cycle
                </button>
              </div>
              {w.cycles.length > 0 && (
                <div className="cycle-summary">
                  <h3>Crop cycles</h3>
                  {w.cycles.map((item) => (
                    <p key={item.id}>
                      <strong>{item.crop}</strong> · {item.sowing_date} →{" "}
                      {item.expected_harvest} · {item.status}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="manual-map">
              <Sprout size={40} />
              <h3>Every useful decision starts here.</h3>
              <p>
                You can record a field without a map. Add its crop and
                observations as you go.
              </p>
              <button
                className="button primary"
                disabled={w.offline}
                onClick={() => setAdding(true)}
              >
                Add my first field
              </button>
            </div>
          )}
        </section>
      </div>
      {plot && (
        <>
          <PlotHealth
            key={`health:${plot.id}`}
            plot={plot}
            owner={w.farmer.id}
            consents={w.consents}
            cache={w.offlineOpt}
            offline={w.offline}
            busy={w.busy}
            act={w.act}
            providerStatus={w.status?.satellite_configuration}
            onUpdated={w.refreshEvidence}
          />
          <PlotContext
            key={`context:${plot.id}`}
            plot={plot}
            owner={w.farmer.id}
            consents={w.consents}
            cache={w.offlineOpt}
            offline={w.offline}
            busy={w.busy}
            act={w.act}
            onUpdated={w.refreshEvidence}
          />
        </>
      )}
      <details className="product-card management-details">
        <summary>Manage farms, field details & crop cycles</summary>
        <FieldManagement
          farms={w.farms}
          plot={plot}
          cycles={w.cycles}
          busy={w.busy}
          offline={w.offline}
          act={w.act}
          reload={w.loadFields}
          reloadCycles={w.refreshEvidence}
        />
      </details>
      {adding && <AddField w={w} onClose={() => setAdding(false)} />}{" "}
      {cycle && plot && <AddCycle w={w} onClose={() => setCycle(false)} />}
    </>
  );
}
