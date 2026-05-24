# Implementation Plan: Where Am I — Travel Map App

## Context
Building a personal travel map from scratch per DESIGN.md. A single 10-month Europe trip visualised as an animated route: a transport icon travels stop-to-stop, painting a line behind it. The project currently has only DESIGN.md and README.md — everything needs to be scaffolded.

---

## Build Order

### Step 1 — Project scaffold

```bash
npm create vite@latest . -- --template react-ts
```

Then install dependencies:
```bash
npm install leaflet react-leaflet leaflet-geodesic
npm install -D @types/leaflet
# Tailwind v4
npm install tailwindcss @tailwindcss/vite
# shadcn (after Tailwind v4 is wired up)
npx shadcn@latest init
```

Key config changes:
- `vite.config.ts`: add `@tailwindcss/vite` plugin, disable default Leaflet zoom control via map options
- `src/index.css`: `@import "tailwindcss"` (Tailwind v4 syntax — no config file needed)
- `index.html`: standard Vite entry
- Leaflet CSS: imported in `main.tsx` via `import 'leaflet/dist/leaflet.css'`

---

### Step 2 — Types & config

**`src/types.ts`**
```ts
export type TransportMode = 'campervan' | 'plane' | 'ferry'

export interface Waypoint { lat: number; lng: number }

export interface Section {
  name?: string
  lat: number
  lng: number
  waypoints?: Waypoint[]
  date: string
  transportMode?: TransportMode
  speed?: number
  notes?: string
  media?: string[]
}

export interface Trip {
  name: string
  lat: number
  lng: number
  animationSpeed?: number
  sections: Section[]
}

export type PlayState = 'overview' | 'playing' | 'paused' | 'media'
```

**`src/lib/config.ts`**
```ts
export const ROUTE_COLOR = '#e85d04'
export const DEFAULT_SPEED = 300        // km / animation-second
export const PLAY_ZOOM_OFFSET = 2       // zoom levels added on Play
export const IMAGE_DURATION_MS = 1000
```

---

### Step 3 — Geo utilities (`src/lib/geo.ts`)

Pure functions, no React:

