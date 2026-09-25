/**
 * Runs once before the backend tests and gives the run a real schema.
 *
 * `applyD1Migrations` replays `migrations/` into the test database, so the
 * tests run against exactly what production runs against. A hand written
 * CREATE TABLE here would drift, and a drifting fixture is worse than none: it
 * passes while production is broken.
 */
import { applyD1Migrations, env } from 'cloudflare:test'

/**
 * `TEST_MIGRATIONS` is added by `vitest.worker.config.ts` and is deliberately
 * not in `worker-configuration.d.ts`, which describes production. Narrowed
 * here so a test only binding cannot appear on the type the Worker uses.
 */
type Migrations = Parameters<typeof applyD1Migrations>[1]
const { TEST_MIGRATIONS } = env as typeof env & { TEST_MIGRATIONS: Migrations }

await applyD1Migrations(env.DB, TEST_MIGRATIONS)
