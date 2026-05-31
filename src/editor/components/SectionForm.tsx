import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Section, TransportMode } from '@/types'
import type { EditorDispatch } from '@/editor/state/useTripEditor'
import { TRANSPORT_MODES } from '@/editor/components/transport'
import WaypointEditor from '@/editor/components/WaypointEditor'
import MediaListEditor from '@/editor/components/MediaListEditor'

interface Props {
  index: number
  section: Section
  addingWaypoint: boolean
  onToggleAddWaypoint: () => void
  dispatch: EditorDispatch
}

export default function SectionForm({
  index,
  section,
  addingWaypoint,
  onToggleAddWaypoint,
  dispatch,
}: Props) {
  const update = (patch: Partial<Section>) => dispatch({ type: 'updateSection', index, patch })

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      <div className="flex items-center gap-1.5">
        <MapPin className="size-3.5 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Section {index + 1}
        </h2>
      </div>

      <div className="space-y-1">
        <Label htmlFor="sec-name">Name</Label>
        <Input id="sec-name" value={section.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="sec-date">Date</Label>
          <Input
            id="sec-date"
            type="date"
            value={section.date ?? ''}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sec-mode">Transport</Label>
          <Select
            id="sec-mode"
            value={section.transportMode ?? ''}
            onChange={(e) =>
              update({ transportMode: (e.target.value || undefined) as TransportMode | undefined })
            }
          >
            <option value="">none</option>
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="sec-lat">Lat</Label>
          <Input
            id="sec-lat"
            type="number"
            step="any"
            value={section.lat}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isNaN(v)) update({ lat: v })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sec-lng">Lng</Label>
          <Input
            id="sec-lng"
            type="number"
            step="any"
            value={section.lng}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isNaN(v)) update({ lng: v })
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="sec-notes">Notes</Label>
        <Textarea id="sec-notes" value={section.notes ?? ''} onChange={(e) => update({ notes: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Waypoints</Label>
          <Button
            size="sm"
            variant={addingWaypoint ? 'default' : 'outline'}
            onClick={onToggleAddWaypoint}
          >
            <Plus /> {addingWaypoint ? 'Click map…' : 'Add waypoint'}
          </Button>
        </div>
        <WaypointEditor index={index} waypoints={section.waypoints ?? []} dispatch={dispatch} />
      </div>

      <div className="space-y-1.5">
        <Label>Media</Label>
        <MediaListEditor index={index} media={section.media ?? []} dispatch={dispatch} />
      </div>
    </div>
  )
}
