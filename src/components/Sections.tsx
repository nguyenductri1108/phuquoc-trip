import { NOTE, SHEET_URL } from '../config.ts';
import { NHOM, byPhone, fmtKm, isDone, km, lines, stripDone, tel } from '../lib/trip.ts';
import type { LatLng, Place, Trip } from '../lib/trip.ts';
import type { SyncState } from '../lib/hooks.ts';
import { Acc, Actions, Check, Icon } from './ui.tsx';
import { Alert, level } from './DayHead.tsx';
import './Sections.css';

/** Everything in the sheet's dat_truoc column. "✓ " at the start of a line = done, for the whole group. */
export function Bookings({ trip, onGoto }: { trip: Trip; onGoto: (key: string) => void }) {
  const rows = trip.lich.flatMap(x => lines(x.dat_truoc).map(l => ({ x, text: stripDone(l), ok: isDone(l) })));
  const done = rows.filter(r => r.ok).length;
  return (
    <section className="card pad" id="book" aria-labelledby="bookTitle">
      <h2 className="h2" id="bookTitle">Cần đặt trước {rows.length > 0 && <small className="num">{done}/{rows.length} xong</small>}</h2>
      <p className="hint">Gọi xong thì thêm dấu ✓ ở đầu dòng (cột dat_truoc trong Google Sheet) – cả nhóm sẽ thấy việc đó đã xong.</p>
      <ul className="list">
        {rows.map(r => {
          const q = trip.quan[r.x.quan];
          return (
            <li className="book" key={r.x.key + r.text} data-done={r.ok}>
              <Check on={r.ok} />
              <div>
                <p><span className="sr">{r.ok ? 'Đã xong: ' : 'Chưa xong: '}</span>{r.text}</p>
                <button className="meta linkish" type="button" onClick={() => onGoto(r.x.key)}>
                  Ngày {r.x.ngay} · {r.x.bat_dau}{q && ` · ${q.ten}`}
                </button>
              </div>
              {q?.dien_thoai && byPhone(r.text)
                ? <a className="btn sm" href={tel(q.dien_thoai)} aria-label={`Gọi ${q.ten}`}><Icon name="phone" />Gọi</a> : <span />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Notes({ trip, open, onToggle }: { trip: Trip; open: Set<string>; onToggle: (id: string) => void }) {
  const all = [...trip.canh_bao].sort((a, b) => level(a.muc)[2] - level(b.muc)[2] || (a.ngay || 9) - (b.ngay || 9));
  return (
    <section className="card pad" id="notes" aria-labelledby="notesTitle">
      <h2 className="h2" id="notesTitle">Tất cả lưu ý <small className="num">{all.length}</small></h2>
      <div className="alerts list">
        {all.map((w, i) => { const id = `note-${i}`; return <Alert key={id} id={id} w={w} open={open.has(id)} onToggle={onToggle} />; })}
      </div>
    </section>
  );
}

export function Directory({ trip, me, open, onToggle, onMap }: {
  trip: Trip; me: LatLng | null; open: Set<string>; onToggle: (id: string) => void; onMap: (id: string) => void;
}) {
  const all = Object.values(trip.quan);
  const dist = (q: Place) => (me && q.lat != null && q.lng != null ? km(me, { lat: q.lat, lng: q.lng }) : Infinity);
  const groups = [...Object.keys(NHOM), 'khac']
    .map(k => [k, all.filter(q => (k === 'khac' ? !NHOM[q.nhom] : q.nhom === k))] as const)
    .filter(([, a]) => a.length);
  return (
    <section className="card pad" id="dir" aria-labelledby="dirTitle">
      <h2 className="h2" id="dirTitle">Danh bạ <small className="num">{all.length}</small></h2>
      <p className="hint">{me ? 'Đang xếp theo khoảng cách tới bạn.' : 'Bật “Vị trí của tôi” trên bản đồ để xếp theo khoảng cách.'}</p>
      <div className="list">
        {groups.map(([k, a]) => (
          <Acc key={k} id={`grp-${k}`} className="grp" open={open.has(`grp-${k}`)} onToggle={onToggle}
            head={<span className="t">{NHOM[k]?.[0] ?? 'Khác'} <small className="num">{a.length}</small></span>}>
            {(me ? [...a].sort((p, q) => dist(p) - dist(q)) : a).map(q => (
              <div className="place" key={q.id}>
                <b>{q.ten}</b>
                <p className="meta">{[q.loai, q.danh_gia && `★ ${q.danh_gia}`, q.gia, dist(q) < Infinity && `cách ${fmtKm(dist(q))}`].filter(Boolean).join(' · ')}</p>
                <p className="meta">{q.dia_chi}{q.gio_mo_cua && ` · ${q.gio_mo_cua}`}</p>
                <Actions q={q} onMap={onMap} />
              </div>
            ))}
          </Acc>
        ))}
      </div>
    </section>
  );
}

export function Footer({ trip, sync }: { trip: Trip; sync: SyncState }) {
  return (
    <footer className="foot">
      <p>{NOTE}</p>
      <p>
        Nguồn: {!SHEET_URL ? 'dữ liệu có sẵn' : sync.state === 'live' ? 'Google Sheet (trực tiếp)' : 'bản lưu gần nhất của Google Sheet'}
        {' · '}Bản đồ © OpenStreetMap · Thời tiết Open-Meteo
        {SHEET_URL && <> · <a href={SHEET_URL} target="_blank" rel="noopener">Mở Google Sheet</a></>}
      </p>
      {sync.err && <p>Lỗi Google Sheet: {sync.err}</p>}
      {trip.issues.length > 0 && (
        <details>
          <summary>{trip.issues.length} dòng dữ liệu trong Sheet bị bỏ qua</summary>
          <ul>{trip.issues.map(i => <li key={i}>{i}</li>)}</ul>
        </details>
      )}
    </footer>
  );
}
