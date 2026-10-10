/**
 * This project's own tables. **Hand written, and deliberately not in
 * `worker/schema.ts`.**
 *
 * That file is generated: `npm run db:schema` overwrites it wholesale from
 * better-auth's options. Anything of ours put in it survives exactly until the
 * next regeneration and then vanishes without a word, taking the migration
 * history's idea of reality with it. Enodia learned that; this split is how it
 * stays unlearnable here. `drizzle.config.ts` reads both files.
 *
 * **The first of ours is the rate limit counter**, and it arrived with the
 * live party rather than with sync: opening a party is the first route of ours
 * that writes anything, and joining one looks a code up, which is the first
 * thing of ours worth guessing at. The party itself is not here. It lives in a
 * Durable Object per party, `worker/party.ts`, because it needs to push to four
 * open connections and D1 cannot.
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The counters behind `worker/limit.ts`, one row per key per window. Ported
 * from Enodia's `worker/schema-app.ts`, where the longer reasoning lives.
 *
 * **A table of ours rather than better-auth's `rate_limit`, and that is not
 * tidiness.** better-auth prunes its table with no key filter, on a schedule
 * set by the longest window it has configured itself, so rows of ours in there
 * would be deleted on a timetable decided by `worker/auth.ts`. Its `key`
 * column is also unique, so one of our keys colliding with one of theirs would
 * merge two counters into one.
 *
 * `key` is the primary key rather than a separate id, because the whole access
 * pattern is one upsert on it. See `limit.ts` for why that has to be one
 * statement.
 */
export const apiRateLimit = sqliteTable('api_rate_limit', {
  /** `<rule>:<who>`, where who is an address. `limit.ts` builds it. */
  key: text('key').primaryKey(),
  /** Requests taken in the current window, including the one that went over. */
  count: integer('count').notNull(),
  /** When the current window opened, epoch ms. Fixed, not sliding. */
  windowStart: integer('window_start').notNull(),
})

/**
 * The live war, as last fetched. **One row**, id `war`, written by the Cron
 * Trigger in `worker/war.ts` every five minutes and read by `GET /api/war`.
 *
 * A snapshot rather than a pass-through, so the community API is called a
 * fixed number of times a day whatever the traffic, and so an outage there
 * leaves the last good answer here **with its real age on it**: a failed fetch
 * moves `tried_at` and sets `ok` to 0, and leaves `payload` and `fetched_at`
 * exactly as they were. The browser decides whether that is too old to draw.
 */
export const warSnapshot = sqliteTable('war_snapshot', {
  id: text('id').primaryKey(),
  /** The trimmed planets as JSON, or null when no fetch has ever succeeded. */
  payload: text('payload'),
  /** When the payload was fetched, epoch ms. Null alongside a null payload. */
  fetchedAt: integer('fetched_at'),
  /** When the last fetch was tried, whether it worked or not. */
  triedAt: integer('tried_at').notNull(),
  /** Whether that last try worked. */
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  /** Why it did not, in a sentence, for whoever reads the table. Never sent to a browser. */
  error: text('error'),
})

/**
 * The war over time, for the Star Map: **one row an hour**, kept thirty
 * days, written by the same Cron Trigger as the snapshot and read by
 * `GET /api/war/history`.
 *
 * Nobody publishes the war's history, so the tool keeps its own from the day
 * the server first ran. Each row is the trimmed planets and the totals of one
 * fetch, as JSON, the same shape as the snapshot: a planet missing from an
 * hour means nothing was happening there, which for a front means it fell or
 * was taken. One row an hour rather than one per planet, because D1 on the
 * free plan allows fifty queries a run and a hundred bound values a query.
 */
export const warHistory = sqliteTable('war_history', {
  /** When the fetch behind this row was made, epoch ms. */
  at: integer('at').primaryKey(),
  /** `{ planets, stats }` as JSON, trimmed exactly as the snapshot is. */
  payload: text('payload').notNull(),
})
