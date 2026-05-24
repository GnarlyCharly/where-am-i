import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IMAGE_DURATION_MS } from '@/lib/config'

const VIDEO_EXTS = /\.(mp4|webm|mov)$/i

interface Props {
  mediaQueue: string[]
  mediaIndex: number
  skipMedia: (direction: 'forward' | 'back') => void
}

export default function MediaPopover({ mediaQueue, mediaIndex, skipMedia }: Props) {
  const currentUrl = mediaQueue[mediaIndex]
  const isVideo = VIDEO_EXTS.test(currentUrl)

  const [segProgress, setSegProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const elapsedRef = useRef(0)     // ms elapsed for current image item
  const frameStartRef = useRef(0)  // performance.now() of the last RAF call
  const pointerDownTimeRef = useRef(0)

  // Mirror into refs so the stable RAF callback sees current values
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

  // Stable tick — reads all mutable state through refs to avoid stale closures
  const tick = useCallback((ts: number) => {
    if (isPausedRef.current) return

    let p: number
    if (isVideoRef.current) {
      const vid = videoRef.current
      if (!vid || !vid.duration || isNaN(vid.duration)) {
        // Video not ready yet — keep waiting
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
  }, []) // intentionally empty — stable function, all state via refs

  // Reset and restart whenever the current item changes
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
        // Quick tap — navigate left or right
        if (e.clientX < window.innerWidth / 2) {
          skipMediaRef.current('back')
        } else {
          skipMediaRef.current('forward')
        }
        return
      }

      // Long hold released — resume from current position
      frameStartRef.current = performance.now()
      if (isVideoRef.current) videoRef.current?.play().catch(() => {})
      rafRef.current = requestAnimationFrame(tick)
    },
    [tick],
  )

  // Treat pointer cancel (e.g. scroll interrupt) the same as releasing a hold
  const onPointerCancel = useCallback(() => {
    isPausedRef.current = false
    frameStartRef.current = performance.now()
    if (isVideoRef.current) videoRef.current?.play().catch(() => {})
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Instagram-style segmented progress bar */}
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
    </div>,
    document.body,
  )
}
