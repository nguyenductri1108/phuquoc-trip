import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { skyAt } from '../lib/sky.ts';
import { START } from '../config.ts';
import { DAY, HOUR, MIN, OUTDOOR, dayLabel, fmtKm, fmtTime, isDone, km, lines, outfits, swatches, until, wmo } from '../lib/trip.ts';
import type { LatLng, Stop, Trip } from '../lib/trip.ts';
import { useNow } from '../lib/hooks.ts';
import type { Weather } from '../lib/hooks.ts';
import { Actions, Digits, Dress, Icon, WxChip } from './ui.tsx';
import './NowCard.css';

const SOON = 15 * MIN;
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  trip: Trip; now: number; tl: { cur: Stop | null; next: Stop | null; phase: string }; today: number; last: number;
  wx: Weather; me: LatLng | null; onGoto: (key: string) => void; onDay: (n: number) => void; onMap: (id: string) => void;
}

export function NowCard(p: Props) {
  const { phase, cur, next } = p.tl;
  const ref = useRef<HTMLElement>(null);
  // texts reveal (transitions.dev) each time "now" changes
  useLayoutEffect(() => {
    const el = ref.current!;
    el.classList.remove('is-shown');
    void el.offsetHeight;
    el.classList.add('is-shown');
  }, [phase, cur?.key, next?.key]);
  return (
    <section className="card nowcard t-stagger" ref={ref} aria-label="Bây giờ">
      {phase === 'before' ? <Before {...p} /> : phase === 'during' ? <During {...p} />
        : phase === 'after' ? <After /> : <p className="now-title">Chưa có lịch</p>}
    </section>
  );
}

