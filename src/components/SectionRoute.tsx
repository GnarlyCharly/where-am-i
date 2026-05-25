import { useEffect, useRef } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PathData } from '@/lib/geo'
import type { PlayState, TransportMode, Trip } from '@/types'
import { ROUTE_COLOR } from '@/lib/config'

interface Props {
  trip: Trip
  path: PathData
  traveledPoints: L.LatLng[]
  playState: PlayState
}

function lineOptions(mode?: TransportMode): L.PathOptions {
  const base = { color: ROUTE_COLOR, weight: 3, opacity: 0.7 }
  if (mode === 'plane') return { ...base, dashArray: '8 6' }
  if (mode === 'ferry') return { ...base, dashArray: '2 6' }
  return base
}

export default function SectionRoute({ trip, path, traveledPoints, playState }: Props) {
  const map = useMap()
  const animLineRef = useRef<L.Polyline | null>(null)
  const isOverview = playState === 'overview'

  // Imperative polyline for the animated route — bypasses React reconciliation each frame
  useEffect(() => {
    const line = L.polyline([], { color: ROUTE_COLOR, weight: 3, opacity: 0.7 })
    line.addTo(map)
    animLineRef.current = line
    return () => {
      line.remove()
    }
  }, [map])

  useEffect(() => {
    animLineRef.current?.setLatLngs(traveledPoints)
  }, [traveledPoints])

  // During playback the animated line above handles rendering; hide the overview polylines
  if (!isOverview) return null

  return (
    <>
      {trip.sections.map((section, i) => {
        const startIdx = i === 0 ? 0 : path.sectionEndIndices[i - 1]
        const endIdx = path.sectionEndIndices[i]
        const points = path.points.slice(startIdx, endIdx + 1)
        return (
          <Polyline key={i} positions={points} pathOptions={lineOptions(section.transportMode)} />
        )
      })}
    </>
  )
}
