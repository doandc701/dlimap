import type { ClosedExpressway, TollSource, VehicleClass } from '#shared/types'

/**
 * Giá dịch vụ sử dụng đường bộ (BOT) và phí cao tốc – tra cứu ngày 22/10/2026.
 *
 * Nhóm xe (NĐ 130/2024/NĐ-CP, thông báo VEC 2025):
 *  1: < 12 ghế, tải < 2 t, xe buýt công cộng · 2: 12–30 ghế, tải 2–< 4 t
 *  3: ≥ 31 ghế, tải 4–< 10 t, đầu kéo không kéo moóc · 4: tải 10–< 18 t, container < 40 ft
 *  5: tải ≥ 18 t, container ≥ 40 ft
 *
 * `verified: false` = nguồn cũ (trước 2024) hoặc bài báo không nêu rõ tuyến/hiệu lực – cần
 * đối chiếu lại với biểu giá chính thức của nhà đầu tư trước khi dùng cho thanh toán.
 * Giá vé lượt danh sách 12/2023 là mức "dự kiến" theo vietnamnet; chưa xác nhận lại từng trạm.
 */

const VNN_2023: TollSource = {
  url: 'https://vietnamnet.vn/danh-sach-tram-thu-phi-bot-tang-gia-ve-tu-29-12-2229007.html',
  date: '2023-12-20',
  verified: false,
  note: 'Danh sách giá dự kiến áp dụng từ 29/12/2023',
}

type P = [number, number, number, number, number]
const prices = (p: P): Record<VehicleClass, number> => ({ 1: p[0], 2: p[1], 3: p[2], 4: p[3], 5: p[4] })

export interface OpenStation {
  name: string
  /** lowercase substrings matched against the OSM booth name */
  keywords: string[]
  road: string
  /** null = station known but no complete / current price table found */
  prices: Record<VehicleClass, number> | null
  source: TollSource
  /** ISO date – station not charging until then */
  suspendedUntil?: string
}

const STD = prices([41000, 59000, 87000, 140000, 200000])

