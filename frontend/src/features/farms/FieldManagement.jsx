import { useProductLocale } from "../product/ProductLocale";
import React, { useState } from "react";
import { farmApi } from "./api";
import { BoundaryEditor } from "../../components/product/BoundaryEditor";
import { AreaInput } from "../../components/product/AreaInput";
import { fromHectares, toHectares } from "../product/india";
function CycleEditor({ cycle, busy, offline, act, reload }) {
  const { tx } = useProductLocale();
  const [draft, setDraft] = useState(cycle);
  return (
    <details>
      <summary>
        {cycle.crop} · {cycle.status} {tx("\xB7 edit cycle")}
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            const fields = [
              "crop",
              "variety",
              "sowing_date",
              "expected_harvest",
              "growth_stage",
              "season",
              "status",
              "revision",
            ];
            await farmApi(`/crop-cycles/${cycle.id}`, {
              method: "PUT",
              body: {
                ...Object.fromEntries(fields.map((key) => [key, draft[key]])),
                operation_id: crypto.randomUUID(),
              },
            });
            await reload();
          });
        }}
      >
        {["crop", "variety", "growth_stage", "season"].map((key) => (
          <label className="v2-label" key={key}>
            {key.replaceAll("_", " ")}
            <input
              value={draft[key] || ""}
              required={key === "crop"}
              maxLength={key === "crop" || key === "variety" ? 100 : 50}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  [key]: event.target.value || null,
                }))
              }
            />
          </label>
        ))}
        {["sowing_date", "expected_harvest"].map((key) => (
          <label className="v2-label" key={key}>
            {key.replaceAll("_", " ")}
            <input
              type="date"
              required
              value={draft[key]}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        <label className="v2-label">
          {tx("Cycle status")}
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                status: event.target.value,
              }))
            }
          >
            {["planned", "active", "completed", "cancelled"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <button disabled={busy || offline}>{tx("Update cycle")}</button>
        <button
          className="v2-danger"
          type="button"
          disabled={busy || offline}
          onClick={() =>
            act(async () => {
              if (
                !window.confirm(
                  "Delete this crop cycle? Field observations remain in the timeline.",
                )
              )
                return;
              await farmApi(`/crop-cycles/${cycle.id}`, {
                method: "DELETE",
              });
              await reload();
            })
          }
        >
          {tx("Delete cycle")}
        </button>
      </form>
    </details>
  );
}
function PlotEditor({ plot, busy, offline, act, reload }) {
  const { tx } = useProductLocale();
  const [name, setName] = useState(plot.name),
    [area, setArea] = useState(
      plot.entered_area_hectares
        ? Number(fromHectares(plot.entered_area_hectares, "acre").toFixed(6))
        : "",
    ),
    [areaUnit, setAreaUnit] = useState("acre"),
    [areaEdited, setAreaEdited] = useState(false),
    [boundary, setBoundary] = useState(plot.boundary || null),
    [irrigation, setIrrigation] = useState(plot.irrigation_type || "");
  return (
    <details>
      <summary>
        {tx("Edit selected field:")} {plot.name}
      </summary>
      <p>
        {tx(
          "Boundary edits make earlier satellite observations historical. Conflicting edits from another device require a refresh.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            const geometry = boundary;
            await farmApi(`/plots/${plot.id}`, {
              method: "PUT",
              body: {
                operation_id: crypto.randomUUID(),
                revision: plot.revision,
                farm_id: plot.farm_id,
                name,
                entered_area_hectares: areaEdited
                  ? area
                    ? toHectares(area, areaUnit)
                    : null
                  : plot.entered_area_hectares,
                boundary: geometry,
                boundary_quality: geometry ? "farmer_drawn" : "manual",
                irrigation_type: irrigation || null,
              },
            });
            await reload();
          });
        }}
      >
        <label className="v2-label">
          {tx("Updated field name")}
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <AreaInput
          label={tx("Updated manual area")}
          value={area}
          onChange={(value) => {
            setArea(value);
            setAreaEdited(true);
          }}
          unit={areaUnit}
          onUnitChange={setAreaUnit}
          required={!boundary}
        />
        <BoundaryEditor value={boundary} onChange={setBoundary} />
        <label className="v2-label">
          {tx("Irrigation type, if known")}
          <input
            maxLength={50}
            value={irrigation}
            onChange={(event) => setIrrigation(event.target.value)}
          />
        </label>
        <button disabled={busy || offline}>{tx("Update field")}</button>
        <button
          className="v2-danger"
          type="button"
          disabled={busy || offline}
          onClick={() =>
            act(async () => {
              if (
                !window.confirm(
                  "Delete this field and its cycles, timeline and photographs? Photo removal is queued.",
                )
              )
                return;
              await farmApi(`/plots/${plot.id}`, {
                method: "DELETE",
              });
              await reload();
            })
          }
        >
          {tx("Delete selected field")}
        </button>
      </form>
    </details>
  );
}
export default function FieldManagement({
  farms,
  plot,
  cycles,
  busy,
  offline,
  act,
  reload,
  reloadCycles,
}) {
  const { tx } = useProductLocale();
  return (
    <section className="v2-card">
      <h2>{tx("Manage saved farms and cycles")}</h2>
      {farms.map((farm) => (
        <article className="v2-event" key={`${farm.id}:${farm.revision}`}>
          <h3>{farm.name}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get("name");
              act(async () => {
                await farmApi(`/farms/${farm.id}`, {
                  method: "PATCH",
                  body: {
                    revision: farm.revision,
                    name,
                  },
                });
                await reload();
              });
            }}
          >
            <label className="v2-label">
              {tx("Rename farm")}
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={farm.name}
              />
            </label>
            <button disabled={busy || offline}>{tx("Rename farm")}</button>
            <button
              type="button"
              className="v2-danger"
              disabled={busy || offline}
              onClick={() =>
                act(async () => {
                  if (
                    !window.confirm(
                      `Delete ${farm.name} and all its fields, evidence and photographs?`,
                    )
                  )
                    return;
                  await farmApi(`/farms/${farm.id}`, {
                    method: "DELETE",
                  });
                  await reload();
                })
              }
            >
              {tx("Delete farm")}
            </button>
          </form>
        </article>
      ))}
      {plot && (
        <PlotEditor
          key={`${plot.id}:${plot.revision}`}
          plot={plot}
          busy={busy}
          offline={offline}
          act={act}
          reload={reload}
        />
      )}
      {cycles.map((cycle) => (
        <CycleEditor
          key={`${cycle.id}:${cycle.revision}`}
          cycle={cycle}
          busy={busy}
          offline={offline}
          act={act}
          reload={reloadCycles}
        />
      ))}
    </section>
  );
}
