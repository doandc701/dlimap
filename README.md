# DLiMap – Trợ lý giao thông

Web app (Nuxt 4 + MapLibre + PrimeVue 4 + Tailwind CSS 4) lấy cảm hứng từ Vietmap Live: dẫn đường, cảnh báo tốc độ,
camera phạt nguội, tính phí BOT, dẫn đường hybrid (ngoại tuyến), đi theo nhóm…

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # bản production, đọc .env nếu có
```

### Link test cho điện thoại / máy khác

Geolocation, Service Worker và Wake Lock cần HTTPS (hoặc `localhost`), nên hãy dùng link HTTPS:

```bash
npm run build && npm start   # terminal 1: bản production ở cổng 3000 (tải nhanh hơn dev qua tunnel)
npm run share                # terminal 2: ngrok → in ra https://….ngrok-free.dev, gửi link này cho máy khác
```

- Lần đầu mở, ngrok (gói miễn phí) hiện trang cảnh báo → bấm **Visit Site**. Qua ngrok không cài được PWA
  (manifest bị trang cảnh báo chặn); các chức năng khác chạy bình thường.
- Cùng mạng LAN: `npm run dev:lan` (HTTPS chứng chỉ tự ký, trình duyệt sẽ cảnh báo) rồi mở `https://<IP máy>:3000`.
- `nuxt dev --tunnel` (Cloudflare) cũng được nếu mạng không chặn `trycloudflare.com`.
- Link tunnel là công khai: ai có link đều vào được, nên tắt `ngrok` khi test xong.

## Tính năng

| Tính năng | Cách làm | Dữ liệu |
|---|---|---|
| Cảnh báo giới hạn tốc độ | Biển tốc độ dọc tuyến (tải trước) hoặc của đường đang đi; đường chưa có biển → áp dụng TT 38/2024 theo nhóm xe | OSM + quy định (đã đối chiếu TT 38/2024) |
| Camera phạt nguội / đèn đỏ | Camera dọc tuyến hoặc phía trước xe, báo bằng giọng nói từ 500 m | OSM (còn thưa ở VN) + cộng đồng báo cáo |
| Cấm vượt, khu đông dân cư, hầm chui, đèn giao thông | Thẻ `overtaking=no`, `tunnel=yes`, `highway=traffic_signals`; khu dân cư là ước đoán từ bản đồ | OSM |
| Khoảng cách an toàn | 35/55/70/100 m theo TT 38/2024 Điều 11; dưới 60 km/h gợi ý quy tắc 2 giây | Quy định |
| Dẫn đường + giọng nói tiếng Việt | OSRM; giọng trình duyệt hoặc TTS qua máy chủ, âm thanh tải trước | OSRM |
| Chọn phương tiện (như Google Maps) | Ô tô, xe máy (tránh cao tốc, không tính phí BOT), xe đạp, đi bộ; mỗi phương tiện hiện thời gian riêng | OSRM, Valhalla |
| Dẫn đường Hybrid | Lưu tuyến, dữ liệu đường, camera, bảng phí; tải trước bản đồ 2 km quanh tuyến (Service Worker) | – |
| Phí BOT & cao tốc | Trạm hở: giá vé lượt theo trạm; cao tốc thu phí kín: km thực đi × đơn giá. Mỗi mục ghi nguồn + ngày, mục cũ gắn "cần xác minh", không có nguồn → "chưa có giá" | `server/data/tolls.ts` (tra cứu 22/10/2026) |
| ePass / VETC | Người dùng tự nhập số dư để cảnh báo thiếu tiền; link sang trang chính thức để nạp | Không có API công khai |
| Kẹt xe thời gian thực | TomTom Traffic Flow (vector tiles, proxy qua máy chủ): tô màu đường, thẻ "Giao thông ở khu này", số phút chậm thêm trên tuyến cộng vào giờ đến – cần `NUXT_TOMTOM_KEY` | TomTom (free 200k tile/tháng) |
| Tra cứu phạt nguội | Chuẩn hoá biển số, mở cổng chính thức csgt.bocongan.gov.vn (yêu cầu VNeID mức 2) | Cục CSGT |
| Cảm biến áp suất lốp | Web Bluetooth đọc quảng bá BLE của cảm biến "TPMS" (0x0100) và "BR" (0x27A5) – cần bật cờ Chrome | Cảm biến thật |
| Camera giao thông trực tuyến | Link cổng Sở GTVT TP.HCM + camera giám sát gần bạn | OSM |
| Đi theo nhóm | Phòng có mã 6 ký tự, đồng bộ vị trí mỗi 3 giây | Server Nitro (RAM) |
| Báo cáo cộng đồng | CSGT, tai nạn, kẹt xe, camera, nguy hiểm. Tự hết hạn (kẹt xe 1 giờ, tai nạn/CSGT 2 giờ, nguy hiểm 12 giờ, camera 30 ngày); người báo xoá được; 2 người bấm "Không còn nữa" thì ẩn | Nitro storage `.data/` |
| Bấm vào bản đồ | Bấm địa điểm (cửa hàng, bến xe, bệnh viện…), camera, trạm BOT, báo cáo → thẻ thông tin + Chỉ đường / Từ đây | OpenMapTiles + Nominatim |
| Chế độ lái xe, mô phỏng chuyến đi | Toàn màn hình + giữ màn hình sáng; chạy thử dọc tuyến 1×–8× | – |

