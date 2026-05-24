import { useEffect, useMemo, useRef } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { PlayState, TransportMode } from '@/types'

interface Props {
  pos: L.LatLng
  bearing: number
  mode: TransportMode
  playState: PlayState
}

export default function TravelIcon({ pos, bearing, mode, playState }: Props) {
  const markerRef = useRef<L.Marker | null>(null)

  // Keep bearing current in a ref so the icon memo can use the latest value on mode-change
  const bearingRef = useRef(bearing)
  bearingRef.current = bearing

  // Only recreate the Leaflet icon when the transport mode changes, not on every bearing update
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<img src="/icons/${mode}.svg" style="width:40px;height:auto;display:block;transform:rotate(${bearingRef.current - 90}deg);" />`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    [mode],
  )

  // Apply bearing rotation directly on the DOM element each frame — no icon recreation
  useEffect(() => {
    const img = markerRef.current?.getElement()?.querySelector<HTMLImageElement>('img')
    if (img) img.style.transform = `rotate(${bearing - 90}deg)`
  })

  if (playState === 'overview') return null

  return <Marker ref={markerRef} position={pos} icon={icon} />
}
