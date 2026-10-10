import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fieldBounds, polygonFromVertices } from '../utils/remoteSensing';

setWorkerUrl('/map/maplibre-gl-worker.mjs');
const empty = { type: 'FeatureCollection', features: [] };

export default function FieldMap({ vertices, onVertices, drawing, editing, center, image, instructions, unavailable }) {
  const container = useRef(null), mapRef = useRef(null), markers = useRef([]);
  const current = useRef({ vertices, onVertices, drawing, editing });
  current.current = { vertices, onVertices, drawing, editing };
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    let map;
    try {
      map = new Map({ container: container.current,
        style: process.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
        center: [73, 26.8], zoom: 12, attributionControl: true });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        map.addSource('field', { type: 'geojson', data: empty });
        map.addLayer({ id: 'field-fill', type: 'fill', source: 'field', paint: { 'fill-color': '#287454', 'fill-opacity': .16 } });
        map.addLayer({ id: 'field-border', type: 'line', source: 'field', paint: { 'line-color': '#18543c', 'line-width': 3 } });
        setReady(true);
      });
      map.on('click', event => {
        const value = current.current;
        if (value.drawing && value.vertices.length < 200) value.onVertices([...value.vertices, [event.lngLat.lng, event.lngLat.lat]]);
      });
      map.on('error', () => setFailed(true));
      map.on('webglcontextlost', () => setFailed(true));
    } catch { setFailed(true); }
    return () => { markers.current.forEach(m => m.remove()); map?.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const polygon = polygonFromVertices(vertices);
    map.getSource('field')?.setData(polygon ? { type: 'Feature', geometry: polygon, properties: {} } : empty);
    markers.current.forEach(m => m.remove());
    markers.current = vertices.map((point, index) => {
      const marker = new Marker({ color: '#18543c', draggable: editing }).setLngLat(point).addTo(map);
      marker.on('dragend', () => {
        const value = current.current;
        const next = [...value.vertices];
        const position = marker.getLngLat();
        next[index] = [position.lng, position.lat];
        value.onVertices(next);
      });
      return marker;
    });
  }, [vertices, ready, editing]);
  useEffect(() => { if (center) mapRef.current?.jumpTo({ center, zoom: 15 }); }, [center]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer('satellite')) map.removeLayer('satellite');
    if (map.getSource('satellite')) map.removeSource('satellite');
    if (image) {
      const [west, south, east, north] = fieldBounds(image.geometry);
      map.addSource('satellite', { type: 'image', url: image.url, coordinates: [[west, north], [east, north], [east, south], [west, south]] });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-opacity': .85 } }, 'field-border');
      map.fitBounds([[west, south], [east, north]], { padding: 32, maxZoom: 18, duration: 0 });
    }
  }, [image, ready]);
  return <div className="rs-map-wrap"><div ref={container} className="rs-map" role="region" aria-label={instructions} />
    {drawing && <button type="button" disabled={!ready || vertices.length >= 200} onClick={() => {
      const point = mapRef.current?.getCenter();
      if (point) onVertices([...vertices, [point.lng, point.lat]]);
    }}>Add corner at map centre</button>}
    {failed && <p role="status" className="rs-notice">{unavailable}</p>}
  </div>;
}
