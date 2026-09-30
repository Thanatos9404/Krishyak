import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localeRoot = fileURLToPath(new URL('../src/i18n/locales', import.meta.url));
const english = JSON.parse(fs.readFileSync(path.join(localeRoot, 'en.json'), 'utf8'));
const codes = ['as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'];
const scripts = {
  as: 'Bengali', bn: 'Bengali', brx: 'Devanagari', doi: 'Devanagari', gu: 'Gujarati',
  hi: 'Devanagari', kn: 'Kannada', ks: 'Arabic', kok: 'Devanagari', mai: 'Devanagari',
  ml: 'Malayalam', mni: 'Meetei_Mayek', mr: 'Devanagari', ne: 'Devanagari', or: 'Oriya',
  pa: 'Gurmukhi', sa: 'Devanagari', sat: 'Ol_Chiki', sd: 'Arabic', ta: 'Tamil', te: 'Telugu', ur: 'Arabic',
};
const intentionallyShared = new Set(['app.name']);
const allowedLatin = /(?:Krishyak|AI|JAM|PM-KISAN|DBT|MSP|NPK|DAP|MOP|JPG|PNG|WebP|MB|pH|API|React|FastAPI|ML|e-NAM|KCC|GPS|SMS|OTP|ID|kg|mm|ha)/gi;

const flatten = (source, prefix = '', target = {}) => {
  for (const [key, value] of Object.entries(source || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, fullKey, target);
    else if (typeof value === 'string') target[fullKey] = value;
  }
  return target;
};

const englishFlat = flatten(english);
const failures = [];
for (const code of codes) {
  const basePath = path.join(localeRoot, `${code}.json`);
  const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
  const generated = JSON.parse(fs.readFileSync(path.join(localeRoot, 'generated', `${code}.json`), 'utf8'));
  const flat = flatten(generated);
  const allowedScript = new RegExp(`\\p{Script=${scripts[code]}}`, 'u');
  for (const [key, value] of Object.entries(flat)) {
    const source = englishFlat[key];
    const sourcePlaceholders = [...(source || '').matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    const translatedPlaceholders = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(translatedPlaceholders)) {
      failures.push(`${code}.${key}: placeholder mismatch`);
    }
    if (value === source && !intentionallyShared.has(key) && !/^[A-Z0-9 .&+/-]{1,12}$/.test(value)) {
      failures.push(`${code}.${key}: unchanged English`);
    }
    const scrubbed = value
      .replace(/\{\{\w+\}\}/g, '')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '')
      .replace(/data\.gov\.in/gi, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\([NPK]\)/g, '')
      .replace(allowedLatin, '');
    if (key === 'privacy.contact' || key === 'terms.contact') continue;
    const foreignLetters = [...scrubbed].filter((char) => /\p{L}/u.test(char) && !allowedScript.test(char) && char !== 'ʼ');
    if (foreignLetters.length) failures.push(`${code}.${key}: foreign script in "${value}"`);
  }

  const localizedPests = { ...(base.pests || {}), ...(generated.pests || {}) };
  for (const [key, source] of Object.entries(english.pests || {})) {
    const value = localizedPests[key];
    if (!value) failures.push(`${code}.pests.${key}: missing localized pest label`);
    else if (value === source) failures.push(`${code}.pests.${key}: unchanged English`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${codes.length} lazy translation packs: placeholders, English fallbacks, and script purity.`);
}
