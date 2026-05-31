# Implementation Plan: TripEditor

## Context

A **local-only** companion app, in the same repo as the "Where Am I" viewer, for
creating and editing the trip that the viewer renders. The viewer reads
[src/data/trip.json](src/data/trip.json) (a `Trip` with `sections[]`); TripEditor
edits that same file so changes flow straight into the viewer.

The editor reuses existing primitives:
- `Trip` / `Section` / `Waypoint` / `TransportMode` types from [src/types.ts](src/types.ts)
- `buildPath()` and geo helpers from [src/lib/geo.ts](src/lib/geo.ts) for the live path preview
- `SectionRoute` / `ROUTE_COLOR` / Leaflet + Tailwind v4 + shadcn (base-ui) UI stack

### Decisions locked in
| Question | Choice |
|---|---|
| Persistence | **Write back to `src/data/trip.json` via a Vite dev-server middleware** (single source of truth, no manual step) |
| Launch | **Separate Vite page entry** (`editor.html`) opened via `pnpm run editor` at `/where-am-i/editor.html` |
| Structural editing | **Add / delete sections, reorder sections, edit trip-level fields** |
| Field scope | **All section fields incl. `media[]`**, plus per-waypoint `transportMode` |

---

## Layout

```
┌──────────────┬─────────────────────────────────────┐
│ Section list │                                     │
│ (reorderable)│         Live map preview            │
│              │   (draggable section pt + waypoints)│
│  [+ section] │                                     │
├──────────────┤                                     │
│ Trip fields  │                                     │
│ (name, start)│                                     │
└──────────────┴─────────────────────────────────────┘
│        Selected-section field editor (panel)        │
└─────────────────────────────────────────────────────┘
[ Save ]  ·  unsaved-changes indicator
```

- **Left rail** — ordered list of sections (name or date fallback), drag handles to
  reorder, click to select, delete button per row, "+ Add section" at the bottom,
  and a trip-level fields block (trip name, start lat/lng).
- **Center** — Leaflet map showing the **whole trip** route (greyed) with the
  **selected section's leg highlighted**, plus draggable markers.
- **Bottom panel** — field editor for the selected section.

---

## Build Order

### Step 1 — Second Vite entry (multi-page)

- Add **`editor.html`** at repo root (clone of `index.html`, title "TripEditor",
  script `src="/src/editor/main.tsx"`).
- Add **`src/editor/main.tsx`** mirroring [src/main.tsx](src/main.tsx) (imports
  `leaflet/dist/leaflet.css` + `./index.css`, renders `<EditorApp />`).
