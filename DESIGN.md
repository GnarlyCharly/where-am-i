# Where Am I — Design Document

## Overview

A personal travel map web app built with React (Vite) and Leaflet. Visualizes a single 10-month journey across Europe as an **animated route** — a transport icon travels stop-to-stop, painting the line behind it. The journey is divided into named sections; sections play one at a time and stay permanently painted on the map when complete.

---

## Goals

- One trip, multiple sections (e.g. "Scandinavia", "Central Europe", "Iberia")
- Each section is an ordered sequence of stops connected by animated lines
- Transport mode per leg: campervan, plane, ferry
- Plane legs rendered as great-circle arcs; all others as straight polylines
- Single consistent line color across all sections
- Global animation speed with per-leg overrides
- Completed sections stay painted on the map; play one section at a time
- No backend required — deployable as a static site

## Non-goals (v1)

- Multiple trips / users
- Real-time data or a database
- Native iOS/Android app

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, good ecosystem |
| Map | Leaflet + react-leaflet | Mature, lightweight, OSM-compatible |
| Tile provider | OpenStreetMap (default) | Free, no API key needed |
| Styling | Tailwind CSS v4 | Utility-first, works well with shadcn |
| Components | shadcn/ui | Accessible, unstyled-by-default, Tailwind-based |
| Geodesic lines | Leaflet.Geodesic | Great-circle arc interpolation for plane legs |
| Data | `src/data/trip.json` | Edit by hand, no backend needed |

---

## Data Model

`src/data/trip.json` — a single trip object. `sections` is a flat array where every entry is a section. ~100 entries for the full journey.

```json
{
  "name": "Europe 2025",
  "animationSpeed": 300,
  "lat": 59.3293,
  "lng": 18.0686,
  "sections": [
    {
      "name": "Stockholm",
      "lat": 59.3293,
      "lng": 18.0686,
      "date": "2025-06-01",
      "notes": "Start of the trip."
    },
    {
      "lat": 57.7071,
      "lng": 11.9668,
      "date": "2025-06-04",
      "transportMode": "campervan"
    },
    {
      "name": "Copenhagen",
      "lat": 55.6761,
      "lng": 12.5683,
      "date": "2025-06-10",
      "transportMode": "ferry",
      "waypoints": [
        { "lat": 57.3, "lng": 11.8 },
        { "lat": 56.5, "lng": 12.1 }
      ],
      "notes": "Overnight ferry from Gothenburg."
    },
    {
      "name": "Mallorca",
      "lat": 39.6953,
      "lng": 3.0176,
      "date": "2025-07-10",
      "transportMode": "plane",
      "speed": 800,
      "notes": "Flew from Barcelona.",
      "media": [
        "https://example.com/photos/mallorca-arrival.jpg",
        "https://example.com/photos/mallorca-beach.jpg",
        "https://example.com/videos/mallorca-sunset.mp4"
      ]
    }
  ]
}
```

### Trip fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Display name for the whole journey |
| `lat` / `lng` | number | yes | Starting coordinates — the line to the first section draws from here |
| `animationSpeed` | number | no | Default speed in **km per animation-second**. Fallback: 300. |

### Section fields

Every entry in `sections` is a section. Each section is one location — the line is drawn from the previous section's coordinates to this one.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | If present, the name pops in on the map when the icon arrives. Omit for silent waypoints. |
| `lat` / `lng` | number | yes | Destination coordinates for this section |
| `waypoints` | array | no | Intermediate `{ lat, lng }` points to shape the path between the previous section and this one. Drawn in order before the destination. |
| `date` | string (ISO date) | yes | Date of arrival |
| `transportMode` | string | no | Transport mode used to travel from the previous section to this one. Omit on the first section. |
| `speed` | number | no | Per-leg speed override in km/animation-second. |
| `notes` | string | no | Free-text shown in the sidebar / popup |
| `media` | string[] | no | List of image or video URLs. Shown as a fullscreen popover when the icon arrives; animation pauses until all items have been displayed. Images show for 1 second; videos play for their full duration. |

Sections without a `name` are silent waypoints — they shape the route and allow mode changes without adding a label on the map.

### Transport modes & animation

| `transportMode` | Icon | Line style | Curve |
|---|---|---|---|
| `campervan` | 🚐 campervan SVG | Solid | Straight polyline |
| `plane` | ✈️ plane SVG | Dashed | Great-circle arc (Leaflet.Geodesic) |
| `ferry` | ⛴️ ferry SVG | Dotted | Straight polyline |
| _(omitted)_ | 📍 pin | Solid | Straight polyline |

The icon **rotates to face the direction of travel** and swaps automatically when `transportMode` changes between sections.

### Speed unit: km per animation-second

A speed of `300` means the icon covers 300 real-world km per second of screen time.

