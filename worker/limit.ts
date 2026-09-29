/**
 * Rate limiting for the routes better-auth does not cover.
 *
 * `worker/auth.ts` limits `/api/auth/*` and that is all it can do: better-auth
 * only sees its own handler. The party routes are ours, so they are counted
 * here. Ported from Enodia's `worker/limit.ts`; its docblock is longer and
 * worth reading before changing how `take` counts.
 *
 * ## Why the counting has to be one statement
 *
 * D1 has no interactive transactions, only batches. A limiter written the
 * obvious way, read the count then write it back, is two round trips with a
 * gap in the middle, and a burst of simultaneous requests all read the same
 * value before any of them writes. The limit then holds only when nobody is
 * trying, which is when it is not needed.
 *
 * `take` is therefore a single upsert with `RETURNING`. SQLite applies it
 * atomically, every `SET` expression sees the pre-update row, and the count it
 * hands back is this caller's own position in the window.
 *
 * ## A fixed window, not a sliding one
 *
 * The window opens on the first request and closes `window` seconds later. A
 * caller can spend `max` at the end of one window and `max` at the start of
 * the next. The point is to bound what one caller can spend, not to smooth it.
 *
 * ## What this does not do
 *
 * **It does not save a Worker invocation.** The request has already counted
 * against the daily allowance by the time this runs. A Cloudflare rate
 * limiting rule at the edge rejects before a Worker runs; it is free, and it
 * is stigly's to configure in the dashboard. This is what holds until then.
 */

import { sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import * as schema from './schema.ts'

export type Rule = { window: number; max: number }

/**
 * Every limit on this API that is ours, in one place so they read against each
 * other. None should ever be reached by somebody using the tool: a limit that
 * fires on ordinary use teaches people the tool is broken, and they are right.
 */
export const RULES = {
  /**
   * Opening a party. **The one route here that creates something**, a Durable
   * Object holding a party for twelve hours. Nobody opens twenty parties in an
   * hour on purpose.
   */
  open: { window: 3600, max: 20 },

  /**
   * Joining a party, which is looking a code up. Counted on every join, the
   * reconnects included, because a failed guess and a real reconnect cost the
   * same. So the number is high enough that a flaky connection reconnecting all
   * evening never reaches it, and low enough that guessing is pointless: a code
   * is one of 887 million and a party lives twelve hours. See `party.ts`.
   */
  join: { window: 3600, max: 120 },
} as const satisfies Record<string, Rule>

export type Refused = { retryAfter: number }

type DB = DrizzleD1Database<typeof schema>

/**
 * Take one request against `key`. Returns null when it is allowed, and how long
 * to wait when it is not.
 */
export async function take(db: DB, key: string, rule: Rule): Promise<Refused | null> {
  const now = Date.now()
  const opened = now - rule.window * 1000

  /**
   * One statement. `excluded` is the row this insert tried to add, so its
   * `window_start` is `now`; the bare names are the row already there. SQLite
   * evaluates every `SET` against the pre-update row, so the two cases cannot
   * disagree about whether the window rolled. `RETURNING` makes it one round
   * trip, so the count read back is this caller's and nobody else's.
   */
  const row = await db.get<{ count: number; window_start: number }>(sql`
    insert into api_rate_limit (key, count, window_start)
    values (${key}, 1, ${now})
    on conflict(key) do update set
      count = case when api_rate_limit.window_start <= ${opened} then 1
                   else api_rate_limit.count + 1 end,
      window_start = case when api_rate_limit.window_start <= ${opened} then excluded.window_start
                          else api_rate_limit.window_start end
    returning count, window_start
  `)

  // A driver that returned nothing is a bug, not an allowance. Fail closed.
  if (!row) return { retryAfter: rule.window }

  // Pruning, only when a window has just opened for this key, so it costs
  // nothing on a busy key. The longest window, because one table holds every
  // rule's rows and pruning on the shortest would keep resetting the longest.
  if (row.count === 1) {
    await db.run(sql`delete from api_rate_limit where window_start < ${now - LONGEST * 1000}`)
  }

  if (row.count > rule.max) {
    return { retryAfter: Math.max(1, Math.ceil((row.window_start + rule.window * 1000 - now) / 1000)) }
  }
  return null
}

const LONGEST = Math.max(...Object.values(RULES).map((rule) => rule.window))

/**
 * Keyed on the address, because nothing on the party routes has an account.
 * **`cf-connecting-ip` and never `x-forwarded-for`**: Cloudflare appends to
 * that one rather than replacing it, so a caller who sends their own arrives
 * with a value of their choosing in front, and every limit here would reset by
 * changing a string. A request with no address shares one bucket, which is
 * strict rather than open.
 */
export const addressKey = (rule: keyof typeof RULES, request: Request) =>
  `${rule}:a:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`
