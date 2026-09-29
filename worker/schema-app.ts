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