- Stockholm → Copenhagen (~520 km) at speed 300 → ~1.7 s
- A 2000 km flight at speed 800 → 2.5 s
- A short 80 km ferry at speed 150 → ~0.5 s

Zoom-independent — consistent regardless of map zoom level.

### Performance note

With ~100 stops across all sections, path points are pre-computed once on load. The animation loop uses `requestAnimationFrame` and updates only the trailing polyline and icon position each frame. Leaflet handles this comfortably at Europe scale.

---

## Application Structure

```
where-am-i/
├── public/
│   └── icons/
│       ├── campervan.svg
│       ├── plane.svg
│       └── ferry.svg
├── src/
│   ├── data/
│   │   └── trip.json               # Single trip with sections
│   ├── components/
│   │   ├── Map.tsx                 # Leaflet map wrapper
│   │   ├── SectionRoute.tsx        # Renders one section's polyline (overview + animated reveal)
│   │   ├── TravelIcon.tsx          # Moving icon marker (rotates, swaps per mode)
│   │   ├── StopLabel.tsx           # City name label that pops in on the map
│   │   ├── MediaPopover.tsx        # Fullscreen media overlay with segmented progress bar
│   │   └── BottomSheet.tsx         # Expandable section list + playback controls
│   ├── hooks/
│   │   └── useRouteAnimation.ts    # requestAnimationFrame loop, position interpolation
│   ├── lib/
│   │   └── geo.ts                  # Geodesic interpolation, km distance, bearing calc
│   ├── types.ts                    # Trip, Section, Stop, TransportMode types
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

---

## UI Layout

Mobile-first. The map always fills the entire screen; the section list overlays it.

---

### Mobile — bottom sheet

#### Collapsed (default)

```
┌─────────────────────────────┐
│                             │
│        Leaflet Map          │
│     (full screen)           │
│   🚐══════●─ ─ ─ ─          │
│                             │
├─────────────────────────────┤  ← drag handle
│  ✓ Copenhagen               │
│  ▶ Hamburg        [▶ ][■ ]  │  ← active row + controls
│  · Amsterdam                │
└─────────────────────────────┘
  (3 rows visible)
```

#### Expanded (drag up or tap handle)

```
┌─────────────────────────────┐
│                             │
│        Leaflet Map          │
│     (top 50% of screen)     │
│                             │
├─────────────────────────────┤  ← drag handle
│  ✓ Stockholm                │
│  ✓ Gothenburg               │
│  ✓ Copenhagen               │  ↑ scrollable list
│  ▶ Hamburg        [▶ ][■ ]  │  ← active, auto-scrolled to
│  · Amsterdam                │
│  · Paris                    │
└─────────────────────────────┘
  (50% of screen height)
