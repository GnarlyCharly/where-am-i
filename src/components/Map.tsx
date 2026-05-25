import { useEffect, type ReactNode, type RefObject } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Trip } from '@/types'
import { Button } from '@/components/ui/button'

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
        <Button
          variant="outline"
          size="icon"
          onClick={() => mapRef.current?.zoomIn()}
          className="bg-white shadow"
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => mapRef.current?.zoomOut()}
          className="bg-white shadow text-gray-700 hover:bg-gray-50"
          aria-label="Zoom out"
        >
          −
        </Button>
      </div>
    </div>
  )
}
