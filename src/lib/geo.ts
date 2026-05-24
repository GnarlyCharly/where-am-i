import L from 'leaflet'
import type { Trip } from '@/types'

export interface PathData {
  points: L.LatLng[]
  distances: number[]          // cumulative km from start, parallel to points[]
  sectionIndices: number[]     // which section each point belongs to, parallel to points[]
  sectionEndIndices: number[]  // index in points[] where section[i]'s destination is
}

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

export function haversineKm(a: L.LatLngLiteral, b: L.LatLngLiteral): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * DEG
  const dLng = (b.lng - a.lng) * DEG
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function bearing(a: L.LatLngLiteral, b: L.LatLngLiteral): number {
  const lat1 = a.lat * DEG
  const lat2 = b.lat * DEG
  const dLng = (b.lng - a.lng) * DEG
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * RAD + 360) % 360
}

// Returns n+1 points from a to b along the great-circle arc (indices 0..n).
export function interpolateGreatCircle(
  a: L.LatLngLiteral,
  b: L.LatLngLiteral,
  n: number,
): L.LatLng[] {
  const φ1 = a.lat * DEG
  const λ1 = a.lng * DEG
  const φ2 = b.lat * DEG
  const λ2 = b.lng * DEG

  const sinDφ = Math.sin((φ2 - φ1) / 2)
  const sinDλ = Math.sin((λ2 - λ1) / 2)
  const d = 2 * Math.asin(
    Math.sqrt(sinDφ ** 2 + Math.cos(φ1) * Math.cos(φ2) * sinDλ ** 2),
  )

  if (d < 1e-10) return [L.latLng(a.lat, a.lng), L.latLng(b.lat, b.lng)]

  const result: L.LatLng[] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    result.push(L.latLng(
      Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD,
      Math.atan2(y, x) * RAD,
    ))
  }
  return result
}

// Pre-computes the full trip path once on load.
export function buildPath(trip: Trip): PathData {
  const points: L.LatLng[] = []
  const distances: number[] = []
  const sectionIndices: number[] = []
  const sectionEndIndices: number[] = []

  let cumDist = 0

  // Trip starting point — part of section 0's incoming leg
  points.push(L.latLng(trip.lat, trip.lng))
  distances.push(0)
  sectionIndices.push(0)

  for (let i = 0; i < trip.sections.length; i++) {
    const section = trip.sections[i]
    const isPlane = section.transportMode === 'plane'

    // All stops in this leg: waypoints (if any) then the section destination
    const stops: Array<{ lat: number; lng: number }> = [
      ...(section.waypoints ?? []),
      { lat: section.lat, lng: section.lng },
    ]

    for (const stop of stops) {
      const last = points[points.length - 1]
      const from: L.LatLngLiteral = { lat: last.lat, lng: last.lng }

      if (isPlane) {
        const distKm = haversineKm(from, stop)
        const n = Math.max(30, Math.ceil(distKm / 50))
        const arc = interpolateGreatCircle(from, stop, n)
        // arc[0] === from, already in points[] — start from 1
        for (let k = 1; k < arc.length; k++) {
          cumDist += haversineKm(
            { lat: arc[k - 1].lat, lng: arc[k - 1].lng },
            { lat: arc[k].lat, lng: arc[k].lng },
          )
          points.push(arc[k])
          distances.push(cumDist)
          sectionIndices.push(i)
        }
      } else {
        cumDist += haversineKm(from, stop)
        points.push(L.latLng(stop.lat, stop.lng))
        distances.push(cumDist)
        sectionIndices.push(i)
      }
    }

    sectionEndIndices.push(points.length - 1)
  }

  return { points, distances, sectionIndices, sectionEndIndices }
}
