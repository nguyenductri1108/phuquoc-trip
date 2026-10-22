# Phú Quốc 24–27/10 · lịch trình nhóm

Trang web (React + Vite + TypeScript, chỉ frontend) cho chuyến Phú Quốc của nhóm 8 người. Trang chạy theo giờ thật (giờ Việt Nam):

- Thẻ "Bây giờ" cho biết đang làm gì và tiếp theo đi đâu. Trước ngày đi thì đếm ngược.
- Bản đồ vẽ lộ trình từng ngày, có nút xem vị trí của mình.
- Có thời tiết, dresscode và đồ cần mang cho từng ngày.
- Có checklist việc cần đặt trước và danh bạ quán.

## Chạy

```bash
npm install
npm run dev          # http://localhost:5173 – thêm ?t=2026-10-25T14:00 để xem thử một thời điểm bất kỳ
npm test             # kiểm tra logic giờ / dữ liệu (src/lib/trip.test.ts)
npm run build        # ra thư mục dist/ để deploy
```

## Dữ liệu = Google Sheet

`src/config.ts` → `SHEET_URL`. Trang đọc Sheet mỗi phút, sửa trên Sheet thì khoảng 1 phút sau cả nhóm thấy, không cần deploy lại. Sheet phải để chia sẻ "Bất kỳ ai có đường liên kết – Người xem".

| Tab | Một dòng là | Cột chính |
|---|---|---|
| `quan` | một quán / địa điểm | `id` (mã không dấu), `ten`, `nhom` (an · bien · choi · mua · nghi · spa · hat · bay), `dia_chi`, `dien_thoai`, `gio_mo_cua`, `danh_gia`, `gia`, `toa_do` ("vĩ độ, kinh độ"), `maps` |
| `lich` | một mục trong lịch | `ngay` (1–4), `bat_dau`, `ket_thuc` (trống = tới mục sau), `hoat_dong`, `dresscode`, `quan` / `du_phong` (id ở tab quan), `mo_ta`, `du_phong_mo_ta`, `gia`, `luu_y`, `dat_truoc`, `di_chuyen`, `links` |
| `ngay` | một ngày | `ngay`, `tieu_de` |
| `canh_bao` | một lưu ý | `muc` (🔴 / 🟡 / 🟢), `ngay` (trống = chung), `tieu_de`, `chi_tiet`, `links` |

Mẹo:

- **Đổi quán:** thêm quán mới ở tab `quan`. Lấy toạ độ bằng cách chuột phải vào điểm trên Google Maps rồi bấm vào dòng toạ độ để copy. Sau đó sửa cột `quan` ở dòng lịch tương ứng, nhớ sửa luôn `mo_ta`, `gia`, `luu_y` của dòng đó cho khớp.
- **Đánh dấu đã đặt xong:** thêm `✓ ` vào đầu dòng ở cột `dat_truoc`. Checklist của cả nhóm sẽ tự tick.
- **Nhiều mục trong một ô:** cột `links` và `dat_truoc` ghi mỗi mục một dòng (Alt/Option + Enter để xuống dòng trong ô). Link viết theo dạng `Tên | URL`.
- **Câu "Mang …"** trong cột `luu_y` sẽ tự vào danh sách "mang theo" của ngày đó.
- **Giờ từ 0:00 đến 3:59** được tính là đêm muộn của ngày ghi ở cột `ngay`. Ví dụ "0:30" ở ngày 1 nghĩa là 0:30 rạng sáng 25/10. Ngày trên trang chuyển lúc 4:00 sáng.
- **Quán chưa có toạ độ** vẫn có nút "Chỉ đường" (tìm theo tên + địa chỉ, hoặc theo link Maps trong cột `maps`). Thêm `toa_do` thì quán mới hiện trên bản đồ.
- **Dòng sai** (giờ không đọc được, id quán không có, ngày không có trong tab `ngay`) sẽ bị bỏ qua. Đầu trang hiện thông báo vàng, cuối trang ghi rõ dòng nào sai và vì sao. Trang không bị sập.
- **Sau khi sửa:** khoảng 1 phút sau, máy nào đang mở trang cũng tự cập nhật, có toast báo thay đổi (ví dụ "N1 18:00: Xin Chào → Ra Khơi") và chip "Mới đổi" ở mục vừa đổi. Bấm nút "Trực tiếp" để lấy ngay.

Trên điện thoại, chọn "Thêm vào màn hình chính" (Safari: nút Chia sẻ; Chrome: menu ⋮) để mở trang như một app.

`src/data/trip.json` là bản dự phòng khi mất mạng. Trước mỗi lần deploy, chạy `npm run pull-sheet` để cập nhật nó từ Sheet.

## Deploy (host tĩnh)

Link chính: <https://phuquoc-sscdm.vercel.app>. Project `phuquoc-trip` trên Vercel đã nối với repo GitHub, nên mỗi lần push lên `main` Vercel tự build và deploy. GitHub Actions cũng deploy cùng lúc một bản lên GitHub Pages.

Commit phải đứng tên `nguyenductri1108 <nguyenductri1108.thd@gmail.com>` (đã đặt riêng cho repo này qua `git config --local`). Nếu commit mang email khác, Vercel sẽ chặn deploy ("commit author doesn't have permission").

`npm run build` rồi đưa thư mục `dist/` lên host. Cấu hình `base: './'` nên trang chạy được ở bất kỳ đường dẫn nào.

- **Netlify Drop:** kéo thả `dist/` vào <https://app.netlify.com/drop>.
- **Vercel / Netlify qua GitHub:** import repo, build command `npm run build`, output `dist`.
- **GitHub Pages:** đẩy `dist/` lên nhánh `gh-pages`, hoặc dùng GitHub Actions.

Bản đồ: © OpenStreetMap contributors. Thời tiết: Open-Meteo. Trang có `noindex` nên không bị Google tìm thấy.
