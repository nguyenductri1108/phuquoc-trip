// Bake the live Google Sheet into src/data/trip.json (offline fallback). Run: npm run pull-sheet
import { writeFileSync } from 'node:fs';
import { fetchSheet, normalize } from '../src/lib/trip.ts';
import { SHEET_URL, START } from '../src/config.ts';

const raw = await fetchSheet(SHEET_URL);
const { issues, lich, quan } = normalize(raw, START);
if (issues.length) console.warn(`⚠ ${issues.length} dòng bị bỏ qua:\n` + issues.join('\n'));
// "updated" lets the app tell whether this snapshot or a viewer's cached copy of the Sheet is newer
writeFileSync(new URL('../src/data/trip.json', import.meta.url), JSON.stringify({ updated: new Date().toISOString(), ...raw }, null, 1) + '\n');
console.log(`src/data/trip.json: ${lich.length} mục lịch, ${Object.keys(quan).length} quán`);
