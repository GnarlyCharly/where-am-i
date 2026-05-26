import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import tripData from '@/data/trip.json'
import { buildPath } from '@/lib/geo'
import { PLAY_ZOOM_LEVEL } from '@/lib/config'
import { useRouteAnimation } from '@/hooks/useRouteAnimation'
import type { Trip } from '@/types'
import Map from '@/components/Map'
import SectionRoute from '@/components/SectionRoute'
import TravelIcon from '@/components/TravelIcon'
import StopLabel from '@/components/StopLabel'
import BottomSheet from '@/components/BottomSheet'
import MediaPopover from '@/components/MediaPopover'

const trip = tripData as unknown as Trip

// Pre-computed once at module level — trip data never changes at runtime
const path = buildPath(trip)

export default function App() {
  const mapRef = useRef<L.Map | null>(null)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  // Set to true during the flyTo zoom; cleared on moveend so auto-pan doesn't
  // interrupt the zoom animation by calling panTo on the very next RAF frame.
  const isZoomingRef = useRef(false)

  const onZoom = useCallback((fromIndex: number) => {
    const map = mapRef.current
    if (!map) return
    const section = trip.sections[fromIndex]
    const centre: L.LatLngExpression = section
      ? [section.lat, section.lng]
      : [trip.lat, trip.lng]
    isZoomingRef.current = true
    map.flyTo(centre, PLAY_ZOOM_LEVEL, { animate: true, duration: 0.5 })
    map.once('moveend', () => { isZoomingRef.current = false })
  }, [])

  const handleResetRef = useRef<() => void>(() => {})

  const {
    playState,
    traveledPoints,
    iconPos,
    iconBearing,
    iconMode,
    revealedSections,
    activeSection,
    mediaQueue,
    mediaIndex,
    play,
    pause,
    reset,
    skipMedia,
    endMedia,
  } = useRouteAnimation(path, trip, speedMultiplier, onZoom, () => handleResetRef.current())

  // Auto-pan the map to follow the icon during active playback
  useEffect(() => {
    if (iconPos && playState === 'playing' && !isZoomingRef.current) {
      mapRef.current?.panTo(iconPos, { animate: false })
    }
  }, [iconPos, playState])

  // Wrap reset to also zoom the map back out to the full trip extent
  const handleReset = useCallback(() => {
    reset()
    const map = mapRef.current
    if (!map) return
    const coords: L.LatLngExpression[] = [
      [trip.lat, trip.lng],
      ...trip.sections.map((s) => [s.lat, s.lng] as L.LatLngExpression),
    ]
    map.flyToBounds(L.latLngBounds(coords), { padding: [40, 40], duration: 0.5 })
  }, [reset])

  handleResetRef.current = handleReset

  // Which stop labels to show: all named in overview, only revealed ones during playback
  const visibleLabels = useMemo(
    () =>
      trip.sections
        .map((section, index) => ({ section, index }))
        .filter(({ section, index }) => {
          if (!section.name || !section.media?.length) return false
          return playState === 'overview' || revealedSections.has(index)
        }),
    [playState, revealedSections],
  )

  return (
    <div className="w-full h-screen">
      <Map trip={trip} mapRef={mapRef}>
        <SectionRoute
          trip={trip}
          path={path}
          traveledPoints={traveledPoints}
          playState={playState}
        />

        {iconPos && (
          <TravelIcon
            pos={iconPos}
            bearing={iconBearing}
            mode={iconMode}
            playState={playState}
          />
        )}

        {visibleLabels.map(({ section, index }) => (
          <StopLabel key={index} section={section} />
        ))}
      </Map>

      <BottomSheet
        trip={trip}
        playState={playState}
        activeSection={activeSection}
        revealedSections={revealedSections}
        play={play}
        pause={pause}
        speedMultiplier={speedMultiplier}
        setSpeedMultiplier={setSpeedMultiplier}
        zoomIn={() => mapRef.current?.zoomIn()}
        zoomOut={() => mapRef.current?.zoomOut()}
      />

      {mediaQueue && (
        <MediaPopover
          mediaQueue={mediaQueue}
          mediaIndex={mediaIndex}
          skipMedia={skipMedia}
          endMedia={endMedia}
        />
      )}
    </div>
  )
}
