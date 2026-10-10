import { useCallback, useEffect, useRef, useState } from 'react';
import farmingApi from '../api/farmingApi';
import { API_BASE_URL } from '../config/api';

const KEY = 'krishyak_catalog_cache_v2';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const valid = list => Array.isArray(list) && list.length > 0 && list.length <= 1000
  && list.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 150)
  && new Set(list).size === list.length;

function savedEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.api !== API_BASE_URL) return {};
    return Object.fromEntries(['crops', 'soilTypes'].flatMap(key => {
      const entry = saved[key];
      const age = Date.now() - Date.parse(entry?.cachedAt);
      return valid(entry?.items) && Number.isFinite(age) && age >= 0 && age <= MAX_AGE ? [[key, entry]] : [];
    }));
  } catch { return {}; }
}

export default function useFarmCatalog() {
  const entries = useRef(null);
  if (entries.current === null) entries.current = savedEntries();
  const [catalog, setCatalog] = useState(() => ({
    crops: entries.current.crops?.items || [], soilTypes: entries.current.soilTypes?.items || [],
    status: {crops:'loading', soilTypes:'loading'},
  }));
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setCatalog(previous => ({...previous, status:{crops:'loading',soilTypes:'loading'}}));
    await Promise.allSettled([
      ['crops', 'crops', () => farmingApi.getCrops()],
      ['soilTypes', 'soil_types', () => farmingApi.getSoilTypes()],
    ].map(async ([key, responseKey, fetch]) => {
      try {
        const response = await fetch();
        if (!valid(response?.[responseKey])) throw new Error('Invalid catalog');
        if (request !== sequence.current) return;
        const items = response[responseKey];
        entries.current[key] = {items, cachedAt:new Date().toISOString()};
        setCatalog(previous => ({...previous,[key]:items,status:{...previous.status,[key]:'live'}}));
        // Storage failure must not invalidate a successful API response.
        try { localStorage.setItem(KEY, JSON.stringify({api:API_BASE_URL,...entries.current})); } catch {}
      } catch {
        if (request !== sequence.current) return;
        const entry = entries.current[key];
        const age = Date.now() - Date.parse(entry?.cachedAt);
        const usable = entry && age >= 0 && age <= MAX_AGE;
        setCatalog(previous => ({...previous,[key]:usable ? entry.items : [],
          status:{...previous.status,[key]:usable ? 'cached' : 'unavailable'}}));
      }
    }));
  }, []);
  useEffect(() => {
    reload();
    const reconnect = () => reload();
    window.addEventListener('online', reconnect);
    return () => { sequence.current += 1; window.removeEventListener('online', reconnect); };
  }, [reload]);
  useEffect(() => {
    if (!Object.values(catalog.status).some(status => ['cached', 'unavailable'].includes(status))) return;
    const timer = setTimeout(reload, 30000);
    return () => clearTimeout(timer);
  }, [catalog.status, reload]);
  return {...catalog, reload};
}
