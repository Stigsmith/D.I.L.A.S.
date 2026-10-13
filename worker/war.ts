/**
 * The live war: who holds each planet, where the fighting is, and how it is
 * going.
 *
 * ## A snapshot, fetched on a schedule
 *
 * A Cron Trigger calls `refreshWar` every five minutes (`wrangler.jsonc`), and
 * it keeps one trimmed row in D1. `GET /api/war` hands that row out with its
 * age. So the community API behind this is called four times every five
 * minutes, whether one person has the map open or a thousand, which is the
 * polite way to use a service somebody runs for free: the planets, the game's
 * raw status (campaigns, effects, attack lines, drifted planets), the Major
 * Order, and the war's running totals. Once an hour a fifth asks for the
 * space station. Its published limit is 5 requests in 10 seconds, and no run
 * asks more than 5. Once an hour too, the game's own server is asked for how
 * scarred each planet is, a request that costs the community API nothing.
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

/**
 * What the game's own status adds to the map, by planet name, read from
 * `/raw/api/WarSeason/<WAR_ID>/Status`. All of it is the game's fact and
 * none of it is named: an effect is a bare number, and what it is called is
 * the browser's curated table, never the server's.
 */
export type WarMarks = {
  /** Every planet carrying an effect, and its effect numbers. */
  effects: Record<string, number[]>
  /** Which planet attacks which, as the game draws its attack lines. */
  attacks: [string, string][]
  /**
   * A planet the live status places away from the fixed position the
   * planet list gives: the black hole drifts. Map units, as the upstream
   * sends them.
   */
  moved: Record<string, { x: number; y: number }>
  /**
   * Where the space station is and when its vote ends, from the same status,
   * so the marker never waits on the hourly station request. Null when the
   * status lists none. Older snapshots lack it.
   */
  station?: { planet: string; electionEnd: string } | null
}

/** The Democracy Space Station, from `/api/v2/space-stations`, refreshed once an hour. */
export type WarStation = {
  planet: string
  electionEnd: string
  actions: { name: string; description: string }[]
}

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
  /** Effects, attack lines and moved planets as of the same fetch, or null when the status could not be read. */
  marks: WarMarks | null
  /** The space station and when it was read, or null. Kept in its own row, so it has its own age. */
  station: (WarStation & { fetchedAt: number }) | null
  /** How scarred each planet is and when it was read, or null. Its own row, like the station. */
  scars: (WarScars & { fetchedAt: number }) | null
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

  /* Either shape: the community API's `planet.index`, or the game's raw
     status, which names the planet by `planetIndex`. */
  const active = new Set<number>()
  for (const c of campaigns) {
    const index = record(record(c)?.planet)?.index ?? record(c)?.planetIndex
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
 * The war season the raw status is read from. It has been 801 since the war
 * began in January 2024 and changes only with a new season; a wrong one
 * answers 404, which loses the marks and nothing else.
 */
export const WAR_ID = 801

/** Caps on what the marks keep from a strange answer. Today: 131 effects, 68 attacks, 1 moved planet. */
const MAX_EFFECT_PLANETS = 400
const MAX_EFFECTS_EACH = 16
const MAX_ATTACKS = 400
const MAX_MOVED = 50

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * The game's raw status, joined to names through the planet list from the
 * same run. Pure. Null when either is not the shape expected, which leaves
 * the marks absent and the war standing.
 */
export function trimMarks(planets: unknown, status: unknown, now: number = Date.now()): WarMarks | null {
  const s = record(status)
  if (!Array.isArray(planets) || !s) return null
  const nameOf = new Map<number, string>()
  const fixedAt = new Map<number, { x: number; y: number }>()
  for (const raw of planets) {
    const p = record(raw)
    if (!p || typeof p.name !== 'string' || !finite(p.index)) continue
    nameOf.set(p.index, p.name.slice(0, 80))
    const at = record(p.position)
    if (at && finite(at.x) && finite(at.y)) fixedAt.set(p.index, { x: at.x, y: at.y })
  }

  const effects: Record<string, number[]> = {}
  let effectPlanets = 0
  for (const raw of Array.isArray(s.planetActiveEffects) ? s.planetActiveEffects : []) {
    const e = record(raw)
    const name = e && finite(e.index) ? nameOf.get(e.index) : undefined
    const id = e?.galacticEffectId
    if (!name || !finite(id) || !Number.isInteger(id) || id < 0) continue
    if (!effects[name]) {
      if (effectPlanets >= MAX_EFFECT_PLANETS) continue
      effects[name] = []
      effectPlanets += 1
    }
    if (effects[name].length < MAX_EFFECTS_EACH && !effects[name].includes(id)) effects[name].push(id)
  }

  const attacks: [string, string][] = []
  for (const raw of Array.isArray(s.planetAttacks) ? s.planetAttacks : []) {
    const a = record(raw)
    const from = a && finite(a.source) ? nameOf.get(a.source) : undefined
    const to = a && finite(a.target) ? nameOf.get(a.target) : undefined
    if (from && to && from !== to && attacks.length < MAX_ATTACKS) attacks.push([from, to])
  }

  /* A position that differs from the fixed one by more than rounding. */
  const moved: Record<string, { x: number; y: number }> = {}
  let movedCount = 0
  for (const raw of Array.isArray(s.planetStatus) ? s.planetStatus : []) {
    const p = record(raw)
    const at = record(p?.position)
    if (!p || !finite(p.index) || !at || !finite(at.x) || !finite(at.y)) continue
    const fixed = fixedAt.get(p.index)
    const name = nameOf.get(p.index)
    if (!fixed || !name || movedCount >= MAX_MOVED) continue
    if (Math.abs(fixed.x - at.x) < 1e-4 && Math.abs(fixed.y - at.y) < 1e-4) continue
    if (Math.abs(at.x) > 1.5 || Math.abs(at.y) > 1.5) continue
    moved[name] = { x: at.x, y: at.y }
    movedCount += 1
  }

  /* The vote's end is in war seconds, the clock `time` also reads, so it is
     that far from now. Checked against the community API's own conversion. */
  let station: WarMarks['station'] = null
  const first = record(Array.isArray(s.spaceStations) ? s.spaceStations[0] : null)
  const stationAt = first && finite(first.planetIndex) ? nameOf.get(first.planetIndex) : undefined
  if (stationAt) {
    const left = finite(first?.currentElectionEndWarTime) && finite(s.time) ? first.currentElectionEndWarTime - s.time : NaN
    const ends = Number.isFinite(left) && Math.abs(left) < 30 * 86400 ? new Date(now + left * 1000).toISOString() : ''
    station = { planet: stationAt, electionEnd: ends }
  }
  return { effects, attacks, moved, station }
}

/**
 * The first space station, down to its planet, when its vote ends, and its
 * tactical actions by name. Pure. Null when there is none.
 */
export function trimStation(stations: unknown): WarStation | null {
  if (!Array.isArray(stations)) return null
  const s = record(stations[0])
  const planet = record(s?.planet)
  if (!s || !planet || typeof planet.name !== 'string') return null
  const text = (v: unknown, cap: number) => (typeof v === 'string' ? v.slice(0, cap) : '')
  const actions = (Array.isArray(s.tacticalActions) ? s.tacticalActions : [])
    .slice(0, 8)
    .map((raw) => {
      const a = record(raw)
      return { name: text(a?.name, 60), description: text(a?.description, 400) }
    })
    .filter((a) => a.name)
  return { planet: planet.name.slice(0, 80), electionEnd: text(s.electionEnd, 40), actions }
}

/**
 * The upstream refuses any request that does not name its client and a
 * contact, both, with a 400. Its README still calls the contact optional; the
 * service does not. `SUPER_CLIENT` and `SUPER_CONTACT` in `wrangler.jsonc`,
 * where the contact is a placeholder until the curator picks a project address.
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
/**
 * Every run asks four things at once: the planets, the game's raw status
 * (which carries the campaigns as well as the marks), the Major Order and
 * the totals. A fifth is asked only when needed: the community campaign
 * list when the raw status failed, or else, once an hour, the space
 * station. So a run never passes the upstream's 5 requests in 10 seconds.
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
    const [planets, status, assignments, totals] = await Promise.all([
      ask(fetcher, '/api/v1/planets', identity.client, identity.contact),
      ask(fetcher, `/raw/api/WarSeason/${WAR_ID}/Status`, identity.client, identity.contact).catch(() => null),
      ask(fetcher, '/api/v1/assignments', identity.client, identity.contact).catch(() => null),
      ask(fetcher, '/api/v1/war', identity.client, identity.contact).catch(() => null),
    ])
    const fromStatus = record(status)?.campaigns
    const campaigns = Array.isArray(fromStatus)
      ? fromStatus
      : await ask(fetcher, '/api/v1/campaigns', identity.client, identity.contact)
    const trimmed = trimWar(planets, campaigns)
    if (!trimmed) throw new Error('the answer was not a list of planets and a list of campaigns')
    const stats = trimStats(totals)
    const marks = trimMarks(planets, status, now)
    const payload = JSON.stringify({ planets: trimmed, order: trimOrder(assignments), stats, marks })
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('war', ${payload}, ${now}, ${now}, 1, null)
      on conflict(id) do update set
        payload = excluded.payload, fetched_at = excluded.fetched_at,
        tried_at = excluded.tried_at, ok = 1, error = null
    `)
    /* The history is context too: if keeping it fails, the snapshot above
       has already landed and stays. */
    const kept = await keepHistory(db, now, trimmed, stats).catch(() => false)
    /* The station's planet and vote ride on the status above; this asks only
       for its tactical actions. On the hourly run, or whenever the last try
       failed (the upstream answers 429 at times, its limit shared with
       whoever else calls from the same address), and only when the campaign
       list was not the fifth. */
    if (Array.isArray(fromStatus) && (kept || !(await stationFresh(db)))) {
      await refreshStation(db, identity, fetcher, now).catch(() => false)
    }
    /* The scarring changes when the war razes a planet, which is rare: the
       hourly run, or when none has been read yet. */
    if (kept || !(await hasScars(db))) await refreshScars(db, planets, fetcher, now).catch(() => false)
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

/** How old a station may be before it is not served: two missed hours. */
export const STATION_TOO_OLD_MS = 3 * 60 * 60 * 1000

/** Whether the last station try worked. False when none has been read yet. */
async function stationFresh(db: DB): Promise<boolean> {
  const row = await db.get<{ fetched_at: number | null; ok: number }>(sql`select fetched_at, ok from war_snapshot where id = 'station'`)
  return Boolean(row && row.fetched_at !== null && row.ok === 1)
}

/**
 * The space station, into its own row of the snapshot table, so it keeps its
 * own age. A failure leaves the last good one, as the war's row does; no
 * station at all (between stations) is stored as an empty payload.
 */
export async function refreshStation(db: DB, identity: { client: string; contact: string }, fetcher: Fetcher, now: number): Promise<boolean> {
  try {
    const station = trimStation(await ask(fetcher, '/api/v2/space-stations', identity.client, identity.contact))
    const payload = JSON.stringify(station)
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('station', ${payload}, ${now}, ${now}, 1, null)
      on conflict(id) do update set
        payload = excluded.payload, fetched_at = excluded.fetched_at,
        tried_at = excluded.tried_at, ok = 1, error = null
    `)
    return true
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 200)
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('station', null, null, ${now}, 0, ${error})
      on conflict(id) do update set tried_at = excluded.tried_at, ok = 0, error = excluded.error
    `)
    return false
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
  let doc: { planets?: WarPlanet[]; order?: WarOrder | null; stats?: WarStats | null; marks?: WarMarks | null }
  try {
    doc = JSON.parse(row.payload) as typeof doc
  } catch {
    return null
  }
  if (!Array.isArray(doc.planets)) return null
  return {
    fetchedAt: row.fetched_at, triedAt: row.tried_at, ok: row.ok === 1,
    planets: doc.planets, order: doc.order ?? null, stats: doc.stats ?? null, marks: doc.marks ?? null,
    station: withStatus(doc.marks?.station, await readStation(db, row.fetched_at), row.fetched_at),
    scars: await readScars(db, row.fetched_at),
  }
}

/**
 * How scarred each planet is, from the game's own client configuration: the
 * one public answer Arrowhead serves directly that the community API does not
 * pass on. Planets razed by the enemy carry a figure, 0 to 100: Mars is 100,
 * the scorched Altus worlds 50. Read once an hour with the station. The
 * Helldivers 2 Companion found where the game files it, 12 October 2026.
 */
export const GAME_CONFIG = 'https://api.live.prod.thehelldiversgame.com/api/Configuration/GameClient'
const SCAR_MIX = 1787495693
const MAX_SCARS = 400

/** Scarring by the upstream's planet name, and by the game's hash for a planet the war does not list (Mars). */
export type WarScars = { planets: Record<string, number>; hashes: Record<string, number> }

export function trimScars(planets: unknown, config: unknown): WarScars | null {
  const list = record(config)?.onlineOverrideConfiguration
  if (!Array.isArray(list) || !Array.isArray(planets)) return null
  const byHash = new Map<number, string>()
  for (const p of planets) {
    const r = record(p)
    if (r && typeof r.hash === 'number' && typeof r.name === 'string') byHash.set(r.hash, r.name)
  }
  const out: WarScars = { planets: {}, hashes: {} }
  let kept = 0
  for (const entry of list) {
    const r = record(entry)
    if (!r || r.enabled !== true || r.parentMixId !== SCAR_MIX || r.dataType !== 6) continue
    const value = Number(r.data)
    if (typeof r.id32 !== 'number' || !Number.isFinite(value) || value <= 0) continue
    if (++kept > MAX_SCARS) break
    const scar = Math.min(100, Math.round(value))
    const name = byHash.get(r.id32)
    if (name) out.planets[name] = scar
    else out.hashes[String(r.id32)] = scar
  }
  return out
}

async function hasScars(db: DB): Promise<boolean> {
  const row = await db.get<{ fetched_at: number | null }>(sql`select fetched_at from war_snapshot where id = 'scars'`)
  return Boolean(row && row.fetched_at !== null)
}

/**
 * The scarring, into its own row, the station's way: a failure leaves the
 * last good one with its own age. The game's server, not the community API,
 * so none of that API's five requests are spent on it.
 */
export async function refreshScars(db: DB, planets: unknown, fetcher: Fetcher, now: number): Promise<boolean> {
  try {
    const response = await fetcher(GAME_CONFIG, {
      headers: { accept: 'application/json', 'accept-language': 'en-US' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`the game's configuration answered ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_ANSWER) throw new Error(`the game's configuration answered with ${text.length} characters`)
    const scars = trimScars(planets, JSON.parse(text))
    if (!scars) throw new Error("the game's configuration was not the shape expected")
    const payload = JSON.stringify(scars)
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('scars', ${payload}, ${now}, ${now}, 1, null)
      on conflict(id) do update set
        payload = excluded.payload, fetched_at = excluded.fetched_at,
        tried_at = excluded.tried_at, ok = 1, error = null
    `)
    return true
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 200)
    await db.run(sql`
      insert into war_snapshot (id, payload, fetched_at, tried_at, ok, error)
      values ('scars', null, null, ${now}, 0, ${error})
      on conflict(id) do update set tried_at = excluded.tried_at, ok = 0, error = excluded.error
    `)
    return false
  }
}

/** The kept scarring, when it is at most three hours older than the war it rides on. */
async function readScars(db: DB, warAt: number): Promise<Snapshot['scars']> {
  const row = await db.get<{ payload: string | null; fetched_at: number | null }>(
    sql`select payload, fetched_at from war_snapshot where id = 'scars'`,
  )
  if (!row || row.payload === null || row.fetched_at === null) return null
  if (warAt - row.fetched_at > STATION_TOO_OLD_MS) return null
  try {
    const scars = JSON.parse(row.payload) as WarScars
    return { ...scars, fetchedAt: row.fetched_at }
  } catch {
    return null
  }
}

/**
 * The station as the status places it, with the actions from the station's
 * own row when that row is about the same planet. Without a status reading
 * (an older snapshot), the row alone, as before.
 */
function withStatus(
  fromStatus: WarMarks['station'] | undefined,
  kept: Snapshot['station'],
  warAt: number,
): Snapshot['station'] {
  if (!fromStatus) return fromStatus === null ? null : kept
  const same = kept && kept.planet.toUpperCase() === fromStatus.planet.toUpperCase()
  return {
    planet: fromStatus.planet,
    electionEnd: fromStatus.electionEnd || (same ? kept.electionEnd : ''),
    actions: same ? kept.actions : [],
    fetchedAt: warAt,
  }
}

/** The kept station, when it is at most three hours older than the war it rides on. */
async function readStation(db: DB, warAt: number): Promise<Snapshot['station']> {
  const row = await db.get<{ payload: string | null; fetched_at: number | null }>(
    sql`select payload, fetched_at from war_snapshot where id = 'station'`,
  )
  if (!row || row.payload === null || row.fetched_at === null) return null
  if (warAt - row.fetched_at > STATION_TOO_OLD_MS) return null
  try {
    const station = JSON.parse(row.payload) as WarStation | null
    return station ? { ...station, fetchedAt: row.fetched_at } : null
  } catch {
    return null
  }
}
