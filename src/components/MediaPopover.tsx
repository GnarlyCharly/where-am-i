import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { IMAGE_DURATION_MS } from '@/lib/config'

const VIDEO_EXTS = /\.(mp4|webm|mov)$/i

interface Props {
  mediaQueue: string[]
  mediaIndex: number
  skipMedia: (direction: 'forward' | 'back') => void
  endMedia: () => void
}

export default function MediaPopover({ mediaQueue, mediaIndex, skipMedia, endMedia }: Props) {
  const currentUrl = mediaQueue[mediaIndex]
  const isVideo = VIDEO_EXTS.test(currentUrl)

  const [segProgress, setSegProgress] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const frameStartRef = useRef(0)
  const pointerDownTimeRef = useRef(0)

  const isVideoRef = useRef(isVideo)
  isVideoRef.current = isVideo
  const skipMediaRef = useRef(skipMedia)
  skipMediaRef.current = skipMedia

  const cancelRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const tick = useCallback((ts: number) => {
    if (isPausedRef.current) return

    let p: number
    if (isVideoRef.current) {
      const vid = videoRef.current
      if (!vid || !vid.duration || isNaN(vid.duration)) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      p = vid.currentTime / vid.duration
    } else {
      const dt = ts - frameStartRef.current
      frameStartRef.current = ts
      elapsedRef.current += dt
      p = Math.min(elapsedRef.current / IMAGE_DURATION_MS, 1)
    }

    setSegProgress(p)

    if (p >= 1) {
      skipMediaRef.current('forward')
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    cancelRaf()
    isPausedRef.current = false
    elapsedRef.current = 0
    setSegProgress(0)

    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }

    frameStartRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)

    return cancelRaf
  }, [mediaIndex, isVideo, tick, cancelRaf])

  const onPointerDown = useCallback(() => {
    pointerDownTimeRef.current = performance.now()
    isPausedRef.current = true
    cancelRaf()
    if (isVideoRef.current) videoRef.current?.pause()
  }, [cancelRaf])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const heldMs = performance.now() - pointerDownTimeRef.current
      isPausedRef.current = false

      if (heldMs < 200) {
        const rect = containerRef.current?.getBoundingClientRect()
        const midX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
        if (e.clientX < midX) {
          skipMediaRef.current('back')
        } else {
          skipMediaRef.current('forward')
        }
        return
      }

      frameStartRef.current = performance.now()
      if (isVideoRef.current) videoRef.current?.play().catch(() => {})
      rafRef.current = requestAnimationFrame(tick)
    },
    [tick],
  )

  const onPointerCancel = useCallback(() => {
    isPausedRef.current = false
    frameStartRef.current = performance.now()
    if (isVideoRef.current) videoRef.current?.play().catch(() => {})
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  return createPortal(
    <div
      ref={containerRef}
      className="fixed top-4 left-4 right-4 bottom-48 md:bottom-4 md:right-76 z-2000 bg-black rounded-2xl overflow-hidden flex flex-col select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <button
        className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); endMedia() }}
      >
        <X className="size-4" strokeWidth={2.5} />
      </button>

      <div className="absolute top-0 left-0 right-0 flex gap-1 p-3 z-10">
        {mediaQueue.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: `${i < mediaIndex ? 100 : i === mediaIndex ? segProgress * 100 : 0}%`,
              }}
            />
          </div>
        ))}
      </div>

      {mediaIndex > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/70 text-white hover:bg-black/85 transition-colors flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); skipMedia('back') }}
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
      )}
      {mediaIndex < mediaQueue.length - 1 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/70 text-white hover:bg-black/85 transition-colors flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); skipMedia('forward') }}
        >
          <ChevronRight className="size-6" strokeWidth={2.5} />
        </button>
      )}

      <div className="flex-1 flex items-center justify-center min-h-0">
        {isVideo ? (
          <video
            key={currentUrl}
            ref={videoRef}
            src={currentUrl}
            className="max-w-full max-h-full object-contain"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <img
            key={currentUrl}
            src={currentUrl}
            className="max-w-full max-h-full object-contain"
            alt=""
            draggable={false}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
