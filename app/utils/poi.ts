/** Vietnamese labels for OpenMapTiles POI classes / subclasses (base-map features). */
const SUBCLASS: Record<string, string> = {
  restaurant: 'Nhà hàng', cafe: 'Quán cà phê', fast_food: 'Đồ ăn nhanh', bar: 'Quán bar', pub: 'Quán rượu', ice_cream: 'Kem',
  hotel: 'Khách sạn', motel: 'Nhà nghỉ', hostel: 'Nhà trọ', guest_house: 'Nhà khách',
  hospital: 'Bệnh viện', clinic: 'Phòng khám', doctors: 'Phòng khám', dentist: 'Nha khoa', pharmacy: 'Nhà thuốc',
  school: 'Trường học', kindergarten: 'Trường mầm non', university: 'Trường đại học', college: 'Trường cao đẳng',
  bank: 'Ngân hàng', atm: 'ATM', fuel: 'Cây xăng', charging_station: 'Trạm sạc xe điện', parking: 'Bãi đỗ xe',
  car_wash: 'Rửa xe', car_repair: 'Sửa xe', car: 'Đại lý ô tô', motorcycle: 'Cửa hàng xe máy',
  supermarket: 'Siêu thị', convenience: 'Cửa hàng tiện lợi', mall: 'Trung tâm thương mại', marketplace: 'Chợ',
  department_store: 'Cửa hàng bách hoá', clothes: 'Thời trang', electronics: 'Điện máy', mobile_phone: 'Điện thoại',
  bakery: 'Tiệm bánh', hairdresser: 'Tiệm tóc', beauty: 'Thẩm mỹ', jewelry: 'Trang sức', books: 'Nhà sách',
  police: 'Công an', fire_station: 'Cứu hoả', post_office: 'Bưu điện', townhall: 'Trụ sở UBND', courthouse: 'Toà án',
  place_of_worship: 'Nơi thờ tự', museum: 'Bảo tàng', theatre: 'Nhà hát', cinema: 'Rạp chiếu phim', library: 'Thư viện',
  attraction: 'Điểm tham quan', viewpoint: 'Điểm ngắm cảnh', monument: 'Tượng đài', memorial: 'Đài tưởng niệm',
  park: 'Công viên', playground: 'Sân chơi', stadium: 'Sân vận động', sports_centre: 'Trung tâm thể thao', swimming_pool: 'Bể bơi',
  bus_stop: 'Điểm dừng xe buýt', bus_station: 'Bến xe', station: 'Nhà ga', subway_entrance: 'Lối vào metro', ferry_terminal: 'Bến phà',
}
const CLASS: Record<string, string> = {
  shop: 'Cửa hàng', grocery: 'Tạp hoá', clothing_store: 'Thời trang', lodging: 'Lưu trú', college: 'Trường học',
  religion: 'Nơi thờ tự', town_hall: 'Cơ quan hành chính', bus: 'Xe buýt', railway: 'Đường sắt', aerialway: 'Cáp treo',
  attraction: 'Điểm tham quan', entertainment: 'Giải trí', sports: 'Thể thao', office: 'Văn phòng', golf: 'Sân golf',
}

export function poiCategory(cls: string, subclass: string, sourceLayer?: string): string | undefined {
  if (sourceLayer === 'aerodrome_label') return 'Sân bay'
  if (sourceLayer === 'mountain_peak') return 'Đỉnh núi'
  return SUBCLASS[subclass] ?? SUBCLASS[cls] ?? CLASS[cls] ?? (subclass ? subclass.replace(/_/g, ' ') : undefined)
}
