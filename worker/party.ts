/**
 * The live party. One Durable Object per party, holding up to four members,
 * each one's confirmed loadout, and the host's scenario, and pushing every
 * change to every open connection.
 *
 * Stage 7 of `dds-cloudflare-handover.md`, which Enodia never built, so there
 * was nothing to port. The shape is the one the handover sketched: a Durable
 * Object per party, WebSockets through the hibernation API, a join code.
 *
 * ## Decided by the curator, 27 and 28 September 2026
 *
 * - **A code, not an account.** Accounts cannot open before password reset,
 *   which needs a domain nobody has bought. A code needs only this Worker.
 * - **An unconfirmed slot shows "Still deciding" and nothing else.** So the
 *   server never holds an unconfirmed loadout at all: a member either has a
 *   confirmed build or has none. Nothing half picked can leak because nothing
 *   half picked is ever sent.
 * - **The host sets the scenario**, the way the host picks the mission in
 *   game, and everyone else's screen follows.
 *
 * ## Why a Durable Object and not D1
 *
 * A party has to push: when one person confirms, three other screens change.
 * D1 answers questions and cannot push. A Durable Object is one place per
 * party that holds the open connections, and the hibernation API lets it hold
 * them for free while nobody is talking, which is almost all of the time.
 * Verified on the Workers Free plan before building: SQLite backed objects
 * only, which is what `wrangler.jsonc` declares.
 *
 * ## The server has no opinion about what a build is
 *
 * The handover's rule for published builds, applied here. A build arrives
 * packed by the browser and leaves exactly as it came. No item id is checked
 * on this side and no copy of the game data lives in the Worker: every
 * browser cleans what it receives against its own tables, the same way it
 * cleans anything read from storage. What the server does enforce is size,
 * shape and who may say what.
 *
 * ## Identity without accounts
 *
 * The browser makes a random token per party and keeps it. The server stores
 * only its SHA-256, and a member is whoever holds the token whose hash is on
 * the list. So a reload, a dropped connection or a second tab rejoins as the
 * same person rather than taking a fifth seat. The id other members see is a
 * prefix of that hash, which says nothing about the token.
 */

import { DurableObject } from 'cloudflare:workers'

/**
 * Codes are read aloud over voice chat, so they are short, capitals only and
 * missing every character that sounds or looks like another: no 0, O, 1, I, L.
 * Thirty one characters, six long: about 887 million codes. A party lives
 * twelve hours and joining is limited to 120 an hour per address in `limit.ts`,
 * so guessing one that is live is not a plan anybody could run.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6

/** In game the squad cap is four. A fifth person is refused, not queued. */
export const SQUAD_CAP = 4

/** A party with no activity for this long is deleted by its alarm. */
export const TTL_MS = 12 * 60 * 60 * 1000

/**
 * Caps on what anybody can make the server hold. A packed build is well under
 * a kilobyte, so four is room for names and slack, not for a payload.
 */
export const LIMITS = {
  message: 8 * 1024,
  build: 4 * 1024,
  scenario: 2 * 1024,
  name: 24,
  /** Messages per connection per burst window. A person clicking is nowhere near. */
  burst: { windowMs: 10_000, max: 40 },
} as const

/**
 * Close codes the browser acts on. Anything else is a dropped line and the
 * browser reconnects; these four mean stop trying.
 */
export const CLOSE = {
  full: 4001,
  removed: 4003,
  ended: 4004,
  flooding: 4029,
} as const

/**
 * A fresh code. Rejection sampled rather than `byte % 31`, because 256 is not
 * a multiple of 31 and the modulo would make the first nine characters of the
 * alphabet slightly likelier than the rest.
 */
export function newCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let out = ''
  while (out.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH * 2)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    }
  }
  return out
}

/** What somebody typed, made into a code or refused. Case and spacing are forgiven. */
export function normaliseCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null
  return code
}

/**
 * A display name, or null. Control characters out, runs of space folded, cut
 * to length. React escapes what it renders, so this is about tidiness and
 * size, not about markup.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name)
  return name || null
}

/** Long enough to be unguessable, URL safe, and nothing a browser would not make. */
export const validToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token)

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The id other members see. A prefix of the hash, never the token. */
const memberId = (hash: string) => hash.slice(0, 12)

