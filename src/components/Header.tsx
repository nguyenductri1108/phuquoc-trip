import { CREW, SHEET_URL, TRIP_NAME } from '../config.ts';
import { fmtTime } from '../lib/trip.ts';
import type { SyncState } from '../lib/hooks.ts';
import './Header.css';

export function Header({ now, sync, onSync }: { now: number; sync: SyncState; onSync: () => void }) {
  const m = /^(.*?)\s+([\d–/.-]+)$/.exec(TRIP_NAME);
  const label = {
    local: 'Bản gốc', loading: 'Đang tải…', live: 'Trực tiếp',
    error: sync.at ? `Ngoại tuyến · ${fmtTime(sync.at)}` : 'Lỗi Sheet',
  }[sync.state];
  const title = !SHEET_URL ? 'Chưa nối Google Sheet – đang dùng dữ liệu có sẵn'
    : sync.err ? `Lỗi: ${sync.err}. Bấm để thử lại.`
    : `Đọc Google Sheet mỗi phút${sync.at ? ` · lần cuối ${fmtTime(sync.at)}` : ''}. Bấm để cập nhật ngay.`;
  return (
    <header className="top">
      <div>
        <h1>{m ? <>{m[1]} <span>{m[2]}</span></> : TRIP_NAME}</h1>
        <p>{CREW} · giờ đảo <b className="num">{fmtTime(now)}</b></p>
      </div>
      <button className="sync" type="button" data-state={sync.state} title={title} aria-label={`${label}. ${title}`} onClick={onSync}>
        <span className="dot" />{label}
      </button>
    </header>
  );
}
