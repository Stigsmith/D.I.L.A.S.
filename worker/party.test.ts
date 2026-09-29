/**
 * The live party, run inside workerd against a real Durable Object and a real
 * local D1.
 *
 * Every rule `worker/party.ts` promises is asserted here from the outside, the
 * way a browser meets it: open a party over HTTP, connect over a WebSocket,
 * and read what arrives. Node could not run any of this. A Durable Object,
 * hibernating WebSockets and `cf-connecting-ip` exist only in workerd.
 *
 * The rules that matter most are the ones a wrong implementation would pass
 * quietly: a fifth person getting a seat, a squadmate changing the host's
 * scenario, a reconnect taking a second seat, a removed person still hearing
 * the party. Each has its own test.
 */

import { SELF, env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RULES } from './limit.ts'
import { CLOSE, CODE_ALPHABET, CODE_LENGTH, LIMITS, SQUAD_CAP } from './party.ts'

const ORIGIN = 'https://dds.stigly-official.workers.dev'

type State = {
  type: 'state'
  code: string
  you: string
  host: string
  scenario: Record<string, unknown> | null
  members: { id: string; name: string; online: boolean; build: Record<string, unknown> | null }[]
}
type Message = State | { type: 'error'; error: string }

/** What a browser makes: 32 random bytes, URL safe. */
const token = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function open(body: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`${ORIGIN}/api/party`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  })
}

/** Every socket a test opens, closed after it, so no test leaks a connection into the next. */
const sockets: WebSocket[] = []

type Client = {
  ws: WebSocket
  inbox: Message[]
  send: (message: Record<string, unknown>) => void
  /**
   * The newest state, once it satisfies `test`, waiting up to two seconds.
   * The newest and not any: an older snapshot that happened to match is
   * exactly the state before the thing being tested, and accepting it made
   * two of these tests pass or fail on timing alone.
   */
  state: (test?: (s: State) => boolean) => Promise<State>
  error: () => Promise<string>
  closed: () => Promise<{ code: number; reason: string }>
}

async function connect(code: string, ip = '203.0.113.9'): Promise<{ response: Response; client: Client | null }> {
  const response = await SELF.fetch(`${ORIGIN}/api/party/${code}`, {
    headers: { upgrade: 'websocket', origin: ORIGIN, 'cf-connecting-ip': ip },
  })
  const ws = response.webSocket
  if (!ws) return { response, client: null }
  ws.accept()
  sockets.push(ws)

  const inbox: Message[] = []
  let closedWith: { code: number; reason: string } | null = null
  ws.addEventListener('message', (event) => {
    inbox.push(JSON.parse(String(event.data)) as Message)
  })
  ws.addEventListener('close', (event) => {
    closedWith = { code: event.code, reason: event.reason }
  })

  const until = async <T>(find: () => T | undefined, what: string): Promise<T> => {
    for (let i = 0; i < 200; i++) {
      const hit = find()
      if (hit !== undefined) return hit
      await sleep(10)
    }
    throw new Error(`timed out waiting for ${what}`)
  }

  const client: Client = {
    ws,
    inbox,
    send: (message) => ws.send(JSON.stringify(message)),
    state: (test = () => true) =>
      until(() => {
        const latest = [...inbox].reverse().find((m): m is State => m.type === 'state')
        return latest && test(latest) ? latest : undefined
      }, 'a matching state'),
    error: () =>
      until(() => [...inbox].reverse().find((m) => m.type === 'error')?.error as string | undefined, 'an error'),
    closed: () => until(() => closedWith ?? undefined, 'the socket to close'),
  }
  return { response, client }
}

/** Open a party and connect its host, who says hello. */
async function hostParty(name = 'Host') {
  const hostToken = token()
  const opened = await open({ token: hostToken, name })
  const { code } = (await opened.json()) as { code: string }
  const { client } = await connect(code)
  client!.send({ type: 'hello', token: hostToken, name })
  const first = await client!.state()
  return { code, host: client!, hostToken, hostId: first.you }
}

/** Join an existing party as somebody new, or as a returning token. */
async function joinParty(code: string, name: string, as = token(), ip?: string) {
  const { client } = await connect(code, ip)
  client!.send({ type: 'hello', token: as, name })
  return { client: client!, token: as }
}

