import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { dirUrl, swatches, tel, wmo, zalo } from '../lib/trip.ts';
import type { Place } from '../lib/trip.ts';
import type { Wx } from '../lib/hooks.ts';
import './ui.css';

const PATHS = {
  nav: <path d="M3 11 22 2l-9 19-2-8-8-2z" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  fit: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  shirt: <path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z" />,
  bag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
  ext: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};
export type IconName = keyof typeof PATHS;
export const Icon = ({ name }: { name: IconName }) => <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;

export const Chevron = () => (
  <span className="t-acc-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 6.5L8 10.5L12 6.5" /></svg></span>
);

/** transitions.dev accordion: data-open drives grid-rows 0fr↔1fr; closed panels are inert (no tabbing into hidden links). */
export function Acc({ id, open, onToggle, head, children, className = '', lv }: {
  id: string; open: boolean; onToggle: (id: string) => void; head: ReactNode; children: ReactNode; className?: string; lv?: string;
}) {
  return (
    <div className={`t-acc ${className}`} id={id} data-open={open} data-lv={lv}>
      <button className="acc-head" type="button" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => onToggle(id)}>
        {head}<Chevron />
      </button>
      <div className="t-acc-panel" id={`${id}-p`} inert={!open}><div className="t-acc-panel-inner">{children}</div></div>
    </div>
  );
}

export function Actions({ q, onMap, children }: { q: Place; onMap?: (id: string) => void; children?: ReactNode }) {
  const z = zalo(q.dien_thoai);
  return (
    <div className="acts">
      <a className="btn primary" href={dirUrl(q)} target="_blank" rel="noopener"><Icon name="nav" />Chỉ đường</a>
      {q.dien_thoai && <a className="btn" href={tel(q.dien_thoai)} aria-label={`Gọi ${q.ten} – ${q.dien_thoai}`}><Icon name="phone" />Gọi</a>}
      {z && <a className="btn" href={z} target="_blank" rel="noopener" aria-label={`Nhắn Zalo ${q.ten}`}><Icon name="chat" />Zalo</a>}
      {onMap && q.lat != null && <button className="btn" type="button" onClick={() => onMap(q.id)}><Icon name="pin" />Bản đồ</button>}
      {children}
    </div>
  );
}

export const Dress = ({ s }: { s: string }) => (
  <span className="dress">{swatches(s).map(c => <i key={c} className="sw" style={{ background: c }} />)}{s}</span>
);

export function WxChip({ w }: { w: Wx }) {
  const storm = w.code >= 95, rain = w.rain >= 60;
  return (
    <span className={`chip${storm ? ' storm' : rain ? ' rain' : ''}`}>
      {wmo(w.code)[1]} {Math.round(w.t)}° · mưa {w.rain}%{storm && ' · dông'}
    </span>
  );
}

/** transitions.dev number pop-in: digits re-enter with blur whenever the value changes. */
export function Digits({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const g = ref.current!;
    g.classList.remove('is-animating');
    void g.offsetHeight; // force reflow so the animation replays
    g.classList.add('is-animating');
  }, [value]);
  const chars = [...value];
  return (
    <span className="t-digit-group" ref={ref} aria-hidden="true">
      {chars.map((ch, i) => (
        <span key={`${value}-${i}`} className="t-digit"
          data-stagger={i === chars.length - 2 ? 1 : i === chars.length - 1 ? 2 : undefined}>{ch}</span>
      ))}
    </span>
  );
}

/** transitions.dev checkbox check: a tick that turns on later draws itself. */
export function Check({ on }: { on: boolean }) {
  const [shown, setShown] = useState(on);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(on));
    return () => cancelAnimationFrame(r);
  }, [on]);
  return (
    <span className="t-check" aria-hidden="true" aria-checked={shown}>
      <svg viewBox="0 0 10.1668 10.1668"><path d="M1 5.52L3.92 9.17L9.17 1" /></svg>
    </span>
  );
}

/** transitions.dev toast: rises in, leaves on its own. `n` re-triggers it for a new message. */
export function Toast({ msg, n }: { msg: string; n: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!n) return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), 4500);
    return () => clearTimeout(t);
  }, [n]);
  return <div className={`t-toast toast${open ? ' is-open' : ''}`} role="status" aria-live="polite">{msg}</div>;
}
