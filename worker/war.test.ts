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
import { type Fetcher, UPSTREAM, refreshWar, trimWar } from './war.ts'

const ORIGIN = 'https://dds.stigly-official.workers.dev'
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
    return new Response('not found', { status: 404 })
  }
  return { fetcher, calls }
}

const identity = { client: 'dds.test', contact: 'contact.test' }
const war = (headers: Record<string, string> = {}) => SELF.fetch(`${ORIGIN}/api/war`, { headers })

beforeEach(async () => {
  await env.DB.prepare('delete from war_snapshot').run()
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
    const body = await response.json<{ fetchedAt: number; triedAt: number; ok: boolean; planets: { name: string }[] }>()
    expect(body.fetchedAt).toBe(1_000_000)
    expect(body.triedAt).toBe(1_000_000)
    expect(body.ok).toBe(true)
    expect(body.planets.map((p) => p.name)).toEqual(['MALEVELON CREEK', 'BACKWATER', 'UNDER SIEGE'])
  })

  /** The service answers 400 to a request missing either header. Found against the real one. */
  it('names the tool and a contact to the upstream on both paths', async () => {
    const { fetcher, calls } = fake()
    await refreshWar(db, identity, fetcher)
    expect(calls.map((c) => c.url).sort()).toEqual([`${UPSTREAM}/api/v1/campaigns`, `${UPSTREAM}/api/v1/planets`])
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

describe('the Cron Trigger', () => {
  it('fetches the war into D1 on its schedule, naming the tool as the config says', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const { fetcher } = fake()
      return fetcher(String(input instanceof Request ? input.url : input), init)
    })
    await worker.scheduled(createScheduledController({ cron: '*/5 * * * *' }), env)

    // The fake, and not the network, is what answered.
    expect(spy).toHaveBeenCalledTimes(2)
    const sent = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(sent.get('x-super-client')).toBe(env.SUPER_CLIENT)
    expect(sent.get('x-super-contact')).toBe(env.SUPER_CONTACT)
    expect(env.SUPER_CLIENT).toBe('dds.stigly-official.workers.dev')
    expect(env.SUPER_CONTACT).toBeTruthy()

    const body = await (await war()).json<{ ok: boolean; planets: unknown[] }>()
    expect(body.ok).toBe(true)
    expect(body.planets).toHaveLength(3)
  })
})
