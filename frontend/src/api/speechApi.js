import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 70000 });
let capabilitiesPromise;
let capabilitiesFetchedAt = 0;

export const getSpeechCapabilities = () => {
  if (capabilitiesFetchedAt && Date.now() - capabilitiesFetchedAt > 60000) capabilitiesPromise = null;
  if (!capabilitiesPromise) {
    capabilitiesFetchedAt = 0;
    capabilitiesPromise = client.get('/speech/capabilities').then(({ data }) => {
      capabilitiesFetchedAt = Date.now();
      return data;
    }).catch((error) => {
      capabilitiesPromise = null;
      throw error;
    });
  }
  return capabilitiesPromise;
};

export const transcribeAudio = async (blob, language, signal) => {
  const form = new FormData();
  const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', blob, `recording.${extension}`);
  form.append('language', language);
  const { data } = await client.post('/speech/transcribe', form, { signal });
  return data;
};

export const synthesizeSpeech = async (text, language, pace, signal) => {
  const { data } = await client.post('/speech/synthesize', { text, language, pace }, { signal });
  return data;
};

// Keep runtime errors in the selected UI language, never expose provider bodies.
export const speechError = (error, fallback, limitMessage) => error?.response?.status === 429
  ? (limitMessage || fallback) : fallback;
