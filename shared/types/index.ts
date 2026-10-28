export type LngLat = [number, number]

export interface RouteStep {
  instruction: string
  maneuver: string
  modifier?: string
  name: string
  ref?: string
  distance: number
  duration: number
  location: LngLat
  /** index in route geometry where this step starts */
  geomIndex: number
}

export type TravelMode = 'car' | 'motorbike' | 'bike' | 'foot'

export interface RouteResult {
  mode?: TravelMode
  geometry: LngLat[]
  distance: number
  duration: number
  steps: RouteStep[]
  /** typical speed (km/h) of each geometry segment, from the router */
  segmentSpeeds: number[]
}

export type PoiKind =
  | 'speed_camera'
  | 'red_light_camera'
  | 'traffic_signals'
  | 'toll_booth'
  | 'no_overtaking'
  | 'tunnel'
  | 'surveillance'
  | 'user_camera'

export interface Poi {
  id: string
  kind: PoiKind
  lat: number
  lon: number
  name?: string
  maxspeed?: number
  /** for line features (tunnel / no_overtaking): start+end of the stretch */
  line?: LngLat[]
}

export interface RoadInfo {
  name?: string
  ref?: string
  highway?: string
  maxspeed: number
  maxspeedSource: 'osm' | 'rule'
  /** maxspeed tag from OSM, if any (km/h) */
  osmMaxspeed?: number
  divided: boolean
  residential: boolean
  tunnel: boolean
  noOvertaking: boolean
}

/** Vietnamese toll vehicle classes (Thông tư 35/2016/TT-BGTVT). */
export type VehicleClass = 1 | 2 | 3 | 4 | 5

export interface TollSource {
  url: string
  /** publication date of the source */
  date: string
  /** false = old source or unclear scope – re-check before relying on it */
  verified: boolean
  note?: string
}

export interface TollStation {
  id: string
  name: string
  lat: number
  lon: number
  /** null = station found on OSM but no sourced price */
  prices: Record<VehicleClass, number> | null
  operator?: string
  source?: TollSource
}

/** Closed-system expressway: charged per km actually driven. */
export interface ClosedExpressway {
  name: string
  /** lowercase substrings matched against the route's road names */
  keywords: string[]
  /** đ/km per vehicle class; null = not found in sources */
  perKm: Record<VehicleClass, number | null>
  source: TollSource
}

export interface GroupMember {
  id: string
  name: string
  color: string
  lat: number
  lon: number
  speed: number
  heading: number
  updatedAt: number
}

/** Road attributes for a run of consecutive route segments [from, to). */
export interface RoadRun {
  from: number
  to: number
  name?: string
  ref?: string
  highway: string
  /** maxspeed from OSM tags, if any */
  maxspeed?: number
  divided: boolean
  tunnel: boolean
  noOvertaking: boolean
}

/** Details of a base-map place, from its OpenStreetMap tags. */
export interface PlaceDetails {
  osm: string
  name?: string
  address?: string
  /** raw OSM opening_hours value */
  openingHours?: string
  phone?: string
  website?: string
  email?: string
  facebook?: string
  cuisine?: string
  wheelchair?: string
  internet?: string
  brand?: string
  operator?: string
  description?: string
  /** Wikimedia Commons thumbnail URL */
  photo?: string
  wikipedia?: string
}

export type NearbyCategory = 'restaurant' | 'cafe' | 'hotel' | 'attraction' | 'transit' | 'parking' | 'fuel' | 'pharmacy' | 'atm' | 'hospital'

export interface NearbyPlace {
  id: string
  name: string
  lat: number
  lon: number
  category: NearbyCategory
  /** raw OSM tags used for the subtitle (amenity / cuisine / opening_hours…) */
  kind?: string
  openingHours?: string
}

/** One search suggestion (geocoder result), shaped like Google Maps' autocomplete rows. */
export interface SearchResult {
  /** main line: place name, or "house number + street" for an address */
  name: string
  /** second line: street · ward · district · city */
  address?: string
  lat: number
  lon: number
  /** what the result is – picks the icon */
  kind: 'address' | 'street' | 'area' | 'poi'
  /** OSM value (restaurant, bus_stop, residential…) for the Vietnamese type label */
  category?: string
  /** house number not in the map data: the point is on the street, not at the house */
  approx?: boolean
}
