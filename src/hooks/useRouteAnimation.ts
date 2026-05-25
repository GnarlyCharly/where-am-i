import { useCallback, useRef, useState } from 'react'
import L from 'leaflet'
import type { PathData } from '@/lib/geo'
import { bearing as calcBearing } from '@/lib/geo'
import type { PlayState, TransportMode, Trip } from '@/types'
import { DEFAULT_SPEED } from '@/lib/config'

export interface RouteAnimationReturn {
  playState: PlayState
  traveledPoints: L.LatLng[]
  iconPos: L.LatLng | null
  iconBearing: number
  iconMode: TransportMode
  revealedSections: Set<number>
  activeSection: number
  mediaQueue: string[] | null
  mediaIndex: number
  play: (fromIndex?: number) => void
  pause: () => void
  reset: () => void
  skipMedia: (direction: 'forward' | 'back') => void
  endMedia: () => void
}

// Largest index i where distances[i] <= dist
function findPtIdx(distances: number[], dist: number): number {
  let lo = 0
  let hi = distances.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (distances[mid] <= dist) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function useRouteAnimation(
  path: PathData,
  trip: Trip,
  onZoom?: (fromIndex: number) => void,
): RouteAnimationReturn {
  const [playState, setPlayState] = useState<PlayState>('overview')
  const [traveledPoints, setTraveledPoints] = useState<L.LatLng[]>([])
  const [iconPos, setIconPos] = useState<L.LatLng | null>(null)
  const [iconBearing, setIconBearing] = useState(0)
  const [iconMode, setIconMode] = useState<TransportMode>('campervan')
  const [revealedSections, setRevealedSections] = useState<Set<number>>(new Set())
  const [activeSection, setActiveSection] = useState(0)
  const [mediaQueue, setMediaQueue] = useState<string[] | null>(null)
  const [mediaIndex, setMediaIndex] = useState(0)

  // Mutable refs for the RAF loop — avoids stale closures, no re-render on change
  const rafRef = useRef<number>(0)
  const distanceRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const playStateRef = useRef<PlayState>('overview')
  const revealedRef = useRef<Set<number>>(new Set())
  const mediaIndexRef = useRef(0)
  const mediaQueueRef = useRef<string[] | null>(null)

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const tick = useCallback((timestamp: number) => {
    if (playStateRef.current !== 'playing') return

    const delta =
      lastTimeRef.current !== null ? (timestamp - lastTimeRef.current) / 1000 : 0
    lastTimeRef.current = timestamp

    const { points, distances, sectionIndices, sectionEndIndices } = path
    const maxDist = distances[distances.length - 1]

    // Use the speed for whatever section we're currently in
    const curPtIdx = findPtIdx(distances, distanceRef.current)
    const curSecIdx = sectionIndices[Math.min(curPtIdx, points.length - 1)]
    const speed =
      trip.sections[curSecIdx]?.speed ?? trip.animationSpeed ?? DEFAULT_SPEED

    distanceRef.current = Math.min(distanceRef.current + speed * delta, maxDist)
    const dist = distanceRef.current

    // Interpolate icon position between path points
    const ptIdx = findPtIdx(distances, dist)
    let pos: L.LatLng
    let bear: number

    if (ptIdx < points.length - 1) {
      const span = distances[ptIdx + 1] - distances[ptIdx]
      const t = span > 0 ? (dist - distances[ptIdx]) / span : 0
      pos = L.latLng(
        points[ptIdx].lat + t * (points[ptIdx + 1].lat - points[ptIdx].lat),
        points[ptIdx].lng + t * (points[ptIdx + 1].lng - points[ptIdx].lng),
      )
      bear = calcBearing(points[ptIdx], points[ptIdx + 1])
    } else {
      pos = points[points.length - 1]
      bear = ptIdx > 0 ? calcBearing(points[ptIdx - 1], points[ptIdx]) : 0
    }

    // Detect all section crossings that happened this frame
    let mediaToShow: string[] | null = null
    const newRevealed = new Set(revealedRef.current)
    for (let i = 0; i < sectionEndIndices.length; i++) {
      if (newRevealed.has(i)) continue
      if (dist >= distances[sectionEndIndices[i]]) {
        newRevealed.add(i)
        // Only queue media from the first newly-crossed section that has it
        if (!mediaToShow && trip.sections[i].media?.length) {
          mediaToShow = trip.sections[i].media!
        }
      }
    }

    // Active section = section we're traveling toward;
    // if we just crossed its end this frame, advance to the next one
    let activeSec = sectionIndices[Math.min(ptIdx, points.length - 1)]
    if (newRevealed.has(activeSec)) {
      activeSec = Math.min(activeSec + 1, trip.sections.length - 1)
    }

    const mode = (trip.sections[activeSec]?.transportMode ?? 'campervan') as TransportMode

    const revealedChanged = newRevealed.size !== revealedRef.current.size
    if (revealedChanged) revealedRef.current = newRevealed

    setTraveledPoints([...points.slice(0, ptIdx + 1), pos])
    setIconPos(pos)
    setIconBearing(bear)
    setIconMode(mode)
    setActiveSection(activeSec)
    if (revealedChanged) setRevealedSections(new Set(newRevealed))

    if (mediaToShow) {
      stopRaf()
      playStateRef.current = 'media'
      mediaQueueRef.current = mediaToShow
      mediaIndexRef.current = 0
      setPlayState('media')
      setMediaQueue(mediaToShow)
      setMediaIndex(0)
      return
    }

    if (dist >= maxDist) {
      stopRaf()
      playStateRef.current = 'paused'
      setPlayState('paused')
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [path, trip, stopRaf])

  const startRaf = useCallback(() => {
    stopRaf()
    lastTimeRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }, [tick, stopRaf])

  const play = useCallback(
    (fromIndex?: number) => {
      // Called without an index while paused → resume from current position
      if (fromIndex === undefined && playStateRef.current === 'paused') {
        playStateRef.current = 'playing'
        setPlayState('playing')
        startRaf()
        return
      }

      const idx = fromIndex ?? 0

      stopRaf()
      lastTimeRef.current = null

      // Start FROM sections[idx]: the animation begins at sections[idx]'s location
      // and travels toward sections[idx+1] and beyond.
      const startDist = path.distances[path.sectionEndIndices[idx]] ?? 0
      distanceRef.current = startDist

      // Mark sections 0..idx as already revealed (we've "arrived" at idx)
      const preRevealed = new Set<number>()
      for (let i = 0; i <= idx; i++) preRevealed.add(i)
      revealedRef.current = preRevealed
      mediaIndexRef.current = 0

      const nextIdx = Math.min(idx + 1, trip.sections.length - 1)
      const ptIdx = findPtIdx(path.distances, startDist)
      const initPos = path.points[ptIdx]
      const initMode = (trip.sections[nextIdx]?.transportMode ?? 'campervan') as TransportMode

      setRevealedSections(new Set(preRevealed))
      setActiveSection(nextIdx)
      setIconPos(initPos)
      setIconBearing(0)
      setIconMode(initMode)
      setTraveledPoints(path.points.slice(0, ptIdx + 1))

      onZoom?.(idx)

      // If this section has media, show it first — animation resumes from startDist after
      const media = trip.sections[idx].media
      if (media?.length) {
        mediaQueueRef.current = media
        mediaIndexRef.current = 0
        playStateRef.current = 'media'
        setMediaQueue(media)
        setMediaIndex(0)
        setPlayState('media')
      } else {
        mediaQueueRef.current = null
        setMediaQueue(null)
        setMediaIndex(0)
        playStateRef.current = 'playing'
        setPlayState('playing')
        startRaf()
      }
    },
    [path, trip, onZoom, stopRaf, startRaf],
  )

  const pause = useCallback(() => {
    stopRaf()
    playStateRef.current = 'paused'
    setPlayState('paused')
  }, [stopRaf])

  const reset = useCallback(() => {
    stopRaf()
    distanceRef.current = 0
    lastTimeRef.current = null
    revealedRef.current = new Set()
    mediaIndexRef.current = 0
    mediaQueueRef.current = null
    playStateRef.current = 'overview'
    setPlayState('overview')
    setTraveledPoints([])
    setIconPos(null)
    setIconBearing(0)
    setIconMode('campervan')
    setRevealedSections(new Set())
    setActiveSection(0)
    setMediaQueue(null)
    setMediaIndex(0)
  }, [stopRaf])

  const skipMedia = useCallback(
    (direction: 'forward' | 'back') => {
      if (!mediaQueueRef.current) return
      const next =
        direction === 'forward' ? mediaIndexRef.current + 1 : mediaIndexRef.current - 1
      if (next < 0) return
      if (next >= mediaQueueRef.current.length) {
        // Past the last item — same effect as endMedia
        mediaIndexRef.current = 0
        mediaQueueRef.current = null
        playStateRef.current = 'playing'
        setMediaQueue(null)
        setMediaIndex(0)
        setPlayState('playing')
        startRaf()
      } else {
        mediaIndexRef.current = next
        setMediaIndex(next)
      }
    },
    [startRaf],
  )

  const endMedia = useCallback(() => {
    mediaIndexRef.current = 0
    mediaQueueRef.current = null
    playStateRef.current = 'playing'
    setMediaQueue(null)
    setMediaIndex(0)
    setPlayState('playing')
    startRaf()
  }, [startRaf])

  return {
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
  }
}
