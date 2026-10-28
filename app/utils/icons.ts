/**
 * Every UI icon of the app in one place: Material Symbols Rounded (the set Google Maps uses),
 * from Iconify via @iconify/tailwind4. Each value is a Tailwind class that draws the icon as a
 * 1em × 1em mask in `currentColor`, so it follows the surrounding font size and colour and works
 * offline (the SVG is inlined into the CSS at build time).
 *
 * Use with <AppIcon name="…" />, or pass a value to PrimeVue `icon` props (`:icon="ICON.play"`).
 * Browse / swap icons: https://icon-sets.iconify.design/material-symbols/
 */
export const ICON = {
  // navigation & chrome
  menu: 'icon-[material-symbols--menu-rounded]',
  search: 'icon-[material-symbols--search-rounded]',
  close: 'icon-[material-symbols--close-rounded]',
  back: 'icon-[material-symbols--chevron-left-rounded]',
  forward: 'icon-[material-symbols--chevron-right-rounded]',
  swap: 'icon-[material-symbols--swap-vert-rounded]',
  external: 'icon-[material-symbols--open-in-new-rounded]',
  goTo: 'icon-[material-symbols--north-east-rounded]',
  check: 'icon-[material-symbols--check-rounded]',
  add: 'icon-[material-symbols--add-rounded]',
  delete: 'icon-[material-symbols--delete-outline-rounded]',
  spinner: 'icon-[material-symbols--progress-activity]',
  // place card
  directions: 'icon-[material-symbols--directions-rounded]',
  save: 'icon-[material-symbols--star-outline-rounded]',
  saved: 'icon-[material-symbols--star-rounded]',
  nearby: 'icon-[material-symbols--explore-outline-rounded]',
  share: 'icon-[material-symbols--share-outline]',
  place: 'icon-[material-symbols--location-on-outline-rounded]',
  hours: 'icon-[material-symbols--schedule-outline-rounded]',
  phone: 'icon-[material-symbols--call-outline-rounded]',
  website: 'icon-[material-symbols--language]',
  email: 'icon-[material-symbols--mail-outline-rounded]',
  wheelchair: 'icon-[material-symbols--accessible-rounded]',
  wifi: 'icon-[material-symbols--wifi-rounded]',
  info: 'icon-[material-symbols--info-outline-rounded]',
  coords: 'icon-[material-symbols--my-location-rounded]',
  map: 'icon-[material-symbols--map-outline-rounded]',
  road: 'icon-[material-symbols--road]',
  area: 'icon-[material-symbols--location-city-rounded]',
  school: 'icon-[material-symbols--school-outline-rounded]',
  // map buttons
  myLocation: 'icon-[material-symbols--my-location-rounded]',
  traffic: 'icon-[material-symbols--traffic-outline-rounded]',
  darkMode: 'icon-[material-symbols--dark-mode-outline-rounded]',
  lightMode: 'icon-[material-symbols--light-mode-outline-rounded]',
  report: 'icon-[material-symbols--warning-outline-rounded]',
  carMode: 'icon-[material-symbols--directions-car-outline-rounded]',
  // travel modes
  car: 'icon-[material-symbols--directions-car-outline-rounded]',
  motorbike: 'icon-[material-symbols--two-wheeler-rounded]',
  bike: 'icon-[material-symbols--directions-bike-rounded]',
  foot: 'icon-[material-symbols--directions-walk-rounded]',
  // nearby categories
  restaurant: 'icon-[material-symbols--restaurant-rounded]',
  cafe: 'icon-[material-symbols--local-cafe-outline-rounded]',
  hotel: 'icon-[material-symbols--hotel-outline-rounded]',
  attraction: 'icon-[material-symbols--photo-camera-outline-rounded]',
  transit: 'icon-[material-symbols--directions-bus-outline-rounded]',
  parking: 'icon-[material-symbols--local-parking-rounded]',
  fuel: 'icon-[material-symbols--local-gas-station-outline-rounded]',
  pharmacy: 'icon-[material-symbols--local-pharmacy-outline-rounded]',
  atm: 'icon-[material-symbols--atm-rounded]',
  hospital: 'icon-[material-symbols--local-hospital-outline-rounded]',
  // road features & alerts
  overspeed: 'icon-[material-symbols--speed-rounded]',
  speedCamera: 'icon-[material-symbols--speed-camera]',
  surveillance: 'icon-[material-symbols--videocam-outline-rounded]',
  signals: 'icon-[material-symbols--traffic-rounded]',
  noOvertaking: 'icon-[material-symbols--do-not-disturb-on-outline-rounded]',
  tunnel: 'icon-[material-symbols--subway-outline]',
  toll: 'icon-[material-symbols--toll-outline-rounded]',
  residential: 'icon-[material-symbols--home-work-outline-rounded]',
  arrive: 'icon-[material-symbols--sports-score-rounded]',
  offline: 'icon-[material-symbols--cloud-off-outline-rounded]',
  online: 'icon-[material-symbols--wifi-rounded]',
  // community reports
  reportCamera: 'icon-[material-symbols--photo-camera-outline-rounded]',
  police: 'icon-[material-symbols--local-police-outline-rounded]',
  accident: 'icon-[material-symbols--car-crash-outline-rounded]',
  jam: 'icon-[material-symbols--traffic-jam-outline-rounded]',
  hazard: 'icon-[material-symbols--warning-outline-rounded]',
  thanks: 'icon-[material-symbols--thumb-up-outline-rounded]',
  // route sheet & panels
  start: 'icon-[material-symbols--navigation-outline-rounded]',
  simulate: 'icon-[material-symbols--play-circle-outline-rounded]',
  download: 'icon-[material-symbols--download-rounded]',
  camera: 'icon-[material-symbols--photo-camera-outline-rounded]',
  payments: 'icon-[material-symbols--payments-outline-rounded]',
  violation: 'icon-[material-symbols--receipt-long-outline-rounded]',
  group: 'icon-[material-symbols--group-outline-rounded]',
  trafficCam: 'icon-[material-symbols--videocam-outline-rounded]',
  tire: 'icon-[material-symbols--tire-repair-outline-rounded]',
  settings: 'icon-[material-symbols--settings-outline-rounded]',
  volume: 'icon-[material-symbols--volume-up-outline-rounded]',
  bluetooth: 'icon-[material-symbols--bluetooth-rounded]',
  leave: 'icon-[material-symbols--logout-rounded]',
  // turn-by-turn
  straight: 'icon-[material-symbols--straight-rounded]',
  turnRight: 'icon-[material-symbols--turn-right-rounded]',
  turnLeft: 'icon-[material-symbols--turn-left-rounded]',
  slightRight: 'icon-[material-symbols--turn-slight-right-rounded]',
  slightLeft: 'icon-[material-symbols--turn-slight-left-rounded]',
  sharpRight: 'icon-[material-symbols--turn-sharp-right-rounded]',
  sharpLeft: 'icon-[material-symbols--turn-sharp-left-rounded]',
  uturn: 'icon-[material-symbols--u-turn-left-rounded]',
  roundabout: 'icon-[material-symbols--roundabout-right-rounded]',
} as const

