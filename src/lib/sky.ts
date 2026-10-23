// The sky over Phú Quốc at a given minute of the day, driven by the real sunrise/sunset:
// three gradient stops, where the sun or moon sits on its arc, and how much of the night shows (stars).

type Stops = [string, string, string]; // top, middle, horizon

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, t: number) =>
  '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

const NIGHT: Stops = ['#0b1a2e', '#14294b', '#27426b'];
const keys = (rise: number, set: number): [number, Stops][] => [
  [rise - 90, NIGHT],
  [rise - 30, ['#2b3566', '#7d5c8a', '#e3917f']], // first light
  [rise + 20, ['#6d9bd1', '#f2b896', '#ffd9a8']], // sunrise
  [rise + 120, ['#4fa8e3', '#9fd6f2', '#e4f5fb']], // morning
  [set - 120, ['#4aa3df', '#a3d6ef', '#f4e6c9']], // afternoon
  [set - 40, ['#7fa6cf', '#f6b98a', '#f59a62']], // golden hour
  [set, ['#5d6a9e', '#e0806a', '#e8692e']], // sunset
  [set + 30, ['#2e3566', '#6a4f7d', '#c2616f']], // dusk
  [set + 80, NIGHT],
];

export interface Sky {
  stops: Stops; sea: string; stars: number; label: string;
  sun: { x: number; y: number; color: string } | null; // x: 0–100 % across, y: 0 (horizon) – 1 (zenith)
  moon: { x: number; y: number } | null;
}

/** minute = minutes since local midnight; rise/set = minutes since midnight. */
export function skyAt(minute: number, rise = 5 * 60 + 53, set = 17 * 60 + 43): Sky {
  const k = keys(rise, set);
  let stops = NIGHT;
  for (let i = 0; i < k.length - 1; i++) {
    const [a, ca] = k[i], [b, cb] = k[i + 1];
    if (minute >= a && minute <= b) { const t = (minute - a) / (b - a); stops = ca.map((c, j) => mix(c, cb[j], t)) as Stops; break; }
  }
  const day = (minute - rise) / (set - rise); // 0 at sunrise, 1 at sunset
  const dark = clamp(Math.max(rise - minute, minute - set) / 60); // 0 by day → 1 an hour past sunset
  const arc = (f: number) => Math.sin(Math.PI * clamp(f));
  const nightFrac = ((minute - set + 1440) % 1440) / (1440 - (set - rise));
  const h = minute / 60;
  const label = h < 4 ? 'Đêm khuya' : h < 11 ? 'Buổi sáng' : h < 13.5 ? 'Buổi trưa' : h < 18 ? 'Buổi chiều' : 'Buổi tối';
  return {
    stops, label, stars: dark,
    sea: mix('#1a8aa3', '#07303a', dark),
    // low sun burns orange, high sun goes pale gold
    sun: day > -0.05 && day < 1.05 ? { x: 8 + 84 * clamp(day), y: arc(day), color: mix('#ff8a4c', '#ffe7a3', arc(day)) } : null,
    moon: dark > 0.3 ? { x: 8 + 84 * clamp(nightFrac), y: arc(nightFrac) } : null,
  };
}
