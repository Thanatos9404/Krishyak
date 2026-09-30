import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const code = process.argv[2];
const scripts = { mni: 'Meetei_Mayek', sat: 'Ol_Chiki', sd: 'Arabic' };
if (!scripts[code]) throw new Error(`Unsupported audit code: ${code}`);
const localeRoot = fileURLToPath(new URL('../src/i18n/locales', import.meta.url));
const english = JSON.parse(fs.readFileSync(path.join(localeRoot, 'en.json'), 'utf8'));
const generated = JSON.parse(fs.readFileSync(path.join(localeRoot, 'generated', `${code}.json`), 'utf8'));
const allowedScript = new RegExp(`\\p{Script=${scripts[code]}}`, 'u');
const allowedLatin = /(?:Krishyak|AI|JAM|PM-KISAN|DBT|MSP|NPK|DAP|MOP|JPG|PNG|WebP|MB|pH|API|React|FastAPI|ML|e-NAM|KCC|GPS|SMS|OTP|ID|kg|mm|ha)/gi;
const get = (source, key) => key.split('.').reduce((value, part) => value?.[part], source);
const flatten = (source, prefix = '', target = {}) => {
  for (const [key, value] of Object.entries(source || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, fullKey, target);
    else if (typeof value === 'string') target[fullKey] = value;
  }
  return target;
};

const items = [];
for (const [key, value] of Object.entries(flatten(generated))) {
  if (key === 'privacy.contact' || key === 'terms.contact') continue;
  const scrubbed = value
    .replace(/\{\{\w+\}\}/g, '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '')
    .replace(/data\.gov\.in/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\([NPK]\)/g, '')
    .replace(allowedLatin, '');
  if ([...scrubbed].some((char) => /\p{L}/u.test(char) && !allowedScript.test(char) && char !== 'ʼ')) {
    items.push({ key, source: get(english, key), current: value });
  }
}

console.log(JSON.stringify(items, null, 2));
console.error(`ITEMS ${items.length} SOURCE_CHARS ${items.reduce((sum, item) => sum + item.source.length + 1, 0)}`);
