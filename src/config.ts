// Cấu hình chuyến đi. Quán & lịch nằm ở Google Sheet (SHEET_URL) – sửa Sheet là cả nhóm thấy sau ~1 phút.
// src/data/trip.json là bản dự phòng khi mất mạng; cập nhật nó bằng `npm run pull-sheet` trước khi deploy.
export const TRIP_NAME = 'Phú Quốc 24–27/10';
export const CREW = 'Nhóm 8 người';
export const START = '2026-10-24'; // ngày 1 của chuyến đi (giờ Việt Nam)
export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1xOTDphGa7VCNiCo6DPNSSY9sj-1bCDt75tvwFU74uJM/edit';
export const POLL_MS = 60_000;
// The booked accommodation. While the sheet's `villa` row still says "giả định / chưa chốt", the page shows this instead;
// once that row is edited in the sheet, the sheet wins again.
export const VILLA = {
  ten: 'Sailing Club Signature Resort Phú Quốc',
  loai: 'Resort – chỗ ở của nhóm',
  dia_chi: 'Tổ 3, KP7, An Thới (khu Bãi Trường) – cách sân bay ~10 km',
  dien_thoai: '+84 297 3559 888',
  danh_gia: '4.9',
  toa_do: '10.1153507, 103.9899345',
  maps: 'https://www.google.com/maps/place/Sailing+Club+Signature+Resort+Phu+Quoc/@10.1153507,103.9899345,16z/data=!4m9!3m8!1s0x31a7936d1a86cb47:0x7d2d600a76f4230b!5m2!4m1!1i2!8m2!3d10.1153507!4d103.9899345!16s%2Fg%2F11rcs3x07s',
};
export const NOTE =
  'Dữ liệu Google Maps (điểm, số review, giờ mở cửa) lấy ngày 22/10/2026 – giá là ước tính từ review/mức giá Google, nên gọi xác nhận trước. Chỗ ở: Sailing Club Signature Resort (Bãi Trường, phía nam sân bay).';
