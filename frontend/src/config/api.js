const LOCAL_API_URL = 'http://localhost:8000';
const PRODUCTION_API_URL = 'https://krishyak-api.vercel.app';

export const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'development' ? LOCAL_API_URL : PRODUCTION_API_URL
);

export default API_BASE_URL;
