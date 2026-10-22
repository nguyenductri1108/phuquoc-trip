import { Fragment, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { color, dayPath, dirUrl, numbering, tel } from '../lib/trip.ts';
import type { LatLng, Place, Stop, Trip } from '../lib/trip.ts';
import { Icon } from './ui.tsx';
import './MapView.css';

export const ISLAND: L.LatLngBoundsLiteral = [[9.7, 103.6], [10.6, 104.4]];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ll = (q: Place): [number, number] => [q.lat!, q.lng!];
// label is a digit or ⌂ and colour a fixed hex from NHOM – nothing from the sheet goes into this HTML
const pin = (label: string, cls: string, c: string) => L.divIcon({
  className: '', html: `<span class="pin ${cls}" style="--c:${c}">${label}</span>`, iconSize: cls === 'b' ? [18, 18] : [28, 28],
});
const meIcon = L.divIcon({ className: '', html: '<span class="me-dot"></span>', iconSize: [16, 16] });
// keep auto-panned popups clear of the locate/fit column on the right
const POPUP = { autoPanPaddingTopLeft: [16, 16] as L.PointTuple, autoPanPaddingBottomRight: [64, 16] as L.PointTuple };

export interface Focus { q: Place; n: number }

interface Props {
  trip: Trip; day: number; now: number; cur: Stop | null; next: Stop | null; open: Set<string>;
  focus: Focus | null; meFocus: number; me: (LatLng & { acc: number }) | null; fitKey: string; locating: boolean;
  onLocate: () => void; onFit: () => void; onGoto: (key: string) => void;
}

export function MapView({ trip, day, now, cur, next, open, focus, meFocus, me, fitKey, locating, onLocate, onFit, onGoto }: Props) {
  const items = trip.lich.filter(x => x.ngay === day), nos = numbering(trip.quan, items), path = dayPath(trip.quan, items);
  const markers = useRef(new Map<string, L.Marker>());
  const backups = items.filter(x => open.has(x.key) && trip.quan[x.du_phong]?.lat != null && !nos.has(x.du_phong));

  return (
    <div className="mapbox" id="map">
      {/* zoomSnap 0.25: fitting a day's route can land between whole zoom levels instead of backing off a full step */}
      <MapContainer center={[10.2, 103.97]} zoom={10} minZoom={9} zoomSnap={0.25} maxBounds={ISLAND} zoomControl={false}
        dragging={!L.Browser.mobile} className="leaflet-host" aria-label="Bản đồ lộ trình trong ngày">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {!L.Browser.mobile && <ZoomControl position="topleft" />}

        {path.slice(1).map((p, i) => {
          // leg into p: done once we've arrived, live while heading to the next stop
          const leg = p.x.start <= now ? 'done' : p.x === next ? 'live' : 'todo';
          // className must be a top-level prop: Leaflet applies it only when the path is created (setStyle ignores it)
          return <Polyline key={`${p.x.key}-${leg}`} positions={[ll(path[i].q), ll(p.q)]} interactive={false}
            className={`leg ${leg}`} weight={leg === 'live' ? 4 : 3} />;
        })}

        {backups.map(x => {
          const b = trip.quan[x.du_phong], a = trip.quan[x.quan];
          return (
            <Fragment key={`b-${x.key}`}>
              {a?.lat != null && <Polyline positions={[ll(a), ll(b)]} interactive={false} className="leg hair" weight={1} />}
              <Marker position={ll(b)} icon={pin('', 'b', color(b))} title={`Phương án B: ${b.ten}`} zIndexOffset={-100}
                ref={m => { if (m) markers.current.set(b.id, m); }}>
                <Popup {...POPUP}><PlaceCard q={b} note="Phương án B cho" stops={[x]} onGoto={onGoto} /></Popup>
              </Marker>
            </Fragment>
          );
        })}

        {[...nos].map(([id, no]) => {
          const q = trip.quan[id];
          if (q.lat == null) return null;
          const its = items.filter(x => x.quan === id);
          const st = cur && its.includes(cur) ? 'now' : next && its.includes(next) ? 'next' : its.every(x => x.end <= now) ? 'past' : '';
          return (
            // key = place only: a stop starting/ending restyles the pin in place and keeps its open popup
            <Marker key={id} position={ll(q)} icon={pin(no, `${no === '⌂' ? 'home ' : ''}${st}`, color(q))}
              title={q.ten} alt={q.ten} riseOnHover zIndexOffset={st === 'now' ? 1000 : 0}
              ref={m => { if (m) markers.current.set(id, m); }}>
              <Popup {...POPUP}><PlaceCard q={q} stops={its} onGoto={onGoto} /></Popup>
            </Marker>
          );
        })}

        {me && (
          <>
            <Circle center={[me.lat, me.lng]} radius={me.acc} interactive={false} className="me-ring" weight={1} />
            <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} keyboard={false} zIndexOffset={2000} />
          </>
        )}
        <Controller fitKey={fitKey} path={path.map(p => p.q)} focus={focus} me={me} meFocus={meFocus} markers={markers} />
      </MapContainer>

      <div className="map-tools">
        <button type="button" onClick={onLocate} aria-pressed={locating} aria-label="Vị trí của tôi" title="Vị trí của tôi (chỉ hiện trên máy bạn)"><Icon name="locate" /></button>
        <button type="button" onClick={onFit} aria-label="Xem cả lộ trình trong ngày" title="Cả lộ trình trong ngày"><Icon name="fit" /></button>
      </div>
      {L.Browser.mobile && <p className="map-hint">Dùng 2 ngón để kéo bản đồ</p>}
    </div>
  );
}

