import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getWeatherForecast } from './weatherApi';
import remoteSensingApi from './remoteSensingApi';

export const getLocationContext = async (point, crop, signal) => {
  // No precise device position, context, or third-party error objects are logged or saved.
  const [place, weather, climate] = await Promise.allSettled([
    remoteSensingApi.place({latitude:point.lat,longitude:point.lon},signal),
    getWeatherForecast(Math.round(point.lat*100)/100, Math.round(point.lon*100)/100, signal),
    remoteSensingApi.climate({ latitude: point.lat, longitude: point.lon }, signal),
  ]);
  const location = place.status === 'fulfilled' ? place.value : null;
  let pests = null;
  if (location?.country === 'India' && location.state && crop && !signal?.aborted) {
    const [reports, history] = await Promise.allSettled([
      axios.post(`${API_BASE_URL}/pest/alerts`, { state: location.state, district: location.district || undefined, crop }, { signal, timeout:15000 }),
      axios.get(`${API_BASE_URL}/pest/history`, { params:{ state:location.state, crop, years:3 }, signal, timeout:15000 }),
    ]);
    const alerts = reports.status === 'fulfilled' && reports.value.data?.success ? reports.value.data : null;
    const past = history.status === 'fulfilled' && history.value.data?.success ? history.value.data : null;
    if (alerts || past) pests = {
      government_feed_status:alerts?.government_feed_status || 'unavailable',
      historical_feed_status:past?.historical_feed_status || 'unavailable',
      // Do not retain reporting farmer IDs, coordinates, free-text descriptions, or photos.
      reports:(Array.isArray(alerts?.farmer_reports) ? alerts.farmer_reports : []).slice(0,10).filter(row=>row && typeof row.pest_name==='string' && typeof row.crop==='string' && row.crop.toLowerCase()===crop.toLowerCase())
        .map(row=>({ name:row.pest_name.slice(0,100), crop:row.crop.slice(0,50), severity:row.severity, reported_at:row.reported_at || row.timestamp })),
      history_available:past?.historical_feed_status === 'available',
      history_count:past?.historical_feed_status === 'available' && Array.isArray(past.outbreaks) ? past.outbreaks.length : null,
    };
  }
  return { location, weather:weather.status === 'fulfilled' ? weather.value : null,
    climate:climate.status === 'fulfilled' ? climate.value : null, pests };
};