function Before({ trip, last, wx, onDay }: Props) {
  const now = useNow(1000); // only the countdown ticks every second; the rest of the page stays on the minute clock
  const f = trip.lich[0], ms = Math.max(0, f.start - now);
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / HOUR), m = Math.floor(ms % HOUR / MIN), s = Math.floor(ms % MIN / 1000);
  const todo = trip.lich.flatMap(x => lines(x.dat_truoc)), left = todo.filter(l => !isDone(l)).length;
  const reds = trip.canh_bao.filter(w => w.muc.trim() === '🔴').length;
  return (
    <>
      {/* sunset over the sea – same scene as the app icon */}
      <div className="scene">
        <span className="sun" aria-hidden="true" />
        <span className="plane" aria-hidden="true">✈</span>
        <p className="scene-title t-stagger-line t-stagger-line--1">Đếm ngược tới Phú Quốc</p>
        <div className="count t-stagger-line t-stagger-line--2" role="timer" aria-label={`Còn ${d} ngày ${h} giờ ${m} phút`}>
          {([[pad(d), 'ngày'], [pad(h), 'giờ'], [pad(m), 'phút'], [pad(s), 'giây']] as const).map(([v, l]) => (
            <span className="u" key={l} aria-hidden="true"><span className="tile"><Digits value={v} /></span><small>{l}</small></span>
          ))}
        </div>
        <Sea />
      </div>
      <div className="t-stagger-line t-stagger-line--3">
        <p className="now-place target">✈ {f.hoat_dong} · <span className="nw">{f.bat_dau} {dayLabel(START, f.ngay)}</span></p>
        <ol className="overview" aria-label="Tóm tắt 4 ngày">
          {Array.from({ length: last }, (_, i) => i + 1).map(n => {
            const items = trip.lich.filter(x => x.ngay === n), w = wx.day(n);
            const colors = [...new Set(items.flatMap(x => swatches(x.dresscode)))];
            return (
              <li key={n}>
                <button type="button" onClick={() => onDay(n)}>
                  <b>N{n}</b><span className="o-d num">{dayLabel(START, n)}</span>
                  <span className="o-t">{trip.ngay.find(x => x.ngay === n)?.tieu_de}</span>
                  <span className="o-x">
                    {colors.map(c => <i key={c} className="sw" style={{ background: c }} />)}
                    {w && <span className="num">{wmo(w.code)[1]} {Math.round(w.max)}°</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="vali"><Icon name="shirt" /><span><b>Vali:</b> {outfits(trip.lich).join(' · ')}</span></p>
        <div className="prep">
          {todo.length > 0 && <a href="#book">{left ? `☎ Còn ${left}/${todo.length} việc cần đặt trước` : `✓ Đã đặt xong ${todo.length} việc`}</a>}
          {reds > 0 && <a className="bad" href="#notes">⚠ {reds} lưu ý quan trọng</a>}
        </div>
      </div>
    </>
  );
}

const Sea = () => (
  <svg className="sea" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
    <path className="swell" d="M0 22 Q50 10 100 22 T200 22 T300 22 T400 22 T500 22 T600 22 T700 22 T800 22 V60 H0Z" />
    <path className="crest" d="M0 22 Q50 10 100 22 T200 22 T300 22 T400 22 T500 22 T600 22 T700 22 T800 22" />
  </svg>
);

const hm = (s?: string) => (s ? +s.slice(0, 2) * 60 + +s.slice(3, 5) : undefined);

/** The sky over the island right now: colours, sun or moon and stars follow the real clock and today's sunrise/sunset. */
function LiveSky({ now, rise, set, children }: { now: number; rise?: string; set?: string; children: ReactNode }) {
  const sky = skyAt(Math.floor((now + 7 * HOUR) % DAY / MIN), hm(rise), hm(set));
  const style = { '--sky-1': sky.stops[0], '--sky-2': sky.stops[1], '--sky-3': sky.stops[2], '--sea-1': sky.sea, '--stars': sky.stars } as CSSProperties;
  return (
    <div className={`scene live${sky.stars > 0.5 ? ' night' : ''}`} style={style}>
      <span className="stars" aria-hidden="true" />
      {sky.moon && <span className="moon" aria-hidden="true" style={{ left: `${sky.moon.x}%`, bottom: `${40 + sky.moon.y * 36}px` }} />}
      {sky.sun && <span className="orb" aria-hidden="true" style={{ left: `${sky.sun.x}%`, bottom: `${28 + sky.sun.y * 88}px`, '--orb': sky.sun.color } as CSSProperties} />}
      <div className="t-stagger-line t-stagger-line--1">
        <div className="scene-top"><span className="pill">{sky.label}</span>{children}</div>
      </div>
      <Sea />
    </div>
  );
}

/** Four day segments filling up as the trip goes, with the plane at "now". */
function Track({ trip, now, today, last }: { trip: Trip; now: number; today: number; last: number }) {
  const its = trip.lich.filter(s => s.ngay === today);
  const part = its.length ? Math.min(1, Math.max(0, (now - its[0].start) / (Math.max(...its.map(s => s.end)) - its[0].start))) : 0;
  const pos = (today - 1 + part) / last;
  return (
    <div className="track" role="img" aria-label={`Hành trình: ngày ${today}/${last}, đã đi ${Math.round(pos * 100)}%`}>
      {Array.from({ length: last }, (_, i) => (
        <span key={i} className="seg"><i style={{ '--f': i + 1 < today ? 1 : i + 1 > today ? 0 : part } as CSSProperties} /></span>
      ))}
      <span className="track-plane" style={{ left: `${pos * 100}%` }} aria-hidden="true">✈</span>
    </div>
  );
}

/** Time left in the current stop as a ring (elapsed share) around the minutes that remain. */
function Ring({ frac, left }: { frac: number; left: number }) {
  const r = 24, c = 2 * Math.PI * r, m = Math.max(0, Math.ceil(left / MIN));
  return (
    <svg className="ring" viewBox="0 0 60 60" role="img" aria-label={`Còn ${until(left)}`}>
      <circle className="ring-track" cx="30" cy="30" r={r} />
      <circle className="ring-fill" cx="30" cy="30" r={r} style={{ strokeDasharray: c, strokeDashoffset: c * (1 - frac) }} />
      <text className="ring-label" x="30" y="30">{m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : `${m}′`}</text>
    </svg>
  );
}

function During({ trip, now, tl, today, last, wx, me, onGoto, onMap }: Props) {
  const { cur, next } = tl, x = cur ?? next;
  if (!x) return <p className="now-title">Tự do</p>;
  const q = trip.quan[x.quan], b = trip.quan[x.du_phong];
  const w = q && OUTDOOR.has(q.nhom) ? wx.at(x.start) : null;
  const dayEnd = !cur && x.ngay > today;
  const soon = !cur && x.start - now <= SOON;
  const wear = dayEnd && !x.dresscode ? trip.lich.find(s => s.ngay === x.ngay && s.dresscode)?.dresscode : undefined;
  const frac = cur ? Math.min(1, (now - cur.start) / (cur.end - cur.start)) : 0;
  const wd = wx.day(today), wNow = wx.at(now);
  const detail = (
    <button className="btn" type="button" onClick={() => onGoto(x.key)} aria-label={b ? `Chi tiết và phương án B (${b.ten})` : 'Chi tiết'}>
      <Icon name="info" />Chi tiết
    </button>
  );
  return (
    <>
      <LiveSky now={now} rise={wd?.rise} set={wd?.set}>
        <span className="pill">Ngày {today}/{last}{wNow && ` · ${wmo(wNow.code)[1]} ${Math.round(wNow.t)}°`}</span>
        <Track trip={trip} now={now} today={today} last={last} />
      </LiveSky>
      <div className="live-panel t-stagger-line t-stagger-line--2">
        <p className={`eyebrow${cur ? ' live' : ''}`}>
          {cur ? `Đang diễn ra · ${x.bat_dau}–${fmtTime(x.end)}`
            : dayEnd ? `Hết lịch hôm nay · ngủ ngon 🌙` : `${soon ? 'Sắp tới' : 'Tự do · tiếp theo'} ${x.bat_dau}`}
        </p>
        <div className="live-row">
          {cur && <Ring frac={frac} left={cur.end - now} />}
          <div className="live-text">
            <h2 className="now-title">{dayEnd ? `Mai ${x.bat_dau} · ${x.hoat_dong}` : x.hoat_dong}</h2>
            {q && <p className="now-place">{q.ten}{q.danh_gia && ` · ★ ${q.danh_gia}`}</p>}
          </div>
        </div>
      </div>
      <div className="t-stagger-line t-stagger-line--3">
        <div className="now-meta">
          {x.dresscode && <span className="chip"><Dress s={x.dresscode} /></span>}
          {wear && <span className="chip">Mai mặc: <Dress s={wear} /></span>}
          {w && <WxChip w={w} />}
          {me && q?.lat != null && q.lng != null && <span className="chip">📍 cách bạn {fmtKm(km(me, { lat: q.lat, lng: q.lng }))}</span>}
        </div>
        {cur ? <p className="left"><b>còn {until(cur.end - now)}</b><span>xong lúc {fmtTime(cur.end)}</span></p>
          : <p className="left"><b>còn {until(x.start - now)}</b>{dayEnd && <span>{dayLabel(START, x.ngay)}</span>}</p>}
        {q ? <Actions q={q} onMap={onMap}>{detail}</Actions> : <div className="acts">{detail}</div>}
      </div>
      {cur && next && (
        <button className="next-up" type="button" onClick={() => onGoto(next.key)}>
          <span>
            <span className="k">{next.start - now <= SOON ? 'Sắp tới' : 'Tiếp theo'} · {next.bat_dau}{next.ngay !== cur.ngay && ` · ${dayLabel(START, next.ngay)}`}</span>
            <b>{next.hoat_dong}</b>
          </span>
          <span className="in">sau {until(next.start - now)}</span>
        </button>
      )}
    </>
  );
}

const After = () => (
  <>
    <p className="eyebrow t-stagger-line t-stagger-line--1">Chuyến đi đã kết thúc</p>
    <p className="now-title t-stagger-line t-stagger-line--2">Hẹn cả nhóm chuyến sau 🌅</p>
    <p className="now-place t-stagger-line t-stagger-line--3">Lịch 4 ngày vẫn xem lại được ở dưới.</p>
  </>
);