export type IconName = keyof typeof ICON

/** Icon of each community report type (map marker, alert, report panel, place card). */
export const REPORT_ICON: Record<string, IconName> = {
  camera: 'reportCamera', police: 'police', accident: 'accident', jam: 'jam', hazard: 'hazard',
}

/** Icon of each road feature kind from OSM (map marker, alert, place card). */
export const POI_ICON: Record<string, IconName> = {
  speed_camera: 'speedCamera', red_light_camera: 'speedCamera', traffic_signals: 'signals',
  no_overtaking: 'noOvertaking', tunnel: 'tunnel', surveillance: 'surveillance', toll: 'toll',
}

/** Icon of a search result: by kind, and for places by OSM category (restaurant, hospital…). */
export function searchIcon(kind: string | undefined, category?: string): IconName {
  if (kind === 'street') return 'road'
  if (kind === 'area') return 'area'
  if (kind !== 'poi' || !category) return 'place'
  if (/restaurant|fast_food|food_court/.test(category)) return 'restaurant'
  if (/cafe|ice_cream/.test(category)) return 'cafe'
  if (/hotel|motel|guest_house|hostel|apartment/.test(category)) return 'hotel'
  if (/hospital|clinic|doctors|dentist/.test(category)) return 'hospital'
  if (/pharmacy|chemist/.test(category)) return 'pharmacy'
  if (/fuel|charging_station/.test(category)) return 'fuel'
  if (/parking/.test(category)) return 'parking'
  if (/bus_stop|bus_station|station|halt|subway|ferry/.test(category)) return 'transit'
  if (/bank|atm/.test(category)) return 'atm'
  if (/school|kindergarten|university|college/.test(category)) return 'school'
  if (/attraction|museum|viewpoint|monument|memorial|temple|place_of_worship|park/.test(category)) return 'attraction'
  return 'place'
}
