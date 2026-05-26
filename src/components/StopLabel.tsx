import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const [mediaIdx, setMediaIdx] = useState(0)
  const mediaCount = section.media?.length ?? 0

  useEffect(() => {
    if (!open) setMediaIdx(0)
  }, [open])

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
    <div ref={wrapperRef} style={{ position: 'absolute', marginLeft: -5, marginTop: -10 }}>
      {section.media?.length ? (
        <HoverCard open={open} onOpenChange={setOpen}>
          <HoverCardTrigger
            render={
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen((v) => !v)
                }}
              />
            }
            delay={150}
            closeDelay={100}
            className="stop-label"
          >
            {dot}{name}
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            collisionPadding={{ top: 16, bottom: 16, left: 8, right: typeof window !== 'undefined' && window.innerWidth >= 768 ? 320 : 8 }}
            className="p-0 overflow-hidden w-[calc(100vw-16px)] max-h-[calc(100vh-32px)] md:w-[min(calc(100vw-336px),800px)] md:max-h-[800px]"
          >
            <div className="relative">
              <img
                src={section.media[mediaIdx]}
                alt={section.name ?? ''}
                className="block w-full max-h-[calc(100vh-32px)] md:max-h-[800px] object-contain"
              />
              {mediaCount > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIdx((i) => (i - 1 + mediaCount) % mediaCount)
                    }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIdx((i) => (i + 1) % mediaCount)
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/50 text-white text-[10px] px-2 py-0.5">
                    {mediaIdx + 1} / {mediaCount}
                  </div>
                </>
              )}
            </div>
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
