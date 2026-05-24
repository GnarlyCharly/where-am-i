import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import tripData from '@/data/trip.json'
import { buildPath } from '@/lib/geo'
import { PLAY_ZOOM_OFFSET } from '@/lib/config'
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

  // Zoom in when playback starts, passing the starting section index
  const onZoom = useCallback((_fromIndex: number) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo(map.getCenter(), map.getZoom() + PLAY_ZOOM_OFFSET, {
      animate: true,
      duration: 0.5,
    })
  }, [])

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
  } = useRouteAnimation(path, trip, onZoom)

  // Auto-pan the map to follow the icon during active playback
  useEffect(() => {
    if (iconPos && playState === 'playing') {
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

  // Which stop labels to show: all named in overview, only revealed ones during playback
  const visibleLabels = useMemo(
    () =>
      trip.sections
        .map((section, index) => ({ section, index }))
        .filter(({ section, index }) => {
          if (!section.name) return false
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
        reset={handleReset}
      />

      {mediaQueue && (
        <MediaPopover
          mediaQueue={mediaQueue}
          mediaIndex={mediaIndex}
          skipMedia={skipMedia}
        />
      )}
    </div>
  )
}
