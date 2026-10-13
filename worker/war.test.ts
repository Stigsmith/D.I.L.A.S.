/**
 * The live war, run inside workerd against a real local D1, with the upstream
 * stood in for. **No test here reaches api.helldivers2.dev**: every fetch goes
 * to a fake, and the one test that drives the Cron Trigger itself checks that
 * the fake, and not the network, was what it called.
 *
 * The rules that matter are the ones a wrong implementation would pass
 * quietly: a failed fetch disguising the age of the last good one, a quiet
 * planet bloating the snapshot, the upstream asked without the tool naming
 * itself, and a foreign page reading the answer.
 */

import { SELF, createScheduledController, env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker from './index.ts'
import * as schema from './schema.ts'
import { type Fetcher, GAME_CONFIG, HISTORY_EVERY_MS, HISTORY_KEEP_MS, UPSTREAM, WAR_ID, refreshWar, trimMarks, trimOrder, trimScars, trimStation, trimStats, trimWar } from './war.ts'

const ORIGIN = 'https://dilas.me'
const db = drizzle(env.DB, { schema })

/** Shaped like the upstream's own answer, trimmed to the fields that matter plus some that do not. */
const planet = (index: number, name: string, currentOwner: string, extra: Record<string, unknown> = {}) => ({
  index,
  name,
  sector: 'Somewhere',
  biome: { name: 'Moor', description: 'ignored' },
  hazards: [],
  position: { x: 0.1, y: 0.2 },
  waypoints: [],
  maxHealth: 1_000_000,
  health: 1_000_000,
  disabled: false,
  initialOwner: currentOwner,
  currentOwner,
  regenPerSecond: 4,
  event: null,
  statistics: { playerCount: 0, missionsWon: 12 },
  attacking: [],
  regions: [{ id: 0, name: 'IGNORED' }],
  ...extra,
})

const PLANETS = [
  planet(0, 'SUPER EARTH', 'Humans'),
  planet(1, 'QUIET HOLD', 'Humans', { hash: 1001 }),
  planet(196, 'MALEVELON CREEK', 'Automaton', { health: 250_000, statistics: { playerCount: 4210 } }),
  planet(2, 'BACKWATER', 'Terminids', { hash: 1002 }),
  planet(3, 'UNDER SIEGE', 'Humans', {
    statistics: { playerCount: 900 },
    event: {
      id: 1, eventType: 1, faction: 'Illuminate', health: 600_000, maxHealth: 2_000_000,
      startTime: '2026-09-29T00:00:00Z', endTime: '2026-09-30T12:00:00Z', campaignId: 9, jointOperationIds: [1],
    },
  }),
]
const CAMPAIGNS = [
  { id: 8, planet: PLANETS[2], type: 0, count: 1, faction: 'Automaton' },
  { id: 9, planet: PLANETS[4], type: 0, count: 1, faction: 'Illuminate' },
]

/** The Major Order exactly as the real service sent it on 30 September 2026. */
const ORDER = [{
  id: 1715805482,
  title: 'MAJOR ORDER',
  briefing: 'Kill the requisite enemies to ensure early investors in the TD-110 Maelstrom Tanks receive their promised deluxe features.',
  description: null,
  expiration: '2026-10-01T19:30:02.5980151Z',
  flags: 0,
  progress: [12759594, 2114700],
  tasks: [
    { type: 3, values: [2, 0, 25000000, 2651633799, 0, 0, 0, 0, 0, 0], valueTypes: [1, 2, 3, 4, 6, 5, 8, 9, 11, 12] },
    { type: 3, values: [3, 0, 5000000, 2664856027, 0, 0, 0, 0, 0, 0], valueTypes: [1, 2, 3, 4, 6, 5, 8, 9, 11, 12] },
  ],
  reward: { type: 1, amount: 40 },
  rewards: [{ type: 1, amount: 40 }],
}]

/** The war's totals exactly as the real service sent them on 2 October 2026, nonsense fields included. */
const WAR = {
  started: '2024-01-23T20:05:13Z', ended: '2028-02-08T20:04:55Z', now: '1972-08-18T12:30:30Z', clientVersion: '0.3.0',
  factions: ['Humans', 'Terminids', 'Automaton', 'Illuminate'], impactMultiplier: 0.028533781,
  statistics: {
    missionsWon: 1056414361, missionsLost: 102693485, missionTime: 3482065814467,
    terminidKills: 226645807204, automatonKills: 119725368690, illuminateKills: 76977223083,
    bulletsFired: 2026282813838, bulletsHit: 2225226023679, timePlayed: 3482065814467,
    deaths: 9057442173, revives: 2, friendlies: 1050259578, missionSuccessRate: 91, accuracy: 100, playerCount: 38398,
  },
}

/**
 * The game's raw status, shaped like the real one read on 12 October 2026:
 * planets by index, the campaigns, effects as bare numbers, attack lines,
 * and a position for every planet, one of which has drifted.
 */
const STATUS = {
  warId: 801,
  time: 83935560,
  planetStatus: [
    { index: 0, owner: 1, health: 1_000_000, players: 0, position: { x: 0.1, y: 0.2 } },
    { index: 196, owner: 3, health: 250_000, players: 4210, position: { x: 0.1, y: 0.2 } },
    { index: 2, owner: 2, health: 1_000_000, players: 0, position: { x: 0.35, y: 0.25 } },
  ],
  planetAttacks: [{ source: 196, target: 1 }, { source: 2, target: 2 }, { source: 999, target: 1 }],
  campaigns: [{ id: 8, planetIndex: 196, type: 0, count: 1, race: 3 }, { id: 9, planetIndex: 3, type: 0, count: 1, race: 4 }],
  planetActiveEffects: [
    { index: 2, galacticEffectId: 1229 }, { index: 2, galacticEffectId: 1229 }, { index: 3, galacticEffectId: 1190 },
    { index: 999, galacticEffectId: 5 }, { index: 1, galacticEffectId: 'gloom' },
  ],
  spaceStations: [{ id32: 749875195, planetIndex: 3, currentElectionEndWarTime: 83939990 }],
}

/** The space station as the community API sent it on 12 October 2026, trimmed. */
const STATIONS = [{
  id32: 749875195,
  planet: { index: 3, name: 'UNDER SIEGE', sector: 'Omega' },
  electionEnd: '2026-10-12T08:23:44Z',
  flags: 1,
  tacticalActions: [{ id32: 1, name: 'EAGLE STORM', description: 'DSS crews maintain a rotating fleet of Eagle Fighters.', status: 2 }],
}]

const STATUS_PATH = `/raw/api/WarSeason/${WAR_ID}/Status`

/** The game's client configuration, trimmed to the scarring mix and some that is not. Mars is a hash the war does not list. */
const SCAR = { parentMixId: 1787495693, dataType: 6, enabled: true }
const CONFIG = {
  pollingConfiguration: [{ id32: 1, interval: 60 }],
  onlineOverrideConfiguration: [
    { ...SCAR, id32: 1001, data: '50' },
    { ...SCAR, id32: 1893896155, data: '100' },
    { ...SCAR, id32: 1002, data: '20', enabled: false },
    { ...SCAR, id32: 1002, data: '30', parentMixId: 5 },
    { ...SCAR, id32: 0, data: '0' },
  ],
}

type Call = { url: string; headers: Record<string, string> }

/** A stand in for the upstream that answers from the fixtures and records what it was asked. */
function fake(answers: Partial<Record<string, () => Response>> = {}) {
  const calls: Call[] = []
  const fetcher: Fetcher = async (input, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    calls.push({ url: input, headers })
    if (input === GAME_CONFIG) return (answers.config || (() => Response.json(CONFIG)))()
    const path = input.slice(UPSTREAM.length)
    const answer = answers[path]
    if (answer) return answer()
    if (path === '/api/v1/planets') return Response.json(PLANETS)
    if (path === '/api/v1/campaigns') return Response.json(CAMPAIGNS)
    if (path === '/api/v1/assignments') return Response.json(ORDER)
    if (path === '/api/v1/war') return Response.json(WAR)
    if (path === STATUS_PATH) return Response.json(STATUS)
    if (path === '/api/v2/space-stations') return Response.json(STATIONS)
    return new Response('not found', { status: 404 })
  }
  return { fetcher, calls }
}

const identity = { client: 'dilas.test', contact: 'contact.test' }
const war = (headers: Record<string, string> = {}) => SELF.fetch(`${ORIGIN}/api/war`, { headers })

beforeEach(async () => {
  await env.DB.prepare('delete from war_snapshot').run()
  await env.DB.prepare('delete from war_history').run()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('trimming the upstream answer', () => {
  it('keeps what is happening and leaves out the quiet planets Super Earth holds', () => {
    const out = trimWar(PLANETS, CAMPAIGNS)
    expect(out?.map((p) => p.name)).toEqual(['MALEVELON CREEK', 'BACKWATER', 'UNDER SIEGE'])
  })

  it('marks the campaigns, reads the defence and the players, and drops what the map never draws', () => {
    const out = trimWar(PLANETS, CAMPAIGNS) ?? []
    const creek = out.find((p) => p.name === 'MALEVELON CREEK')
    expect(creek).toEqual({
      name: 'MALEVELON CREEK', owner: 'Automaton', health: 250_000, maxHealth: 1_000_000,
      players: 4210, campaign: true, event: null,
    })
    expect(out.find((p) => p.name === 'BACKWATER')?.campaign).toBe(false)
    expect(out.find((p) => p.name === 'UNDER SIEGE')?.event).toEqual({
      faction: 'Illuminate', health: 600_000, maxHealth: 2_000_000, endTime: '2026-09-30T12:00:00Z',
    })
    expect(JSON.stringify(out)).not.toContain('IGNORED')
  })

  it('refuses an answer that is not two lists, and skips entries it cannot read', () => {
    expect(trimWar({ planets: [] }, CAMPAIGNS)).toBeNull()
    expect(trimWar(PLANETS, null)).toBeNull()
    const junk = [null, 7, 'x', { name: 'NO INDEX', currentOwner: 'Automaton' }, planet(5, 'MARTIANS', 'Martians')]
    expect(trimWar(junk, [])).toEqual([])
  })

  it('bounds what it keeps from a strange answer', () => {
    const [long] = trimWar([planet(6, 'X'.repeat(500), 'Terminids', { health: -5, maxHealth: 'lots' })], []) ?? []
    expect(long?.name.length).toBe(80)
    expect(long?.health).toBe(0)
    expect(long?.maxHealth).toBe(0)
  })
})

describe('trimming the Major Order', () => {
  it('reads the briefing, the end and each task\'s faction, goal and progress off the real shape', () => {
    expect(trimOrder(ORDER)).toEqual({
      title: 'MAJOR ORDER',
      briefing: ORDER[0]?.briefing,
      expiresAt: '2026-10-01T19:30:02.5980151Z',
      tasks: [
        { race: 2, goal: 25_000_000, progress: 12_759_594 },
        { race: 3, goal: 5_000_000, progress: 2_114_700 },
      ],
      reward: { type: 1, amount: 40 },
    })
  })

  it('keeps the reward as a type and an amount, from either field, and nothing when there is none', () => {
    const one = ORDER[0] as Record<string, unknown>
    expect(trimOrder([{ ...one, reward: undefined }])?.reward).toEqual({ type: 1, amount: 40 })
    expect(trimOrder([{ ...one, reward: null, rewards: [] }])?.reward).toBeNull()
    expect(trimOrder([{ ...one, reward: { type: 'medals', amount: 40 }, rewards: [] }])?.reward).toBeNull()
    expect(trimOrder([{ ...one, reward: { type: 1, amount: -5 }, rewards: [] }])?.reward).toBeNull()
  })

  it('is nothing when there is no order, or what arrived is not one', () => {
    expect(trimOrder([])).toBeNull()
    expect(trimOrder(null)).toBeNull()
    expect(trimOrder([{ title: 'MAJOR ORDER' }])).toBeNull()
  })

  it('bounds a strange one', () => {
    const odd = trimOrder([{ briefing: 'x'.repeat(5000), expiration: '2026-10-01T00:00:00Z', tasks: Array(40).fill({ values: ['a'], valueTypes: [1] }) }])
    expect(odd?.briefing.length).toBe(600)
    expect(odd?.tasks).toHaveLength(8)
    expect(odd?.tasks[0]).toEqual({ race: null, goal: 0, progress: 0 })
    expect(odd?.reward).toBeNull()
  })
})

describe('trimming the war totals', () => {
  it('keeps the counts the war room shows, and leaves out the fields that count nothing', () => {
    expect(trimStats(WAR)).toEqual({
      playerCount: 38398, terminidKills: 226645807204, automatonKills: 119725368690, illuminateKills: 76977223083,
      deaths: 9057442173, bulletsFired: 2026282813838, missionsWon: 1056414361, missionsLost: 102693485,
    })
    expect(JSON.stringify(trimStats(WAR))).not.toContain('accuracy')
  })

  it('is nothing without a statistics block, and reads a strange count as 0', () => {
    expect(trimStats(null)).toBeNull()
    expect(trimStats({ statistics: [] })).toBeNull()
    expect(trimStats({ statistics: { playerCount: 'lots', deaths: -1 } })).toMatchObject({ playerCount: 0, deaths: 0, missionsWon: 0 })
  })
})

describe('fetching and serving the snapshot', () => {
  it('answers 503 until a fetch has ever worked', async () => {
    const response = await war()
    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('serves what was fetched, with its age, cacheable for a minute', async () => {
    const { fetcher } = fake()
    expect(await refreshWar(db, identity, fetcher, 1_000_000)).toEqual({ ok: true, planets: 3 })

    const response = await war()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    const body = await response.json<{ fetchedAt: number; triedAt: number; ok: boolean; planets: { name: string }[]; order: { tasks: unknown[] } | null; stats: { playerCount: number } | null }>()
    expect(body.fetchedAt).toBe(1_000_000)
    expect(body.triedAt).toBe(1_000_000)
    expect(body.ok).toBe(true)
    expect(body.planets.map((p) => p.name)).toEqual(['MALEVELON CREEK', 'BACKWATER', 'UNDER SIEGE'])
    expect(body.order?.tasks).toHaveLength(2)
    expect(body.stats?.playerCount).toBe(38398)
  })

  /** The service answers 400 to a request missing either header. Found against the real one. */
  it('names the tool and a contact to the upstream on every path', async () => {
    const { fetcher, calls } = fake()
    await refreshWar(db, identity, fetcher)
    const community = calls.filter((c) => c.url.startsWith(UPSTREAM))
    expect(community.map((c) => c.url).sort()).toEqual([
      `${UPSTREAM}/api/v1/assignments`, `${UPSTREAM}/api/v1/planets`, `${UPSTREAM}/api/v1/war`,
      `${UPSTREAM}/api/v2/space-stations`, `${UPSTREAM}${STATUS_PATH}`,
    ])
    expect(community.every((c) => c.headers['x-super-client'] === 'dilas.test')).toBe(true)
    expect(community.every((c) => c.headers['x-super-contact'] === 'contact.test')).toBe(true)
    /* The game's own server is a different service: it is not sent the community API's headers. */
    expect(calls.filter((c) => c.url === GAME_CONFIG)).toHaveLength(1)
  })

  /**
   * The rule the whole design exists for. An outage must leave the last good
   * answer with its own age, not stamp it as fresh and not throw it away.
   */
  it('keeps the last good snapshot with its real age when a later fetch fails', async () => {
    await refreshWar(db, identity, fake().fetcher, 1_000_000)
    const down = fake({ '/api/v1/planets': () => new Response('upstream down', { status: 502 }) })
    const result = await refreshWar(db, identity, down.fetcher, 1_300_000)
    expect(result.ok).toBe(false)

    const body = await (await war()).json<{ fetchedAt: number; triedAt: number; ok: boolean; planets: unknown[] }>()
    expect(body.fetchedAt).toBe(1_000_000)
    expect(body.triedAt).toBe(1_300_000)
    expect(body.ok).toBe(false)
    expect(body.planets).toHaveLength(3)
  })

  it('records an answer that is not JSON, or not lists, as a failure rather than throwing', async () => {
    const notJson = fake({ [STATUS_PATH]: () => new Response('<html>busy</html>', { status: 200 }), '/api/v1/campaigns': () => new Response('<html>busy</html>', { status: 200 }) })
    expect(await refreshWar(db, identity, notJson.fetcher)).toMatchObject({ ok: false })
    const wrongShape = fake({ '/api/v1/planets': () => Response.json({ planets: [] }) })
    expect(await refreshWar(db, identity, wrongShape.fetcher)).toMatchObject({ ok: false })
    const thrown: Fetcher = async () => { throw new Error('connection reset') }
    expect(await refreshWar(db, identity, thrown)).toEqual({ ok: false, error: 'connection reset' })

    // Nothing ever worked, so there is still nothing to serve.
    expect((await war()).status).toBe(503)
    const row = await env.DB.prepare('select ok, error from war_snapshot').first<{ ok: number; error: string }>()
    expect(row).toEqual({ ok: 0, error: 'connection reset' })
  })

  /** The order is context. Losing it must not cost the map its colour. */
  it('still lands the war when only the Major Order fails, with no order', async () => {
    const orderDown = fake({ '/api/v1/assignments': () => new Response('busy', { status: 503 }) })
    expect(await refreshWar(db, identity, orderDown.fetcher)).toEqual({ ok: true, planets: 3 })
    const body = await (await war()).json<{ ok: boolean; planets: unknown[]; order: unknown }>()
    expect(body.ok).toBe(true)
    expect(body.planets).toHaveLength(3)
    expect(body.order).toBeNull()
  })

  /** The totals are context too. Losing them must not cost the map its colour or the order. */
  it('still lands the war and the order when only the totals fail, with no totals', async () => {
    const totalsDown = fake({ '/api/v1/war': () => new Response('busy', { status: 503 }) })
    expect(await refreshWar(db, identity, totalsDown.fetcher)).toEqual({ ok: true, planets: 3 })
    const body = await (await war()).json<{ planets: unknown[]; order: unknown; stats: unknown }>()
    expect(body.planets).toHaveLength(3)
    expect(body.order).not.toBeNull()
    expect(body.stats).toBeNull()
  })

  it('never sends the failure reason to a browser', async () => {
    await refreshWar(db, identity, fake().fetcher)
    await refreshWar(db, identity, async () => { throw new Error('secret internal reason') })
    expect(await (await war()).text()).not.toContain('secret internal reason')
  })

  it('refuses a foreign page and anything but a GET, and serves its own page with no origin', async () => {
    await refreshWar(db, identity, fake().fetcher)
    expect((await war({ origin: 'https://elsewhere.example' })).status).toBe(403)
    expect((await SELF.fetch(`${ORIGIN}/api/war`, { method: 'POST', headers: { origin: ORIGIN } })).status).toBe(405)
    expect((await war()).status).toBe(200)
    expect((await war({ origin: ORIGIN })).status).toBe(200)
  })
})

describe('the marks and the space station', () => {
  it('reads effects, attack lines and drifted planets by name, dropping what does not resolve', () => {
    const marks = trimMarks(PLANETS, STATUS)
    expect(marks?.effects).toEqual({ BACKWATER: [1229], 'UNDER SIEGE': [1190] })
    expect(marks?.attacks).toEqual([['MALEVELON CREEK', 'QUIET HOLD']])
    expect(marks?.moved).toEqual({ BACKWATER: { x: 0.35, y: 0.25 } })
  })

  it('places the station from the status, its vote end converted from war time', () => {
    const at = Date.parse('2026-10-13T07:10:23Z')
    expect(trimMarks(PLANETS, STATUS, at)?.station).toEqual({ planet: 'UNDER SIEGE', electionEnd: '2026-10-13T08:24:13.000Z' })
    expect(trimMarks(PLANETS, { ...STATUS, spaceStations: [] }, at)?.station).toBeNull()
  })

  it('is nothing when the status or the planets are not the shape expected, and bounds a strange one', () => {
    expect(trimMarks(PLANETS, null)).toBeNull()
    expect(trimMarks(null, STATUS)).toBeNull()
    const flood = {
      planetActiveEffects: Array.from({ length: 50 }, (_, i) => ({ index: 1, galacticEffectId: i })),
      planetAttacks: Array.from({ length: 2000 }, () => ({ source: 1, target: 2 })),
    }
    const marks = trimMarks(PLANETS, flood)
    expect(marks?.effects['QUIET HOLD']).toHaveLength(16)
    expect(marks?.attacks).toHaveLength(400)
  })

  it('reads the station planet, its vote and its actions by name, and nothing when there is none', () => {
    expect(trimStation(STATIONS)).toEqual({
      planet: 'UNDER SIEGE', electionEnd: '2026-10-12T08:23:44Z',
      actions: [{ name: 'EAGLE STORM', description: 'DSS crews maintain a rotating fleet of Eagle Fighters.' }],
    })
    expect(trimStation([])).toBeNull()
    expect(trimStation({ planet: 'x' })).toBeNull()
  })

  it('serves the marks and the station with the war, campaigns read from the raw status', async () => {
    const { fetcher, calls } = fake()
    expect(await refreshWar(db, identity, fetcher, 1_000_000)).toEqual({ ok: true, planets: 3 })
    expect(calls.some((c) => c.url.endsWith('/api/v1/campaigns'))).toBe(false)
    const body = await (await war()).json<{ planets: { name: string; campaign: boolean }[]; marks: { effects: Record<string, number[]> }; station: { planet: string; fetchedAt: number } }>()
    expect(body.planets.filter((p) => p.campaign).map((p) => p.name)).toEqual(['MALEVELON CREEK', 'UNDER SIEGE'])
    expect(body.marks.effects.BACKWATER).toEqual([1229])
    expect(body.station.planet).toBe('UNDER SIEGE')
    expect(body.station.fetchedAt).toBe(1_000_000)
  })

  it('never asks more than five things in one run, and asks the station only once an hour', async () => {
    const first = fake()
    await refreshWar(db, identity, first.fetcher, 1_000_000)
    expect(first.calls.filter((c) => c.url.startsWith(UPSTREAM))).toHaveLength(5)
    const next = fake()
    await refreshWar(db, identity, next.fetcher, 1_300_000)
    expect(next.calls).toHaveLength(4)
    expect(next.calls.some((c) => c.url === GAME_CONFIG)).toBe(false)
    expect(next.calls.some((c) => c.url.endsWith('/space-stations'))).toBe(false)
  })

  it('falls back to the campaign list when the raw status fails, losing only the marks and the station', async () => {
    const down = fake({ [STATUS_PATH]: () => new Response('bad gateway', { status: 502 }) })
    expect(await refreshWar(db, identity, down.fetcher, 1_000_000)).toEqual({ ok: true, planets: 3 })
    expect(down.calls.filter((c) => c.url.startsWith(UPSTREAM))).toHaveLength(5)
    expect(down.calls.some((c) => c.url.endsWith('/space-stations'))).toBe(false)
    const body = await (await war()).json<{ planets: { campaign: boolean }[]; marks: unknown; station: unknown }>()
    expect(body.planets.filter((p) => p.campaign)).toHaveLength(2)
    expect(body.marks).toBeNull()
    expect(body.station).toBeNull()
  })

  it('keeps the marker when the station request is refused, asks again next run, and drops stale actions after three hours', async () => {
    const HOUR = 60 * 60 * 1000
    type Body = { station: { planet: string; actions: unknown[]; fetchedAt: number } | null }
    await refreshWar(db, identity, fake().fetcher, 1_000_000)
    const refused = fake({ '/api/v2/space-stations': () => new Response('too many', { status: 429 }) })
    await refreshWar(db, identity, refused.fetcher, 1_000_000 + HOUR)
    let body = await (await war()).json<Body>()
    expect(body.station?.planet).toBe('UNDER SIEGE')
    expect(body.station?.actions).toHaveLength(1)
    expect(body.station?.fetchedAt).toBe(1_000_000 + HOUR)
    const next = fake({ '/api/v2/space-stations': () => new Response('too many', { status: 429 }) })
    await refreshWar(db, identity, next.fetcher, 1_000_000 + HOUR + 300_000)
    expect(next.calls.some((c) => c.url.endsWith('/space-stations'))).toBe(true)
    await refreshWar(db, identity, next.fetcher, 1_000_000 + 4 * HOUR)
    body = await (await war()).json<Body>()
    expect(body.station?.planet).toBe('UNDER SIEGE')
    expect(body.station?.actions).toEqual([])
  })
})

describe('the scarring', () => {
  it('reads the scarring mix by planet name, by hash for a planet the war does not list, and nothing else', () => {
    expect(trimScars(PLANETS, CONFIG)).toEqual({ planets: { 'QUIET HOLD': 50 }, hashes: { '1893896155': 100 } })
    expect(trimScars(PLANETS, null)).toBeNull()
    expect(trimScars(null, CONFIG)).toBeNull()
  })

  it('serves it with the war, keeps the last good one when a read fails, and drops it after three hours', async () => {
    const HOUR = 60 * 60 * 1000
    await refreshWar(db, identity, fake().fetcher, 1_000_000)
    let body = await (await war()).json<{ scars: { planets: Record<string, number>; hashes: Record<string, number>; fetchedAt: number } | null }>()
    expect(body.scars?.planets).toEqual({ 'QUIET HOLD': 50 })
    expect(body.scars?.fetchedAt).toBe(1_000_000)
    const down = fake({ config: () => new Response('busy', { status: 503 }) })
    await refreshWar(db, identity, down.fetcher, 1_000_000 + HOUR)
    body = await (await war()).json()
    expect(body.scars?.fetchedAt).toBe(1_000_000)
    await refreshWar(db, identity, down.fetcher, 1_000_000 + 4 * HOUR)
    body = await (await war()).json()
    expect(body.scars).toBeNull()
  })

  it('never costs the war: a broken configuration still lands the snapshot', async () => {
    const broken = fake({ config: () => new Response('not json') })
    expect(await refreshWar(db, identity, broken.fetcher, 1_000_000)).toEqual({ ok: true, planets: 3 })
    const body = await (await war()).json<{ ok: boolean; scars: unknown }>()
    expect(body.ok).toBe(true)
    expect(body.scars).toBeNull()
  })
})

describe('the history', () => {
  const HOUR = 60 * 60 * 1000
  const T0 = 1_790_000_000_000
  const kept = async () =>
    (await env.DB.prepare('select at from war_history order by at').all<{ at: number }>()).results.map((r) => r.at)
  const history = (query = '', headers: Record<string, string> = {}) =>
    SELF.fetch(`${ORIGIN}/api/war/history${query}`, { headers })
  /** The Creek further taken, an hour on. */
  const creekAt = (health: number) =>
    fake({ '/api/v1/planets': () => Response.json(PLANETS.map((p) => (p.name === 'MALEVELON CREEK' ? { ...p, health } : p))) })

  it('keeps a copy of a good fetch at most once an hour, and lets the oldest go after thirty days', async () => {
    await env.DB.prepare('insert into war_history (at, payload) values (?, ?)').bind(T0 - HISTORY_KEEP_MS - 1, '{"planets":[],"stats":null}').run()
    await refreshWar(db, identity, fake().fetcher, T0)
    expect(await kept()).toEqual([T0])
    await refreshWar(db, identity, fake().fetcher, T0 + 5 * 60 * 1000)
    expect(await kept()).toEqual([T0])
    await refreshWar(db, identity, fake().fetcher, T0 + HISTORY_EVERY_MS)
    expect(await kept()).toEqual([T0, T0 + HISTORY_EVERY_MS])
  })

  it('keeps nothing from a failed fetch', async () => {
    await refreshWar(db, identity, async () => { throw new Error('down') }, T0)
    expect(await kept()).toEqual([])
  })

  /** History is context. A broken table must not cost the map its colour. */
  it('still lands the snapshot when keeping the history fails', async () => {
    await env.DB.prepare('drop table war_history').run()
    try {
      expect(await refreshWar(db, identity, fake().fetcher, T0)).toEqual({ ok: true, planets: 3 })
      expect((await war()).status).toBe(200)
    } finally {
      await env.DB.prepare('create table war_history (at integer primary key not null, payload text not null)').run()
    }
  })

  it('serves one planet\'s hours oldest first, without its name, and nothing of anywhere else', async () => {
    await refreshWar(db, identity, creekAt(250_000).fetcher, T0)
    await refreshWar(db, identity, creekAt(150_000).fetcher, T0 + HOUR)
    const response = await history('?planet=Malevelon%20Creek')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    const body = await response.json<{ planet: string; from: number; points: { at: number; health: number; owner: string; name?: string }[] }>()
    expect(body.planet).toBe('MALEVELON CREEK')
    expect(body.from).toBe(T0)
    expect(body.points.map((p) => [p.at, p.health, p.owner])).toEqual([[T0, 250_000, 'Automaton'], [T0 + HOUR, 150_000, 'Automaton']])
    expect(body.points[0]?.name).toBeUndefined()
    const siege = await (await history('?planet=UNDER%20SIEGE')).json<{ points: { event: unknown }[] }>()
    expect(siege.points[0]?.event).toEqual({ faction: 'Illuminate', health: 600_000, maxHealth: 2_000_000 })
    expect((await (await history('?planet=NOWHERE')).json<{ points: unknown[] }>()).points).toEqual([])
  })

  it('serves the war\'s own hours: how many were fighting and how many fronts were open', async () => {
    await refreshWar(db, identity, fake().fetcher, T0)
    const body = await (await history()).json<{ from: number; points: unknown[] }>()
    expect(body).toEqual({ from: T0, points: [{ at: T0, players: 38398, fronts: 2 }] })
  })

  it('answers 503 before the first hour, and refuses a bad name, a foreign page and anything but a GET', async () => {
    expect((await history()).status).toBe(503)
    await refreshWar(db, identity, fake().fetcher, T0)
    expect((await history('?planet=')).status).toBe(400)
    expect((await history(`?planet=${'X'.repeat(81)}`)).status).toBe(400)
    expect((await history('', { origin: 'https://elsewhere.example' })).status).toBe(403)
    expect((await SELF.fetch(`${ORIGIN}/api/war/history`, { method: 'POST', headers: { origin: ORIGIN } })).status).toBe(405)
  })
})

describe('the Cron Trigger', () => {
  it('fetches the war into D1 on its schedule, naming the tool as the config says', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const { fetcher } = fake()
      return fetcher(String(input instanceof Request ? input.url : input), init)
    })
    await worker.scheduled(createScheduledController({ cron: '*/5 * * * *' }), env)

    // The fake, and not the network, is what answered.
    // Four every run, and the space station and the game's scarring on the first.
    expect(spy).toHaveBeenCalledTimes(6)
    const sent = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(sent.get('x-super-client')).toBe(env.SUPER_CLIENT)
    expect(sent.get('x-super-contact')).toBe(env.SUPER_CONTACT)
    expect(env.SUPER_CLIENT).toBe('dilas.me')
    expect(env.SUPER_CONTACT).toBeTruthy()

    const body = await (await war()).json<{ ok: boolean; planets: unknown[] }>()
    expect(body.ok).toBe(true)
    expect(body.planets).toHaveLength(3)
  })
})
