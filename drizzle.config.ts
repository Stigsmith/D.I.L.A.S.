import { defineConfig } from 'drizzle-kit'

/**
 * Turns the schema into SQL in `migrations/`.
 *
 *   npm run db:schema      better-auth's options -> worker/schema.ts
 *   npm run db:generate    schema -> a numbered .sql file
 *   npm run db:migrate     apply them to the local D1
 *
 * `dialect: 'sqlite'` and no credentials, on purpose. D1 is SQLite, and
 * generating a migration only needs the schema, not a database: drizzle-kit
 * diffs against its own journal in `migrations/meta/`. Applying is wrangler's
 * job, because only wrangler can reach a D1 binding.
 *
 * **Use `npx auth@latest` for the schema, never `@better-auth/cli`.** The
 * obvious name is the deprecated one, pinned minors behind, and it emits an
 * `account` table missing the NOT NULL `issuer` column. Nothing fails until the
 * first sign up. Enodia found it that way; `npm run db:schema` names the right
 * one so nobody has to remember.
 *
 * Ported verbatim from Enodia's `drizzle.config.ts`.
 */
export default defineConfig({
  dialect: 'sqlite',
  /**
   * Two files, and the split matters. `schema.ts` is GENERATED and overwritten
   * whole. `schema-app.ts` is ours. See the docblock there.
   */
  schema: ['./worker/schema.ts', './worker/schema-app.ts'],
  out: './migrations',
})