/** Trạm thu phí hở (vé lượt). */
export const OPEN_STATIONS: OpenStation[] = [
  {
    name: 'Trạm Km93+160 QL1 (BOT Bắc Giang – Lạng Sơn)', keywords: ['km93', 'km 93'], road: 'QL1',
    prices: prices([60000, 81000, 100000, 161000, 230000]),
    source: { url: 'https://baolangson.vn/tu-ngay-25-4-2025-dieu-chinh-gia-ve-su-dung-duong-bo-tai-km-93-160-quoc-lo-1a-5042494.html', date: '2025-03-31', verified: true, note: 'Hiệu lực 25/4/2025' },
  },
  { name: 'BOT QL1 Hà Nội – Bắc Giang', keywords: ['phù đổng', 'hà nội - bắc giang', 'hà nội – bắc giang'], road: 'QL1', prices: prices([40000, 57000, 86000, 140000, 200000]), source: VNN_2023 },
  { name: 'Trạm Nam Cầu Giẽ (tránh Phủ Lý)', keywords: ['nam cầu giẽ'], road: 'QL1', prices: prices([28000, 46000, 69000, 86000, 138000]), source: VNN_2023 },
  { name: 'Trạm số 1 / số 2 QL5', keywords: ['quốc lộ 5', 'ql5', 'trạm số 1', 'trạm số 2'], road: 'QL5', prices: prices([45000, 65000, 87000, 140000, 200000]), source: VNN_2023 },
  { name: 'Trạm Km41 Quán Toan (QL10)', keywords: ['quán toan', 'km41'], road: 'QL10', prices: prices([38000, 54000, 81000, 130000, 196000]), source: VNN_2023 },
  { name: 'Trạm Đại Yên (QL18)', keywords: ['đại yên'], road: 'QL18', prices: prices([35000, 47000, 59000, 94000, 188000]), source: VNN_2023 },
  { name: 'Trạm Phả Lại (QL18)', keywords: ['phả lại'], road: 'QL18', prices: STD, source: VNN_2023 },
  { name: 'Trạm Yên Lệnh (QL38)', keywords: ['yên lệnh'], road: 'QL38', prices: prices([35000, 47000, 76000, 123000, 188000]), source: VNN_2023 },
  { name: 'Trạm cầu Việt Trì (QL2)', keywords: ['việt trì', 'hạc trì'], road: 'QL2', prices: prices([38000, 54000, 81000, 130000, 196000]), source: VNN_2023 },
  { name: 'Trạm cầu Văn Lang (QL32C)', keywords: ['văn lang'], road: 'QL32C', prices: prices([41000, 53000, 64000, 106000, 200000]), source: VNN_2023 },
  { name: 'Trạm Km67+300 QL32 (Tam Nông)', keywords: ['tam nông', 'km67'], road: 'QL32', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km72+930 Thái Nguyên – Chợ Mới (QL3)', keywords: ['chợ mới', 'km72'], road: 'QL3', prices: STD, source: VNN_2023 },
  { name: 'Trạm Hàm Rồng Km1610+800 (QL1)', keywords: ['hàm rồng'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Hoàng Mai (QL1, Nghệ An)', keywords: ['hoàng mai'], road: 'QL1', prices: STD, source: VNN_2023 },
  {
    name: 'Trạm Bến Thủy / Bến Thủy 2 (QL1)', keywords: ['bến thủy'], road: 'QL1', prices: prices([47000, 64000, 87000, 140000, 200000]),
    source: { ...VNN_2023, note: 'Tạm dừng thu 30 ngày từ 0h 20/10/2026 – https://nhandan.vn/tam-dung-thu-phi-tai-hai-tram-bot-ben-thuy-trong-30-ngay-post996205.html' },
    suspendedUntil: '2026-11-19',
  },
  { name: 'Trạm TASCO Quảng Bình Km604 (QL1)', keywords: ['km604'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Quán Hàu (QL1)', keywords: ['quán hàu'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Đông Hà Km763+800 (QL1)', keywords: ['đông hà', 'km763'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km943+975 (QL1)', keywords: ['km943'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km1064+730 (QL1, Quảng Nam)', keywords: ['km1064'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Tam Kỳ (QL1)', keywords: ['tam kỳ'], road: 'QL1', prices: prices([35000, 53000, 76000, 129000, 200000]), source: VNN_2023 },
  { name: 'Trạm Km1148+1300 (QL1, Bắc Bình Định)', keywords: ['km1148'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km1212+550 (QL1, Nam Bình Định)', keywords: ['km1212'], road: 'QL1', prices: prices([35000, 53000, 82000, 135000, 200000]), source: VNN_2023 },
  { name: 'Trạm Bàn Thạch / An Dân (QL1)', keywords: ['bàn thạch', 'an dân'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm hầm Cù Mông (QL1)', keywords: ['cù mông'], road: 'QL1', prices: prices([70000, 83000, 141000, 165000, 259000]), source: VNN_2023 },
  { name: 'Trạm hầm Đèo Cả (QL1)', keywords: ['đèo cả'], road: 'QL1', prices: prices([110000, 160000, 200000, 210000, 280000]), source: VNN_2023 },
  { name: 'Trạm Ninh An (Ninh Lộc, QL1)', keywords: ['ninh an', 'ninh lộc'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Ninh Xuân (QL26)', keywords: ['ninh xuân'], road: 'QL26', prices: prices([29000, 35000, 47000, 70000, 141000]), source: VNN_2023 },
  { name: 'Trạm Sông Phan (QL1)', keywords: ['sông phan'], road: 'QL1', prices: STD, source: VNN_2023 },
  { name: 'Trạm Ea Đar (QL26)', keywords: ['ea đar'], road: 'QL26', prices: prices([29000, 35000, 47000, 70000, 141000]), source: VNN_2023 },
  { name: 'Trạm Pleiku – cầu 110 (QL14)', keywords: ['cầu 110'], road: 'QL14', prices: STD, source: VNN_2023 },
  { name: 'Trạm số 2 QL14 (Đồng Xoài)', keywords: ['đồng xoài'], road: 'QL14', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km49+550 QL19 (Bình Định)', keywords: ['km49'], road: 'QL19', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km124+720 QL19 (Gia Lai)', keywords: ['km124'], road: 'QL19', prices: STD, source: VNN_2023 },
  { name: 'Trạm Liên Đầm (QL20)', keywords: ['liên đầm'], road: 'QL20', prices: STD, source: VNN_2023 },
  { name: 'Trạm cầu Mỹ Lợi (QL50)', keywords: ['mỹ lợi'], road: 'QL50', prices: STD, source: VNN_2023 },
  { name: 'Trạm cầu Cổ Chiên (QL60)', keywords: ['cổ chiên'], road: 'QL60', prices: STD, source: VNN_2023 },
  { name: 'Trạm Km2079+535 Cần Thơ – Phụng Hiệp (QL1)', keywords: ['phụng hiệp', 'km2079'], road: 'QL1', prices: prices([35000, 53000, 82000, 140000, 200000]), source: VNN_2023 },
  { name: 'Trạm tuyến tránh Sóc Trăng (QL1)', keywords: ['sóc trăng', 'trà canh'], road: 'QL1', prices: prices([29000, 41000, 47000, 82000, 165000]), source: VNN_2023 },
  { name: 'Trạm Km2171+200 Bạc Liêu (QL1)', keywords: ['km2171'], road: 'QL1', prices: prices([29000, 41000, 47000, 82000, 165000]), source: VNN_2023 },
  { name: 'Trạm Km16+905 QL91', keywords: ['ql91', 'quốc lộ 91'], road: 'QL91', prices: STD, source: VNN_2023 },
  {
    name: 'Trạm thu phí Xa lộ Hà Nội', keywords: ['xa lộ hà nội'], road: 'Xa lộ Hà Nội (TP Thủ Đức)', prices: prices([28000, 42000, 55000, 110000, 155000]),
    source: { url: 'https://vietnamfinance.vn/bot-xa-lo-ha-noi-se-thu-phi-tro-lai-tu-ngay-14-gia-ve-cao-nhat-155000-dong-d62698.html', date: '2021-03-19', verified: false, note: 'Biểu giá từ 1/4/2021; chưa thấy điều chỉnh sau đó. Giảm 50% cho xe cư dân lân cận' },
  },
  {
    name: 'Trạm BOT Cai Lậy (QL1 / tuyến tránh)', keywords: ['cai lậy'], road: 'QL1', prices: prices([14000, 24000, 29000, 49000, 118000]),
    source: { url: 'https://tuoitre.vn/saigontimes/sau-nhieu-nam-ngung-bot-cai-lay-se-thu-phi-voi-muc-tu-14-000-den-118-000-dong-xe/', date: '2022-08-04', verified: false },
  },
  {
    name: 'Trạm BOT An Sương – An Lạc', keywords: ['an sương', 'an lạc'], road: 'QL1 (Bình Tân)', prices: prices([15000, 20000, 40000, 50000, 80000]),
    source: { url: 'https://caselaw.vn/van-ban-phap-luat/327549-quyet-dinh-so-33-2019-qd-ubnd-ngay-19-12-2019-ve-muc-gia-toi-da-dich-vu-su-dung-duong-bo-tai-tram-thu-bot-an-suong-an-lac-do-thanh-pho-ho-chi-minh-ban-hanh', date: '2019-12-19', verified: false, note: 'Mức giá tối đa theo QĐ 33/2019/QĐ-UBND, hiệu lực 1/1/2020' },
  },
  {
    name: 'Trạm BOT tránh Biên Hòa (Trảng Bom)', keywords: ['trảng bom', 'tránh biên hòa'], road: 'QL1', prices: null,
    source: { url: 'https://nhadautu.vn/hom-nay-tram-bot-bien-hoa-se-bat-dau-thu-phi-tro-lai-sau-20-ngay-xa-tram-d3953.html', date: '2017-10', verified: false, note: 'Chỉ tìm được khoảng giá 25.000–140.000 đ; trạng thái 2026 chưa xác nhận' },
  },
  {
    name: 'Trạm thu phí Bắc Thăng Long – Nội Bài', keywords: ['bắc thăng long'], road: 'Võ Văn Kiệt (Hà Nội)', prices: null,
    source: { url: 'https://vov.vn/xa-hoi/lai-de-xuat-tang-phi-gap-3-lan-o-tram-thu-phi-bot-bac-thang-long-noi-bai-691243.vov', date: '2019', verified: false, note: 'Chỉ có giá nhóm 1 (10.000–15.000 đ); trạng thái 2026 chưa xác nhận' },
  },
  {
    name: 'Trạm thu phí cầu Phú Mỹ', keywords: ['phú mỹ'], road: 'Võ Chí Công (TP Thủ Đức)', prices: null,
    source: { url: 'https://www.sggp.org.vn/tphcm-cac-tram-thu-phi-hoan-chinh-thu-tu-dong-post638105.html', date: '?', verified: false, note: 'Dự kiến kết thúc thu phí 4/2026 – chưa xác nhận đã dừng hay chưa' },
  },
]

/**
 * Trạm đã dừng thu – không tính phí dù OSM còn vẽ trạm.
 *  - QL51: tạm dừng từ 13/1/2023, đang tháo dỡ (tuoitre 11/01/2026)
 *  - Cầu Rạch Miễu: dừng thu từ 9/2026 (vietstock 05/2026)
 *  - Cầu Đồng Nai: dừng thu từ 24/8/2020, đã chuyển sở hữu Nhà nước, đang tháo dỡ (lsvn.vn)
 */
export const STOPPED_KEYWORDS = ['ql51', 'quốc lộ 51', 'rạch miễu', 'cầu đồng nai']

const VEC_2024: TollSource = {
  url: 'https://tuoitre.vn/4-tuyen-cao-toc-nao-se-tang-phi-gia-bao-nhieu-20240103093422385.htm',
  date: '2024-01-03', verified: true, note: 'VEC tăng giá từ 1/2/2024; hệ số nhóm xe 1/1,5/2/2,5/4 suy ra từ bảng giá VEC',
}

/** VEC charges per PCU-km; class multipliers ≈ 1 / 1.5 / 2 / 2.5 / 4. */
const pcu = (base: number): Record<VehicleClass, number> => ({ 1: base, 2: base * 1.5, 3: base * 2, 4: base * 2.5, 5: base * 4 })

/** Cao tốc thu phí kín – tính theo số km thực đi trên tuyến. */
export const CLOSED_EXPRESSWAYS: ClosedExpressway[] = [
  {
    name: 'Cao tốc TP.HCM – Long Thành – Dầu Giây', keywords: ['long thành', 'dầu giây'], perKm: pcu(2240),
    source: { url: 'https://thuviennhadat.vn/bat-dong-san/bang-gia-phi-cao-toc-tphcm-long-thanh-dau-giay-moi-nhat-16782.html', date: '2025-05-26', verified: true, note: 'Hiệu lực 5/5/2025; 2.240 đ/PCU-km' },
  },
  {
    name: 'Cao tốc Cầu Giẽ – Ninh Bình', keywords: ['cầu giẽ - ninh bình', 'cầu giẽ – ninh bình', 'cầu giẽ-ninh bình'], perKm: pcu(1680), source: VEC_2024,
  },
  {
    name: 'Cao tốc Pháp Vân – Cầu Giẽ', keywords: ['pháp vân'], perKm: pcu(1500),
    source: { url: 'https://vnexpress.net/cao-toc-phap-van-cau-gie-bat-dau-thu-phi-3291121.html', date: '2015', verified: false, note: 'Số liệu 2015 – cần cập nhật' },
  },
  {
    name: 'Cao tốc Nội Bài – Lào Cai', keywords: ['nội bài - lào cai', 'nội bài – lào cai', 'nội bài-lào cai'], perKm: pcu(1680),
    source: { ...VEC_2024, note: 'Đoạn Nội Bài–Yên Bái 1.680 đ/PCU-km; đoạn Yên Bái–Lào Cai 1.120 đ/PCU-km (ở đây dùng mức cao hơn)' },
  },
  {
    name: 'Cao tốc Đà Nẵng – Quảng Ngãi', keywords: ['đà nẵng - quảng ngãi', 'đà nẵng – quảng ngãi', 'đà nẵng-quảng ngãi'], perKm: pcu(1680),
    source: { url: 'https://tuoitre.vn/toan-canh-nhung-doan-cao-toc-di-qua-mien-trung-dang-thu-phi-100260715115606598.htm', date: '2026-07-15', verified: true, note: 'Cả tuyến Túy Loan–Quảng Ngãi: 216.160–868.000 đ' },
  },
  {
    name: 'Cao tốc Hà Nội – Hải Phòng', keywords: ['hà nội - hải phòng', 'hà nội – hải phòng', 'hà nội-hải phòng'],
    perKm: { 1: 2100, 2: 3000, 3: 4000, 4: 6400, 5: 8251 },
    source: { ...VNN_2023, note: 'Mục "trạm thu phí kín trên cao tốc QL5" – bài báo không ghi rõ tên tuyến' },
  },
  {
    name: 'Cao tốc Trung Lương – Mỹ Thuận', keywords: ['trung lương - mỹ thuận', 'trung lương – mỹ thuận', 'trung lương-mỹ thuận'],
    perKm: { 1: 2000, 2: 3000, 3: 3500, 4: 4500, 5: 6500 },
    source: { url: '', date: '2022-08-09', verified: false, note: 'Mức từ 0h 9/8/2022 (SGGP, Thư viện pháp luật – chưa có link gốc); phương án cho phép tăng 15% mỗi 3 năm' },
  },
  {
    name: 'Cao tốc Bắc Giang – Lạng Sơn', keywords: ['bắc giang - lạng sơn', 'bắc giang – lạng sơn', 'bắc giang-lạng sơn'],
    perKm: { 1: 2100, 2: 3000, 3: 3700, 4: null, 5: 8100 },
    source: { url: 'https://vietnamfinance.vn/thu-phi-cao-toc-bac-giang--lang-son-tu-182-muc-cao-nhat-200-ngan-dongluot-d46350.html', date: '2020-02', verified: false, note: 'Số liệu 2020; nguồn không có giá nhóm 4' },
  },
  {
    name: 'Cao tốc TP.HCM – Trung Lương (không thu phí)', keywords: ['hồ chí minh - trung lương', 'hồ chí minh – trung lương', 'sài gòn - trung lương', 'sài gòn – trung lương'],
    perKm: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    source: { url: 'https://thuviennhadat.vn/bat-dong-san/tuyen-duong-cao-toc-tp-hcm-trung-luong-thu-phi-lai-chua-23197.html', date: '2025-09-03', verified: true, note: 'Miễn phí từ 1/1/2019; chỉ thu lại khi mở rộng 8 làn theo PPP' },
  },
  {
    name: 'Cao tốc Phan Thiết – Dầu Giây (Nhà nước, mức 1)', keywords: ['phan thiết - dầu giây', 'phan thiết – dầu giây', 'phan thiết-dầu giây'],
    perKm: { 1: 1300, 2: 1950, 3: 2600, 4: 3250, 5: 5200 },
    source: { url: 'https://baolaocai.vn/tu-22h-ngay-23-bat-dau-thu-phi-5-tuyen-cao-toc-bac-nam-do-nha-nuoc-dau-tu-post894739.html', date: '2026-03-01', verified: true, note: 'NĐ 130/2024, thu từ 22h 2/3/2026' },
  },
  ...[
    ['Cao tốc Mai Sơn – QL45', ['mai sơn']],
    ['Cao tốc QL45 – Nghi Sơn', ['quốc lộ 45 - nghi sơn', 'ql45 - nghi sơn', 'ql45 – nghi sơn']],
    ['Cao tốc Nghi Sơn – Diễn Châu', ['nghi sơn - diễn châu', 'nghi sơn – diễn châu']],
    ['Cao tốc Vĩnh Hảo – Phan Thiết', ['vĩnh hảo']],
  ].map(([name, keywords]): ClosedExpressway => ({
    name: name as string, keywords: keywords as string[],
    perKm: { 1: 900, 2: 1350, 3: 1800, 4: 2250, 5: 3600 },
    source: { url: 'https://baolaocai.vn/tu-22h-ngay-23-bat-dau-thu-phi-5-tuyen-cao-toc-bac-nam-do-nha-nuoc-dau-tu-post894739.html', date: '2026-03-01', verified: true, note: 'NĐ 130/2024 mức 2, thu từ 22h 2/3/2026' },
  })),
  ...[
    ['Cao tốc Bãi Vọt – Cam Lộ', ['bãi vọt', 'hàm nghi', 'vũng áng', 'vạn ninh', 'cam lộ']],
    ['Cao tốc Quảng Ngãi – Nha Trang', ['hoài nhơn', 'quy nhơn', 'chí thạnh', 'vân phong']],
  ].map(([name, keywords]): ClosedExpressway => ({
    name: name as string, keywords: keywords as string[],
    perKm: { 1: 900, 2: 1350, 3: 1800, 4: 2250, 5: 3600 },
    source: { url: 'https://tuoitre.vn/toan-canh-nhung-doan-cao-toc-di-qua-mien-trung-dang-thu-phi-100260715115606598.htm', date: '2026-07-15', verified: true, note: 'NĐ 130/2024 mức 2; Bãi Vọt–Cam Lộ từ 15/7/2026, Quảng Ngãi–Nha Trang từ 15/8/2026' },
  })),
]

export function matchOpenStation(name: string | undefined, today = new Date()) {
  if (!name) return
  const n = normName(name)
  if (STOPPED_KEYWORDS.some((k) => n.includes(normName(k)))) return { stopped: true as const }
  const hit = OPEN_STATIONS.find((t) => t.keywords.some((k) => n.includes(normName(k))))
  if (hit?.suspendedUntil && today < new Date(hit.suspendedUntil)) return { stopped: true as const, station: hit }
  return hit && { stopped: false as const, station: hit }
}
