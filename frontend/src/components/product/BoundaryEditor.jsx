import { useProductLocale } from "../../features/product/ProductLocale";
import { useState } from "react";
import {
  LocateFixed,
  MapPin,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
} from "lucide-react";
import { deferredFeature } from "../../features/product/deferredProductFeature";
const FieldMap = deferredFeature(() => import("../FieldMap"));
export function BoundaryEditor({ value, onChange }) {
  const { tx } = useProductLocale();
  const initial = value?.coordinates?.[0]?.slice(0, -1) || [];
  const [history, setHistory] = useState([initial]),
    [position, setPosition] = useState(0);
  const [open, setOpen] = useState(false),
    [center, setCenter] = useState(null),
    [error, setError] = useState("");
  const vertices = history[position];
  const commit = (next) => {
    setHistory((previous) => [...previous.slice(0, position + 1), next]);
    setPosition(position + 1);
    onChange(
      next.length >= 3
        ? {
            type: "Polygon",
            coordinates: [[...next, next[0]]],
          }
        : null,
    );
  };
  const travel = (step) => {
    const next = position + step;
    setPosition(next);
    const points = history[next];
    onChange(
      points.length >= 3
        ? {
            type: "Polygon",
            coordinates: [[...points, points[0]]],
          }
        : null,
    );
  };
  const locate = () => {
    setError("");
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable. You can draw on the map or enter an area below.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setCenter([result.coords.longitude, result.coords.latitude]);
        setOpen(true);
      },
      () =>
        setError(
          "Location permission was denied or the position could not be found. Draw on the map or use manual area.",
        ),
      {
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };
  return (
    <fieldset className="boundary-editor">
      <legend>
        {tx("Field boundary")} <span className="optional">optional</span>
      </legend>
      <p>
        {tx(
          "Mark the corners on a map, or leave this step and enter the area. A boundary enables satellite requests when configured.",
        )}
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button secondary"
          onClick={() => setOpen(!open)}
        >
          <MapPin size={18} />
          {open ? tx("Close map") : tx("Draw on a map")}
        </button>
        <button type="button" className="button secondary" onClick={locate}>
          <LocateFixed size={18} />
          {tx("Use my location")}
        </button>
      </div>
      {error && (
        <p role="status" className="status-panel">
          {error}
        </p>
      )}
      {open && (
        <>
          <p className="small muted">
            {tx(
              "The map contacts OpenFreeMap. Select corners by clicking. For a keyboard, move the map with arrow keys and use \u201CAdd corner at map centre\u201D. Drag a corner to adjust it.",
            )}
          </p>
          <FieldMap
            vertices={vertices}
            onVertices={commit}
            drawing
            editing
            center={center}
            instructions="Draw the field boundary. Arrow keys move the map."
            unavailable="The map could not load. Enter the area to continue."
          />
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              disabled={!position}
              onClick={() => travel(-1)}
            >
              <Undo2 size={16} />
              {tx("Undo")}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={position >= history.length - 1}
              onClick={() => travel(1)}
            >
              <Redo2 size={16} />
              {tx("Redo")}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={!vertices.length}
              onClick={() => commit(vertices.slice(0, -1))}
            >
              <Trash2 size={16} />
              {tx("Remove last corner")}
            </button>
            <button
              type="button"
              className="button text"
              disabled={!vertices.length}
              onClick={() => commit([])}
            >
              <RotateCcw size={16} />
              {tx("Reset")}
            </button>
          </div>
          <p role="status">
            {vertices.length} {vertices.length === 1 ? "corner" : "corners"} ·{" "}
            {vertices.length < 3
              ? tx("Add at least three corners, or use manual area.")
              : tx("Boundary ready to save. Area is calculated by the server.")}
          </p>
        </>
      )}
    </fieldset>
  );
}
