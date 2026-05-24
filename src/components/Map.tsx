import { useEffect, type ReactNode, type RefObject } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Trip } from '@/types'

interface Props {
  children?: ReactNode
  trip: Trip
  mapRef: RefObject<L.Map | null>
}

function MapSetup({ trip, mapRef }: { trip: Trip; mapRef: RefObject<L.Map | null> }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    const coords: L.LatLngExpression[] = [
      [trip.lat, trip.lng],
      ...trip.sections.map((s) => [s.lat, s.lng] as L.LatLngExpression),
    ]
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}

export default function Map({ children, trip, mapRef }: Props) {
  return (
    <div className="relative w-full h-full">
      <MapContainer
        className="w-full h-full"
        center={[trip.lat, trip.lng]}
        zoom={5}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapSetup trip={trip} mapRef={mapRef} />
        {children}
      </MapContainer>

      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 bg-white rounded shadow font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center text-lg leading-none cursor-pointer"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 bg-white rounded shadow font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center text-lg leading-none cursor-pointer"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  )
}
