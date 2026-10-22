import { START } from '../config.ts';
import { bring, dayLabel, wmo } from '../lib/trip.ts';
import type { Trip, Warning } from '../lib/trip.ts';
import type { Weather } from '../lib/hooks.ts';
import { Acc, Dress, Icon } from './ui.tsx';
import { LinkList } from './Timeline.tsx';
import './DayHead.css';

const LV: Record<string, [string, string, number]> = { '🔴': ['red', 'Quan trọng', 0], '🟡': ['amber', 'Lưu ý', 1], '🟢': ['green', 'Mẹo', 2] };
export const level = (m: string) => LV[m.trim()] ?? LV['🟡'];

export function Alert({ w, id, open, onToggle }: { w: Warning; id: string; open: boolean; onToggle: (id: string) => void }) {
  const [lv, label] = level(w.muc);
  return (
    <Acc id={id} open={open} onToggle={onToggle} className="alert" lv={lv}
      head={<><span className="lv">{label}</span><span className="t">{w.tieu_de}</span></>}>
      <div className="acc-body"><p>{w.chi_tiet}</p><LinkList s={w.links} /></div>
    </Acc>
  );
}

export function DayHead({ trip, day, wx, open, onToggle }: {
  trip: Trip; day: number; wx: Weather; open: Set<string>; onToggle: (id: string) => void;
}) {
  const items = trip.lich.filter(x => x.ngay === day), w = wx.day(day);
  const dress = items.filter(x => x.dresscode), kit = bring(items);
  const alerts = trip.canh_bao.filter(a => a.ngay === day);
  return (
    <>
      <section className="card day-head" aria-labelledby="dayTitle">
        <h2 id="dayTitle">Ngày {day} · {dayLabel(START, day, true)}</h2>
        <p className="sub">{trip.ngay.find(d => d.ngay === day)?.tieu_de}</p>
        {w && (
          <p className="wx-line">
            <span>{wmo(w.code)[1]} {wmo(w.code)[2]} · {Math.round(w.min)}–{Math.round(w.max)}°</span>
            <span>Mưa {w.rain}%</span>
            <span>Bình minh {w.rise} · Hoàng hôn {w.set}</span>
          </p>
        )}
        {(dress.length > 0 || kit.length > 0) && (
          <div className="kit">
            {dress.length > 0 && (
              <div><Icon name="shirt" /><ul aria-label="Dresscode">
                {dress.map(x => <li key={x.key}><span className="num">{x.bat_dau}</span><Dress s={x.dresscode} /></li>)}
              </ul></div>
            )}
            {kit.length > 0 && (
              <div><Icon name="bag" /><ul aria-label="Mang theo">
                {kit.map(b => <li key={b.text}><span className="num">{b.gio}</span>{b.text}</li>)}
              </ul></div>
            )}
          </div>
        )}
      </section>
      {alerts.length > 0 && (
        <div className="alerts day-alerts">
          {alerts.map((a, i) => { const id = `al-${day}-${i}`; return <Alert key={id} id={id} w={a} open={open.has(id)} onToggle={onToggle} />; })}
        </div>
      )}
    </>
  );
}
