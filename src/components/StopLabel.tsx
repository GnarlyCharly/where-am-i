import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { ROUTE_COLOR } from '@/lib/config'
import type { Section } from '@/types'

interface Props {
  section: Section
}

function LabelOverlay({ section }: Props) {
  const map = useMap()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const latlng = L.latLng(section.lat, section.lng)

  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current) return
      const pt = map.latLngToLayerPoint(latlng)
      L.DomUtil.setPosition(wrapperRef.current, pt)
    }
    update()
    map.on('viewreset zoomend', update)
    return () => { map.off('viewreset zoomend', update) }
  // latlng is a stable object value — deps are the underlying coords
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, section.lat, section.lng])

  const pane = map.getPanes().markerPane
  if (!pane) return null

  const dot = <div className="stop-dot" style={{ backgroundColor: ROUTE_COLOR }} />
  const name = <span className="stop-name">{section.name}</span>

  return createPortal(
    <div ref={wrapperRef} style={{ position: 'absolute' }}>
      {section.media?.length ? (
        <HoverCard>
          <HoverCardTrigger render={<div />} delay={150} closeDelay={100} className="stop-label">
            {dot}{name}
          </HoverCardTrigger>
          <HoverCardContent side="top" className="w-64 p-0 overflow-hidden">
            <img
              src={section.media[0]}
              alt={section.name ?? ''}
              className="w-full h-40 object-cover"
            />
            {section.media.length > 1 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                +{section.media.length - 1} more photo{section.media.length > 2 ? 's' : ''}
              </p>
            )}
          </HoverCardContent>
        </HoverCard>
      ) : (
        <div className="stop-label">{dot}{name}</div>
      )}
    </div>,
    pane,
  )
}

export default function StopLabel({ section }: Props) {
  if (!section.name) return null
  return <LabelOverlay section={section} />
}
