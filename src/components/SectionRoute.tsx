import { Polyline } from 'react-leaflet'
import L from 'leaflet'
import type { PathData } from '@/lib/geo'
import type { PlayState, TransportMode } from '@/types'
import { ROUTE_COLOR } from '@/lib/config'

interface Props {
  path: PathData
  traveledPoints: L.LatLng[]
  playState: PlayState
}

function lineOptions(mode?: TransportMode): L.PathOptions {
  const base = { color: ROUTE_COLOR, weight: 3, opacity: 0.7 }
  if (mode === 'plane') return { ...base, dashArray: '8 6' }
  if (mode === 'ferry') return { ...base, dashArray: '2 6' }
  return base
}

// Group an ordered point list into runs of consecutive same-mode segments,
// using path.pointModes as the per-index mode lookup. The boundary point
// between two runs is shared so the rendered lines connect without a gap.
function groupByMode(
  points: L.LatLng[],
  pointModes: (TransportMode | undefined)[],
): { points: L.LatLng[]; mode: TransportMode | undefined }[] {
  const runs: { points: L.LatLng[]; mode: TransportMode | undefined }[] = []
  if (points.length < 2) return runs
  let runStart = 0
  for (let i = 1; i < points.length; i++) {
    const atEnd = i === points.length - 1
    const modeChangesNext = !atEnd && pointModes[i + 1] !== pointModes[i]
    if (atEnd || modeChangesNext) {
      runs.push({
        points: points.slice(runStart, i + 1),
        mode: pointModes[i],
      })
      runStart = i
    }
  }
  return runs
}

export default function SectionRoute({ path, traveledPoints, playState }: Props) {
  const isOverview = playState === 'overview'
  // Overview shows the entire path; playback shows the traveled portion.
  // traveledPoints[i] aligns with path.pointModes[i] (the i-th traveled point
  // sits on the segment whose incoming mode is pointModes[i]), so the same
  // grouping function works for both.
  const runs = isOverview
    ? groupByMode(path.points, path.pointModes)
    : groupByMode(traveledPoints, path.pointModes)

  return (
    <>
      {runs.map((run, i) => (
        <Polyline
          key={`${isOverview ? 'o' : 't'}-${i}`}
          positions={run.points}
          pathOptions={lineOptions(run.mode)}
        />
      ))}
    </>
  )
}
