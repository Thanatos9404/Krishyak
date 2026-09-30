import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const keys = new Set();
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|jsx)$/.test(entry.name)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) keys.add(match[1]);
    }
  }
};

walk(fileURLToPath(new URL('../src', import.meta.url)));
console.log([...keys].sort().join('\n'));
console.error(`COUNT ${keys.size}`);

const english = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../src/i18n/locales/en.json', import.meta.url)), 'utf8'));
const get = (source, key) => key.split('.').reduce((value, part) => value?.[part], source);
const missingEnglish = [...keys].sort().filter((key) => typeof get(english, key) !== 'string');
console.error(`MISSING_ENGLISH ${missingEnglish.length}`);
console.error(missingEnglish.join('\n'));
