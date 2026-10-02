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
import { type Fetcher, HISTORY_EVERY_MS, HISTORY_KEEP_MS, UPSTREAM, refreshWar, trimOrder, trimStats, trimWar } from './war.ts'

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
  planet(1, 'QUIET HOLD', 'Humans'),
  planet(196, 'MALEVELON CREEK', 'Automaton', { health: 250_000, statistics: { playerCount: 4210 } }),
  planet(2, 'BACKWATER', 'Terminids'),
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

type Call = { url: string; headers: Record<string, string> }

/** A stand in for the upstream that answers from the fixtures and records what it was asked. */
function fake(answers: Partial<Record<string, () => Response>> = {}) {
  const calls: Call[] = []
  const fetcher: Fetcher = async (input, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    calls.push({ url: input, headers })
    const path = input.slice(UPSTREAM.length)
    const answer = answers[path]
    if (answer) return answer()
    if (path === '/api/v1/planets') return Response.json(PLANETS)
    if (path === '/api/v1/campaigns') return Response.json(CAMPAIGNS)
    if (path === '/api/v1/assignments') return Response.json(ORDER)
    if (path === '/api/v1/war') return Response.json(WAR)
    return new Response('not found', { status: 404 })
  }
  return { fetcher, calls }
}

const identity = { client: 'dds.test', contact: 'contact.test' }
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
    expect(calls.map((c) => c.url).sort()).toEqual([
      `${UPSTREAM}/api/v1/assignments`, `${UPSTREAM}/api/v1/campaigns`, `${UPSTREAM}/api/v1/planets`, `${UPSTREAM}/api/v1/war`,
    ])
    expect(calls.every((c) => c.headers['x-super-client'] === 'dds.test')).toBe(true)
    expect(calls.every((c) => c.headers['x-super-contact'] === 'contact.test')).toBe(true)
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
    const notJson = fake({ '/api/v1/campaigns': () => new Response('<html>busy</html>', { status: 200 }) })
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
    expect(spy).toHaveBeenCalledTimes(4)
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
