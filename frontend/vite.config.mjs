import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const deployment = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const previewHeaders = Object.fromEntries(deployment.headers[0].headers.map(({ key, value }) => [key, value]));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_MAP_STYLE_URL']);
  return {
    plugins: [react()],
    // Preserve the existing deployment variable without exposing other env values.
    define: {
      'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || ''),
      'process.env.VITE_MAP_STYLE_URL': JSON.stringify(env.VITE_MAP_STYLE_URL || ''),
    },
    server: { host: '127.0.0.1', port: 3000, strictPort: true, proxy: { '/api/v2': { target: 'http://127.0.0.1:8000' } } },
    preview: { host: '127.0.0.1', port: 3000, strictPort: true, headers: previewHeaders, proxy: { '/api/v2': { target: 'http://127.0.0.1:8000' } } },
    build: { outDir: 'build' },
  };
});
