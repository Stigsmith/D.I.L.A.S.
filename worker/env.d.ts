/**
 * Makes the `cloudflare:test` module visible to the type checker.
 *
 * **The reference path is load bearing, and it is not the package root.**
 * The pool's top level `types` points at its config types; `cloudflare:test`
 * is declared under the `./types` subpath. Reference the root and `SELF`, `env`
 * and `applyD1Migrations` are all undeclared, with an error that reads as
 * though the package were broken. Enodia's note, carried over.
 *
 * `tsconfig.worker.json` sets `types: []`, which switches off automatic
 * inclusion, so this reference is the only thing pulling these in.
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />
