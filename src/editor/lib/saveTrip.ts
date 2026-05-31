import type { Trip } from '@/types'

// Posts the working trip to the dev-only middleware (see vite-plugin-trip-saver.ts),
// which writes it back to src/data/trip.json.
export async function saveTrip(trip: Trip): Promise<void> {
  const res = await fetch('/__save-trip', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(trip),
  })
  if (!res.ok) {
    let message = `Save failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(message)
  }
}
