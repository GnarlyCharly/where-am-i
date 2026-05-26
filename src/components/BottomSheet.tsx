import { useEffect, useRef, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import type { PlayState, Section, Trip } from '@/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface Props {
  trip: Trip
  playState: PlayState
  activeSection: number
  revealedSections: Set<number>
  play: (fromIndex?: number) => void
  pause: () => void
  speedMultiplier: number
  setSpeedMultiplier: (m: number) => void
  autoSkipMedia: boolean
  setAutoSkipMedia: (v: boolean) => void
  zoomIn: () => void
  zoomOut: () => void
}

const ROW_H = 48 // px — matches h-12, drives collapsed height calculation
const SPEED_OPTIONS = [0.5, 1, 2, 3, 5, 10]

export default function BottomSheet({
  trip,
  playState,
  activeSection,
  revealedSections,
  play,
  pause,
  speedMultiplier,
  setSpeedMultiplier,
  autoSkipMedia,
  setAutoSkipMedia,
  zoomIn,
  zoomOut,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const mobileListRef = useRef<HTMLDivElement | null>(null)
  const desktopListRef = useRef<HTMLDivElement | null>(null)
  const mobileRowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const desktopRowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const dragStartY = useRef(0)

  const isPlaying = playState === 'playing' || playState === 'media'
  const hasStarted = playState !== 'overview'


  // Pause playback when the mobile sheet is expanded so the list can be browsed
  useEffect(() => {
    if (expanded && isPlaying) pause()
  }, [expanded, isPlaying, pause])

  // Keep active row visible — pinned to top when collapsed on mobile, centred otherwise
  useEffect(() => {
    function scrollToActive(
      list: HTMLDivElement | null,
      refs: Map<number, HTMLDivElement>,
      pinTop: boolean,
    ) {
      if (!list) return
      const row = refs.get(activeSection)
      if (!row) return
      list.scrollTop = pinTop
        ? row.offsetTop
        : row.offsetTop - list.clientHeight / 2 + ROW_H / 2
    }
    scrollToActive(mobileListRef.current, mobileRowRefs.current, !expanded)
    scrollToActive(desktopListRef.current, desktopRowRefs.current, false)
  }, [activeSection, expanded])

  function rowState(i: number): 'done' | 'active' | 'upcoming' {
    if (hasStarted && revealedSections.has(i)) return 'done'
    if (hasStarted && i === activeSection) return 'active'
    return 'upcoming'
  }

  function handlePlayPause() {
    if (isPlaying) pause()
    else play() // resumes if paused, starts from 0 if overview
  }

  function renderRow(
    section: Section,
    i: number,
    refs: Map<number, HTMLDivElement>,
    showInlineControls: boolean,
  ) {
    const state = rowState(i)
    const indicator = state === 'done' ? '✓' : state === 'active' ? '▶' : '·'
    const isActive = state === 'active'

    return (
      <div
        key={i}
        ref={(el) => { if (el) refs.set(i, el) }}
        style={{ height: ROW_H }}
        className={[
          'flex items-center gap-2 px-4 cursor-pointer select-none',
          isActive ? 'bg-orange-50 text-[#e85d04]' : 'text-gray-700 hover:bg-gray-50',
        ].join(' ')}
        onClick={() => {
          if (showInlineControls) setExpanded(false)
          play(i)
        }}
      >
        <span className={`w-4 shrink-0 text-xs ${isActive ? 'font-bold' : 'opacity-40'}`}>
          {indicator}
        </span>
        <span className="flex-1 flex items-baseline gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{section.date}</span>
          {section.name && (
            <span className="text-sm truncate text-gray-400">{section.name}</span>
          )}
        </span>
        {section.media?.length && (
          <ImageIcon className="shrink-0 size-3.5 opacity-40 mr-1" />
        )}
        {(isActive || (!hasStarted && i === 0)) && showInlineControls && (
          <div className="flex gap-1 shrink-0 ml-1">
            <Button
              variant="outline"
              size="default"
              className="px-2 text-[#e85d04] border-orange-300 hover:bg-orange-50 hover:text-[#e85d04]"
              onClick={(e) => { e.stopPropagation(); setExpanded(false); handlePlayPause() }}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const dy = e.clientY - dragStartY.current
    if (Math.abs(dy) < 10) setExpanded((v) => !v)
    else if (dy < -30) setExpanded(true)
    else if (dy > 30) setExpanded(false)
  }

  return (
    <>
      {/* ── Mobile speed control — top right, hidden on md+ ── */}
      <div className="md:hidden fixed top-3 right-3 z-[999] bg-white/95 backdrop-blur rounded-lg shadow-md px-2 py-1 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Speed</span>
          {SPEED_OPTIONS.map((m) => (
            <Button
              key={m}
              variant={speedMultiplier === m ? 'default' : 'outline'}
              size="sm"
              className="px-2 h-7 text-xs"
              onClick={() => setSpeedMultiplier(m)}
            >
              {m}x
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 pb-0.5 text-xs text-gray-500 cursor-pointer">
          <span>Skip photos</span>
          <Switch
            size="sm"
            checked={autoSkipMedia}
            onCheckedChange={(v) => setAutoSkipMedia(v)}
          />
        </label>
      </div>

      {/* ── Mobile bottom sheet — hidden on md+ ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[999] bg-white rounded-t-2xl shadow-[0_-2px_16px_rgba(0,0,0,0.15)]">
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div
          ref={mobileListRef}
          className={`relative transition-[height] duration-300 ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
          style={{ height: expanded ? 'calc(50vh - 40px)' : `${ROW_H}px` }}
        >
          {trip.sections.map((s, i) => renderRow(s, i, mobileRowRefs.current, true))}
        </div>
      </div>

      {/* ── Desktop panel — hidden below md ── */}
      <div className="hidden md:flex fixed top-4 right-4 z-[999] w-[280px] max-h-[calc(100vh-2rem)] bg-white rounded-xl shadow-lg flex-col">
        {/* Speed control header */}
        <div className="shrink-0 px-3 py-2 flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Speed</span>
          {SPEED_OPTIONS.map((m) => (
            <Button
              key={m}
              variant={speedMultiplier === m ? 'default' : 'outline'}
              size="sm"
              className="flex-1 px-1"
              onClick={() => setSpeedMultiplier(m)}
            >
              {m}x
            </Button>
          ))}
        </div>

        {/* Skip media toggle */}
        <label className="shrink-0 px-3 py-2 flex items-center justify-between gap-2 text-xs text-gray-600 cursor-pointer">
          <span>Skip photos while playing</span>
          <Switch
            size="sm"
            checked={autoSkipMedia}
            onCheckedChange={(v) => setAutoSkipMedia(v)}
          />
        </label>

        {/* Zoom control */}
        <div className="shrink-0 px-3 py-2 flex items-center gap-1 border-b">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            Zoom out
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            Zoom in
          </Button>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div ref={desktopListRef} className="relative flex-1 min-h-0 overflow-y-auto">
            {trip.sections.map((s, i) => renderRow(s, i, desktopRowRefs.current, false))}
          </div>

          <div className="shrink-0 p-3 flex gap-2 border-t">
            <Button
              onClick={handlePlayPause}
              className="flex-1 h-9"
            >
              {isPlaying ? 'Pause' : playState === 'paused' ? 'Resume' : 'Start'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
