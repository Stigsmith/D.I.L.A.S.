/**
 * The live war: who holds each planet, where the fighting is, and how it is
 * going.
 *
 * ## A snapshot, fetched on a schedule
 *
 * A Cron Trigger calls `refreshWar` every five minutes (`wrangler.jsonc`), and
 * it keeps one trimmed row in D1. `GET /api/war` hands that row out with its
 * age. So the community API behind this is called 1,152 times a day, four
 * paths every five minutes, whether one person has the map open or a thousand,
 * which is the polite way to use a service somebody runs for free. Its
 * published limit is 5 requests in 10 seconds; this is 4 in 300: the planets,
 * the campaigns, the Major Order, and the war's running totals.
 *
 * ## The API decorates, it never carries
 *
 * The map is drawn from the planet table
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
 * ## And over time
 *
 * Once an hour the same run also keeps a copy in `war_history`, thirty days
 * of them, for the Star Map: how a front has moved, and how many were
 * fighting. Nobody publishes the war's history, so it starts the day the
 * server first ran. A failure there never costs the snapshot.
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

/**
 * How often the history keeps a copy: an hour, less a few minutes, so a run
 * on the five minute schedule that lands a moment early still counts.
 */
export const HISTORY_EVERY_MS = 57 * 60 * 1000

/** How long the history keeps a copy. Thirty days of hourly rows is about seven megabytes. */
export const HISTORY_KEEP_MS = 30 * 24 * 60 * 60 * 1000

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

/**
 * The Major Order, trimmed. Its tasks are kept as numbers rather than read
 * into sentences: `race` is the value the upstream marks with value type 1
 * and `goal` the one marked 3, which is how its own answer labels them. What
 * each task type means is not published, so nothing here guesses at it.
 *
 * `reward` is kept as the upstream sends it, a type and an amount. Type 1
 * reads as medals: the one real order seen, on 30 September 2026, paid
 * type 1 amount 40, and Major Orders pay medals. **That is an inference from
 * one answer**, so the number stays a number here and the browser decides
 * what to call it.
 */
export type WarOrder = {
  title: string
  briefing: string
  expiresAt: string
  tasks: { race: number | null; goal: number; progress: number }[]
  reward: { type: number; amount: number } | null
}

/**
 * The war's running totals, from `/api/v1/war`. Field names as the upstream
 * spelled them on 2 October 2026, read off a real answer. Every one is a
 * count; anything missing or not a count is 0, and the browser shows only
 * what is there. Two fields in that answer were left out because they were
 * not counts of anything: `accuracy` read 100 with more bullets hit than
 * fired, and `revives` read 2.
 */
export const STAT_FIELDS = [
  'playerCount', 'terminidKills', 'automatonKills', 'illuminateKills',
  'deaths', 'bulletsFired', 'missionsWon', 'missionsLost',
] as const

export type WarStats = Record<(typeof STAT_FIELDS)[number], number>