```

#### Mobile behavior

- **Collapsed** — shows exactly 3 rows; the active section is always among them (list snaps so active row stays visible)
- **Expanded** — grows to 50% of screen height; scrollable; auto-scrolls to keep the active section in view as animation plays
- **Drag handle** — swipe up/down or tap to toggle

---

### Desktop — top-right panel

```
┌────────────────────────────────────────────┐
│ [+]                        ┌─────────────┐ │
│ [−]                        │  Europe 2025│ │
│        Leaflet Map         ├─────────────┤ │
│                            │ ✓ Stockholm │ │
│   🚐══════●─ ─ ─ ─         │ ✓ Gothenburg│ │
│                            │ ▶ Hamburg   │ │  ← scrollable
│                            │ · Amsterdam │ │
│                            │ · Paris     │ │
│                            ├─────────────┤ │
│                            │  [▶ ][■ ]   │ │  ← controls
│                            └─────────────┘ │
└────────────────────────────────────────────┘
```

#### Desktop behavior

- Fixed-width panel (~280px) anchored to the top-right, floating over the map
- Scrollable list of all sections; auto-scrolls to keep the active section in view
- Collapsed/expanded toggle not needed — panel is always fully visible
- Play / Pause and Reset controls pinned to the bottom of the panel
- Active section highlighted with the theme color

---

### Shared behavior (both layouts)

- **Active row** — highlighted with the theme color
- **Overview lines** — all routes drawn at 100% opacity on load
- **During playback** — only lines and labels behind the icon are visible; everything ahead is hidden until the icon reaches it
- **Completed sections** — remain visible at full opacity once the icon has passed
- **Icon** — moves along path, rotates to face direction of travel, swaps SVG on mode change
- **Named sections** — all labels visible in overview; hidden ahead of the icon during playback, revealed as the icon arrives
- **Map viewport** — on load fits the entire trip; when playback starts zooms in ~2 levels with a smooth transition, then auto-pans to follow the icon; Reset zooms back out to fit the whole trip
- **Zoom controls** — custom +/− buttons in the top-left corner; default zoom set to fit the whole trip on load; user can zoom freely at any time without disrupting auto-pan

---

## Animation System

### Page load — overview state

On load, before any interaction:
1. All section lines are drawn immediately at **100% opacity** — the full trip is visible
2. All named-section labels are shown on the map
3. The map fits and zooms to the bounding box of the entire trip (Leaflet `fitBounds`)
4. No icon is shown; no animation is running

This gives the user the complete picture of the journey before they press Play.

### Playback model

| User action | Result |
|---|---|
| Press **Play** | Map zooms in ~2 levels from the overview zoom with a smooth transition, then animation starts from the first section |
| Press **Play** on a specific section row | Map zooms in ~2 levels, then animation starts from that section; all preceding sections treated as complete |
| Press **Pause** | Icon freezes; current state preserved |
| Press **Play** again after pause | Resumes from current position |
| Press **Reset** | Returns to overview state — all lines back to overview opacity, no icon |

### Path pre-computation (on load)

1. For each section, for each leg:
   - Straight legs: `[fromStop, toStop]`
   - Plane/geodesic legs: interpolate N intermediate points along the great-circle arc
2. Tag each waypoint with cumulative distance from section start (km)
3. Store as a flat `LatLng[]` + parallel `distances[]` per section

### Playback loop (`useRouteAnimation`)

Each `requestAnimationFrame`:
1. Advance `distanceTraveled += speed * deltaTime` (active leg's speed)
2. Binary-search `distances[]` → interpolate current `LatLng`
3. Slice waypoints up to current position → update trailing `Polyline` at full opacity
4. Move `TravelIcon` to current `LatLng`
5. Compute bearing → rotate icon
6. Check if icon has passed the next stop:
   - Always: advance leg, swap icon SVG if `transportMode` changed
   - If section has `name`: reveal its label on the map
   - If section has `media`: pause animation, open media popover, cycle through each item at 1 s each, then resume
7. Auto-pan the map to keep the icon centered (`panTo` with no animation lag — smooth follow)
8. On section complete: section line locks to full opacity; animation continues into next section automatically

### Trip state machine

```
overview → playing ⇄ media → overview (reset)
              ↕
           paused
```

- **overview** — all lines at 100% opacity, all labels visible, no icon
- **playing** — icon animating; lines and labels behind the cursor visible, everything ahead hidden
- **media** — animation paused; media popover open; cycles through `media` items at 1 s each; returns to **playing** when done
- **paused** — icon frozen; state preserved (user-triggered; distinct from media pause)
- No per-section state — the single cursor position determines what's complete vs upcoming

### Controls

- **Play / Pause** — global; starts from beginning or resumes from current position
- **Reset** — returns to overview state
- **Click a section row** — jumps to that section and starts playing from it

---

## Visual Design Notes

- **Single line color** — one theme color for all sections; defined in `src/lib/config.ts`, not in the data file
- Named sections: small filled circle + name text; scale-in animation on reveal
- Icon rotates smoothly using CSS `transform: rotate()`
- **Media popover** — fullscreen overlay (dark backdrop); images use `object-fit: cover`; videos autoplay muted
  - **Images** — shown for 1 second, then auto-advance
  - **Videos** — shown for the full duration of the video, then auto-advance
  - **Progress bar** — segmented bar across the top (one segment per media item, Instagram-style); each segment fills at its own rate (1 s for images, video duration for videos)
  - **Click/tap right half** — skip to next item immediately; if no more items, close popover and resume animation
  - **Click/tap left half** — go back to the previous item; no-op if already on the first item
  - **Press and hold** — pauses the current item's timer/video playback for as long as the pointer/finger is held; releasing resumes from where it paused

---

## Open Questions

- ~~Styling approach~~ → **Tailwind CSS v4 + shadcn/ui** ✓
- ~~Line style~~ → **straight polylines; plane legs use great-circle arcs** ✓
- ~~Single or per-trip color~~ → **single global theme color** ✓
- ~~Animation speed~~ → **km/animation-second, global default + per-leg `speed` override** ✓
- ~~Stop labels~~ → **`name` is optional; if present, pops in on the map. No `name` = silent waypoint.** ✓
- ~~One trip or multiple~~ → **one trip, multiple sections; completed sections stay painted** ✓
- ~~Map viewport~~ → **fits whole trip on load; auto-pans to follow icon during playback; custom +/− zoom buttons top-left** ✓
- Stats panel: countries visited, total km, months on the road?
- Dark mode / alternative tile style?

---

## Out of Scope for v1 (possible v2 features)

- Click-to-add stops directly on the map
- Photo attachments per stop
- Filter/search by date or country
- Export to KML/GeoJSON
- Scrubber / timeline bar to seek to any point in the animation