- `haversineKm(a, b)` — distance between two LatLngs in km
- `bearing(a, b)` — compass bearing in degrees
- `interpolateGreatCircle(a, b, n)` — returns n intermediate LatLng points along the geodesic arc (using `leaflet-geodesic`'s `GeodesicLine` or manual spherical math)
- `buildPath(trip)` → `{ points: LatLng[], distances: number[] }` — pre-computes the entire flat path with cumulative km distances. Called once on load. Each point also tagged with its section index so the animation loop knows when it crosses a section boundary.

---

### Step 4 — Animation hook (`src/hooks/useRouteAnimation.ts`)

Owns all playback state. Returns:

```ts
{
  playState: PlayState
  traveledPoints: LatLng[]      // points behind the icon (the painted line)
  iconPos: LatLng | null
  iconBearing: number
  iconMode: TransportMode
  revealedSections: Set<number> // section indices where icon has arrived
  activeSection: number         // current section index
  mediaQueue: string[] | null   // media items to show (null = not in media state)
  play: (fromIndex?: number) => void
  pause: () => void
  reset: () => void
  skipMedia: (direction: 'forward' | 'back') => void
  endMedia: () => void
}
```

Internals:
- `rafRef` — requestAnimationFrame handle
- `distanceRef` — current distance traveled (km), updated each frame
- `pathRef` — pre-computed `{ points, distances }` from `buildPath()`
- Each frame: advance distance → binary-search distances[] → interpolate LatLng → update traveledPoints → check section crossings → trigger media if needed
- On `play(fromIndex)`: zoom map +2 levels (via a callback passed in), then start RAF
- Speed changes mid-leg: `distanceRef` uses `section.speed ?? trip.animationSpeed ?? DEFAULT_SPEED`

---

### Step 5 — SVG icons (`public/icons/`)

Three SVGs, each designed to point **right** (0°) so CSS `rotate` works correctly:
- `campervan.svg` — simple van silhouette
- `plane.svg` — top-down aircraft
- `ferry.svg` — boat/ship silhouette

---

### Step 6 — Map components

**`src/components/Map.tsx`**
- `MapContainer` with `zoomControl={false}`, `attributionControl={false}`
- `TileLayer` (OpenStreetMap)
- Custom zoom buttons (`+` / `−`) absolutely positioned top-left using shadcn `Button`, call `map.zoomIn()` / `map.zoomOut()`
- Exposes a `mapRef` via `useMap()` so parent can call `fitBounds` and `flyTo`
- On mount: `map.fitBounds(tripBounds)` derived from all section coordinates

**`src/components/SectionRoute.tsx`**
- Takes `sections`, `traveledPoints`, `playState`
- In `overview` state: renders all section polylines at full opacity using `Polyline` components
- In `playing`/`paused`/`media` state: renders `traveledPoints` as a single `Polyline` (everything else hidden)
- Plane legs: uses `leaflet-geodesic`'s `GeodesicLine` instead of `Polyline`
- Line style per mode: solid (campervan), dashed (plane), dotted (ferry)

**`src/components/TravelIcon.tsx`**
- `Marker` with a `DivIcon` containing an `<img>` of the current mode's SVG
- CSS `transform: rotate(${bearing}deg)` applied inline
- Rendered only when `playState !== 'overview'`

**`src/components/StopLabel.tsx`**
- `Marker` with a `DivIcon` containing a small dot + name text
- Rendered for each section in `revealedSections` that has a `name`
- Pop-in via CSS `scale` animation (`animate-in zoom-in-50` from Tailwind)

---

### Step 7 — Media popover (`src/components/MediaPopover.tsx`)

- Full-screen fixed overlay (dark backdrop) rendered outside the map via React portal
- Detects video vs image by URL extension (`.mp4`, `.webm`, `.mov` → video)
- **Segmented progress bar** across the top: one `<div>` per media item, fills at its own rate
  - Images: CSS transition `width: 0% → 100%` over 1000ms, driven by `setTimeout`
  - Videos: sync to `video.currentTime / video.duration` via `requestAnimationFrame`
- **Hold to pause**: `pointerdown` pauses timer/video; `pointerup` resumes from where it left off
- **Left/right half tap**: split on `e.clientX < window.innerWidth / 2`
  - Left: go back one item (no-op if first)
  - Right: advance to next item or close + call `endMedia()`
- `autoPlay` + `muted` + `playsInline` on `<video>`

---

### Step 8 — Bottom sheet / panel (`src/components/BottomSheet.tsx`)

Uses shadcn `Drawer` (vaul-based) on mobile, custom fixed panel on desktop, switched via Tailwind `md:` breakpoint.

**Mobile (< md)**
- Collapsed: height = 3 rows; expanded: `max-h-[50vh]`
- Drag handle at top toggles between states
- List auto-scrolls to active section (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
- Active section highlighted in theme color; shows Play/Pause + Reset buttons inline

**Desktop (≥ md)**
- Fixed panel `w-[280px]` top-right `top-4 right-4`, no collapse toggle
- Scrollable list, auto-scrolls to active section
- Play/Pause + Reset pinned to bottom of panel

Section row states: `✓` (index < activeSection), `▶` (active), `·` (upcoming)
Clicking any row calls `play(index)`.

---

### Step 9 — App assembly (`src/App.tsx`)

Wires everything together:
1. Load `trip.json`
2. Call `buildPath(trip)` once → store in ref
3. `useRouteAnimation(path, trip)` → destructure all state
4. Pass `map.flyTo` / `map.setZoom` to animation hook via callback ref
5. Render: `<Map>` → `<SectionRoute>` + `<TravelIcon>` + `<StopLabel[]>` inside map; `<BottomSheet>` and `<MediaPopover>` outside map

---

### Step 10 — Sample data (`src/data/trip.json`)

~8–10 sections covering a realistic Europe campervan route with:
- Mix of named and anonymous waypoints
- At least one plane leg (with `speed` override)
- At least one ferry leg (with `waypoints` path shaping)
- One section with `media` (placeholder image URLs)

---

## Critical files to create (in order)

1. `package.json` + install
2. `vite.config.ts`, `tsconfig.json`, `index.html`
3. `src/index.css`, `src/main.tsx`
4. `src/types.ts`
5. `src/lib/config.ts`
6. `src/lib/geo.ts`
7. `src/hooks/useRouteAnimation.ts`
8. `public/icons/*.svg` (3 files)
9. `src/components/Map.tsx`
10. `src/components/SectionRoute.tsx`
11. `src/components/TravelIcon.tsx`
12. `src/components/StopLabel.tsx`
13. `src/components/MediaPopover.tsx`
14. `src/components/BottomSheet.tsx`
15. `src/data/trip.json`
16. `src/App.tsx`

---

## Key technical notes

- **Leaflet + React**: Leaflet mutates the DOM directly; update polyline points via `.setLatLngs()` on a ref rather than re-rendering React components each frame — avoids reconciliation overhead during animation
- **Tailwind v4**: uses `@import "tailwindcss"` in CSS, no `tailwind.config.js` needed; configured via CSS variables
- **shadcn init**: run after Tailwind is confirmed working; choose "Default" style, CSS variables on
- **leaflet-geodesic**: `GeodesicLine` accepts standard Leaflet LatLng arrays; drop-in replacement for `Polyline` for plane legs
- **Auto-pan**: use `map.panTo(iconPos, { animate: false })` each frame — `animate: false` prevents Leaflet's own easing from conflicting with the RAF loop

---

## Verification

1. `npm run dev` — dev server starts, map renders over Europe with all section lines visible
2. Press Play — map zooms in ~2 levels, icon appears, line paints behind it
3. Icon swaps between campervan/plane/ferry SVGs at mode transitions
4. Named sections pop in labels as icon passes
5. Clicking a section row in the list jumps playback to that section
6. Media popover opens on sections with `media`, segmented bar fills, left/right tap navigates, hold pauses
7. Mobile: bottom sheet collapses to 3 rows, expands to 50vh, auto-scrolls to active
8. Desktop: top-right panel visible, scrolls to active section
9. Reset returns to full overview with all lines at 100% opacity
