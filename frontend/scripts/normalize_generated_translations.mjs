import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import scheduledLocales from '../src/i18n/locales/scheduledLocales.js';

const localeRoot = fileURLToPath(new URL('../src/i18n/locales', import.meta.url));
const codes = ['as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'];

for (const code of codes) {
  const basePath = path.join(localeRoot, `${code}.json`);
  const base = fs.existsSync(basePath)
    ? JSON.parse(fs.readFileSync(basePath, 'utf8'))
    : scheduledLocales[code];
  const generatedPath = path.join(localeRoot, 'generated', `${code}.json`);
  const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
  const privacyLabel = generated.privacy?.title || base.privacy?.title || base.common?.information || base.registration?.title;
  const termsLabel = generated.terms?.title || base.terms?.title || base.common?.information || base.registration?.title;
  generated.privacy = { ...generated.privacy, contact: `${privacyLabel}: privacy@krishyak.app` };
  generated.terms = { ...generated.terms, contact: `${termsLabel}: support@krishyak.app` };
  fs.writeFileSync(generatedPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
}

console.log('Normalized localized support and privacy contact labels.');
