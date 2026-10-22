// Pure trip logic – no DOM, no React. `npm test` checks it (trip.test.ts).

export type Row = Record<string, string>;
export interface RawTrip { ngay: Row[]; quan: Row[]; lich: Row[]; canh_bao: Row[] }

const PLACE_KEYS = ['id', 'ten', 'nhom', 'loai', 'dia_chi', 'dien_thoai', 'gio_mo_cua', 'danh_gia', 'gia', 'toa_do', 'maps'] as const;
const STOP_KEYS = ['bat_dau', 'ket_thuc', 'hoat_dong', 'dresscode', 'quan', 'du_phong', 'mo_ta', 'du_phong_mo_ta',
  'gia', 'luu_y', 'dat_truoc', 'di_chuyen', 'links'] as const;
const WARN_KEYS = ['muc', 'tieu_de', 'chi_tiet', 'links'] as const;

export type Place = Record<(typeof PLACE_KEYS)[number], string> & { lat: number | null; lng: number | null };
export type Stop = Record<(typeof STOP_KEYS)[number], string> & { ngay: number; row: number; start: number; end: number; key: string };
export type Warning = Record<(typeof WARN_KEYS)[number], string> & { ngay: number };
export interface DayInfo { ngay: number; tieu_de: string }
export interface Trip { ngay: DayInfo[]; quan: Record<string, Place>; lich: Stop[]; canh_bao: Warning[]; issues: string[] }
export type Phase = 'empty' | 'before' | 'during' | 'after';

export const TZ = '+07:00', MIN = 6e4, HOUR = 36e5, DAY = 864e5;

const str = (v: unknown) => (v == null ? '' : String(v)).trim();
const pick = <K extends string>(r: Row, keys: readonly K[]) =>
  Object.fromEntries(keys.map(k => [k, str(r[k])])) as Record<K, string>;

export const toMin = (s: string) => {
  const m = /^\s*(\d{1,2})(?:\s*[:hg.]\s*(\d{2})?)?\s*$/i.exec(s || '');
  return m ? +m[1] * 60 + +(m[2] || 0) : NaN;
};
export const dayStart = (start: string, n: number) => Date.parse(`${start}T00:00:00${TZ}`) + (n - 1) * DAY;

export function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else q = false;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export const toObjects = ([head = [], ...rows]: string[][]): Row[] => rows.map(r =>
  Object.fromEntries(head.map((k, i) => [k.trim(), (r[i] || '').trim()]).filter(([k]) => k)));

// Sheet rows (all strings) → render-ready trip. Bad rows are skipped and reported, never fatal.
export function normalize(raw: RawTrip, start: string): Trip {
  const issues: string[] = [], quan: Record<string, Place> = {};
  raw.quan.forEach((r, i) => {
    const p = pick(r, PLACE_KEYS);
    if (!p.id) return;
    const [lat, lng] = p.toa_do.split(',').map(v => parseFloat(v));
    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    if (!ok) issues.push(`quan dòng ${i + 2} (${p.id}): ${p.toa_do ? `toạ độ "${p.toa_do}" không đọc được` : 'chưa có toạ độ'} → chưa hiện trên bản đồ`);
    quan[p.id] = { ...p, lat: ok ? lat : null, lng: ok ? lng : null };
  });
  const lich: Stop[] = [];
  const ends = new Map<Stop, number | null>();
  const days = new Set(raw.ngay.map(r => parseInt(r.ngay, 10)).filter(n => n >= 1));
  // same 04:00 rule as dayOf: 0:00–3:59 is the late night of that trip day ("0:30" = "24:30")
  const late = (m: number) => (m < 240 ? m + 1440 : m);
  raw.lich.forEach((r, i) => {
    const x = pick(r, STOP_KEYS);
    if (!x.hoat_dong) return;
    const ngay = parseInt(r.ngay, 10), s = late(toMin(x.bat_dau)), e = late(toMin(x.ket_thuc));
    if (!(ngay >= 1) || (days.size && !days.has(ngay)) || Number.isNaN(s)) {
      issues.push(`lich dòng ${i + 2}: ngày/giờ "${str(r.ngay)} ${x.bat_dau}" không đọc được (ngày phải có trong tab ngay)`);
      return;
    }
    for (const k of ['quan', 'du_phong'] as const)
      if (x[k] && !quan[x[k]]) issues.push(`lich dòng ${i + 2}: không có quán id "${x[k]}"`);
    const d0 = dayStart(start, ngay), stop = { ...x, ngay, row: i + 2, start: d0 + s * MIN, end: 0, key: `it-${ngay}-${s}` };
    ends.set(stop, Number.isNaN(e) ? null : d0 + (e < s ? e + 1440 : e) * MIN);
    lich.push(stop);
  });
  lich.sort((a, b) => a.start - b.start);
  const seen: Record<string, number> = {};
  lich.forEach((x, i) => {
    // ponytail: no ket_thuc = until the next stop, capped at 3h so "chơi game" doesn't run until breakfast
    x.end = ends.get(x) ?? Math.min(lich[i + 1]?.start ?? Infinity, x.start + 180 * MIN);
    const k = x.key;
    seen[k] = (seen[k] || 0) + 1;
    x.key = seen[k] > 1 ? `${k}-${seen[k]}` : k;
  });
  const ngay = raw.ngay.map(r => ({ ngay: parseInt(r.ngay, 10), tieu_de: str(r.tieu_de) })).filter(d => d.ngay >= 1);
  const canh_bao = raw.canh_bao.map(r => ({ ...pick(r, WARN_KEYS), ngay: parseInt(r.ngay, 10) || 0 })).filter(w => w.tieu_de);
  return { ngay, quan, lich, canh_bao, issues };
}

