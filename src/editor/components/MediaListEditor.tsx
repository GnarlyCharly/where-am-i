import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resolveMediaUrl, isVideoUrl } from '@/lib/cloudinary'
import type { Section } from '@/types'
import type { EditorDispatch } from '@/editor/state/useTripEditor'

interface Props {
  index: number
  media: string[]
  dispatch: EditorDispatch
}

const THUMB_WIDTH = 120

function setMedia(dispatch: EditorDispatch, index: number, media: string[]) {
  const patch: Partial<Section> = media.length ? { media } : { media: undefined }
  dispatch({ type: 'updateSection', index, patch })
}

export default function MediaListEditor({ index, media, dispatch }: Props) {
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const v = draft.trim()
    if (!v) return
    setMedia(dispatch, index, [...media, v])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      {media.map((m, mi) => {
        const url = resolveMediaUrl(m, { width: THUMB_WIDTH })
        const video = isVideoUrl(m)
        return (
          <div key={mi} className="flex items-center gap-1.5 rounded-md border border-border p-1">
            <div className="size-9 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
              {video ? (
                <span className="text-[9px] text-muted-foreground">video</span>
              ) : (
                <img src={url} alt="" className="size-full object-cover" loading="lazy" />
              )}
            </div>
            <Input
              value={m}
              onChange={(e) => {
                const next = media.slice()
                next[mi] = e.target.value
                setMedia(dispatch, index, next)
              }}
              className="h-6 flex-1 font-mono text-[10px]"
            />
            <div className="flex shrink-0">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Move up"
                disabled={mi === 0}
                onClick={() => {
                  const next = media.slice()
                  ;[next[mi - 1], next[mi]] = [next[mi], next[mi - 1]]
                  setMedia(dispatch, index, next)
                }}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Move down"
                disabled={mi === media.length - 1}
                onClick={() => {
                  const next = media.slice()
                  ;[next[mi + 1], next[mi]] = [next[mi], next[mi + 1]]
                  setMedia(dispatch, index, next)
                }}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove media"
                onClick={() => setMedia(dispatch, index, media.filter((_, i) => i !== mi))}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        )
      })}

      <div className="flex items-center gap-1">
        <Input
          value={draft}
          placeholder="Cloudinary ID or URL"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addDraft()
            }
          }}
          className="h-6 flex-1 font-mono text-[10px]"
        />
        <Button size="icon-sm" variant="outline" aria-label="Add media" onClick={addDraft}>
          <Plus />
        </Button>
      </div>
    </div>
  )
}
