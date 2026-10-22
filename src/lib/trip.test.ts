// npm test – checks the time model, CSV parsing and data validation against the real trip data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bring, byPhone, dayOf, dayPath, diffTrips, dirUrl, lines, links, normalize, numbering, parseCSV, swatches, tel, timeline, toMin, toObjects, until, zalo } from './trip.ts';
import type { RawTrip } from './trip.ts';
import { START } from '../config.ts';
import data from '../data/trip.json' with { type: 'json' };

const raw = data as RawTrip;
const at = (s: string) => Date.parse(s + '+07:00');
const hm = (ms: number) => new Date(ms + 7 * 36e5).toISOString().slice(5, 16);
const t = normalize(raw, START);
const find = (h: string) => t.lich.find(x => x.hoat_dong.startsWith(h))!;

test('parsing', () => {
  assert.deepEqual(['7:30', '07:30', '24:00', '7h30', '18h', '7', '', 'Trước 9:00'].map(toMin), [450, 450, 1440, 450, 1080, 420, NaN, NaN]);
  assert.deepEqual(parseCSV('a,b\n"x, y","he said ""hi"""\r\n"multi\nline",z'), [['a', 'b'], ['x, y', 'he said "hi"'], ['multi\nline', 'z']]);
  assert.deepEqual(toObjects(parseCSV('"id","ten","",""\n"a","A","",""')), [{ id: 'a', ten: 'A' }]); // gviz pads empty columns
});

test('trip data is clean', () => {
  assert.deepEqual(t.issues, []);
  assert.equal(t.lich.length, 42);
  assert.equal(new Set(t.lich.map(x => x.key)).size, 42);
});

test('end times', () => {
  assert.equal(hm(find('Ăn tối hải sản').end), '10-24T21:00'); // no end → next stop, capped at 3h
  assert.equal(hm(find('Về hát').end), '10-25T00:00');
  assert.equal(hm(find('Về phòng nghỉ').start), '10-25T00:00'); // "24:00" belongs to day 1
  assert.equal(hm(find('Về phòng nghỉ').end), '10-25T03:00');
  assert.equal(hm(find('Cất cánh').end), '10-27T18:00');
});

test('now / next', () => {
  const tl = (s: string) => { const r = timeline(t.lich, at(s)); return [r.phase, r.cur?.hoat_dong ?? null, r.next?.hoat_dong ?? null]; };
  assert.deepEqual(tl('2026-10-22T09:00'), ['before', null, 'Đến sân bay PQC, chụp vài tấm']);
  assert.deepEqual(tl('2026-10-24T10:30').slice(0, 2), ['during', 'Đến sân bay PQC, chụp vài tấm']);
  assert.deepEqual(tl('2026-10-24T12:00').slice(1), ['Ăn trưa món local', 'Nghỉ ngơi, tránh nắng, nhận phòng – check-in villa']);
  assert.deepEqual(tl('2026-10-24T15:10').slice(1), [null, 'Đi biển']); // gap between stops
  assert.deepEqual(tl('2026-10-26T02:00').slice(1), [null, 'Ăn sáng (ai muốn thì dậy sớm, không thì ngủ tiếp)']);
  assert.deepEqual(tl('2026-10-27T14:00').slice(1), ['Có mặt sân bay, làm thủ tục (quầy đóng 14:20)', 'Cất cánh về Hà Nội']);
  assert.deepEqual(tl('2026-10-27T19:00'), ['after', null, null]);
  assert.deepEqual(['2026-10-22T09:00', '2026-10-25T00:30', '2026-10-25T10:00', '2026-10-28T08:00'].map(s => dayOf(START, at(s), 4)), [1, 1, 2, 4]);
  assert.equal(until(2 * 864e5 + 3 * 36e5 + 1), '2 ngày 3 giờ');
  assert.equal(until(61 * 6e4), '1 giờ 1 phút');
});

test('helpers', () => {
  assert.equal(tel('+84 394 241 419 (có WhatsApp/Zalo)'), 'tel:+84394241419');
  assert.equal(links('A | https://x.vn/a\nhttps://www.foody.vn/b')[1].ten, 'foody.vn');
  assert.match(dirUrl(t.quan.ngon83), /destination_place_id=ChIJ-eA02-6NpzERxPjZuX6DDWo/);
  assert.match(dirUrl(t.quan.villa), /destination=10\.2045,103\.965$/);
  assert.deepEqual(swatches('Trắng – hồng'), ['#ffffff', '#f4a8b8']);
  assert.deepEqual(swatches('Nâu be'), ['#7b4a2a', '#e3d3b4']);
  assert.deepEqual(bring(t.lich.filter(x => x.ngay === 3)).map(b => b.gio), ['10:00', '12:00', '15:00', '17:15']);
  const tasks = t.lich.flatMap(x => lines(x.dat_truoc));
  assert.deepEqual(tasks.filter(l => !byPhone(l)), [
    'Mua vé VinWonders online cho 8 người (vinwonders.com/Klook), cân nhắc combo vé + buffet',
    'Check-in online trước 24h cho cả 8 người',
  ]);
});

test('map numbering, zalo, diff', () => {
  const d1 = t.lich.filter(x => x.ngay === 1);
  assert.deepEqual([...numbering(t.quan, d1).entries()].slice(0, 3), [['pqc', '1'], ['villa', '⌂'], ['ngon83', '2']]);
  assert.equal(dayPath(t.quan, t.lich.filter(x => x.ngay === 2)).filter(p => p.q.id === 'vinwonders').length, 1);
  assert.equal(zalo('+84 394 241 419 (có WhatsApp/Zalo)'), 'https://zalo.me/0394241419');
  assert.equal(zalo('+84 974 349 255'), undefined);
  assert.equal(diffTrips(t, normalize(raw, START)).changed, false);
  const edited = structuredClone(raw);
  edited.lich.find(r => r.hoat_dong === 'Ăn trưa hải sản Thanh Nga')!.quan = 'combac';
  edited.lich.find(r => r.hoat_dong === 'Đi matxa')!.bat_dau = '9:30';
  const d = diffTrips(t, normalize(edited, START));
  assert.equal(d.keys.length, 2);
  assert.equal(d.message, 'N3 12:00: Thanh Nga Seafood beach restaurant → Cơm Bắc Gia Đình (Sunset Town) (+1 thay đổi khác)');
});

test('bad sheet edits are reported, not fatal', () => {
  const broken = structuredClone(raw);
  broken.lich[3].bat_dau = 'chiều';
  broken.lich[4].quan = 'khongco';
  broken.quan[0].toa_do = '';
  const r = normalize(broken, START);
  assert.equal(r.issues.length, 3);
  assert.equal(r.lich.length, 41);
});
