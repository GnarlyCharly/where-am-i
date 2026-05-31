export type TransportMode = 'campervan' | 'car' | 'plane' | 'ferry'

export interface Waypoint {
  lat: number
  lng: number
  // Mode for the leg arriving at this waypoint; defaults to the section's transportMode.
  transportMode?: TransportMode
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
