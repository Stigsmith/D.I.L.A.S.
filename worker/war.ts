/**
 * The live war: who holds each planet, where the fighting is, and how it is
 * going. Stage 6 of `dds-cloudflare-handover.md`, built the way that plan
 * designed it.
 *
 * ## A snapshot, fetched on a schedule
 *
 * A Cron Trigger calls `refreshWar` every five minutes (`wrangler.jsonc`), and
 * it keeps one trimmed row in D1. `GET /api/war` hands that row out with its
 * age. So the community API behind this is called 576 times a day, two paths
 * every five minutes, whether one person has the map open or a thousand, which
 * is the polite way to use a service somebody runs for free. Its published
 * limit is 5 requests in 10 seconds; this is 2 in 300.
 *
 * ## The API decorates, it never carries
 *
 * `dds-roadmap.md`, "The live starmap". The map is drawn from the planet table
 * the browser already ships. This only colours it in, and if it is down, old
 * or wrong, the browser draws the map uncoloured and says why. Nothing here is
 * on the critical path of choosing a planet.
 *
 * ## The server has no opinion about planets
 *
 * No copy of the planet table lives in the Worker. Planets go out by the
 * upstream's own name and every browser joins them to its own table by name,
 * the same way the build-time fetch does. The server trims and bounds; the
 * browser cleans what it receives.
 *
 * ## Ten milliseconds
 *
 * The free plan gives a Cron Trigger 10 ms of CPU. Parsing and trimming the
 * 300 KB planet answer measured 1.5 ms in node on 29 September 2026; waiting
 * on the network is not CPU and does not count.
 */

import { sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import * as schema from './schema.ts'

export const UPSTREAM = 'https://api.helldivers2.dev'

/**
 * Long enough for a slow answer, short enough that a hung one ends the run.
 * The service took ten seconds to answer a bare request on 30 September 2026,
 * and an eight second limit timed out against it. Waiting is not CPU, so a
 * long wait costs the ten millisecond allowance nothing.
 */
export const TIMEOUT_MS = 20_000

/** The planet list is about 300 KB. Anything past this is not an answer to trust. */
export const MAX_ANSWER = 2 * 1024 * 1024

/** Who can hold a planet, as the upstream spells it. Anything else is not drawn. */
export const OWNERS = ['Humans', 'Automaton', 'Terminids', 'Illuminate'] as const

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export type WarPlanet = {
  /** The upstream's name, upper case. The browser joins it to its own table. */
  name: string
  owner: (typeof OWNERS)[number]
  health: number
  maxHealth: number
  players: number
  /** Whether there is an active campaign here, which is what you can drop on. */
  campaign: boolean
  /** A defence: who is attacking, how far along, and when it ends. */
  event: null | { faction: (typeof OWNERS)[number]; health: number; maxHealth: number; endTime: string }
}

export type Snapshot = {
  fetchedAt: number
  triedAt: number
  /** Whether the latest try worked. False with a payload means the payload is older than the try. */
  ok: boolean
  planets: WarPlanet[]
}

type DB = DrizzleD1Database<typeof schema>

const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)

const owner = (v: unknown) => (OWNERS as readonly unknown[]).includes(v) ? (v as WarPlanet['owner']) : null

/**
 * The upstream's planets and campaigns, down to what the map draws. Pure.
 *
 * **A planet Super Earth holds with nothing happening on it is left out**, and
 * that absence means exactly that. It is most of the galaxy, so the snapshot
 * is a few kilobytes rather than three hundred. Returns null when either answer
 * is not a list, which the caller treats as a failed fetch.
 */
export function trimWar(planets: unknown, campaigns: unknown): WarPlanet[] | null {
  if (!Array.isArray(planets) || !Array.isArray(campaigns)) return null

  const active = new Set<number>()
  for (const c of campaigns) {
    const index = record(record(c)?.planet)?.index
    if (typeof index === 'number' && Number.isInteger(index)) active.add(index)
  }

  const out: WarPlanet[] = []
  for (const raw of planets) {
    const p = record(raw)
    if (!p || typeof p.name !== 'string' || typeof p.index !== 'number') continue
    const held = owner(p.currentOwner)
    if (!held) continue
    const e = record(p.event)
    const attacker = e ? owner(e.faction) : null
    const event = e && attacker
      ? {
          faction: attacker,
          health: amount(e.health),
          maxHealth: amount(e.maxHealth),
          endTime: typeof e.endTime === 'string' ? e.endTime.slice(0, 40) : '',
        }
      : null
    const campaign = active.has(p.index)
    if (held === 'Humans' && !campaign && !event) continue
    out.push({
      name: p.name.slice(0, 80),
      owner: held,
      health: amount(p.health),
      maxHealth: amount(p.maxHealth),
      players: amount(record(p.statistics)?.playerCount),
      campaign,
      event,
    })
  }
  return out
}

/**
 * The upstream refuses any request that does not name its client and a
 * contact, both, with a 400. Its README still calls the contact optional; the
 * service does not. `SUPER_CLIENT` and `SUPER_CONTACT` in `wrangler.jsonc`,
 * where the contact is a placeholder until stigly picks a project address.
 */
async function ask(fetcher: Fetcher, path: string, client: string, contact: string): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-super-client': client,
    'x-super-contact': contact,
  }
  const response = await fetcher(UPSTREAM + path, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  const text = await response.text()
  if (text.length > MAX_ANSWER) throw new Error(`${path} answered with ${text.length} characters`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${path} did not answer with JSON`)
  }
}

/**
 * One fetch of the war, written to D1. Never throws: a failure is recorded
 * against the row, and the last good payload stays exactly as it was, with its
 * own `fetched_at`, so its age is never disguised.
 *
 * `fetcher` is the global fetch, looked up when called rather than when this
 * module loads, so the tests can stand in for the upstream.
 */
export async function refreshWar(
  db: DB,
  identity: { client: string; contact: string },
  fetcher: Fetcher = (input, init) => fetch(input, init),
  now: number = Date.now(),
): Promise<{ ok: true; planets: number } | { ok: false; error: string }> {
  try {
    const [planets, campaigns] = await Promise.all([
      ask(fetcher, '/api/v1/planets', identity.client, identity.contact),
      ask(fetcher, '/api/v1/campaigns', identity.client, identity.contact),
    ])
    const trimmed = trimWar(planets, campaigns)
    if (!trimmed) throw new Error('the answer was not a list of planets and a list of campaigns')
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('war', ${JSON.stringify(trimmed)}, ${now}, ${now}, 1, null)
      on conflict(id) do update set
        payload = excluded.payload, fetched_at = excluded.fetched_at,
        tried_at = excluded.tried_at, ok = 1, error = null
    `)
    return { ok: true, planets: trimmed.length }
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 200)
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('war', null, null, ${now}, 0, ${error})
      on conflict(id) do update set tried_at = excluded.tried_at, ok = 0, error = excluded.error
    `)
    return { ok: false, error }
  }
}

/** The snapshot as `GET /api/war` sends it, or null when no fetch has ever worked. */
export async function readWar(db: DB): Promise<Snapshot | null> {
  const row = await db.get<{ payload: string | null; fetched_at: number | null; tried_at: number; ok: number }>(
    sql`select payload, fetched_at, tried_at, ok from war_snapshot where id = 'war'`,
  )
  if (!row || row.payload === null || row.fetched_at === null) return null
  let planets: WarPlanet[]
  try {
    planets = JSON.parse(row.payload) as WarPlanet[]
  } catch {
    return null
  }
  return { fetchedAt: row.fetched_at, triedAt: row.tried_at, ok: row.ok === 1, planets }
}
