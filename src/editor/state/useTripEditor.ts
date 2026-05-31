import { useCallback, useEffect, useReducer } from 'react'
import type { LatLngLiteral } from 'leaflet'
import tripData from '@/data/trip.json'
import type { Section, Trip, Waypoint } from '@/types'
import { saveTrip } from '@/editor/lib/saveTrip'

const initialTrip = tripData as unknown as Trip

export interface EditorState {
  trip: Trip
  selectedIndex: number | null
  dirty: boolean
  saving: boolean
  saveError: string | null
}

type Action =
  | { type: 'select'; index: number | null }
  | { type: 'updateTrip'; patch: Partial<Pick<Trip, 'name' | 'lat' | 'lng'>> }
  | { type: 'addSection' }
  | { type: 'deleteSection'; index: number }
  | { type: 'reorderSections'; from: number; to: number }
  | { type: 'updateSection'; index: number; patch: Partial<Section> }
  | { type: 'addWaypoint'; index: number; at: LatLngLiteral }
  | { type: 'updateWaypoint'; index: number; wpIndex: number; patch: Partial<Waypoint> }
  | { type: 'deleteWaypoint'; index: number; wpIndex: number }
  | { type: 'reorderWaypoints'; index: number; from: number; to: number }
  | { type: 'moveSectionPoint'; index: number; at: LatLngLiteral }
  | { type: 'moveWaypoint'; index: number; wpIndex: number; at: LatLngLiteral }
  | { type: 'saveStart' }
  | { type: 'saveSuccess' }
  | { type: 'saveError'; error: string }

function round(n: number): number {
  // 6 decimals ≈ 0.1 m precision; keeps the JSON tidy.
  return Math.round(n * 1e6) / 1e6
}

function mapSection(state: EditorState, index: number, fn: (s: Section) => Section): EditorState {
  const sections = state.trip.sections.map((s, i) => (i === index ? fn(s) : s))
  return { ...state, trip: { ...state.trip, sections }, dirty: true }
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selectedIndex: action.index }

    case 'updateTrip':
      return { ...state, trip: { ...state.trip, ...action.patch }, dirty: true }

    case 'addSection': {
      const sections = state.trip.sections
      const prev = sections[sections.length - 1]
      const base = prev ?? { lat: state.trip.lat, lng: state.trip.lng }
      const today = new Date().toISOString().slice(0, 10)
      const newSection: Section = {
        name: 'New section',
        lat: round(base.lat + 0.1),
        lng: round(base.lng + 0.1),
        date: today,
      }
      return {
        ...state,
        trip: { ...state.trip, sections: [...sections, newSection] },
        selectedIndex: sections.length,
        dirty: true,
      }
    }

    case 'deleteSection': {
      const sections = state.trip.sections.filter((_, i) => i !== action.index)
      let selectedIndex = state.selectedIndex
      if (selectedIndex !== null) {
        if (selectedIndex === action.index) selectedIndex = null
        else if (selectedIndex > action.index) selectedIndex -= 1
      }
      return { ...state, trip: { ...state.trip, sections }, selectedIndex, dirty: true }
    }

    case 'reorderSections': {
      const sections = move(state.trip.sections, action.from, action.to)
      // Keep the selection pointing at the same section after the move.
      let selectedIndex = state.selectedIndex
      if (selectedIndex === action.from) selectedIndex = action.to
      else if (selectedIndex !== null) {
        if (action.from < selectedIndex && action.to >= selectedIndex) selectedIndex -= 1
        else if (action.from > selectedIndex && action.to <= selectedIndex) selectedIndex += 1
      }
      return { ...state, trip: { ...state.trip, sections }, selectedIndex, dirty: true }
    }

    case 'updateSection':
      return mapSection(state, action.index, (s) => ({ ...s, ...action.patch }))

    case 'addWaypoint':
      return mapSection(state, action.index, (s) => ({
        ...s,
        waypoints: [...(s.waypoints ?? []), { lat: round(action.at.lat), lng: round(action.at.lng) }],
      }))

    case 'updateWaypoint':
      return mapSection(state, action.index, (s) => ({
        ...s,
        waypoints: (s.waypoints ?? []).map((w, i) =>
          i === action.wpIndex ? { ...w, ...action.patch } : w,
        ),
      }))

    case 'deleteWaypoint':
      return mapSection(state, action.index, (s) => {
        const waypoints = (s.waypoints ?? []).filter((_, i) => i !== action.wpIndex)
        const next: Section = { ...s }
        if (waypoints.length === 0) delete next.waypoints
        else next.waypoints = waypoints
        return next
      })

    case 'reorderWaypoints':
      return mapSection(state, action.index, (s) => ({
        ...s,
        waypoints: move(s.waypoints ?? [], action.from, action.to),
      }))

    case 'moveSectionPoint':
      return mapSection(state, action.index, (s) => ({
        ...s,
        lat: round(action.at.lat),
        lng: round(action.at.lng),
      }))

    case 'moveWaypoint':
      return mapSection(state, action.index, (s) => ({
        ...s,
        waypoints: (s.waypoints ?? []).map((w, i) =>
          i === action.wpIndex ? { ...w, lat: round(action.at.lat), lng: round(action.at.lng) } : w,
        ),
      }))

    case 'saveStart':
      return { ...state, saving: true, saveError: null }
    case 'saveSuccess':
      return { ...state, saving: false, dirty: false }
    case 'saveError':
      return { ...state, saving: false, saveError: action.error }

    default:
      return state
  }
}

export function useTripEditor() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    trip: structuredClone(initialTrip),
    selectedIndex: initialTrip.sections.length > 0 ? 0 : null,
    dirty: false,
    saving: false,
    saveError: null,
  }))

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!state.dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.dirty])

  const save = useCallback(async () => {
    dispatch({ type: 'saveStart' })
    try {
      await saveTrip(state.trip)
      dispatch({ type: 'saveSuccess' })
    } catch (err) {
      dispatch({ type: 'saveError', error: (err as Error).message })
    }
  }, [state.trip])

  return { state, dispatch, save }
}

export type EditorDispatch = ReturnType<typeof useTripEditor>['dispatch']
