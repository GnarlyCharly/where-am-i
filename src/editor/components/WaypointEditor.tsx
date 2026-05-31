import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { TransportMode, Waypoint } from '@/types'
import type { EditorDispatch } from '@/editor/state/useTripEditor'
import { TRANSPORT_MODES } from '@/editor/components/transport'

interface Props {
  index: number
  waypoints: Waypoint[]
  dispatch: EditorDispatch
}

function numberField(value: number, onCommit: (n: number) => void) {
  return (
    <Input
      type="number"
      step="any"
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const v = Number(e.target.value)
        if (!Number.isNaN(v) && v !== value) onCommit(v)
      }}
      className="h-6"
    />
  )
}

export default function WaypointEditor({ index, waypoints, dispatch }: Props) {
  return (
    <div className="space-y-1.5">
      {waypoints.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No waypoints. Use “Add waypoint”, then click the map or edit coordinates.
        </p>
      )}
      {waypoints.map((w, wi) => (
        <div key={wi} className="flex items-center gap-1 rounded-md border border-border p-1">
          <span className="w-4 text-center text-[10px] text-muted-foreground tabular-nums shrink-0">{wi + 1}</span>
          <div className="grid grid-cols-2 gap-1 flex-1">
            {numberField(w.lat, (lat) =>
              dispatch({ type: 'updateWaypoint', index, wpIndex: wi, patch: { lat } }),
            )}
            {numberField(w.lng, (lng) =>
              dispatch({ type: 'updateWaypoint', index, wpIndex: wi, patch: { lng } }),
            )}
          </div>
          <Select
            value={w.transportMode ?? ''}
            onChange={(e) =>
              dispatch({
                type: 'updateWaypoint',
                index,
                wpIndex: wi,
                patch: { transportMode: (e.target.value || undefined) as TransportMode | undefined },
              })
            }
            className="h-6 w-24 shrink-0"
          >
            <option value="">inherit</option>
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <div className="flex shrink-0">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Move waypoint up"
              disabled={wi === 0}
              onClick={() => dispatch({ type: 'reorderWaypoints', index, from: wi, to: wi - 1 })}
            >
              <ArrowUp />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Move waypoint down"
              disabled={wi === waypoints.length - 1}
              onClick={() => dispatch({ type: 'reorderWaypoints', index, from: wi, to: wi + 1 })}
            >
              <ArrowDown />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete waypoint"
              onClick={() => dispatch({ type: 'deleteWaypoint', index, wpIndex: wi })}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
