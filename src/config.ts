// Cấu hình chuyến đi. Quán & lịch nằm ở Google Sheet (SHEET_URL) – sửa Sheet là cả nhóm thấy sau ~1 phút.
// src/data/trip.json là bản dự phòng khi mất mạng; cập nhật nó bằng `npm run pull-sheet` trước khi deploy.
export const TRIP_NAME = 'Phú Quốc 24–27/10';
export const CREW = 'Nhóm 8 người';
export const START = '2026-10-24'; // ngày 1 của chuyến đi (giờ Việt Nam)
export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1xOTDphGa7VCNiCo6DPNSSY9sj-1bCDt75tvwFU74uJM/edit';
export const POLL_MS = 60_000;
export const NOTE =
  'Dữ liệu Google Maps (điểm, số review, giờ mở cửa) lấy ngày 22/10/2026 – giá là ước tính từ review/mức giá Google, nên gọi xác nhận trước. Chỗ ở: Sailing Club Signature Resort (Bãi Trường, phía nam sân bay).';
