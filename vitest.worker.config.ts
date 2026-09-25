import { join } from 'node:path'

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

/**
 * The backend's tests, run **inside workerd itself** against a real local D1.
 *
 *   npm run test:worker
 *
 * Not in node, and it cannot be: node has no D1 binding, no
 * `cf-connecting-ip` and no workerd. Every bug Enodia found in the same
 * backend was invisible to a type check and a green build:
 *
 * - rate limiting silently off, because better-auth defaults it to
 *   `NODE_ENV === 'production'` and Workers sets no `NODE_ENV`
 * - the client address read from a header a caller can supply
 * - a generated schema missing a NOT NULL column, which fails only on insert
 *
 * All three are catchable here and nowhere else. Ported from Enodia's
 * `vitest.worker.config.ts`.
 */
export default defineConfig(async () => {
  /**
   * The real migration files, replayed into the test database by
   * `worker/test-setup.ts`, so a schema change that was never migrated fails
   * these tests instead of passing against a fixture.
   */
  const migrations = await readD1Migrations(join(import.meta.dirname, 'migrations'))

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          /**
           * **Pinned, and not production's date.** `wrangler.jsonc` says
           * 2026-09-23. The workerd this test pool ships refuses anything past
           * 2026-08-22 and fails to start rather than warning; Enodia found
           * that and pins the same.
           *
           * Safe because the only dated behaviour relied on here needs
           * 2025-04-01 or later. If a test ever disagrees with production, this
           * gap is the first thing to suspect.
           */
          compatibilityDate: '2026-08-22',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            /** Fixed, because these tests assert on behaviour, not opacity. Never leaves the runner. */
            BETTER_AUTH_SECRET: 'test-secret-not-used-anywhere-else-000000',
          },
        },
      }),
    ],
    test: {
      include: ['worker/**/*.test.ts'],
      setupFiles: ['./worker/test-setup.ts'],
    },
  }
})
