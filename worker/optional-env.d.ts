/**
 * Bindings that may or may not exist, typed as exactly that.
 *
 * `npm run types` writes `worker-configuration.d.ts` from what `wrangler.jsonc`
 * and `.dev.vars` actually declare, so a setting that is not configured yet
 * does not appear there at all. These two are read by `index.ts` and are
 * absent until Stage 2, when stigly has a domain to send mail from:
 *
 *   RESEND_API_KEY   a secret, `wrangler secret put RESEND_API_KEY`
 *   MAIL_FROM        a `var` in wrangler.jsonc, on the bought domain
 *
 * Declared optional here rather than faked into `.dev.vars` as empty strings,
 * which would type them as always present and make the type say something
 * production does not. Once Stage 2 lands both come from the generated file
 * and this one can go.
 */

/**
 * Merged into the global `Env`, which is the name `index.ts` uses.
 *
 * The wrangler that generated worker-configuration.d.ts on 25 September 2026
 * makes the global `Env` and `Cloudflare.Env` siblings, both extending an
 * internal base, so augmenting `Cloudflare.Env` alone, the way older generated
 * files allowed, reaches nothing. Both are augmented so either spelling sees
 * the same shape.
 */
interface Env {
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

declare namespace Cloudflare {
  interface Env {
    RESEND_API_KEY?: string
    MAIL_FROM?: string
  }
}
