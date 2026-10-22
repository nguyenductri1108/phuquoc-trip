import type { CSSProperties } from 'react';
import { OUTDOOR, color, isDone, lines, links, numbering, safeUrl, stripDone } from '../lib/trip.ts';
import type { Place, Stop, Trip } from '../lib/trip.ts';
import type { Weather } from '../lib/hooks.ts';
import { Actions, Chevron, Dress, Icon, WxChip } from './ui.tsx';
import './Timeline.css';

export function LinkList({ s }: { s: string }) {
  const l = links(s).filter(k => safeUrl(k.url));
  if (!l.length) return null;
  return (
    <>
      <h4>Tham khảo</h4>
      <ul className="links">{l.map(k => <li key={k.url}><a href={k.url} target="_blank" rel="noopener"><Icon name="ext" />{k.ten}</a></li>)}</ul>
    </>
  );
}

type State = 'past' | 'now' | 'next' | 'later';
interface Common {
  wx: Weather; onToggle: (id: string) => void; onMap: (id: string) => void; onShare: (x: Stop) => void;
}

/** One day's stops. Keyed by day so switching days replays the staggered entrance. */
export function Timeline({ trip, day, now, cur, next, open, changed, ...rest }: Common & {
  trip: Trip; day: number; now: number; cur: Stop | null; next: Stop | null; open: Set<string>; changed: Set<string>;
}) {
  const items = trip.lich.filter(x => x.ngay === day), nos = numbering(trip.quan, items);
  return (
    <div id="timeline" role="tabpanel" aria-labelledby={`tab-${day}`} key={day}>
      <ol className="tl enter">
        {items.length ? items.map((x, i) => (
          <StopItem key={x.key} x={x} i={i} q={trip.quan[x.quan]} b={trip.quan[x.du_phong]} no={nos.get(x.quan)}
            st={x === cur ? 'now' : x === next ? 'next' : x.end <= now ? 'past' : 'later'}
            open={open.has(x.key)} isNew={changed.has(x.key)} {...rest} />
        )) : <li className="hint">Chưa có lịch cho ngày này.</li>}
      </ol>
    </div>
  );
}

function StopItem({ x, i, q, b, no, st, open, isNew, wx, onToggle, onMap, onShare }: Common & {
  x: Stop; i: number; q?: Place; b?: Place; no?: string; st: State; open: boolean; isNew: boolean;
}) {
  const w = q && OUTDOOR.has(q.nhom) ? wx.at(x.start) : null;
  const price = x.gia || q?.gia, todo = lines(x.dat_truoc);
  const share = <button className="btn" type="button" onClick={() => onShare(x)}><Icon name="share" />Gửi</button>;
  return (
    <li className="it t-acc" id={x.key} data-open={open} data-state={st} style={{ '--i': i } as CSSProperties}>
      <button className="it-head" type="button" aria-expanded={open} aria-controls={`${x.key}-p`} onClick={() => onToggle(x.key)}>
        <time className="num">{x.bat_dau}</time>
        <span className="it-dot" aria-hidden="true" />
        <span>
          <span className="it-title">{x.hoat_dong}</span>
          {q && <span className="it-place">{no && <span className="no" style={{ '--c': color(q) } as CSSProperties}>{no}</span>}{q.ten}</span>}
          <span className="chips">
            {st === 'now' && <span className="chip now">Đang diễn ra</span>}
            {st === 'next' && <span className="chip next">Tiếp theo</span>}
            {isNew && <span className="chip new">Mới đổi</span>}
            {x.dresscode && <span className="chip"><Dress s={x.dresscode} /></span>}
            {w && <WxChip w={w} />}
          </span>
        </span>
        <Chevron />
      </button>
      <div className="t-acc-panel" id={`${x.key}-p`} role="region" aria-label={`Chi tiết: ${x.hoat_dong}`} inert={!open}>
        <div className="t-acc-panel-inner">
          <div className="it-more">
            {q && (
              <>
                <p>{q.dia_chi}</p>
                <p className="facts">
                  {q.danh_gia && <span><Icon name="star" />{q.danh_gia}</span>}
                  {q.gio_mo_cua && <span><Icon name="clock" />{q.gio_mo_cua}</span>}
                  {price && <span><Icon name="cash" />{price}</span>}
                </p>
                <Actions q={q} onMap={onMap}>{share}</Actions>
              </>
            )}
            {todo.length > 0 && (
              <div className="book-note"><b>Cần đặt trước</b>{todo.map(l => <p key={l}>{isDone(l) && '✓ '}{stripDone(l)}</p>)}</div>
            )}
            {x.mo_ta && <><h4>Vì sao chọn</h4><p>{x.mo_ta}</p></>}
            {x.luu_y && <><h4>Lưu ý</h4>{lines(x.luu_y).map(l => <p key={l}>{l}</p>)}</>}
            {x.di_chuyen && <><h4>Di chuyển</h4><p>{x.di_chuyen}</p></>}
            {(b || x.du_phong_mo_ta) && (
              <div className="plan-b">
                <h4>Phương án B{b && ` · ${b.ten}`}</h4>
                {x.du_phong_mo_ta && <p>{x.du_phong_mo_ta}</p>}
                {b && <Actions q={b} onMap={onMap} />}
              </div>
            )}
            <LinkList s={x.links} />
            {!q && <div className="acts">{share}</div>}
          </div>
        </div>
      </div>
    </li>
  );
}