export function timeline(lich: Stop[], now: number) {
  const cur = lich.filter(x => x.start <= now && now < x.end).pop() ?? null;
  const next = lich.find(x => x.start > now) ?? null;
  const end = Math.max(...lich.map(x => x.end));
  const phase: Phase = !lich.length ? 'empty' : now < lich[0].start ? 'before' : now >= end ? 'after' : 'during';
  return { cur, next, phase };
}

// trip day = date of (now − 4h): karaoke at 00:30 still belongs to day 1
export const dayOf = (start: string, now: number, last: number) =>
  Math.min(Math.max(Math.floor((now - 4 * HOUR - dayStart(start, 1)) / DAY) + 1, 1), last);

export function until(ms: number) {
  const m = Math.max(0, Math.ceil(ms / MIN)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${mm} phút` : `${mm} phút`;
}

const HHMM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtTime = (ms: number) => HHMM.format(ms);
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], WDL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const vnDate = (start: string, n: number) => new Date(dayStart(start, n) + 7 * HOUR); // read with getUTC* = date on the island
export const dayLabel = (start: string, n: number, long = false) => {
  const d = vnDate(start, n);
  return `${(long ? WDL : WD)[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};
export const isoDate = (start: string, n: number) => vnDate(start, n).toISOString().slice(0, 10);

// map pin labels: places numbered in visiting order, the villa is ⌂
export function numbering(quan: Record<string, Place>, items: Stop[]) {
  const nos = new Map<string, string>();
  let k = 0;
  for (const x of items) { const q = quan[x.quan]; if (q && !nos.has(q.id)) nos.set(q.id, q.nhom === 'nghi' ? '⌂' : String(++k)); }
  return nos;
}
// places with coordinates in visiting order, consecutive repeats merged (VinWonders 8:00–16:30 = one stop)
export function dayPath(quan: Record<string, Place>, items: Stop[]) {
  const path: { q: Place; x: Stop }[] = [];
  for (const x of items) { const q = quan[x.quan]; if (q?.lat != null && path[path.length - 1]?.q !== q) path.push({ q, x }); }
  return path;
}

// What changed between two versions of the sheet, worded for a toast.
export function diffTrips(a: Trip, b: Trip) {
  const name = (t: Trip, id: string) => t.quan[id]?.ten ?? id;
  const byKey = new Map(a.lich.map(x => [x.key, x])), byTitle = new Map(a.lich.map(x => [`${x.ngay}|${x.hoat_dong}`, x]));
  const sig = (t: Trip, x: Stop) => JSON.stringify([{ ...x, row: 0 }, t.quan[x.quan], t.quan[x.du_phong]]);
  const msgs: [number, string][] = [], keys: string[] = []; // [priority, text]: a swapped place matters most
  for (const x of b.lich) {
    const o = byKey.get(x.key) ?? byTitle.get(`${x.ngay}|${x.hoat_dong}`);
    if (o && sig(a, o) === sig(b, x)) continue;
    keys.push(x.key);
    if (!o) msgs.push([1, `Thêm N${x.ngay} ${x.bat_dau}: ${x.hoat_dong}`]);
    else if (o.quan !== x.quan) msgs.push([0, `N${x.ngay} ${x.bat_dau}: ${name(a, o.quan)} → ${name(b, x.quan)}`]);
    else if (o.bat_dau !== x.bat_dau) msgs.push([2, `N${x.ngay} ${x.hoat_dong}: ${o.bat_dau} → ${x.bat_dau}`]);
  }
  msgs.sort((p, q) => p[0] - q[0]);
  const changed = keys.length > 0 || a.lich.length !== b.lich.length
    || JSON.stringify([a.ngay, a.quan, a.canh_bao]) !== JSON.stringify([b.ngay, b.quan, b.canh_bao]);
  const message = !changed ? '' : msgs.length ? msgs[0][1] + (msgs.length > 1 ? ` (+${msgs.length - 1} thay đổi khác)` : '') : 'Lịch vừa được cập nhật';
  return { changed, keys, message };
}

export const lines = (s: string) => String(s || '').split('\n').map(t => t.trim()).filter(Boolean);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
export const links = (s: string) => lines(s).map(l => {
  const [a, b] = l.split(' | ');
  return b ? { ten: a, url: b } : { ten: host(a), url: a };
});
export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

const DONE = /^(✓|✔|\[x\])\s*/i; // "✓ Đặt bàn…" in the sheet = done, for everyone
export const isDone = (l: string) => DONE.test(l);
export const stripDone = (l: string) => l.replace(DONE, '');
// only offer "Gọi" for tasks done by phone ("Đặt bàn…", "Gọi…", "Hỏi…") – not "Mua vé online", "Check-in online"
export const byPhone = (task: string) => /(^|\s)(gọi|đặt|hỏi|nhắn|giữ)\s/iu.test(task);

// "Mang …" sentences in luu_y (also "… → mang …") become the day's packing list
export function bring(items: Stop[]) {
  const out = new Map<string, { gio: string; text: string }>();
  for (const x of items)
    for (const s of x.luu_y.match(/(?:^|[.\n→]\s*)[Mm]ang [^.;\n]+/g) || []) {
      const t = s.replace(/^[.\n→\s]+/, '').trim(), text = t[0].toUpperCase() + t.slice(1);
      if (!out.has(text)) out.set(text, { gio: x.bat_dau, text });
    }
  return [...out.values()];
}

const DRESS: [RegExp, string][] = [[/trắng/iu, '#ffffff'], [/hồng/iu, '#f4a8b8'], [/nâu/iu, '#7b4a2a'], [/\bbe\b/iu, '#e3d3b4'], [/đen/iu, '#1b1b1d']];
export const swatches = (s: string) => DRESS.filter(([re]) => re.test(s)).map(([, c]) => c);

export const outfits = (lich: Stop[]) => [...new Set(lich.map(x => x.dresscode).filter(Boolean))];

// place categories (the sheet's "nhom" column): label + pin colour (white text on each passes 4.5:1)
export const NHOM: Record<string, [string, string]> = {
  an: ['Ăn uống', '#be185d'], bien: ['Biển', '#0e7490'], choi: ['Vui chơi', '#1d4ed8'], mua: ['Mua sắm', '#15803d'],
  spa: ['Spa & massage', '#a16207'], hat: ['Karaoke', '#6d28d9'], nghi: ['Chỗ ở', '#12191c'], bay: ['Sân bay', '#334155'],
};
export const color = (q?: Place) => (NHOM[q?.nhom ?? ''] ?? NHOM.nghi)[1];
export const OUTDOOR = new Set(['bien', 'choi']);

export const tel = (s: string) => 'tel:' + s.split('(')[0].replace(/[^\d+]/g, '');
export const zalo = (s: string) =>
  /zalo/i.test(s) ? 'https://zalo.me/' + s.split('(')[0].replace(/[^\d+]/g, '').replace(/^\+84/, '0') : undefined;
const placeId = (url: string) => /[?&]query_place_id=([\w-]+)/.exec(url)?.[1];
// best destination we have: Google place id > coordinates > the pasted Maps link > a text search for name + address
export const dirUrl = (q: Place) => {
  const dir = 'https://www.google.com/maps/dir/?api=1&destination=', pid = placeId(q.maps);
  if (pid) return `${dir}${encodeURIComponent(q.ten)}&destination_place_id=${pid}`;
  if (q.lat != null) return `${dir}${q.lat},${q.lng}`;
  if (safeUrl(q.maps)) return q.maps;
  return dir + encodeURIComponent([q.ten, q.dia_chi, 'Phú Quốc'].filter(Boolean).join(', '));
};

export interface LatLng { lat: number; lng: number }
export const km = (a: LatLng, b: LatLng) => {
  const r = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
export const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 100) * 10} m` : `${d.toFixed(1).replace('.', ',')} km`);

const WMO: [number, string, string][] = [[0, '☀️', 'Nắng'], [2, '🌤️', 'Ít mây'], [3, '☁️', 'Nhiều mây'], [48, '🌫️', 'Sương mù'],
  [57, '🌦️', 'Mưa phùn'], [67, '🌧️', 'Mưa'], [82, '🌦️', 'Mưa rào'], [99, '⛈️', 'Dông']];
export const wmo = (c: number) => WMO.find(([max]) => c <= max) ?? WMO[WMO.length - 1];

const SHEET_NEED: Record<keyof RawTrip, string[]> = {
  ngay: ['ngay', 'tieu_de'], quan: ['id', 'toa_do'], lich: ['bat_dau', 'hoat_dong'], canh_bao: ['muc', 'tieu_de'],
};
export async function fetchSheet(url: string): Promise<RawTrip> {
  const id = /\/d\/([\w-]{20,})/.exec(url)?.[1];
  if (!id) throw new Error('link Google Sheet không đúng dạng');
  const tabs = await Promise.all(Object.entries(SHEET_NEED).map(async ([tab, need]) => {
    // a stalled request on island 4G must not block every later sync
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${tab}`,
      { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`tab ${tab}: HTTP ${r.status}`);
    const rows = toObjects(parseCSV(await r.text()));
    // gviz quietly falls back to the first tab when a tab name doesn't exist
    if (rows.length && !need.every(k => k in rows[0])) throw new Error(`không thấy tab "${tab}" (hoặc sai tên cột)`);
    return [tab, rows] as const;
  }));
  return Object.fromEntries(tabs) as unknown as RawTrip;
}
