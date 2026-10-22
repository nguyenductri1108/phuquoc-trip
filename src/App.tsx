import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { START, TRIP_NAME } from './config.ts';
import { dayOf, km, timeline } from './lib/trip.ts';
import type { Stop } from './lib/trip.ts';
import { simulated, useGeo, useNow, useTripData, useWeather } from './lib/hooks.ts';
import { Header } from './components/Header.tsx';
import { NowCard } from './components/NowCard.tsx';
import { DayTabs } from './components/DayTabs.tsx';
import { DayHead } from './components/DayHead.tsx';
import { ISLAND, MapView } from './components/MapView.tsx';
import type { Focus } from './components/MapView.tsx';
import { Timeline } from './components/Timeline.tsx';
import { Bookings, Directory, Footer, Notes } from './components/Sections.tsx';
import { Toast } from './components/ui.tsx';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// deep links: #ngay-2 opens a day, #it-3-720 opens one stop (what the "Gửi" button shares)
const linkedStop = () => (/^#it-[\d-]+$/.test(location.hash) ? location.hash.slice(1) : null);
const linkedDay = () => +(/^#(?:ngay-|it-)(\d+)/.exec(location.hash)?.[1] ?? 0);

export default function App() {
  const [toast, setToast] = useState({ msg: '', n: 0 });
  const [changed, setChanged] = useState<Set<string>>(() => new Set());
  const notify = useCallback((msg: string, keys: string[] = []) => {
    setToast(t => ({ msg, n: t.n + 1 }));
    if (keys.length) setChanged(c => new Set([...c, ...keys]));
  }, []);

  const { trip, sync, pull } = useTripData(notify);
  const now = useNow();
  const last = Math.max(1, ...trip.lich.map(x => x.ngay), ...trip.ngay.map(d => d.ngay));
  const wx = useWeather(last);
  const geo = useGeo(notify);
  const tl = useMemo(() => timeline(trip.lich, now), [trip, now]);
  const today = dayOf(START, now, last), during = tl.phase === 'during';

  const [day, setDay] = useState(() => linkedDay() || (during ? today : 1));
  const shown = Math.min(day, last);
  const [open, setOpen] = useState<Set<string>>(() => new Set(linkedStop() ? [linkedStop()!] : []));
  const [scrollTo, setScrollTo] = useState<string | null>(linkedStop);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [fitN, setFitN] = useState(0);
  const [meFocus, setMeFocus] = useState(0);

  // at the 04:00 rollover, follow the trip only if the viewer was looking at the day that just ended
  const prevToday = useRef(today);
  useEffect(() => {
    if (during && today !== prevToday.current) setDay(d => (d === prevToday.current ? today : d));
    prevToday.current = today;
  }, [today, during]);

  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setScrollTo(null);
  }, [scrollTo, shown]);

  const toggle = useCallback((id: string) => setOpen(o => {
    const n = new Set(o);
    if (!n.delete(id)) n.add(id);
    return n;
  }), []);
  const selectDay = useCallback((n: number) => {
    setDay(n);
    history.replaceState(null, '', `#ngay-${n}`);
  }, []);
  const goto = useCallback((key: string) => {
    const x = trip.lich.find(s => s.key === key);
    if (!x) return;
    setDay(x.ngay);
    setOpen(o => new Set(o).add(key));
    setScrollTo(key);
  }, [trip]);
  const fly = useCallback((id: string) => {
    const q = trip.quan[id];
    if (q?.lat == null) return;
    if (innerWidth < 960) document.getElementById('map')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    setFocus(f => ({ q, n: (f?.n ?? 0) + 1 }));
  }, [trip]);
  const share = useCallback(async (x: Stop) => {
    const q = trip.quan[x.quan];
    const url = `${location.origin}${location.pathname}#${x.key}`;
    const text = `N${x.ngay} · ${x.bat_dau} ${x.hoat_dong}${q ? ` – ${q.ten}` : ''}${x.dresscode ? ` · dresscode ${x.dresscode}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: TRIP_NAME, text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); notify('Đã copy link – dán vào nhóm chat nhé'); }
    } catch { /* share sheet dismissed */ }
  }, [trip, notify]);

  // my location: fly there on the first fix and on every tap – unless we're not on the island yet
  const flyMe = useCallback(() => {
    if (!geo.me) return;
    if (L.latLngBounds(ISLAND).contains([geo.me.lat, geo.me.lng])) setMeFocus(n => n + 1);
    else notify(`Bạn đang cách Phú Quốc ~${Math.round(km(geo.me, { lat: 10.2, lng: 103.97 })).toLocaleString('vi-VN')} km – tới đảo bản đồ sẽ hiện chấm xanh của bạn.`);
  }, [geo.me, notify]);
  const hadFix = useRef(false);
  useEffect(() => { if (geo.me && !hadFix.current) { hadFix.current = true; flyMe(); } }, [geo.me, flyMe]);

  useEffect(() => {
    const onHash = () => { const k = linkedStop(), d = linkedDay(); if (k) goto(k); else if (d) setDay(d); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [goto]);

  const say = tl.cur ? `Đang diễn ra: ${tl.cur.hoat_dong}.` : tl.next ? `Tiếp theo lúc ${tl.next.bat_dau}: ${tl.next.hoat_dong}.` : '';

  return (
    <div className="app">
      <Header now={now} sync={sync} onSync={() => pull(true)} />
      {simulated && <p className="preview">Đang xem thử thời gian (link có ?t=…). Bỏ phần ?t trên link để về giờ thật.</p>}
      <NowCard trip={trip} now={now} tl={tl} today={today} last={last} wx={wx} me={geo.me} onGoto={goto} onMap={fly}
        onDay={n => { selectDay(n); setScrollTo('dayTitle'); }} />
      <p className="sr" aria-live="polite">{say}</p>
      <DayTabs last={last} day={shown} today={during ? today : 0} wx={wx} onSelect={selectDay} />
      <DayHead trip={trip} day={shown} wx={wx} open={open} onToggle={toggle} />
      <MapView trip={trip} day={shown} now={now} cur={tl.cur} next={tl.next} open={open} focus={focus} meFocus={meFocus}
        me={geo.me} fitKey={`${shown}:${fitN}`} locating={geo.on} onFit={() => setFitN(n => n + 1)} onGoto={goto}
        onLocate={() => (geo.on && geo.me ? flyMe() : geo.enable())} />
      <Timeline trip={trip} day={shown} now={now} cur={tl.cur} next={tl.next} open={open} changed={changed} wx={wx}
        onToggle={toggle} onMap={fly} onShare={share} />
      <Bookings trip={trip} onGoto={goto} />
      <Notes trip={trip} open={open} onToggle={toggle} />
      <Directory trip={trip} me={geo.me} open={open} onToggle={toggle} onMap={fly} />
      <Footer trip={trip} sync={sync} />
      <Toast msg={toast.msg} n={toast.n} />
    </div>
  );
}