type Member = {
  id: string
  /** SHA-256 of the member's token. Never sent to anybody. */
  hash: string
  name: string
  joinedAt: number
  /** The confirmed loadout, packed by the browser, or null for still deciding. */
  build: Record<string, unknown> | null
}

type Meta = {
  code: string
  /** The member id that may set the scenario and remove people. */
  host: string
  createdAt: number
  touchedAt: number
  scenario: Record<string, unknown> | null
}

/** Rides on each socket and survives hibernation. */
type Attachment = { member: string | null; windowStart: number; count: number }

/** An object, not an array or a primitive, and no bigger than `max` once packed. */
const smallObject = (value: unknown, max: number): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && JSON.stringify(value).length <= max

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export class Party extends DurableObject<Env> {
  /**
   * Claims this object for a new party, called by the Worker right after it
   * picks a code. False when the code already belongs to a live party, and the
   * Worker picks another. The opener is the first member and the host.
   */
  async open(code: string, tokenHash: string, name: string): Promise<boolean> {
    const existing = await this.ctx.storage.get<Meta>('meta')
    if (existing && Date.now() - existing.touchedAt < TTL_MS) return false

    await this.ctx.storage.deleteAll()
    const now = Date.now()
    const host = memberId(tokenHash)
    const meta: Meta = { code, host, createdAt: now, touchedAt: now, scenario: null }
    const members: Member[] = [{ id: host, hash: tokenHash, name, joinedAt: now, build: null }]
    await this.ctx.storage.put({ meta, members })
    await this.ctx.storage.setAlarm(now + TTL_MS)
    return true
  }

  /** The WebSocket upgrade. Anything else is refused, and so is a party that is gone. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'This address only speaks WebSocket.' }, 426)
    }
    if (!(await this.live())) {
      return json({ error: 'No party with that code. It may have ended.' }, 404)
    }
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ member: null, windowStart: Date.now(), count: 0 } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > LIMITS.message) {
      ws.close(1009, 'Message too large')
      return
    }

    const att = ws.deserializeAttachment() as Attachment
    const now = Date.now()
    if (now - att.windowStart > LIMITS.burst.windowMs) {
      att.windowStart = now
      att.count = 0
    }
    att.count += 1
    if (att.count > LIMITS.burst.max) {
      ws.close(CLOSE.flooding, 'Too many messages')
      return
    }
    ws.serializeAttachment(att)

    let msg: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(message)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('shape')
      msg = parsed as Record<string, unknown>
    } catch {
      ws.close(1007, 'Not a message')
      return
    }

    const meta = await this.live()
    if (!meta) {
      ws.close(CLOSE.ended, 'This party has ended')
      return
    }
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []

    if (msg.type === 'hello') {
      if (!validToken(msg.token)) {
        ws.close(1008, 'No token')
        return
      }
      const hash = await hashToken(msg.token)
      let me = members.find((m) => m.hash === hash)
      if (!me) {
        if (members.length >= SQUAD_CAP) {
          ws.close(CLOSE.full, 'This party is full')
          return
        }
        me = { id: memberId(hash), hash, name: cleanName(msg.name) ?? 'Helldiver', joinedAt: now, build: null }
        members.push(me)
      } else {
        me.name = cleanName(msg.name) ?? me.name
      }
      att.member = me.id
      ws.serializeAttachment(att)
      await this.save(meta, members)
      this.broadcast(meta, members)
      return
    }

    // Everything below is somebody already in the party.
    const me = members.find((m) => m.id === att.member)
    if (!me) {
      ws.close(att.member ? CLOSE.removed : 1008, att.member ? 'You were removed from this party' : 'Say hello first')
      return
    }
    const isHost = me.id === meta.host

    switch (msg.type) {
      case 'loadout': {
        if (msg.build === null) me.build = null
        else if (smallObject(msg.build, LIMITS.build)) me.build = msg.build
        else return this.refuse(ws, 'That loadout is too large to share.')
        break
      }
      case 'scenario': {
        if (!isHost) return this.refuse(ws, 'Only the host sets the scenario.')
        if (msg.scenario === null) meta.scenario = null
        else if (smallObject(msg.scenario, LIMITS.scenario)) meta.scenario = msg.scenario
        else return this.refuse(ws, 'That scenario is too large to share.')
        break
      }
      case 'name': {
        me.name = cleanName(msg.name) ?? me.name
        break
      }
      case 'leave': {
        await this.remove(meta, members, me.id, 1000, 'Left the party')
        return
      }
      case 'kick': {
        if (!isHost) return this.refuse(ws, 'Only the host can remove somebody.')
        if (typeof msg.member !== 'string' || msg.member === me.id) return this.refuse(ws, 'Nobody to remove.')
        if (!members.some((m) => m.id === msg.member)) return this.refuse(ws, 'Nobody to remove.')
        await this.remove(meta, members, msg.member, CLOSE.removed, 'You were removed from this party')
        return
      }
      default:
        return this.refuse(ws, 'Unknown message.')
    }

    await this.save(meta, members)
    this.broadcast(meta, members)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // Somebody's online dot went out. Everyone else hears about it.
    const meta = await this.live()
    if (!meta) return
    const members = (await this.ctx.storage.get<Member[]>('members')) ?? []
    this.broadcast(meta, members, ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  /**
   * Twelve quiet hours and nobody connected: the party is gone. Somebody who
   * left a tab open keeps it alive, because an open tab is somebody still
   * planning to drop.
   */
  async alarm(): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>('meta')
    if (!meta) return
    const now = Date.now()
    if (now - meta.touchedAt >= TTL_MS && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll()
      return
    }
    await this.ctx.storage.setAlarm(Math.max(meta.touchedAt + TTL_MS, now + 10 * 60 * 1000))
  }

  /* ---------------------------------------------------------------- */

  /** The party, or null when there is none or it has run out of time. */
  private async live(): Promise<Meta | null> {
    const meta = await this.ctx.storage.get<Meta>('meta')
    if (!meta) return null
    return Date.now() - meta.touchedAt < TTL_MS ? meta : null
  }

  private async save(meta: Meta, members: Member[]) {
    meta.touchedAt = Date.now()
    await this.ctx.storage.put({ meta, members })
  }

  /**
   * Out of the party, by their own hand or the host's. **A host who leaves
   * hands the party to whoever has been in it longest** rather than ending it
   * for everybody: an explicit leave is one person's choice, and three people
   * mid planning should not lose the room over it. The last one out ends it.
   */
  private async remove(meta: Meta, members: Member[], id: string, code: number, reason: string) {
    const rest = members.filter((m) => m.id !== id)
    for (const socket of this.ctx.getWebSockets()) {
      const att = socket.deserializeAttachment() as Attachment
      if (att.member === id) socket.close(code, reason)
    }
    if (rest.length === 0) {
      await this.ctx.storage.deleteAll()
      return
    }
    if (meta.host === id) {
      meta.host = [...rest].sort((a, b) => a.joinedAt - b.joinedAt)[0]!.id
    }
    await this.save(meta, rest)
    this.broadcast(meta, rest)
  }

  private refuse(ws: WebSocket, error: string) {
    ws.send(JSON.stringify({ type: 'error', error }))
  }

  /**
   * The whole party to every open connection, each told which member it is.
   * Four members and their builds is a few kilobytes, so there is no diffing.
   * The hash never leaves this object.
   */
  private broadcast(meta: Meta, members: Member[], closing?: WebSocket) {
    const sockets = this.ctx.getWebSockets().filter((s) => s !== closing && s.readyState === WebSocket.OPEN)
    const online = new Set(
      sockets.map((s) => (s.deserializeAttachment() as Attachment).member).filter((m): m is string => Boolean(m)),
    )
    const shared = {
      type: 'state',
      code: meta.code,
      host: meta.host,
      scenario: meta.scenario,
      members: [...members]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((m) => ({ id: m.id, name: m.name, online: online.has(m.id), build: m.build })),
    }
    for (const socket of sockets) {
      const att = socket.deserializeAttachment() as Attachment
      if (!att.member) continue
      try {
        socket.send(JSON.stringify({ ...shared, you: att.member }))
      } catch {
        // A socket that died between the list and the send. Its close event
        // will broadcast again.
      }
    }
  }
}