**Không có nguồn dữ liệu công khai** (đã gỡ phần giả lập): đếm giây đèn giao thông; tra cứu phạt nguội tự động
(cổng chính thức bắt đăng nhập VNeID + reCAPTCHA v3); liên kết tài khoản ePass/VETC (chỉ đối tác ngân hàng/ví);
cơ sở dữ liệu camera phạt nguội đầy đủ (Vietmap bán thương mại; tỉnh chỉ công bố danh sách dạng văn bản).

**Apple CarPlay / Android Auto** không hỗ trợ ứng dụng web. Muốn có, cần bọc app bằng app native
(vd. Capacitor + CarPlay / Android for Cars templates). "Chế độ lái xe" là phương án thay thế trên web.

## Cấu trúc

```
app/
  pages/index.vue          màn hình chính
  components/              MapView, SearchBar, NavBanner, SpeedHud, AlertStack, RouteSheet, SideMenu
  components/panel/        Toll, Violation, Group, Tire, Cams, Offline, Settings, Report
  composables/             useNavigation (tuyến, tiến trình, mô phỏng), useRoad (thông tin đường),
                           useAlerts (cảnh báo + giọng nói), useWallet, useGroup, useOffline, …
  utils/traffic.ts         mô phỏng kẹt xe & pha đèn
server/api/                route, geocode, pois, road, roads, group/[code], reports, violations
server/data/tolls.ts       bảng giá trạm BOT (cần cập nhật)
shared/                    kiểu dữ liệu, hàm hình học, quy tắc tốc độ dùng chung client/server
public/sw.js               service worker cho bản đồ ngoại tuyến
```

## Dịch vụ bên ngoài

Đổi trong `nuxt.config.ts` → `runtimeConfig`, hoặc qua biến môi trường
`NUXT_OSRM_URL`, `NUXT_NOMINATIM_URL`, `NUXT_OVERPASS_URL`, `NUXT_TOMTOM_KEY`.

- Bản đồ: OpenFreeMap (`tiles.openfreemap.org`)
- Dẫn đường: OSRM demo server – **chỉ để thử**; khi chạy thật nên tự host OSRM với dữ liệu Việt Nam
- Tìm địa điểm: Nominatim – giới hạn 1 request/giây; khi chạy thật nên tự host
- Dữ liệu đường: Overpass API – chậm (10–40 giây mỗi truy vấn), server đã có cache; khi chạy thật nên tự host
- Kẹt xe: TomTom Traffic Flow – đăng ký key tại https://developer.tomtom.com
- Giọng đọc dự phòng: endpoint TTS không chính thức của Google Translate (`server/api/tts.get.ts`) – khi chạy thật thay bằng FPT.AI / Viettel AI / Google Cloud TTS

## Cập nhật bảng phí

Giá BOT thay đổi theo quyết định của nhà đầu tư/Bộ GTVT (VEC tăng ~12% mỗi 3 năm, dự kiến đợt tới ~2027).
Mỗi mục trong `server/data/tolls.ts` có `source { url, date, verified, note }` – khi cập nhật, ghi lại nguồn
và đặt `verified: true` nếu là biểu giá chính thức từ 2024 trở lại đây. Trạm dừng thu thêm vào `STOPPED_KEYWORDS`.

## Triển khai lên Vercel

1. Vào https://vercel.com/new → **Import** repo `doandc701/dlimap` (Framework: Nuxt – tự nhận).
2. **Environment Variables**: thêm `NUXT_TOMTOM_KEY` = key TomTom (không có thì lớp kẹt xe bị ẩn).
3. **Deploy**. Từ đó mỗi lần `git push` lên `main`, Vercel tự build lại.

Hạn chế hiện tại trên Vercel (serverless, không có ổ đĩa lâu dài):
- **Báo cáo cộng đồng** đang lưu vào `.data/` trên đĩa → trên Vercel không lưu được. Cần chuyển sang
  kho dùng chung (vd. Upstash Redis qua Vercel Marketplace) bằng cách cấu hình Nitro storage `data`.
- **Đi theo nhóm** giữ phòng trong RAM → các request có thể rơi vào máy khác nhau, thành viên không thấy nhau.
- Cache trong RAM (tuyến, Overpass, TTS…) chỉ có tác dụng trong từng instance.
