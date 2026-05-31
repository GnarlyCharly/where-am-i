import { writeFile, readFile, access } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

const TRIP_PATH = fileURLToPath(new URL('./src/data/trip.json', import.meta.url))
const BACKUP_PATH = fileURLToPath(new URL('./src/data/trip.backup.json', import.meta.url))

function isTripShape(v: unknown): v is { name: string; lat: number; lng: number; sections: unknown[] } {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return (
    typeof t.name === 'string' &&
    typeof t.lat === 'number' &&
    typeof t.lng === 'number' &&
    Array.isArray(t.sections)
  )
}

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

// Dev-only middleware: lets TripEditor write back to src/data/trip.json.
// apply:'serve' keeps it out of the production build of the viewer.
export function tripSaver(): Plugin {
  let backedUp = false

  return {
    name: 'trip-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-trip', (req, res, next) => {
        if (req.method !== 'POST') return next()

        void (async () => {
          try {
            const raw = await readBody(req)
            const data = JSON.parse(raw)
            if (!isTripShape(data)) {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: 'Payload is not a valid Trip' }))
              return
            }

            // One-time backup per dev session, before the first overwrite.
            if (!backedUp) {
              try {
                await access(TRIP_PATH)
                const current = await readFile(TRIP_PATH, 'utf8')
                await writeFile(BACKUP_PATH, current)
              } catch {
                // no existing file to back up — fine
              }
              backedUp = true
            }

            await writeFile(TRIP_PATH, JSON.stringify(data, null, 2) + '\n')
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error).message }))
          }
        })()
      })
    },
  }
}
