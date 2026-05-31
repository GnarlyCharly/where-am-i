import { useEffect, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTripEditor } from '@/editor/state/useTripEditor'
import EditorMap from '@/editor/components/EditorMap'
import SectionList from '@/editor/components/SectionList'
import SectionForm from '@/editor/components/SectionForm'

export default function EditorApp() {
  const { state, dispatch, save } = useTripEditor()
  const { trip, selectedIndex, dirty, saving, saveError } = state
  const [addingWaypoint, setAddingWaypoint] = useState(false)

  // Reset the add-waypoint toggle when switching sections.
  useEffect(() => {
    setAddingWaypoint(false)
  }, [selectedIndex])

  // ⌘S / Ctrl+S to save.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && !saving) void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dirty, saving, save])

  const selected = selectedIndex !== null ? trip.sections[selectedIndex] : null

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">TripEditor</span>
          <span className="text-xs text-muted-foreground">· {trip.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          <span className="text-xs text-muted-foreground">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : (
              <span className="inline-flex items-center gap-1 text-green-600">
                <Check className="size-3" /> Saved
              </span>
            )}
          </span>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Left rail: section list + trip fields */}
        <aside className="w-64 shrink-0 border-r border-border flex flex-col min-h-0">
          <SectionList trip={trip} selectedIndex={selectedIndex} dispatch={dispatch} />
        </aside>

        {/* Center: live map preview */}
        <main className="flex-1 min-w-0 relative">
          <EditorMap
            trip={trip}
            selectedIndex={selectedIndex}
            addingWaypoint={addingWaypoint}
            dispatch={dispatch}
          />
        </main>

        {/* Right: selected section editor */}
        <aside className="w-80 shrink-0 border-l border-border min-h-0">
          {selected && selectedIndex !== null ? (
            <SectionForm
              index={selectedIndex}
              section={selected}
              addingWaypoint={addingWaypoint}
              onToggleAddWaypoint={() => setAddingWaypoint((v) => !v)}
              dispatch={dispatch}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-xs text-muted-foreground text-center">
              Select a section to edit its fields, or add a new one.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
