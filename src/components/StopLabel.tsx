import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTE_COLOR } from '@/lib/config'
import { resolveMediaUrl } from '@/lib/cloudinary'
import type { Section } from '@/types'

const POPOVER_IMG_WIDTH = 1200

interface Props {
  section: Section
}

function LabelOverlay({ section }: Props) {
  const map = useMap()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const latlng = L.latLng(section.lat, section.lng)
  const [open, setOpen] = useState(false)
  const [mediaIdx, setMediaIdx] = useState(0)
  const [loadedSrcs, setLoadedSrcs] = useState<Set<string>>(new Set())
  const [dimensions, setDimensions] = useState<Map<string, { w: number; h: number }>>(new Map())
  const mediaCount = section.media?.length ?? 0
  const currentSrc = section.media?.[mediaIdx]
    ? resolveMediaUrl(section.media[mediaIdx], { width: POPOVER_IMG_WIDTH })
    : undefined
  const isLoaded = currentSrc ? loadedSrcs.has(currentSrc) : true
  const dims = currentSrc ? dimensions.get(currentSrc) : undefined
  const aspectRatio = dims ? `${dims.w} / ${dims.h}` : undefined

  useEffect(() => {
    if (!open) setMediaIdx(0)
  }, [open])

  // Preload current image off-screen so we know its natural dimensions
  // before showing it — lets the skeleton match the eventual image size.
  useEffect(() => {
    if (!currentSrc || dimensions.has(currentSrc)) return
    const img = new Image()
    img.onload = () => {
      setDimensions((prev) => {
        if (prev.has(currentSrc)) return prev
        const next = new Map(prev)
        next.set(currentSrc, { w: img.naturalWidth, h: img.naturalHeight })
        return next
      })
    }
    img.src = currentSrc
  }, [currentSrc, dimensions])

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
            className="p-0 overflow-hidden w-[calc(100vw-16px)] max-h-125 md:w-[min(calc(100vw-336px),800px)]"
          >
            <div className="relative">
              {!isLoaded && (
                <Skeleton
                  className="w-full max-h-125 rounded-none"
                  style={{ aspectRatio: aspectRatio ?? '4 / 3' }}
                />
              )}
              <img
                src={currentSrc}
                alt={section.name ?? ''}
                loading="lazy"
                decoding="async"
                onLoad={() => {
                  if (currentSrc) {
                    setLoadedSrcs((prev) => {
                      if (prev.has(currentSrc)) return prev
                      const next = new Set(prev)
                      next.add(currentSrc)
                      return next
                    })
                  }
                }}
                className={`block w-full max-h-125 object-contain ${isLoaded ? '' : 'hidden'}`}
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
