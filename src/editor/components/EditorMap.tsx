import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { buildPath } from '@/lib/geo'
import { ROUTE_COLOR } from '@/lib/config'
import type { Trip } from '@/types'
import type { EditorDispatch } from '@/editor/state/useTripEditor'

const SELECTED_COLOR = '#2563eb'

interface Props {
  trip: Trip
  selectedIndex: number | null
  addingWaypoint: boolean
  dispatch: EditorDispatch
}

function circleIcon(color: string, size: number, ring = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)${ring ? `,0 0 0 4px ${color}40` : ''};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const sectionIcon = circleIcon(SELECTED_COLOR, 16, true)
const waypointIcon = circleIcon('#fff', 12)
const otherIcon = circleIcon(ROUTE_COLOR, 10)
const startIcon = circleIcon('#16a34a', 14)

// Fit map to all trip coords once, when the map mounts.
function FitBounds({ trip }: { trip: Trip }) {
  const map = useMap()
  useEffect(() => {
    const coords: L.LatLngExpression[] = [
      [trip.lat, trip.lng],
      ...trip.sections.flatMap((s) => [
        ...(s.waypoints ?? []).map((w) => [w.lat, w.lng] as L.LatLngExpression),
        [s.lat, s.lng] as L.LatLngExpression,
      ]),
    ]
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [48, 48] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

// Click-to-add-waypoint: while active, a map click appends a waypoint
// to the selected section.
function ClickToAddWaypoint({
  active,
  selectedIndex,
  dispatch,
}: {
  active: boolean
  selectedIndex: number | null
  dispatch: EditorDispatch
}) {
  useMapEvents({
    click(e) {
      if (!active || selectedIndex === null) return
      dispatch({ type: 'addWaypoint', index: selectedIndex, at: e.latlng })
    },
  })
  return null
}

export default function EditorMap({ trip, selectedIndex, addingWaypoint, dispatch }: Props) {
  // Pure + cheap, so recompute on every edit for a live preview.
  const path = useMemo(() => buildPath(trip), [trip])

  // Slice the selected section's leg out of the flattened path.
  const selectedLeg = useMemo(() => {
    if (selectedIndex === null) return null
    const end = path.sectionEndIndices[selectedIndex]
    const start = selectedIndex === 0 ? 0 : path.sectionEndIndices[selectedIndex - 1]
    if (end === undefined || start === undefined) return null
    return path.points.slice(start, end + 1)
  }, [path, selectedIndex])

  const selected = selectedIndex !== null ? trip.sections[selectedIndex] : null

  return (
    <MapContainer
      className="w-full h-full"
      center={[trip.lat, trip.lng]}
      zoom={5}
      zoomControl
      attributionControl={false}
      style={{ cursor: addingWaypoint ? 'crosshair' : '' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds trip={trip} />
      <ClickToAddWaypoint active={addingWaypoint} selectedIndex={selectedIndex} dispatch={dispatch} />

      {/* Full route, de-emphasised */}
      <Polyline positions={path.points} pathOptions={{ color: ROUTE_COLOR, weight: 2, opacity: 0.35 }} />

      {/* Selected section's leg, highlighted */}
      {selectedLeg && selectedLeg.length > 1 && (
        <Polyline positions={selectedLeg} pathOptions={{ color: SELECTED_COLOR, weight: 4, opacity: 0.9 }} />
      )}

      {/* Trip start (draggable) */}
      <Marker
        position={[trip.lat, trip.lng]}
        icon={startIcon}
        draggable
        eventHandlers={{
          dragend(e) {
            const { lat, lng } = (e.target as L.Marker).getLatLng()
            dispatch({ type: 'updateTrip', patch: { lat, lng } })
          },
        }}
      />

      {/* Other sections' destination points — click to select */}
      {trip.sections.map((s, i) =>
        i === selectedIndex ? null : (
          <Marker
            key={`sec-${i}`}
            position={[s.lat, s.lng]}
            icon={otherIcon}
            eventHandlers={{ click: () => dispatch({ type: 'select', index: i }) }}
          />
        ),
      )}

      {/* Selected section's waypoints (draggable) */}
      {selected?.waypoints?.map((w, wi) => (
        <Marker
          key={`wp-${selectedIndex}-${wi}`}
          position={[w.lat, w.lng]}
          icon={waypointIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const at = (e.target as L.Marker).getLatLng()
              dispatch({ type: 'moveWaypoint', index: selectedIndex!, wpIndex: wi, at })
            },
          }}
        />
      ))}

      {/* Selected section's destination point (draggable, on top) */}
      {selected && (
        <Marker
          position={[selected.lat, selected.lng]}
          icon={sectionIcon}
          draggable
          zIndexOffset={1000}
          eventHandlers={{
            dragend(e) {
              const at = (e.target as L.Marker).getLatLng()
              dispatch({ type: 'moveSectionPoint', index: selectedIndex!, at })
            },
          }}
        />
      )}
    </MapContainer>
  )
}
