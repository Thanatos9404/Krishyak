import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 90000 });
const post = async (path, request, signal) => {
  const response = await api.post(`/remote-sensing/${path}`, request, { signal });
  if (!response.data?.success || !response.data.data) throw new Error('Invalid satellite response');
  return response.data.data;
};

export const remoteSensingApi = {
  status: async signal => {
    const response = await api.get('/remote-sensing/status', { signal, timeout: 15000 });
    if (!response.data?.success) throw new Error('Satellite service unavailable');
    return response.data.data;
  },
  geometry: (polygon, signal) => post('geometry', polygon, signal),
  acquisitions: (request, signal) => post('acquisitions', request, signal),
  timeseries: (request, signal) => post('timeseries', request, signal),
  climate: (point, signal) => post('climate', point, signal),
  place: (point, signal) => post('place', point, signal),
  preview: async (request, signal) => {
    const response = await api.post('/remote-sensing/preview', request, { signal, responseType: 'blob' });
    if (!response.data?.type?.includes('image/png')) throw new Error('Invalid satellite image');
    return response.data;
  },
};

export default remoteSensingApi;
