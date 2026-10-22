import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bundled from '../data/trip.json';
import { POLL_MS, SHEET_URL, START } from '../config.ts';
import { HOUR, MIN, TZ, dayStart, diffTrips, fetchSheet, isoDate, normalize } from './trip.ts';
import type { LatLng, RawTrip } from './trip.ts';

const store = {
  get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: session only */ } },
};
const onWake = (fn: () => void) => {
  const h = () => { if (!document.hidden) fn(); };
  document.addEventListener('visibilitychange', h);
  addEventListener('pageshow', h); // iOS back-forward cache
  return () => { document.removeEventListener('visibilitychange', h); removeEventListener('pageshow', h); };
};

/* ---------- clock: ?t=2026-10-25T12:00 previews any moment, the clock keeps running from there ---------- */
const qt = new URLSearchParams(location.search).get('t');
const parsed = qt ? Date.parse(qt.length <= 16 ? qt + TZ : qt) : NaN;
export const simulated = Number.isFinite(parsed);
const offset = simulated ? parsed - Date.now() : 0;
const clock = () => Date.now() + offset;

/** Current time, re-rendered on each `step` boundary (default: the minute – every time in the plan is HH:MM) and on wake. */
export function useNow(step = MIN) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    let t = 0;
    const tick = () => { clearTimeout(t); setNow(clock()); t = window.setTimeout(tick, step - (clock() % step) + 20); };
    tick();
    const off = onWake(tick);
    return () => { clearTimeout(t); off(); };
  }, [step]);
  return now;
}

/* ---------- trip data: newest of (bundled snapshot, last sheet copy), then poll the Google Sheet ---------- */
export type SyncState = { state: 'local' | 'loading' | 'live' | 'error'; at: number; err: string };
interface Cache { at: number; data: RawTrip }
const BUNDLED = bundled as RawTrip & { updated?: string };

export function useTripData(notify: (msg: string, keys?: string[]) => void) {
  const fromCache = useRef(false); // started from what this viewer saw last time → announce what changed since
  const [raw, setRaw] = useState<RawTrip>(() => {
    const c = SHEET_URL ? store.get<Cache>('pq-sheet') : null;
    fromCache.current = !!c && c.at > Date.parse(BUNDLED.updated ?? '');
    return fromCache.current ? c!.data : BUNDLED;
  });
  const [sync, setSync] = useState<SyncState>(() =>
    ({ state: SHEET_URL ? 'loading' : 'local', at: store.get<Cache>('pq-sheet')?.at ?? 0, err: '' }));
  const trip = useMemo(() => normalize(raw, START), [raw]);
  const current = useRef(trip);
  current.current = trip;
  const busy = useRef(false), pulled = useRef(0);

  const pull = useCallback(async (manual = false) => {
    if (!SHEET_URL) { if (manual) notify('Chưa nối Google Sheet – đang dùng dữ liệu có sẵn'); return; }
    if (busy.current) return;
    busy.current = true;
    const first = !pulled.current;
    pulled.current = Date.now();
    try {
      const data = await fetchSheet(SHEET_URL);
      store.set('pq-sheet', { at: Date.now(), data });
      const d = diffTrips(current.current, normalize(data, START));
      if (d.changed) {
        setRaw(data);
        if (!first || fromCache.current) notify(`Sheet vừa cập nhật · ${d.message}`, d.keys);
      } else if (manual) notify('Dữ liệu đã là mới nhất');
      setSync({ state: 'live', at: Date.now(), err: '' });
    } catch (e) {
      const offline = e instanceof TypeError || (e as Error).name === 'TimeoutError';
      const err = offline ? 'không kết nối được (mất mạng, hoặc Sheet chưa chia sẻ “Bất kỳ ai có đường liên kết”)' : (e as Error).message;
      setSync(s => ({ ...s, state: 'error', err }));
      if (manual) notify(`Không tải được Sheet: ${err}`);
    } finally { busy.current = false; }
  }, [notify]);

  useEffect(() => {
    if (!SHEET_URL) return;
    pull();
    const id = setInterval(() => { if (!document.hidden) pull(); }, POLL_MS);
    const off = onWake(() => { if (Date.now() - pulled.current > POLL_MS) pull(); });
    return () => { clearInterval(id); off(); };
  }, [pull]);

  return { trip, sync, pull };
}

/* ---------- weather: one Open-Meteo call for the trip dates, refreshed every 30 min ---------- */
interface OpenMeteo {
  hourly: { time: string[]; temperature_2m: (number | null)[]; precipitation_probability: (number | null)[]; weather_code: (number | null)[] };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[];
    precipitation_probability_max: number[]; sunrise: string[]; sunset: string[] };
}
export interface Wx { code: number; t: number; rain: number }
export interface WxDay { code: number; max: number; min: number; rain: number; rise: string; set: string }
export interface Weather { day: (n: number) => WxDay | null; at: (ms: number) => Wx | null }

export function useWeather(last: number): Weather {
  const [wx, setWx] = useState<OpenMeteo | null>(null);
  useEffect(() => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=10.2&longitude=103.97&timezone=Asia%2FHo_Chi_Minh'
      + '&hourly=temperature_2m,precipitation_probability,weather_code'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
      + `&start_date=${isoDate(START, 1)}&end_date=${isoDate(START, last)}`;
    const load = () => fetch(url).then(r => r.json()).then((d: OpenMeteo) => { if (d.daily) setWx(d); })
      .catch(() => { /* weather is a nice-to-have */ });
    load();
    const id = setInterval(load, 30 * MIN);
    return () => clearInterval(id);
  }, [last]);
  return useMemo(() => ({
    day: n => {
      const d = wx?.daily, i = n - 1;
      return d?.time[i] ? { code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
        rain: d.precipitation_probability_max[i], rise: d.sunrise[i].slice(11), set: d.sunset[i].slice(11) } : null;
    },
    at: ms => {
      const h = wx?.hourly, i = Math.floor((ms - dayStart(START, 1)) / HOUR);
      const t = h?.temperature_2m[i];
      return h && t != null ? { code: h.weather_code[i] ?? 0, t, rain: h.precipitation_probability[i] ?? 0 } : null;
    },
  }), [wx]);
}

/* ---------- my location: only after a tap, paused while the page is hidden, never sent anywhere ---------- */
export function useGeo(notify: (msg: string) => void) {
  const [me, setMe] = useState<(LatLng & { acc: number }) | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    let id: number | null = null;
    const start = () => {
      if (id != null || document.hidden) return;
      id = navigator.geolocation.watchPosition(
        p => setMe({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        e => {
          if (e.code !== e.PERMISSION_DENIED) return; // timeouts: keep trying
          setOn(false);
          notify('Bạn đang chặn quyền vị trí – bật lại trong cài đặt trình duyệt. Nếu mở link trong Zalo/Messenger, hãy mở bằng Safari/Chrome.');
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 });
    };
    const stop = () => { if (id != null) navigator.geolocation.clearWatch(id); id = null; };
    const vis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', vis);
    return () => { stop(); document.removeEventListener('visibilitychange', vis); };
  }, [on, notify]);
  const enable = useCallback(() => {
    if (!('geolocation' in navigator)) notify('Trình duyệt này không hỗ trợ định vị');
    else setOn(true);
  }, [notify]);
  return { me, on, enable };
}