// every stop at this place is its own link, so "Thanh Nga" offers both 11:00 (leave) and 12:00 (lunch)
function PlaceCard({ q, note, stops, onGoto }: { q: Place; note?: string; stops: Stop[]; onGoto: (key: string) => void }) {
  return (
    <>
      <b>{q.ten}</b>
      <span className="hint">{note ?? q.loai}</span>
      <ul className="pop-stops">
        {stops.map(x => (
          <li key={x.key}><button className="linkish" type="button" onClick={() => onGoto(x.key)}><span className="num">{x.bat_dau}</span> {x.hoat_dong}</button></li>
        ))}
      </ul>
      <div className="acts">
        <a className="btn primary sm" href={dirUrl(q)} target="_blank" rel="noopener"><Icon name="nav" />Chỉ đường</a>
        {q.dien_thoai && <a className="btn sm" href={tel(q.dien_thoai)}><Icon name="phone" />Gọi</a>}
      </div>
    </>
  );
}

/** Moves the map only on purpose: day change / fit button, a "Bản đồ" tap, or the locate button. Sheet refreshes never move it. */
function Controller({ fitKey, path, focus, me, meFocus, markers }: {
  fitKey: string; path: Place[]; focus: Focus | null; me: LatLng | null; meFocus: number; markers: { current: Map<string, L.Marker> };
}) {
  const map = useMap(), first = useRef(true);
  useEffect(() => {
    if (!path.length) return;
    const b = L.latLngBounds(path.map(ll)), opts = { padding: [40, 40] as [number, number], maxZoom: 14 };
    if (first.current || reduced()) map.fitBounds(b, opts); else map.flyToBounds(b, { ...opts, duration: 0.8 });
    first.current = false;
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus || focus.q.lat == null) return;
    const q = focus.q;
    const show = () => {
      const m = markers.current.get(q.id);
      if (m && map.hasLayer(m)) m.openPopup();
      else { const el = document.createElement('b'); el.textContent = q.ten; L.popup().setLatLng(ll(q)).setContent(el).openOn(map); }
    };
    if (reduced()) { map.setView(ll(q), 16); show(); } else { map.once('moveend', show); map.flyTo(ll(q), 16, { duration: 0.8 }); }
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!meFocus || !me) return;
    if (reduced()) map.setView([me.lat, me.lng], 15); else map.flyTo([me.lat, me.lng], 15, { duration: 0.8 });
  }, [meFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
