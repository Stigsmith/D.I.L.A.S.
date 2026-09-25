/**
 * Accounts. Email and password, and nothing else yet.
 *
 * Stage 1 of `dds-cloudflare-handover.md`. Ported from Enodia's
 * `worker/auth.ts` in `C:\Dev\Hades 2`, nearly verbatim, because every option
 * below is a lesson that project paid for. Read its docblocks before changing
 * one; they are longer than these.
 *
 * The gate is loose on purpose: **viewing is free, creating is free, saving
 * locally is free. An account is only needed to share or compete.** Nothing
 * that works in D.D.S. today starts asking who you are.
 *
 * ## Why a factory rather than a module level instance
 *
 * A D1 binding only exists inside a request. Building the auth object at module
 * scope, which is how every framework example writes it, throws in a Worker
 * because `env` is not there yet. So this takes the database and hands back an
 * instance, and `index.ts` calls it per request.
 *
 * ## The decisions worth knowing
 *
 * **`transaction: false`.** D1 has no interactive transactions, only batches.
 * The adapter defaults to false already, but a correctness property should not
 * rest on a default that could change.
 *
 * **Password reset exists only when mail is configured.** `email.ts` reports
 * whether a provider is set and the reset flow is added only when it is. The
 * alternative, which better-auth allows, is an endpoint that succeeds and sends
 * nothing while somebody waits for a letter that was never written.
 *
 * Email verification is off, and that is a separate call: verification locks
 * somebody out of their own account until they find a letter, whereas reset is
 * the only route back in.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { configured, resetLetter, send } from './email.ts'
import * as schema from './schema.ts'

/** A week. Long enough that signing in is rare, short enough that a stolen one expires. */
const SESSION_DAYS = 7

/** What `send` needs, threaded through so this file names no environment variable. */
type Mail = { RESEND_API_KEY?: string; MAIL_FROM?: string }

export function createAuth(
  db: DrizzleD1Database<typeof schema>,
  secret: string,
  origin: string,
  mail: Mail = {},
) {
  const canMail = configured(mail)
  return betterAuth({
    secret,
    // Derived from the request rather than configured, because the same code
    // serves dds.<subdomain>.workers.dev today and the bought domain later, and
    // a baseURL that disagrees with the host breaks cookies rather than
    // erroring.
    baseURL: origin,
    basePath: '/api/auth',
    // Same origin by construction: public/_headers says connect-src 'self' and
    // this Worker answers on the same hostname. Stated so nobody assumes it is
    // open.
    trustedOrigins: [origin],

    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
      // D1 batches, it does not do interactive transactions.
      transaction: false,
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,

      /**
       * **A reset signs every other session out, and the default does not.**
       * People reset a password because they think somebody else has it, and a
       * new password that leaves that person signed in for another week did not
       * reset anything.
       */
      revokeSessionsOnPasswordReset: true,

      ...(canMail
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
              await send(mail, { to: user.email, ...resetLetter(url) })
            },
            // An hour. Long enough to find the letter, short enough that a link
            // sitting in an old inbox is not a way in.
            resetPasswordTokenExpiresIn: 3600,
          }
        : {}),
    },

    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      // Sliding: a week from last use rather than a week from sign in.
      updateAge: 24 * 60 * 60,
    },

    /**
     * **Rate limiting, stated rather than defaulted, because the default is off
     * here and looks on.**
     *
     * better-auth sets `enabled: options.rateLimit?.enabled ?? isProduction`,
     * and `isProduction` is `NODE_ENV === 'production'`, which Workers never
     * sets. Enodia measured it before stating this: 150 wrong passwords in 12
     * seconds, all 401, not one 429. `auth.test.ts` holds it.
     *
     * `storage: 'database'` because a Worker's memory is per isolate on an edge
     * that runs many and evicts them constantly, so a memory counter is close to
     * no counter. D1 is the only thing every isolate shares.
     *
     * This is the application level limit. **A Cloudflare rate limiting rule at
     * the edge is better and free**, because it rejects before a Worker runs, and
     * it is stigly's to configure in the dashboard.
     */
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        // Sign up is the expensive one: it writes a user that persists.
        '/sign-up/email': { window: 3600, max: 10 },
        // Sign in is the one worth brute forcing.
        '/sign-in/email': { window: 300, max: 20 },
        // Every call mails a stranger's address using the domain's reputation.
        '/request-password-reset': { window: 3600, max: 3 },
      },
    },

    advanced: {
      /**
       * **`cf-connecting-ip`, never the default `x-forwarded-for`.** Cloudflare
       * appends to that one rather than replacing it, so a caller who sends
       * their own arrives with a value of their choosing in front, and every
       * limit above is keyed on the address. `cf-connecting-ip` is set by
       * Cloudflare and overwritten on every request.
       */
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },

      // One origin. Nothing embeds it, `frame-ancestors 'none'` says so, and a
      // cross site cookie would be a capability nothing needs.
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
