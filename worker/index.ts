/**
 * The API. Everything else on this origin is a static file.
 *
 * `wrangler.jsonc` sets `run_worker_first: ["/api/*"]`, so this function is
 * only ever entered for those paths. A page load, an item icon and a theme
 * texture never reach it, which is the difference between free and metered:
 * static asset requests are unlimited on every plan, Worker invocations are
 * 100k a day on the free one.
 *
 * Same origin on purpose. `public/_headers` says `connect-src 'self'` and this
 * answers on the same hostname, so the whole API works under a policy that
 * never had to be opened up for it.
 *
 * Shaped after Enodia's `worker/index.ts` in `C:\Dev\Hades 2`, which carries
 * a dozen more routes. Each arrives here with the stage that needs it, rather
 * than as a route nothing calls.
 *
 * ## What is here, Stage 1
 *
 *   /api/auth/*        handed whole to better-auth: sign up, sign in, sign out, session
 *   /api/capabilities  what this deployment can do. Public, and honest about mail
 *   /api/me            who is signed in
 *
 * ## What is deliberately not here yet
 *
 * **`worker/limit.ts`**, the counter for routes better-auth cannot see. The
 * three routes above are either better-auth's own, which it limits itself, or
 * a session read. Enodia's limiter arrives with Stage 3, sync, which is the
 * first route of ours that writes anything.
 */

import { drizzle } from 'drizzle-orm/d1'

import { createAuth } from './auth.ts'
import * as schema from './schema.ts'

/**
 * `Env` is not declared here. `npm run types` derives it from `wrangler.jsonc`
 * into `worker-configuration.d.ts`, so a binding added to the config cannot go
 * missing from the types. Re-run it after editing the config.
 *
 *   DB                   the D1 database
 *   BETTER_AUTH_SECRET   signs every session cookie. `wrangler secret put
 *                        BETTER_AUTH_SECRET` in production, `.dev.vars` locally,
 *                        which is gitignored. Rotating it signs everybody out,
 *                        which is the right behaviour if it ever leaks
 */

/**
 * Every response this Worker sends, better-auth's included, leaves through here.
 *
 * **public/_headers does not reach the API.** It applies to static assets only,
 * so until this existed every /api/* response went out with no nosniff and no
 * cache instruction, including /api/me, which carries a name and an email.
 * Measured under wrangler dev on 25 September 2026 by reading the response;
 * Enodia's Worker has the same gap.
 *
 *   x-content-type-options: nosniff   a JSON body is never read as anything else
 *   cache-control: no-store           an account's answer is never kept by a cache,
 *                                     unless a route has already said otherwise
 *
 * Copying into a fresh Response keeps every Set-Cookie better-auth wrote;
 * auth.test.ts would fail on the session tests if it did not.
 */
const harden = (response: Response): Response => {
  const out = new Response(response.body, response)
  out.headers.set('x-content-type-options', 'nosniff')
  if (!out.headers.has('cache-control')) out.headers.set('cache-control', 'no-store')
  return out
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return harden(await route(request, env))
  },
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  /**
   * Fail loudly and early. A missing secret means every cookie this Worker
   * issues is signed with `undefined`, which is not an error anywhere in the
   * stack and is a silent authentication bypass.
   *
   * So a fresh checkout with no `.dev.vars` answers 500 on every `/api/*`.
   * That is this line doing its job, not a regression.
   */
  if (!env.BETTER_AUTH_SECRET) {
    return json({ error: 'server misconfigured' }, 500)
  }

  // Built per request, and they have to be: a D1 binding does not exist
  // outside one. The origin comes off the request rather than a config, so
  // the same code serves workers.dev and the bought domain without being told.
  const db = drizzle(env.DB, { schema })
  const auth = createAuth(db, env.BETTER_AUTH_SECRET, url.origin, {
    RESEND_API_KEY: env.RESEND_API_KEY,
    MAIL_FROM: env.MAIL_FROM,
  })

  if (url.pathname.startsWith('/api/auth/')) {
    return auth.handler(request)
  }

  /**
   * What this deployment can actually do. Public, and it exists for one
   * reason: password reset only works when mail is configured, and the UI
   * must not offer a flow that silently sends nothing.
   */
  if (url.pathname === '/api/capabilities') {
    return json({ passwordReset: Boolean(env.RESEND_API_KEY && env.MAIL_FROM) })
  }

  if (url.pathname === '/api/me') {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return json({ error: 'not signed in' }, 401)
    return json({
      user: { id: session.user.id, email: session.user.email, name: session.user.name },
      expiresAt: session.session.expiresAt,
    })
  }

  return json({ error: 'no such route' }, 404)
}