- `vite.config.ts`: add `build.rollupOptions.input` mapping `main` → `index.html`
  and `editor` → `editor.html` so production build emits both (build is optional
  here since it's local-only, but keeps parity).
- `package.json` script: `"editor": "vite --open /where-am-i/editor.html"`.
  (`base` is `/where-am-i/`, so the dev URL is `/where-am-i/editor.html`.)

> The viewer (`pnpm dev`) is untouched; the editor runs from the same dev server.

### Step 2 — Dev-only save middleware

New file **`vite-plugin-trip-saver.ts`** (a small local Vite plugin), registered in
`vite.config.ts` plugins array.

- `apply: 'serve'` so it exists **only in dev** (never in the built viewer).
- `configureServer(server)`: register middleware on `POST /__save-trip`.
  - Read JSON body, validate it shape-checks as a `Trip` (has `name`, numeric
    `lat`/`lng`, array `sections`).
  - Write pretty-printed JSON (2-space indent + trailing newline) to
    `src/data/trip.json` via `node:fs/promises`.
  - Respond `200 {ok:true}` or `400/500 {error}`.
- Optional safety: before first write of a session, copy `trip.json` →
  `trip.backup.json` (gitignored) so a bad save is recoverable.

Client helper **`src/editor/lib/saveTrip.ts`**: `await fetch('/__save-trip', {method:'POST', body: JSON.stringify(trip)})`.

### Step 3 — Editor state model

**`src/editor/state/useTripEditor.ts`** — a hook (plain `useState`/`useReducer`,
no new deps) owning the working copy of the trip.

State:
```ts
{
  trip: Trip                 // working copy, initialised from imported trip.json
  selectedIndex: number | null
  dirty: boolean             // diverged from last saved
  saving: boolean
}
```
Actions: `selectSection`, `updateTripField`, `addSection`, `deleteSection`,
`reorderSections(from,to)`, `updateSection(index, patch)`, `addWaypoint`,
`updateWaypoint(secIdx, wpIdx, patch)`, `deleteWaypoint`, `moveSectionPoint(latlng)`,
`moveWaypoint(wpIdx, latlng)`, `save()`.

- Seed from `import tripData from '@/data/trip.json'` (the editor loads the
  on-disk state at page load; reload after save reflects the written file).
- `dirty` set on any mutation, cleared on successful `save()`.
- `beforeunload` guard when `dirty`.

### Step 4 — Live path preview (`src/editor/components/EditorMap.tsx`)

Reuses the viewer's geometry so the preview matches reality exactly.

- Wrap the map like [src/components/Map.tsx](src/components/Map.tsx): `MapContainer`
  + OSM `TileLayer`, fit bounds to all section/start coords.
- Compute `const path = useMemo(() => buildPath(trip), [trip])` on **every edit** —
  `buildPath` is pure and cheap, so the route (incl. plane great-circle arcs and
  per-leg dash styles) re-renders live as fields/points change.
- Render the full route with the existing **`SectionRoute`** (overview mode,
  `traveledPoints=[]`), drawn de-emphasised.
- Overlay the **selected section's leg** as a highlighted `Polyline` using
  `path.sectionEndIndices` to slice `path.points` for that section (from the prior
  section's end index to this section's).
- **Markers:**
  - Selected section's destination point → draggable `Marker`
    (`draggable`, `eventHandlers.dragend` → `moveSectionPoint`).
  - Each waypoint of the selected section → smaller draggable marker
    (`dragend` → `moveWaypoint`). Distinct icon/color from the section point.
  - Other sections' points → static, dimmed, click-to-select.
- **Add waypoint by clicking the map:** an "Add waypoint" toggle; while active,
  `useMapEvents({ click })` appends a waypoint at the clicked latlng to the
  selected section (inserted before the section destination). New waypoint is
  immediately draggable.

### Step 5 — Section list + trip fields (`src/editor/components/SectionList.tsx`)

- Ordered list; each row shows index, name (or date), and a transport-mode glyph.
- Click → select (highlights on map + opens field panel).
- **Reorder:** native HTML5 drag-and-drop (`draggable` rows, `dragover`/`drop`
  computing from/to) → `reorderSections`. Keep it dependency-free.
- Per-row **delete** (with confirm).
- "**+ Add section**" — appends a section seeded at the previous section's point
  (nudged) with today's date as a sensible default; auto-selects it.
- **Trip fields** block: `name` (text), start `lat`/`lng` (numeric, also draggable
  via a distinct start marker on the map — optional nicety).

### Step 6 — Section field editor (`src/editor/components/SectionForm.tsx`)

Edits the selected section; every change calls `updateSection`. Fields:

- `name` — text
- `date` — date input (`YYYY-MM-DD`)
- `transportMode` — select: `campervan | car | plane | ferry` (+ "inherit/none")
- `notes` — textarea
- `lat` / `lng` — numeric inputs, two-way bound with the draggable map marker
- **`waypoints[]`** — list editor:
  - reorder / delete each waypoint
  - per-waypoint `lat`/`lng` (synced with map drag)
  - per-waypoint `transportMode` override (select; empty = inherit section mode)
  - "Add waypoint" (also available as the map click-toggle in Step 4)
- **`media[]`** — string-list editor (Cloudinary public IDs or full URLs as text):
  add / remove / reorder rows; optional thumbnail via existing
  `resolveMediaUrl` from [src/lib/cloudinary.ts](src/lib/cloudinary.ts).
  Detect video vs image with `isVideoUrl`. (No upload — text entry only.)

Use existing shadcn/base-ui components where present (`button`, `switch`); add
small primitives (`input`, `textarea`, `select`, `label`) via `shadcn` CLI as
needed — they land in `src/components/ui/` and are shared.

### Step 7 — Save & status bar (`src/editor/components/EditorApp.tsx`)

- Compose: `SectionList` (left), `EditorMap` (center), `SectionForm` (bottom).
- **Save** button → `save()` → POST to `/__save-trip`; toast/inline status on
  success/error; clears `dirty`.
- Show unsaved-changes indicator; keyboard shortcut ⌘S → save.
- Display the raw JSON in a collapsible panel (read-only) for sanity-checking.

---

## File Manifest

**New**
- `editor.html`
- `src/editor/main.tsx`
- `src/editor/components/EditorApp.tsx`
- `src/editor/components/EditorMap.tsx`
- `src/editor/components/SectionList.tsx`
- `src/editor/components/SectionForm.tsx`
- `src/editor/components/WaypointEditor.tsx`
- `src/editor/components/MediaListEditor.tsx`
- `src/editor/state/useTripEditor.ts`
- `src/editor/lib/saveTrip.ts`
- `vite-plugin-trip-saver.ts`
- `src/components/ui/{input,textarea,select,label}.tsx` (via shadcn CLI, shared)

**Modified**
- `vite.config.ts` — multi-page input + trip-saver plugin
- `package.json` — `"editor"` script

**Untouched / reused**
- `src/types.ts`, `src/lib/geo.ts`, `src/lib/cloudinary.ts`,
  `src/components/SectionRoute.tsx`, `src/lib/config.ts`

---

## Decisions / Notes

- **No new runtime deps.** Reorder = native HTML5 DnD; map drag = built-in
  Leaflet marker `draggable`; state = React built-ins.
- **Dev-only persistence.** The save middleware is `apply:'serve'`; the built
  static viewer (GitHub Pages, given `base:'/where-am-i/'`) has no write endpoint.
- **Single source of truth.** Editor and viewer both bind to `src/data/trip.json`.
  After save, reload the editor (or re-import) to confirm written state.
- **Backup.** Middleware writes `src/data/trip.backup.json` (add to `.gitignore`)
  before the first write each session.
- **Validation.** Middleware shape-checks before writing; client blocks save while
  any lat/lng field is non-numeric.

## Open / Deferred
- Undo/redo stack (not in scope; `dirty` + reload covers safety).
- Media upload to Cloudinary (text IDs/URLs only for now).
- Date auto-sort vs. manual order (sections keep manual order; reorder is explicit).
