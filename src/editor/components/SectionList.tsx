import { useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Trip } from '@/types'
import type { EditorDispatch } from '@/editor/state/useTripEditor'

interface Props {
  trip: Trip
  selectedIndex: number | null
  dispatch: EditorDispatch
}

export default function SectionList({ trip, selectedIndex, dispatch }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</h2>
        <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'addSection' })}>
          <Plus /> Add
        </Button>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {trip.sections.map((s, i) => {
          const selected = i === selectedIndex
          const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
          return (
            <li
              key={i}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(i)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null && dragIndex !== i) {
                  dispatch({ type: 'reorderSections', from: dragIndex, to: i })
                }
                setDragIndex(null)
                setOverIndex(null)
              }}
              onClick={() => dispatch({ type: 'select', index: i })}
              className={cn(
                'group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-md cursor-pointer text-xs',
                selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted text-foreground/80',
                isOver && 'border-t-2 border-primary',
              )}
            >
              <GripVertical className="size-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
              <span className="w-5 text-right tabular-nums text-muted-foreground shrink-0">{i + 1}</span>
              <span className="flex-1 truncate">
                {s.name || <span className="text-muted-foreground italic">untitled</span>}
                <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{s.date}</span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                aria-label="Delete section"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete section "${s.name || `#${i + 1}`}"?`)) {
                    dispatch({ type: 'deleteSection', index: i })
                  }
                }}
              >
                <Trash2 />
              </Button>
            </li>
          )
        })}
        {trip.sections.length === 0 && (
          <li className="px-3 py-4 text-xs text-muted-foreground text-center">No sections yet.</li>
        )}
      </ul>

      <div className="border-t border-border p-3 space-y-2 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trip</h2>
        <div className="space-y-1">
          <Label htmlFor="trip-name">Name</Label>
          <Input
            id="trip-name"
            value={trip.name}
            onChange={(e) => dispatch({ type: 'updateTrip', patch: { name: e.target.value } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="trip-lat">Start lat</Label>
            <Input
              id="trip-lat"
              type="number"
              step="any"
              value={trip.lat}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isNaN(v)) dispatch({ type: 'updateTrip', patch: { lat: v } })
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="trip-lng">Start lng</Label>
            <Input
              id="trip-lng"
              type="number"
              step="any"
              value={trip.lng}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isNaN(v)) dispatch({ type: 'updateTrip', patch: { lng: v } })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
