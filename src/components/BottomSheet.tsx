import { useEffect, useRef, useState } from 'react'
import type { PlayState, Section, Trip } from '@/types'
import { Button } from '@/components/ui/button'

interface Props {
  trip: Trip
  playState: PlayState
  activeSection: number
  revealedSections: Set<number>
  play: (fromIndex?: number) => void
  pause: () => void
  reset: () => void
}

const ROW_H = 48 // px — matches h-12, drives collapsed height calculation

export default function BottomSheet({
  trip,
  playState,
  activeSection,
  revealedSections,
  play,
  pause,
  reset,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const mobileListRef = useRef<HTMLDivElement | null>(null)
  const desktopListRef = useRef<HTMLDivElement | null>(null)
  const mobileRowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const desktopRowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const dragStartY = useRef(0)

  const isPlaying = playState === 'playing' || playState === 'media'
  const hasStarted = playState !== 'overview'
  const inMedia = playState === 'media'

  // Keep active row centred in whichever list is visible
  useEffect(() => {
    function scrollToActive(
      list: HTMLDivElement | null,
      refs: Map<number, HTMLDivElement>,
    ) {
      if (!list) return
      const row = refs.get(activeSection)
      if (!row) return
      list.scrollTop = row.offsetTop - list.clientHeight / 2 + ROW_H / 2
    }
    scrollToActive(mobileListRef.current, mobileRowRefs.current)
    scrollToActive(desktopListRef.current, desktopRowRefs.current)
  }, [activeSection])

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
          isActive
            ? 'bg-orange-50 text-[#e85d04]'
            : 'text-gray-700 hover:bg-gray-50',
          inMedia ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
        onClick={() => !inMedia && play(i)}
      >
        <span className={`w-4 shrink-0 text-xs ${isActive ? 'font-bold' : 'opacity-40'}`}>
          {indicator}
        </span>
        <span className="flex-1 text-sm truncate">
          {section.name ?? section.date}
        </span>
        {isActive && showInlineControls && (
          <div className="flex gap-1 shrink-0 ml-1">
            <Button
              variant="outline"
              size="default"
              className="px-2 text-[#e85d04] border-orange-300 hover:bg-orange-50 hover:text-[#e85d04]"
              onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>
            <Button
              variant="outline"
              size="default"
              className="px-2 text-gray-500"
              onClick={(e) => { e.stopPropagation(); reset() }}
              title="Reset"
            >
              ↺
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

        {/* Section list — fixed to 3 rows when collapsed, 50vh when expanded */}
        <div
          ref={mobileListRef}
          className={`transition-[height] duration-300 ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
          style={{ height: expanded ? 'calc(50vh - 40px)' : `${ROW_H * 3}px` }}
        >
          {trip.sections.map((s, i) => renderRow(s, i, mobileRowRefs.current, true))}
        </div>
      </div>

      {/* ── Desktop panel — hidden below md ── */}
      <div className="hidden md:flex fixed top-4 right-4 z-[999] w-[280px] max-h-[calc(100vh-2rem)] bg-white rounded-xl shadow-lg flex-col">
        {/* Trip name header */}
        <div className="shrink-0 px-4 py-3 text-sm font-semibold text-gray-800 border-b">
          {trip.name}
        </div>

        {/* Scrollable section list */}
        <div ref={desktopListRef} className="flex-1 min-h-0 overflow-y-auto">
          {trip.sections.map((s, i) => renderRow(s, i, desktopRowRefs.current, false))}
        </div>

        {/* Playback controls pinned to bottom */}
        <div className="shrink-0 p-3 flex gap-2 border-t">
          <Button
            onClick={handlePlayPause}
            disabled={inMedia}
            className="flex-1 h-9"
          >
            {isPlaying ? 'Pause' : playState === 'paused' ? 'Resume' : 'Play'}
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={reset}
            disabled={!hasStarted || inMedia}
            title="Reset"
            className="text-gray-600 text-lg"
          >
            ↺
          </Button>
        </div>
      </div>
    </>
  )
}
