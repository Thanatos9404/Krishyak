export const FIELD_KEY = 'krishyak_rs_field_v1';
export const SUMMARY_KEY = 'krishyak_rs_summary_v1';

// A device-centred 200 m square is nearby context, never a cadastral field.
export const nearbyVertices = ({ lat, lon }) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return [];
  const dy = 100 / 111320, dx = dy / Math.cos(lat * Math.PI / 180);
  const points=[[lon-dx,lat-dy],[lon+dx,lat-dy],[lon+dx,lat+dy],[lon-dx,lat+dy]];
  return points.some(p=>Math.abs(p[0])>180 || Math.abs(p[1])>85) ? [] : points;
};

export const safeRead = key => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
export const safeWrite = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
export const polygonFromVertices = vertices => {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 200) return null;
  if (vertices.some(p => !Array.isArray(p) || p.length !== 2 || p.some(x => !Number.isFinite(x)) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85)) return null;
  return { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] };
};
export const verticesFromPolygon = polygon => {
  const ring = polygon?.type === 'Polygon' && polygon.coordinates?.length === 1 ? polygon.coordinates[0] : null;
  if (!Array.isArray(ring)) return [];
  const points = ring.length > 1 && JSON.stringify(ring[0]) === JSON.stringify(ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
  return polygonFromVertices(points) ? points : [];
};

// Cache stores no boundary, identity or precise coordinates. A digest binds the
// summary to the requested geometry/date/index without storing location in a key.
export const requestDigest = async request => {
  if (!globalThis.crypto?.subtle) return null;
  const data = new TextEncoder().encode(JSON.stringify(request));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
};
export const readSummary = () => {
  const entry = safeRead(SUMMARY_KEY);
  const age = Date.now() - Date.parse(entry?.saved_at);
  const data = entry?.data;
  return entry?.version === 1 && ['ndvi','ndmi','ndre'].includes(data?.index)
    && data?.provenance?.evidence_type === 'remote_sensing_observation'
    && Number.isFinite(Date.parse(data.provenance.computed_at))
    && Array.isArray(data.observations) && data.observations.length <= 40
    && data.observations.every(item => Number.isFinite(Date.parse(item.start)) && Number.isFinite(Date.parse(item.end))
      && (item.mean === null || Number.isFinite(item.mean)) && Number.isFinite(item.valid_fraction)
      && item.valid_fraction >= 0 && item.valid_fraction <= 1)
    && Number.isFinite(age) && age >= 0 && age <= 30 * 86400000 ? entry : null;
};

export const fieldBounds = geometry => {
  const ring = geometry.coordinates[0];
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
