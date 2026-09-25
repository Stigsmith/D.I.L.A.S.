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
 * **Empty at Stage 1, on purpose.** Accounts need only better-auth's own
 * tables. The first of ours are the rate limit counters and the sync table in
 * Stage 3; Enodia's `worker/schema-app.ts` has both, with the reasoning for
 * every column.
 */

export {}
