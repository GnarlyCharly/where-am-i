export type TransportMode = 'campervan' | 'plane' | 'ferry'

export interface Waypoint {
  lat: number
  lng: number
}

export interface Section {
  name?: string
  lat: number
  lng: number
  waypoints?: Waypoint[]
  date: string
  transportMode?: TransportMode
  notes?: string
  media?: string[]
}

export interface Trip {
  name: string
  lat: number
  lng: number
  sections: Section[]
}

export type PlayState = 'overview' | 'playing' | 'paused' | 'media'