export type Snapshot = {
  fetchedAt: number
  triedAt: number
  /** Whether the latest try worked. False with a payload means the payload is older than the try. */
  ok: boolean
  planets: WarPlanet[]
  /** The Major Order as of the same fetch, or null when there is none or it could not be read. */
  order: WarOrder | null
  /** The war's running totals as of the same fetch, or null when they could not be read. */
  stats: WarStats | null
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
 * The first assignment, which is the Major Order, down to what the map shows.
 * Pure. Null when there is none, or when what arrived is not one.
 *
 * Task values arrive as two parallel lists, the values and what kind each one
 * is. Read on 30 September 2026 off a real answer: kind 1 is the faction (2
 * Terminids, 3 Automatons, 4 Illuminate, the game's own numbering), kind 3 is
 * the goal, and the order's `progress` list runs in step with its tasks.
 */
export function trimOrder(assignments: unknown): WarOrder | null {
  if (!Array.isArray(assignments)) return null
  const a = record(assignments[0])
  if (!a) return null
  const text = (v: unknown, cap: number) => (typeof v === 'string' ? v.slice(0, cap) : '')
  const briefing = text(a.briefing, 600) || text(a.description, 600)
  const expiresAt = text(a.expiration, 40)
  if (!briefing || !expiresAt) return null
  const progress = Array.isArray(a.progress) ? a.progress : []
  const tasks = (Array.isArray(a.tasks) ? a.tasks : []).slice(0, 8).map((raw, i) => {
    const t = record(raw)
    const values = Array.isArray(t?.values) ? t.values : []
    const kinds = Array.isArray(t?.valueTypes) ? t.valueTypes : []
    const of = (kind: number) => {
      const at = kinds.indexOf(kind)
      return at >= 0 ? values[at] : undefined
    }
    const race = of(1)
    return { race: typeof race === 'number' && Number.isInteger(race) ? race : null, goal: amount(of(3)), progress: amount(progress[i]) }
  })
  const r = record(a.reward) ?? record(Array.isArray(a.rewards) ? a.rewards[0] : null)
  const reward = r && typeof r.type === 'number' && Number.isInteger(r.type) && amount(r.amount) > 0
    ? { type: r.type, amount: amount(r.amount) }
    : null
  return { title: text(a.title, 80), briefing, expiresAt, tasks, reward }
}

/**
 * The war's running totals, down to the counts the war room shows. Pure.
 * Null when what arrived has no statistics block, which the caller treats as
 * the totals being absent rather than the war failing.
 */
export function trimStats(war: unknown): WarStats | null {
  const s = record(record(war)?.statistics)
  if (!s) return null
  const out = {} as WarStats
  for (const field of STAT_FIELDS) out[field] = amount(s[field])
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
    /* The Major Order and the totals are context. If either alone fails,
       the war still lands and that part is simply absent, rather than the
       map losing its colour over a paragraph of briefing or a kill count. */
    const [planets, campaigns, assignments, totals] = await Promise.all([
      ask(fetcher, '/api/v1/planets', identity.client, identity.contact),
      ask(fetcher, '/api/v1/campaigns', identity.client, identity.contact),
      ask(fetcher, '/api/v1/assignments', identity.client, identity.contact).catch(() => null),
      ask(fetcher, '/api/v1/war', identity.client, identity.contact).catch(() => null),
    ])
    const trimmed = trimWar(planets, campaigns)
    if (!trimmed) throw new Error('the answer was not a list of planets and a list of campaigns')
    const stats = trimStats(totals)
    const payload = JSON.stringify({ planets: trimmed, order: trimOrder(assignments), stats })
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('war', ${payload}, ${now}, ${now}, 1, null)
      on conflict(id) do update set
        payload = excluded.payload, fetched_at = excluded.fetched_at,
        tried_at = excluded.tried_at, ok = 1, error = null
    `)
    /* The history is context too: if keeping it fails, the snapshot above
       has already landed and stays. */
    await keepHistory(db, now, trimmed, stats).catch(() => false)
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

/**
 * One copy an hour of what a good fetch found, and the oldest past thirty
 * days let go. Returns whether a copy was kept. The defence's end time is
 * left out: a history row is read for how far along things were, and an end
 * time from last week says nothing.
 */
export async function keepHistory(db: DB, now: number, planets: WarPlanet[], stats: WarStats | null): Promise<boolean> {
  const last = await db.get<{ at: number | null }>(sql`select max(at) as at from war_history`)
  if (last && last.at !== null && now - last.at < HISTORY_EVERY_MS) return false
  const kept = planets.map((p) => ({
    ...p,
    event: p.event ? { faction: p.event.faction, health: p.event.health, maxHealth: p.event.maxHealth } : null,
  }))
  const payload = JSON.stringify({ planets: kept, stats })
  await db.run(sql`insert or replace into war_history (at, payload) values (${now}, ${payload})`)
  await db.run(sql`delete from war_history where at < ${now - HISTORY_KEEP_MS}`)
  return true
}

/** One planet's hour in the history: the trimmed planet, without its name. */
export type HistoryPoint = { at: number } & Omit<WarPlanet, 'name' | 'event'> & {
  event: null | { faction: WarPlanet['owner']; health: number; maxHealth: number }
}

/**
 * The history as `GET /api/war/history` sends it. With a planet, that
 * planet's hours, oldest first, and only the hours something was happening
 * there. Without one, the war's own: how many were fighting and how many
 * fronts were open, each hour. `from` is the oldest copy kept, so a page can
 * say how long the server has been watching. Null when nothing is kept yet.
 */
export async function readHistory(db: DB, planet: string | null):
  Promise<null | { from: number; points: HistoryPoint[] } | { from: number; points: { at: number; players: number; fronts: number }[] }> {
  const first = await db.get<{ at: number | null }>(sql`select min(at) as at from war_history`)
  if (!first || first.at === null) return null
  if (planet !== null) {
    const rows = await db.all<{ at: number; planet: string }>(sql`
      select h.at as at, j.value as planet
      from war_history h, json_each(h.payload, '$.planets') j
      where json_extract(j.value, '$.name') = ${planet}
      order by h.at
    `)
    const points: HistoryPoint[] = []
    for (const row of rows) {
      try {
        const { name: _name, ...rest } = JSON.parse(row.planet) as WarPlanet
        points.push({ at: row.at, ...rest } as HistoryPoint)
      } catch {
        /* A row that does not parse is skipped, not served. */
      }
    }
    return { from: first.at, points }
  }
  const rows = await db.all<{ at: number; players: number | null; fronts: number }>(sql`
    select h.at as at,
      json_extract(h.payload, '$.stats.playerCount') as players,
      (select count(*) from json_each(h.payload, '$.planets') j where json_extract(j.value, '$.campaign') = 1) as fronts
    from war_history h
    order by h.at
  `)
  return { from: first.at, points: rows.map((r) => ({ at: r.at, players: amount(r.players), fronts: amount(r.fronts) })) }
}

/** The snapshot as `GET /api/war` sends it, or null when no fetch has ever worked. */
export async function readWar(db: DB): Promise<Snapshot | null> {
  const row = await db.get<{ payload: string | null; fetched_at: number | null; tried_at: number; ok: number }>(
    sql`select payload, fetched_at, tried_at, ok from war_snapshot where id = 'war'`,
  )
  if (!row || row.payload === null || row.fetched_at === null) return null
  let doc: { planets?: WarPlanet[]; order?: WarOrder | null; stats?: WarStats | null }
  try {
    doc = JSON.parse(row.payload) as typeof doc
  } catch {
    return null
  }
  if (!Array.isArray(doc.planets)) return null
  return {
    fetchedAt: row.fetched_at, triedAt: row.tried_at, ok: row.ok === 1,
    planets: doc.planets, order: doc.order ?? null, stats: doc.stats ?? null,
  }
}
