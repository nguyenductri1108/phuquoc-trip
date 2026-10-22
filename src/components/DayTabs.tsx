import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { START } from '../config.ts';
import { dayLabel, wmo } from '../lib/trip.ts';
import type { Weather } from '../lib/hooks.ts';
import './DayTabs.css';

/** transitions.dev tabs-sliding: the pill is measured from the active tab; first paint and resizes snap without a transition. */
export function DayTabs({ last, day, today, wx, onSelect }: {
  last: number; day: number; today: number; wx: Weather; onSelect: (n: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), placed = useRef(false);

  useLayoutEffect(() => {
    const move = (animate: boolean) => {
      const tab = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]'), p = pill.current;
      if (!tab || !p) return;
      if (!animate) {
        const prev = p.style.transition;
        p.style.transition = 'none';
        p.style.transform = `translateX(${tab.offsetLeft}px)`;
        p.style.width = `${tab.offsetWidth}px`;
        void p.offsetWidth;
        p.style.transition = prev;
      } else {
        p.style.transform = `translateX(${tab.offsetLeft}px)`;
        p.style.width = `${tab.offsetWidth}px`;
      }
    };
    move(placed.current);
    placed.current = true;
    const snap = () => move(false);
    addEventListener('resize', snap);
    return () => removeEventListener('resize', snap);
  }, [day, last]);

  const onKey = (e: KeyboardEvent) => {
    const k = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (!k) return;
    const n = (day - 1 + k + last) % last + 1;
    onSelect(n);
    document.getElementById(`tab-${n}`)?.focus();
  };

  return (
    <div className="t-tabs days" role="tablist" aria-label="Chọn ngày" ref={bar} onKeyDown={onKey}>
      <span className="t-tabs-pill" aria-hidden="true" ref={pill} />
      {Array.from({ length: last }, (_, i) => i + 1).map(n => {
        const w = wx.day(n);
        return (
          <button key={n} className={`t-tab${n === today ? ' today' : ''}`} type="button" role="tab" id={`tab-${n}`}
            aria-selected={n === day} aria-controls="timeline" tabIndex={n === day ? 0 : -1} onClick={() => onSelect(n)}>
            <b>Ngày {n}{n === today && <span className="sr"> (hôm nay)</span>}</b>
            <span className="num">{dayLabel(START, n)}{w && <span title={`${wmo(w.code)[2]} ${Math.round(w.max)}°`}> {wmo(w.code)[1]}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}