beforeEach(async () => {
  await env.DB.prepare('delete from api_rate_limit').run()
})

afterEach(() => {
  for (const ws of sockets.splice(0)) {
    try {
      ws.close(1000, 'test over')
    } catch {
      // already closed
    }
  }
})

describe('opening a party', () => {
  it('answers with a six character code from the read-aloud alphabet', async () => {
    const response = await open({ token: token(), name: 'Host' })
    expect(response.status).toBe(201)
    const { code } = (await response.json()) as { code: string }
    expect(code).toHaveLength(CODE_LENGTH)
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch)
  })

  it('refuses a request with no usable token', async () => {
    expect((await open({ token: 'short', name: 'Host' })).status).toBe(400)
    expect((await open({ name: 'Host' })).status).toBe(400)
  })

  it('refuses another origin', async () => {
    const response = await open({ token: token(), name: 'Host' }, { origin: 'https://elsewhere.example' })
    expect(response.status).toBe(403)
  })

  it('stops opening parties past the hourly limit, and says how long to wait', async () => {
    await env.DB.prepare('insert into api_rate_limit (key, count, window_start) values (?, ?, ?)')
      .bind('open:a:203.0.113.7', RULES.open.max, Date.now())
      .run()
    const response = await open({ token: token(), name: 'Host' })
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('joining', () => {
  it('refuses a code that is no party, without opening a socket', async () => {
    const { response } = await connect('ZZZZZZ')
    expect(response.status).toBe(404)
    expect(response.webSocket).toBeNull()
  })

  it('refuses something that is not a code at all', async () => {
    expect((await connect('not-a-code')).response.status).toBe(404)
  })

  it('refuses a plain request to a party address', async () => {
    const { code } = await hostParty()
    const response = await SELF.fetch(`${ORIGIN}/api/party/${code}`, { headers: { origin: ORIGIN } })
    expect(response.status).toBe(426)
  })

  it('forgives lower case and spaces in a typed code', async () => {
    const { code } = await hostParty()
    const typed = `${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`
    const { response } = await connect(encodeURIComponent(typed))
    expect(response.status).toBe(101)
  })

  it('stops joining past the hourly limit', async () => {
    const { code } = await hostParty()
    await env.DB.prepare('insert into api_rate_limit (key, count, window_start) values (?, ?, ?)')
      .bind('join:a:203.0.113.50', RULES.join.max, Date.now())
      .run()
    const { response } = await connect(code, '203.0.113.50')
    expect(response.status).toBe(429)
  })

  it('makes the opener the host and the first member', async () => {
    const { host, hostId } = await hostParty('Stigly')
    const state = await host.state()
    expect(state.host).toBe(hostId)
    expect(state.members).toHaveLength(1)
    expect(state.members[0]).toMatchObject({ id: hostId, name: 'Stigly', online: true, build: null })
  })

  it('tells everybody when somebody joins, and never sends a token hash', async () => {
    const { code, host } = await hostParty()
    const { client: mate } = await joinParty(code, 'Brother')
    const seen = await host.state((s) => s.members.length === 2)
    expect(seen.members.map((m) => m.name)).toEqual(['Host', 'Brother'])
    await mate.state((s) => s.members.length === 2)
    expect(JSON.stringify(host.inbox)).not.toMatch(/"hash"/)
  })

  it('gives a returning token its old seat rather than a new one', async () => {
    const { code, host } = await hostParty()
    const first = await joinParty(code, 'Brother')
    const before = await first.client.state((s) => s.members.length === 2)
    first.client.ws.close(1000, 'reload')
    const again = await joinParty(code, 'Brother', first.token)
    const after = await again.client.state((s) => s.members.length === 2 && s.members.every((m) => m.online))
    expect(after.you).toBe(before.you)
    await host.state((s) => s.members.length === 2)
  })

  it(`refuses a fifth person: the squad cap is ${SQUAD_CAP}`, async () => {
    const { code, host } = await hostParty()
    for (const name of ['Two', 'Three', 'Four']) await joinParty(code, name)
    await host.state((s) => s.members.length === SQUAD_CAP)
    const { client: fifth } = await joinParty(code, 'Five')
    expect((await fifth.closed()).code).toBe(CLOSE.full)
    expect((await host.state()).members).toHaveLength(SQUAD_CAP)
  })
})

describe('what a party carries', () => {
  const build = { id: 'bots-ghost', name: 'Ghost', faction: 'bots', primary: 'r-72-censor', strats: [null, null, null, null] }

  it('shares a confirmed loadout with everybody, and null takes it back to still deciding', async () => {
    const { code, host } = await hostParty()
    const { client: mate } = await joinParty(code, 'Brother')
    const joined = await mate.state((s) => s.members.length === 2)

    mate.send({ type: 'loadout', build })
    const shared = await host.state((s) => s.members.some((m) => m.id === joined.you && m.build !== null))
    expect(shared.members.find((m) => m.id === joined.you)!.build).toEqual(build)

    mate.send({ type: 'loadout', build: null })
    await host.state((s) => s.members.every((m) => m.build === null))
  })

  it('refuses a loadout bigger than any real one', async () => {
    const { host } = await hostParty()
    host.send({ type: 'loadout', build: { padding: 'x'.repeat(LIMITS.build) } })
    expect(await host.error()).toMatch(/too large/)
    expect((await host.state()).members[0]!.build).toBeNull()
  })

  it('lets only the host set the scenario, and everybody sees it', async () => {
    const { code, host } = await hostParty()
    const { client: mate } = await joinParty(code, 'Brother')
    await mate.state((s) => s.members.length === 2)

    mate.send({ type: 'scenario', scenario: { faction: 'bugs' } })
    expect(await mate.error()).toMatch(/Only the host/)

    host.send({ type: 'scenario', scenario: { faction: 'bots', difficulty: 9 } })
    const seen = await mate.state((s) => s.scenario !== null)
    expect(seen.scenario).toEqual({ faction: 'bots', difficulty: 9 })
  })

  it('closes a connection that sends something enormous', async () => {
    const { host } = await hostParty()
    host.ws.send('x'.repeat(LIMITS.message + 1))
    expect((await host.closed()).code).toBe(1009)
  })

  it('cleans a name rather than trusting it', async () => {
    const { code, host } = await hostParty()
    await joinParty(code, '  A\u0007very   long name that goes on well past the cap  ')
    const seen = await host.state((s) => s.members.length === 2)
    const name = seen.members[1]!.name
    expect(name.length).toBeLessThanOrEqual(LIMITS.name)
    expect(name).not.toMatch(/[\u0000-\u001f]|\s{2}/)
  })
})

describe('leaving and removing', () => {
  it('hands the party to whoever has been in longest when the host leaves', async () => {
    const { code, host } = await hostParty()
    const { client: second } = await joinParty(code, 'Second')
    const secondState = await second.state((s) => s.members.length === 2)
    const { client: third } = await joinParty(code, 'Third')
    await third.state((s) => s.members.length === 3)

    host.send({ type: 'leave' })
    const after = await second.state((s) => s.members.length === 2)
    expect(after.host).toBe(secondState.you)
    expect(after.members.map((m) => m.name)).toEqual(['Second', 'Third'])
  })

  it('ends the party when the last person leaves', async () => {
    const { code, host } = await hostParty()
    host.send({ type: 'leave' })
    await host.closed()
    expect((await connect(code)).response.status).toBe(404)
  })

  it('lets the host remove somebody, who hears it and loses the connection', async () => {
    const { code, host } = await hostParty()
    const { client: mate } = await joinParty(code, 'Brother')
    const mateState = await mate.state((s) => s.members.length === 2)

    host.send({ type: 'kick', member: mateState.you })
    expect((await mate.closed()).code).toBe(CLOSE.removed)
    await host.state((s) => s.members.length === 1)
  })

  it('does not let a squadmate remove anybody', async () => {
    const { code, host, hostId } = await hostParty()
    const { client: mate } = await joinParty(code, 'Brother')
    await mate.state((s) => s.members.length === 2)

    mate.send({ type: 'kick', member: hostId })
    expect(await mate.error()).toMatch(/Only the host/)
    expect((await host.state()).members).toHaveLength(2)
  })
})
