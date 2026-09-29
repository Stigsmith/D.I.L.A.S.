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
 * Shaped after Enodia's `worker/index.ts` in `C:\Dev\Enodia`, which carries
 * a dozen more routes. Each arrives here with the stage that needs it, rather
 * than as a route nothing calls.
 *
 * ## What is here, Stage 1
 *
 *   /api/auth/*        handed whole to better-auth: sign up, sign in, sign out, session
 *   /api/capabilities  what this deployment can do. Public, and honest about mail
 *   /api/me            who is signed in
 *
 * ## The live party, Stage 7, which came before accounts open
 *
 *   POST /api/party         open a party. Answers with its code
 *   GET  /api/party/<code>  the WebSocket for one party, handed to its Durable Object
 *
 * Neither needs an account: the curator's call, 27 September 2026, because
 * accounts cannot open until a domain exists and a party code needs only this
 * Worker. `worker/party.ts` is the party; `worker/limit.ts` counts both routes,
 * which are the first of ours better-auth cannot see.
 */

import { drizzle } from 'drizzle-orm/d1'

import { createAuth } from './auth.ts'
import { RULES, addressKey, take } from './limit.ts'
import { cleanName, hashToken, newCode, normaliseCode, validToken } from './party.ts'
import * as schema from './schema.ts'

/** The Durable Object class has to be exported from the entry point to exist. */
export { Party } from './party.ts'

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
  // A WebSocket upgrade cannot be copied into a fresh Response: the copy loses
  // the socket and a 101 without one throws. It carries no body to sniff and
  // nothing to cache, so it goes out as the Durable Object made it.
  if (response.status === 101) return response
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

/**
 * A refusal from `limit.ts`, with the wait in the sentence, because "too many
 * requests" with no number is indistinguishable from being broken. Enodia's
 * shape: `retry-after` is the standard header, `x-retry-after` is what
 * better-auth sends on its own routes, and both are set.
 */
const tooMany = (retryAfter: number) =>
  new Response(
    JSON.stringify({
      error: `Too many tries. Wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} and try again.`,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': String(retryAfter),
        'x-retry-after': String(retryAfter),
      },
    },
  )

/**
 * Same origin or nothing. better-auth checks this on its own routes; the party
 * routes are ours, so they check it here. A page on another site cannot open
 * parties in a visitor's name or hold sockets on this API.
 *
 * **A plain same-site GET carries no Origin header at all**, so demanding one
 * there refuses this tool's own pages. Found on 29 September 2026: the drop
 * screen's "does this party exist" question got a 403, read it as a dropped
 * line, and retried a dead code forever. So a missing Origin is accepted on a
 * plain GET, where a foreign page could not read the answer anyway, and
 * required everywhere a browser always sends one: a POST and a WebSocket.
 */
const sameOrigin = (request: Request, url: URL) => request.headers.get('origin') === url.origin
const noForeignOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get('origin')
  return origin === null || origin === url.origin
}

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

  if (url.pathname === '/api/party') {
    if (request.method !== 'POST') return json({ error: 'Open a party with a POST.' }, 405)
    if (!sameOrigin(request, url)) return json({ error: 'wrong origin' }, 403)
    const over = await take(db, addressKey('open', request), RULES.open)
    if (over) return tooMany(over.retryAfter)

    const raw = await request.text()
    if (raw.length > 1024) return json({ error: 'That request is too large.' }, 413)
    let body: { token?: unknown; name?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: 'That request is not JSON.' }, 400)
    }
    if (!validToken(body.token)) return json({ error: 'No token.' }, 400)
    const name = cleanName(body.name) ?? 'Helldiver'
    const tokenHash = await hashToken(body.token)

    /**
     * A clash with a live party is one in hundreds of millions per try, so
     * five tries failing means something else is wrong. Said plainly rather
     * than looping.
     */
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode()
      const stub = env.PARTY.get(env.PARTY.idFromName(code))
      if (await stub.open(code, tokenHash, name)) return json({ code }, 201)
    }
    return json({ error: 'Could not find a free code. Try again in a moment.' }, 503)
  }

  /**
   * One party. A WebSocket upgrade joins it; a plain GET only asks whether it
   * exists, answering 404 or 426, because a browser whose socket failed to
   * open is told nothing about why and would otherwise retry a dead code
   * forever. Both go through the same limit, so asking is no cheaper than
   * guessing. The Durable Object decides which answer.
   */
  const joining = url.pathname.match(/^\/api\/party\/([^/]+)$/)
  if (joining) {
    if (request.method !== 'GET') return json({ error: 'Join a party with a GET.' }, 405)
    const upgrading = request.headers.get('upgrade')?.toLowerCase() === 'websocket'
    if (upgrading ? !sameOrigin(request, url) : !noForeignOrigin(request, url)) {
      return json({ error: 'wrong origin' }, 403)
    }
    const code = normaliseCode(decodeURIComponent(joining[1] ?? ''))
    if (!code) return json({ error: 'That is not a party code.' }, 404)
    const over = await take(db, addressKey('join', request), RULES.join)
    if (over) return tooMany(over.retryAfter)
    return env.PARTY.get(env.PARTY.idFromName(code)).fetch(request)
  }

  return json({ error: 'no such route' }, 404)
}
