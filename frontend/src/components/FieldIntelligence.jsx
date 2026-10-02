import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import remoteSensingApi from '../api/remoteSensingApi';
import { getCurrentLocation } from '../api/weatherApi';
import { getLocationContext } from '../api/locationContextApi';
import { FIELD_KEY, SUMMARY_KEY, polygonFromVertices, verticesFromPolygon, nearbyVertices, safeRead, safeWrite, readSummary, requestDigest } from '../utils/remoteSensing';
import demoBoundary from '../data/remoteSensingDemo.json';

const FieldMap = lazy(() => import('./FieldMap'));
const TrendChart = lazy(() => import('./FieldTrendChart'));
const isoDay = date => date.toISOString().slice(0, 10);
const savedVertices = () => verticesFromPolygon(safeRead(FIELD_KEY));

export default function FieldIntelligence({ formData, farmer, onNavigate }) {
  const { t, languageInfo } = useTranslation();
  const tr = key => t(`remoteSensing.${key}`);
  const [vertices, setVertices] = useState(savedVertices);
  const [status, setStatus] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false), [drawing, setDrawing] = useState(false), [editing, setEditing] = useState(false);
  const [center, setCenter] = useState(null), [coordinateText, setCoordinateText] = useState(''), [geojson, setGeojson] = useState('');
  const [area, setArea] = useState(null), [index, setIndex] = useState('ndvi'), [layer, setLayer] = useState('true_color');
  const [startDate, setStartDate] = useState(() => isoDay(new Date(Date.now() - 90 * 86400000)));
  const [endDate, setEndDate] = useState(() => isoDay(new Date())), [intervalDays, setIntervalDays] = useState(10);
  const [summary, setSummary] = useState(null), [cached, setCached] = useState(null), [acquisitions, setAcquisitions] = useState([]);
  const [selectedDay, setSelectedDay] = useState(''), [image, setImage] = useState(null), [notice, setNotice] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null), [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState(null), [context, setContext] = useState(null), [contextBusy, setContextBusy] = useState(false);
  const [nearby, setNearby] = useState(false), [autoRequest, setAutoRequest] = useState(false);
  const sequence = useRef(0), controller = useRef(null), imageUrl = useRef(null);
  const locationPromise = useRef(null), locationVersion = useRef(0), manuallyChanged = useRef(false), autoAnalyze = useRef(null);
  const analyzedRequest = useRef(null);
  const resetImage = () => { if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); imageUrl.current = null; setImage(null); };

  useEffect(() => {
    const abort = new AbortController();
    remoteSensingApi.status(abort.signal).then(setStatus).catch(() => { if (!abort.signal.aborted) setError('serviceUnavailable'); });
    const entry = readSummary();
    if (entry) setCached(entry);
    return () => { abort.abort(); controller.current?.abort(); sequence.current += 1; if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('locationFailed'); return undefined; }
    let active = true;
    const version=++locationVersion.current;
    const abort = new AbortController();
    setLocationBusy(true);
    // StrictMode reuses the pending promise instead of issuing two permission requests.
    locationPromise.current ||= getCurrentLocation({ includeAccuracy:true });
    locationPromise.current.then(point => {
      if (!active || version!==locationVersion.current) return;
      setDeviceLocation(point); setCenter([point.lon,point.lat]); setLocationError(null);
      const points = nearbyVertices(point);
      if (!Number.isFinite(point.accuracy) || point.accuracy > 100 || point.accuracy < 0 || !points.length) {
        setLocationError('locationAccuracy'); return;
      }
      if (!manuallyChanged.current) {
        setVertices(points); setNearby(true); setAutoRequest(true);
        remoteSensingApi.geometry(polygonFromVertices(points),abort.signal).then(value => {
          if (active && version===locationVersion.current && !manuallyChanged.current) setArea(value.area);
        }).catch(() => { /* Mapping remains available if area service is unreachable. */ });
      }
    }).catch(() => { if (active) setLocationError('locationFailed'); })
      .finally(() => { if (active) setLocationBusy(false); });
    return () => { active=false; locationVersion.current+=1; abort.abort(); };
  }, []);

  useEffect(() => {
    if (!deviceLocation || !navigator.onLine) return undefined;
    const abort = new AbortController();
    setContextBusy(true); setContext(null);
    getLocationContext(deviceLocation,formData?.crop || farmer?.primaryCrop,abort.signal)
      .then(value=>{ if (!abort.signal.aborted) setContext(value); })
      .catch(()=>{ /* Individual unavailable sources are displayed below. */ })
      .finally(()=>{ if (!abort.signal.aborted) setContextBusy(false); });
    return () => abort.abort();
  }, [deviceLocation, formData?.crop, farmer?.primaryCrop]);

  useEffect(() => {
    if (autoRequest && status?.status === 'ready') {
      setAutoRequest(false); autoAnalyze.current?.();
    }
  }, [autoRequest, status?.status]);

  const invalidate = () => {
    controller.current?.abort(); sequence.current += 1; setBusy(false); setSummary(null); setAcquisitions([]);
    setSelectedDay(''); setArea(null); resetImage(); analyzedRequest.current = null;
  };
  const changeVertices = next => { manuallyChanged.current=true; setAutoRequest(false); setNearby(false); invalidate(); setVertices(next); setError(null); };
  const changeRequest = (setter, value) => { setAutoRequest(false); invalidate(); setter(value); setError(null); };
  const begin = () => { controller.current?.abort(); const abort = new AbortController(); controller.current = abort; const id = ++sequence.current; setBusy(true); setError(null); setNotice(null); return { signal: abort.signal, current: () => id === sequence.current }; };
  const fail = async (err, current) => {
    if (!current() || err?.code === 'ERR_CANCELED') return;
    let code = err?.response?.data?.code;
    if (err?.response?.data instanceof Blob) {
      try { code = JSON.parse(await err.response.data.text()).code; } catch { /* Generic image error below. */ }
    }
    if (!current()) return;
    const mapping = { invalid_request: 'invalidField', invalid_geometry: 'invalidField', no_clear_observations: 'insufficient',
      local_quota: 'quota', quota_exceeded: 'quota', busy: 'quota', authentication: 'setup', access_denied: 'setup',
      timeout: 'timeout', not_configured: 'setup', disabled: 'setup' };
    setError(navigator.onLine === false ? 'offline' : mapping[code] || 'serviceUnavailable');
  };

  const validateField = async () => {
    const polygon = polygonFromVertices(vertices);
    if (!polygon) { setError('invalidField'); return; }
    const task = begin();
    try { const value = await remoteSensingApi.geometry(polygon, task.signal); if (task.current()) setArea(value.area); }
    catch (err) { await fail(err, task.current); }
    finally { if (task.current()) setBusy(false); }
  };

  const analyze = async () => {
    const geometry = polygonFromVertices(vertices);
    if (!geometry) { setError('invalidField'); return; }
    if (!navigator.onLine) { setError('offline'); return; }
    const request = { geometry, start_date: startDate, end_date: endDate, index, interval_days: Number(intervalDays), max_cloud_percent: 100,
      spatial_scope:nearby ? 'device_neighborhood' : 'field' };
    const task = begin(); resetImage(); setSummary(null); setAcquisitions([]); setSelectedDay('');
    try {
      // Series and acquisition search can fail independently; retain useful successful evidence.
      const results = await Promise.allSettled([remoteSensingApi.timeseries(request, task.signal), remoteSensingApi.acquisitions(request, task.signal)]);
      if (!task.current()) return;
      if (results[0].status === 'fulfilled') {
        const data = results[0].value;
        setSummary(data); setArea(data.area); analyzedRequest.current = request;
        const digest = await requestDigest(request);
        if (!task.current()) return;
        const entry = { version: 1, data, request_digest: digest, saved_at: new Date().toISOString() };
        if (safeWrite(SUMMARY_KEY, entry)) setCached(entry); else setNotice('storageUnavailable');
      } else await fail(results[0].reason, task.current);
      if (!task.current()) return;
      if (results[1].status === 'fulfilled') {
        const days = [...new Set(results[1].value.acquisitions.map(a => a.acquired_at.slice(0, 10)))];
        setAcquisitions(days); setSelectedDay(days[0] || '');
        if (results[1].value.truncated) setNotice('catalogTruncated');
        if (nearby && results[0].status === 'fulfilled' && results[0].value.status === 'clear') {
          // At most two candidate days; never loop indefinitely through cloudy scenes.
          for (const day of days.slice(0,2)) {
            try {
              const blob = await remoteSensingApi.preview({ ...request, start_date:day, end_date:day, layer:'true_color', width:256, height:256 },task.signal);
              if (!task.current()) return;
              const url=URL.createObjectURL(blob); imageUrl.current=url;
              setSelectedDay(day); setLayer('true_color'); setImage({url,geometry:request.geometry,layer:'true_color',day});
              setNotice(previous=>previous==='autoImageUnavailable' ? (results[1].value.truncated ? 'catalogTruncated' : null) : previous);
              break;
            } catch (err) {
              if (!task.current()) return;
              let code=err?.response?.data?.code;
              if (err?.response?.data instanceof Blob) {
                try { code=JSON.parse(await err.response.data.text()).code; } catch { /* Preserve the successful summary. */ }
              }
              if (code !== 'no_clear_observations') { setNotice('autoImageUnavailable'); break; }
              setNotice('autoImageUnavailable');
            }
          }
        }
      } else await fail(results[1].reason, task.current);
    } catch (err) { await fail(err, task.current); }
    finally { if (task.current()) setBusy(false); }
  };
  autoAnalyze.current=analyze;

  const loadImage = async () => {
    const base = analyzedRequest.current;
    if (!base || !selectedDay) return;
    const task = begin(); resetImage();
    const width = Math.min(512, Math.max(128, window.innerWidth - 32));
    try {
      const blob = await remoteSensingApi.preview({ ...base, start_date: selectedDay, end_date: selectedDay, layer, width, height: width }, task.signal);
      if (!task.current()) return;
      const url = URL.createObjectURL(blob); imageUrl.current = url;
      setImage({ url, geometry: base.geometry, layer, day: selectedDay }); setMapOpen(true);
    } catch (err) { await fail(err, task.current); }
    finally { if (task.current()) setBusy(false); }
  };
  const locate = async () => {
    const version=++locationVersion.current;
    const task = begin(); setLocationBusy(true);
    try {
      const location = await getCurrentLocation({includeAccuracy:true});
      if (task.current()) {
        setDeviceLocation(location); setCenter([location.lon,location.lat]); setLocationError(null);
        const points=nearbyVertices(location);
        if (!Number.isFinite(location.accuracy) || location.accuracy > 100 || location.accuracy < 0 || !points.length) { setLocationError('locationAccuracy'); return; }
        invalidate(); manuallyChanged.current=false; setVertices(points); setNearby(true); setAutoRequest(true);
        remoteSensingApi.geometry(polygonFromVertices(points)).then(value=>{ if (version===locationVersion.current && !manuallyChanged.current) setArea(value.area); }).catch(()=>{});
      }
    }
    catch { if (task.current()) setLocationError('locationFailed'); }
    finally { setLocationBusy(false); if (task.current()) setBusy(false); }
  };
  const centerOnCoordinates = () => {
    const [lat, lon, extra] = coordinateText.split(',').map(value => Number(value.trim()));
    if (!coordinateText.includes(',') || extra !== undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) { setError('invalidField'); return; }
    setCenter([lon, lat]); setMapOpen(true); setError(null);
  };
  const displayed = summary || cached?.data;
  const latest = displayed?.observations?.at(-1);
  const number = value => value == null ? '—' : Number(value).toLocaleString(languageInfo?.speechCode || 'en-IN', { maximumFractionDigits: 3 });
  const canAnalyze = status?.status === 'ready' && !busy;
  const mismatch = area && formData?.area_hectares > 0 && Math.abs(area.hectares - formData.area_hectares) / formData.area_hectares > .2;
  return <div className="rs-page page-stack">
    <div className="card-farm rs-card"><p className="field-eyebrow">{tr('eyebrow')}</p><h2>{tr('title')}</h2><p>{tr('intro')}</p>
      <p>{t(`crops.${(formData?.crop || farmer?.primaryCrop || '').toLowerCase()}`) || formData?.crop} · {number(formData?.area_hectares)} ha · {[farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ')}</p>
      {status && status.status !== 'ready' && <p role="status" className="rs-notice">{tr('setup')}</p>}
      {!status && !error && <p role="status">{t('common.loading')}</p>}
      {error && <p role="alert" className="rs-notice">{tr(error)}</p>}
      {notice && <p role="status" className="rs-notice">{tr(notice)}</p>}
    </div>

    <section className="card-farm rs-card" aria-labelledby="rs-location"><h3 id="rs-location">{tr('deviceContext')}</h3>
      <p>{tr('automaticLocation')}</p><p className="text-sm">{tr('locationPrivacy')}</p>
      {locationBusy && <p role="status">{tr('findingLocation')}</p>}
      {locationError && <p role="status" className="rs-notice">{tr(locationError)}</p>}
      <button type="button" onClick={locate} disabled={busy || locationBusy}>{tr('gps')}</button>
      {deviceLocation && <p>{[context?.location?.city,context?.location?.district,context?.location?.state].filter(Boolean).join(', ') || tr('deviceLocated')}
        {Number.isFinite(deviceLocation.accuracy) && <> · {tr('gpsAccuracy')}: {number(deviceLocation.accuracy)} m</>}</p>}
      {context?.location && <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors / Nominatim</a></small>}
      {contextBusy && <p role="status">{tr('contextLoading')}</p>}
      {deviceLocation && !contextBusy && <div className="rs-context-grid">
        <article><h4>{tr('localWeather')}</h4>{context?.weather && !context.weather.isMock && context.weather.current?.temp != null
          ? <><p>{number(context.weather.current.temp)} °C · {number(context.weather.current.humidity)}% {tr('humidity')}</p><p className="text-sm">{tr('weatherModel')} · {context.weather.current.observed_at}</p></>
          : <p>{tr('contextUnavailable')}</p>}<a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo</a></article>
        <article><h4>{tr('localClimate')}</h4>{context?.climate
          ? <><p>{number(context.climate.mean_temperature_c)} °C · {number(context.climate.mean_annual_precipitation_mm)} mm/{tr('year')}</p><p className="text-sm">{tr('climateBaseline')} · {context.climate.computed_at}</p></>
          : <p>{tr('contextUnavailable')}</p>}<a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">ERA5 / ECMWF / Open-Meteo</a></article>
        <article><h4>{tr('localSoil')}</h4><p>{tr('soilUnavailable')}</p><button type="button" onClick={()=>onNavigate('soil')}>{tr('soilRecords')}</button></article>
        <article><h4>{tr('localPests')}</h4><p>{tr('pestHistoryUnavailable')}</p>
          {context?.pests && <><p>{tr('farmerReports')}: {context.pests.reports.length}</p><p className="text-sm">{tr('reportLimitations')}</p>
            <ul>{context.pests.reports.map((row,i)=><li key={i}>{row.name} · {row.crop} · {row.reported_at || '—'}</li>)}</ul></>}
          <button type="button" onClick={()=>onNavigate('pest')}>{tr('pestReports')}</button></article>
        <article><h4>{tr('localCrops')}</h4><p>{tr('planCrop')}: {t(`crops.${(formData?.crop || farmer?.primaryCrop || '').toLowerCase()}`)}</p><p>{tr('cropHistoryUnavailable')}</p></article>
        <article><h4>{tr('diseaseSupport')}</h4><p>{tr('diseaseEvidence')}</p><button type="button" onClick={()=>onNavigate('health')}>{tr('checkPhoto')}</button></article>
      </div>}
    </section>

    <section className="card-farm rs-card" aria-labelledby="rs-boundary"><h3 id="rs-boundary">{tr('boundary')}</h3><p>{tr('mapInstructions')}</p>
      {nearby && <p role="status" className="rs-notice">{tr('nearbyExplanation')}</p>}
      <div className="rs-actions rs-boundary-actions">
        <button type="button" onClick={() => setMapOpen(true)}>{tr('openMap')}</button>
        <button type="button" onClick={() => { changeVertices(verticesFromPolygon(demoBoundary)); setCenter([73.001, 26.801]); setNotice('demoNotice'); }}>{tr('demo')}</button>
        <button type="button" aria-pressed={drawing} onClick={() => { setDrawing(!drawing); setEditing(false); setMapOpen(true); }}>{drawing ? tr('finish') : tr('draw')}</button>
        <button type="button" aria-pressed={editing} onClick={() => { setEditing(!editing); setDrawing(false); }}>{tr('edit')}</button>
        <button type="button" onClick={() => changeVertices(vertices.slice(0, -1))} disabled={!vertices.length}>{tr('undo')}</button>
        <button type="button" onClick={() => { changeVertices([]); try { localStorage.removeItem(FIELD_KEY); localStorage.removeItem(SUMMARY_KEY); } catch { setNotice('storageUnavailable'); } setCached(null); }}>{tr('reset')}</button>
      </div>
      <p className="text-sm">{tr('mapPrivacy')}</p>
      {mapOpen && <Suspense fallback={<p role="status">{t('common.loading')}</p>}><FieldMap vertices={vertices} onVertices={changeVertices} drawing={drawing} editing={editing} center={center} image={image} instructions={tr('mapInstructions')} unavailable={tr('mapUnavailable')} /></Suspense>}
      <details><summary>{tr('manualBoundary')}</summary>
        <div className="rs-inline"><label htmlFor="rs-center">{tr('coordinates')}</label><input id="rs-center" value={coordinateText} placeholder="26.8, 73.0" onChange={e => setCoordinateText(e.target.value)} /><button type="button" onClick={centerOnCoordinates}>{tr('center')}</button></div>
        <label htmlFor="rs-geojson">{tr('geojson')}</label><textarea id="rs-geojson" rows={4} maxLength={16000} value={geojson} onChange={e => setGeojson(e.target.value)} placeholder='{"type":"Polygon","coordinates":[[[73,26.8],…]]}' />
        <button type="button" onClick={() => { try { const next = verticesFromPolygon(JSON.parse(geojson)); if (!next.length) throw new Error(); changeVertices(next); } catch { setError('invalidField'); } }}>{tr('importBoundary')}</button>
        <p>{tr('vertexCount')}: {vertices.length}/200</p>
        {editing && vertices.map((point, i) => <div className="rs-vertex" key={i}>{['longitude', 'latitude'].map((key, j) => <label key={key}>{tr(key)} {i + 1}<input type="number" step="0.000001" value={point[j]} onChange={e => { const next = vertices.map(p => [...p]); next[i][j] = Number(e.target.value); changeVertices(next); }} /></label>)}</div>)}
      </details>
      <div className="rs-actions"><button type="button" onClick={validateField} disabled={busy || vertices.length < 3}>{tr('calculateArea')}</button>
        <button type="button" disabled={!area || nearby} onClick={() => { const polygon = polygonFromVertices(vertices); if (!polygon || !safeWrite(FIELD_KEY, polygon)) setNotice('storageUnavailable'); else setNotice('saved'); }}>{tr('saveBoundary')}</button>
        {farmer?.boundary && <button type="button" onClick={() => changeVertices(verticesFromPolygon(farmer.boundary))}>{tr('profileBoundary')}</button>}
      </div>
      <p aria-live="polite">{tr(nearby ? 'nearbyArea' : 'mappedArea')}: {number(area?.hectares)} ha / {number(area?.acres)} acres</p>
      {mismatch && !nearby && <p className="rs-notice">{tr('areaMismatch')}</p>}
      {area && area.square_metres / 400 < 25 && <p className="rs-notice">{tr('smallField')}</p>}
    </section>

    <section className="card-farm rs-card" aria-labelledby="rs-observe"><h3 id="rs-observe">{tr('observe')}</h3>
      <div className="rs-controls"><label>{tr('from')}<input type="date" value={startDate} max={endDate} onChange={e => changeRequest(setStartDate, e.target.value)} /></label>
        <label>{tr('to')}<input type="date" value={endDate} max={isoDay(new Date())} min={startDate} onChange={e => changeRequest(setEndDate, e.target.value)} /></label>
        <label>{tr('index')}<select value={index} onChange={e => changeRequest(setIndex, e.target.value)}>{['ndvi','ndmi','ndre'].map(key => <option key={key} value={key}>{tr(`${key}Label`)} ({key.toUpperCase()})</option>)}</select></label>
        <label>{tr('interval')}<select value={intervalDays} onChange={e => changeRequest(setIntervalDays, Number(e.target.value))}><option value={5}>5 {tr('days')}</option><option value={10}>10 {tr('days')}</option></select></label>
      </div><p>{tr('analysisPrivacy')}</p><button type="button" className="rs-primary" disabled={!canAnalyze} onClick={analyze}>{busy ? t('common.loading') : tr('analyze')}</button>
      {summary && !acquisitions.length && <p role="status">{tr('noImagery')}</p>}
      {summary && acquisitions.length > 0 && <><div className="rs-controls"><label>{tr('imageDay')}<select value={selectedDay} onChange={e => { controller.current?.abort(); sequence.current += 1; setBusy(false); setSelectedDay(e.target.value); resetImage(); }}>{acquisitions.map(day => <option key={day}>{day}</option>)}</select></label>
        <label>{tr('layer')}<select value={layer} onChange={e => { controller.current?.abort(); sequence.current += 1; setBusy(false); setLayer(e.target.value); resetImage(); }}>{['true_color','ndvi','ndmi','ndre'].map(key => <option key={key} value={key}>{key === 'true_color' ? tr('naturalColor') : key.toUpperCase()}</option>)}</select></label></div>
        <button type="button" onClick={loadImage} disabled={busy}>{tr('loadImage')}</button><p className="text-sm">{tr('imageExplanation')}</p>
      </>}
      {image && <><p>{image.layer.toUpperCase()} · {image.day} · CDSE Sentinel-2 L2A · {tr('dailyMosaic')}</p><img src={image.url} alt={tr('imageAlt')} className="rs-preview" onError={() => { resetImage(); setError('imageFailed'); }} />
        <small>Contains modified Copernicus Sentinel data ({image.day.slice(0,4)})</small>
        <p>{image.layer === 'true_color' ? tr('colorStretch') : tr('legend')}</p></>}
    </section>

    {displayed && <section className="card-farm rs-card" aria-labelledby="rs-evidence"><h3 id="rs-evidence">{tr('observations')}</h3>
      {displayed.provenance.spatial_scope === 'device_neighborhood' && <p className="rs-notice">{tr('nearbyExplanation')}</p>}
      {!summary && <p role="status" className="rs-notice">{tr('cached')} — {cached.saved_at} · {tr('previousField')}</p>}
      <p>{tr('computed')}: {displayed.provenance.computed_at}</p>
      {displayed.status === 'insufficient_data' && <p role="status" className="rs-notice">{tr('insufficient')}</p>}
      <div className="rs-metrics"><div><span>{displayed.index.toUpperCase()}</span><strong>{number(latest?.mean)}</strong></div>
        <div><span>{tr('trend')}</span><strong>{tr(displayed.trend?.status || 'insufficient_data')}</strong></div>
        <div><span>{tr('validPixels')}</span><strong>{number(latest ? latest.valid_fraction * 100 : null)}%</strong></div>
        <div><span>{tr('observationPeriod')}</span><strong>{latest?.start?.slice(0,10) || '—'} / {latest?.end?.slice(0,10) || '—'}</strong></div>
      </div>
      {displayed.trend?.status === 'declining' && <p className="rs-notice">{tr('inspect')}</p>}
      <Suspense fallback={<p>{t('common.loading')}</p>}><TrendChart observations={displayed.observations} index={displayed.index} description={tr('chartDescription')} /></Suspense>
      <details><summary>{tr('details')}</summary><p>CDSE · Sentinel-2 · L2A · {displayed.provenance.spatial_resolution_m} m</p><p>{displayed.provenance.formula}</p><p>{tr('scientificLimitations')}</p>
        <p>{tr('qualityExplanation')}</p><p>{tr('mosaicExplanation')}</p><p>{tr('economicSeparation')}</p>
        <p>{tr('geometryHash')}: <code className="rs-hash">{displayed.provenance.requested_geometry_hash}</code></p>
        <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html" target="_blank" rel="noreferrer">{tr('officialSource')}</a>
      </details>
    </section>}
    <section className="card-farm rs-card"><h3>{tr('groundCheck')}</h3><p>{tr('inspect')}</p><div className="rs-actions">
      <button type="button" onClick={() => onNavigate('health')}>{t('nav.cropHealth')}</button>
      <button type="button" onClick={() => onNavigate('weather')}>{t('weather.title')}</button>
      <button type="button" onClick={() => onNavigate('soil')}>{t('soilSensor.title')}</button>
      <button type="button" onClick={() => onNavigate('pest')}>{t('pest.title')}</button>
      <button type="button" onClick={() => onNavigate('simulation')}>{t('sidebar.runSimulation')}</button>
    </div></section>
  </div>;
}
