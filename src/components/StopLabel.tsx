import { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { Section } from '@/types'
import { ROUTE_COLOR } from '@/lib/config'

interface Props {
  section: Section
}

export default function StopLabel({ section }: Props) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<div class="stop-label"><div class="stop-dot" style="background-color:${ROUTE_COLOR}"></div><span class="stop-name">${section.name}</span></div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [5, 10],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  if (!section.name) return null

  return <Marker position={[section.lat, section.lng]} icon={icon} />
}
