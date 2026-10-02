# **D.I.L.A.S.: Handover From Enodia, Hosting, Accounts And The Live API**

> Written 25 September 2026 in the Enodia repo, for the next Claude session that opens `C:\Dev\dds`. Enodia is stigly's Hades II tool. It has already done everything in the v2 and v3 half of `dilas-roadmap.md`: it moved off Netlify onto Cloudflare Workers, opened accounts, synced between devices, published builds under short links, built an exchange with friends and leaderboards, and sent password resets from its own domain. This file says what to take from it, in what order, and what it cost Enodia to learn.

> [!danger] The source is the code, not this file
> Every Enodia claim below names a file in **`C:\Dev\Enodia`**. Open that file before porting anything. The docblocks there are long on purpose and they carry reasoning this summary drops. If this file and the code disagree, the code wins, and this file should be corrected.
>
> One example, found while writing this: the comment in `worker/limit.ts` says publishing is capped at fifty builds per account, and `MAX_PER_USER` in `worker/publish.ts` is **100**. The comment went stale and the number did not.

> [!warning] Assistant knowledge of Cloudflare's limits and prices is not a source
> Anything here that Enodia **measured** is stated as fact, with its file. Anything about Cloudflare, Resend or the Helldivers APIs that Enodia never tested is marked **verify**. Check it against the current docs or a real response before building on it. That is the same rule the D.I.L.A.S. `CLAUDE.md` already applies to wikis.

---

# **Decisions Already Made**

Settled with stigly on 25 September 2026. Do not reopen them.

| | |
|---|---|
| **Host** | Cloudflare Workers, the **same Cloudflare account** as Enodia |
| **Mail** | Resend, the **same Resend account** as Enodia, with a sending domain of its own |
| **Database** | Its **own D1**, never Enodia's. Two products do not share a user table |
| **Domain** | **Its own, not bought yet.** Buying it is stigly's job. Until then the `*.workers.dev` address works |
| **"The official API"** | **Live war state**: Arrowhead's API, reached through the community proxies (`api.helldivers2.dev`, DiveHarder). Planet ownership, campaigns, the Major Order and planet effects |

---

# **Where D.I.L.A.S. Stands Today**

Measured on 25 September 2026, not recalled.

| | |
|---|---|
| Stack | Vite 6, React 18, **JavaScript**, Tailwind 3, `lucide-react`. Enodia is TypeScript on Vite 8 and React 19. The backend does not care |
| Routing | Hash routes from `src/lib/router.js`. **No path ever reaches the server**, so no rewrite rules are needed today |
| State | All of it in `localStorage`: `KEYS` in `src/lib/storage.js`, plus `hd2-theme` in `theme.js` and the scenario keys in `scenario.js`. Grep `localStorage` under `src/` for the full list before designing sync |
| Deploy | stigly runs `npm run build` in `cmd` and **drags `dist` onto Netlify**. No `netlify.toml` and no `_headers`, so no security headers at all |
| Network at runtime | None. Planets, weapons and missions are fetched at build time by `npm run wiki` and shipped |
| Uncommitted work | As of this writing, 14 modified files and 7 untracked paths, among them `App.jsx`, `Builder.jsx`, `DropBay.jsx`, `Tiers.jsx`, `score.js`, both docs and the Phase 5 files `build.js` and `build-rules.json`. Only two commits exist. **Look at `git status` first and ask before branching over them** |

The dependency chain in `dilas-roadmap.md` ("The dependency chain") still holds, and Enodia confirms it: **auth and shared storage first, then Exchange, then live squad.** The live war state layer needs no account (`dilas-roadmap.md`, "Order, revised") and can go in right after hosting moves.

---

# **The Target**

> [!success] One origin, static first, a Worker only for `/api/*`
> `dist/` is served as Workers static assets. A Worker script answers `/api/*` and nothing else. D1 holds the data through Drizzle, better-auth runs accounts, and Resend sends mail. The browser only ever talks to its own origin, which is what lets the Content Security Policy say `connect-src 'self'` and mean it.

```
browser ──► yourdomain/            static assets  (free, unlimited)
        ──► yourdomain/api/*       Worker script  (counted: 100k/day on the free plan)
                                     ├─ D1        (accounts, sync, builds, stats, war snapshot)
                                     ├─ Resend    (password reset letters)
                                     └─ upstream  (war state, fetched by the Worker, never the browser)
```

**Why same origin matters so much.** Enodia's `assets/_headers` sets a strict CSP, and `worker/index.ts` opens with the reason: the API is on the same hostname, so the policy never had to be widened for it. The live API follows the same logic. The Worker fetches the upstream and the browser fetches the Worker, so no third-party host is ever added to `connect-src`, and no CORS, no user agent and no user IP ever reach the upstream.

### The config, adapted

Read Enodia's `wrangler.jsonc` in full first, because every key in it carries a comment explaining why. The D.I.L.A.S. version should look like this once Stage 1 lands. Stage 0 is the same file without `main`, `d1_databases` and `vars`.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "dilas",
  "main": "worker/index.ts",
  // Enodia uses 2026-09-02. Anything past 2025-04-01 is what not_found_handling relies on
  "compatibility_date": "<today>",
  // better-auth needs node builtins. Without this the Worker fails to start
  "compatibility_flags": ["nodejs_compat"],

  // Once the domain exists. custom_domain makes Cloudflare create DNS and the certificate
  "routes": [{ "pattern": "<the domain>", "custom_domain": true }],
  "workers_dev": true,

  "assets": {
    "directory": "./dist",
    // Optional while every route is a hash. Needed the day /b/<id> short links exist
    "not_found_handling": "single-page-application",
    // THE LINE THAT KEEPS THIS FREE. Never `true`: every icon would become a billable call
    "run_worker_first": ["/api/*"]
  },

  "d1_databases": [
    { "binding": "DB", "database_name": "dilas", "database_id": "<from wrangler d1 create>", "migrations_dir": "migrations" }
  ],

  // Not secrets. Printed on every letter and every upstream request
  "vars": {
    "MAIL_FROM": "<Name> <someone@the domain>",
    "SUPER_CLIENT": "dilas.me",
    "SUPER_CONTACT": "<a project address on the domain, ask stigly>"
  }
}
```

> [!warning] The binding is `DB`, not the database name
> `wrangler d1 create` suggests a binding named after the database. The code says `env.DB`, and the types generated by `npm run types` follow the config. Enodia's `wrangler.jsonc` has the note.

---

# **Stage 0: Move Hosting, No Backend Yet**

Small, independent, and worth doing first on its own: it puts security headers on the site for the first time and proves the deploy path before anything depends on it.

1. **`wrangler` as a dev dependency** and a `deploy` script: `"deploy": "npm run build && wrangler deploy"`. Enodia's `package.json` has the same.
2. **`wrangler.jsonc`** as above, assets only.
3. **`public/_headers`.** D.I.L.A.S.' Vite `publicDir` is the default `public/`, so that is the only route into `dist/`. Port Enodia's `assets/_headers`, **with its comments**, and adjust:
   - `/assets/*` immutable for a year. That is easier here than in Enodia: D.I.L.A.S. item art lives under `src/assets` and is imported, so Vite fingerprints it. Check that no art is referenced by a stable path from `public/` before assuming every image is hashed
   - `/index.html` `max-age=0, must-revalidate`
   - `/*` gets `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` **without `preload`**, and the CSP
4. **The fonts. Fix this first or the CSP breaks the site.** `src/App.jsx:35` and `src/Tiers.jsx:43` `@import` Oswald and JetBrains Mono from `fonts.googleapis.com`. A CSP of `style-src 'self'` blocks the import and `font-src` defaulting to `'self'` blocks `fonts.gstatic.com`. **This is exactly the bug Enodia shipped**, and nobody saw it because Netlify never applied the policy. Recommended fix: vendor the faces, as Enodia's `scripts/fonts.ts` does, so the page loads nothing from anybody else. The alternative, adding both Google hosts to the policy, works and leaks every visitor's IP to Google.
5. **Verify under `wrangler dev`, never by reading the config.** Add a `workers` entry to `.claude/launch.json` the way Enodia's has, `npx wrangler dev --port 8787`, and curl the real responses:
   ```bash
   curl -sI http://localhost:8787/
   ```
   Check each header by reading it, and load the page in the preview to confirm fonts render and the console has no CSP violations.
6. **Deploy, then prove it landed.** See pitfall 9 below. A version id and "100%" are not evidence.

> [!danger] Moving origin empties everybody's collection
> `localStorage` is per origin. The first visit to the new address starts empty, which is the warning already in D.I.L.A.S. `CLAUDE.md` under Hosting. D.I.L.A.S. has Export and Import in Settings, which is exactly the tool for this. Before the Netlify site is retired, ship one last Netlify build with a notice: the new address, and "Export here, Import there". Then leave the Netlify site up for a while rather than deleting it on the same day. Who uses the tool and how long to keep Netlify up are stigly's calls.

> [!info] What stigly does himself in this stage
> Buying the domain, and `wrangler login` once, which opens a browser to authorise. After that a deploy is `cmd` in the address bar of `C:\Dev\dds`, then `npm run deploy`. The same PowerShell note in `CLAUDE.md` applies.

---

# **Stage 1: The Worker, D1 And Accounts**

### What to port, file by file

All paths are in `C:\Dev\Enodia`. **Keep the Worker in TypeScript** even though the app is JS: wrangler bundles TS itself, the Worker types are generated, and the typecheck runs as its own project so the Workers globals and the DOM globals never collide (`tsconfig.worker.json` explains why).

| Enodia file | Port | Notes |
|---|---|---|
| `worker/index.ts` | **Shape as is**, routes rewritten | One `fetch`, `json()`, `tooMany()`, per-request `drizzle` and `createAuth`. **Keep the `BETTER_AUTH_SECRET` guard at the top**: without it every cookie is signed with `undefined`, which is not an error anywhere and is an authentication bypass |
| `worker/auth.ts` | **Nearly verbatim** | Every option in it is a lesson. See pitfalls 1 to 4 |
| `worker/auth.config.ts` | Verbatim | A stand-in instance so the schema CLI can read the options |
| `worker/limit.ts` | **Verbatim**, retune `RULES` | The single-statement upsert is the whole point. See pitfall 4 |
| `worker/email.ts` | Structure verbatim, letter rewritten | `configured()` and `send()` carry over. `resetLetter` is Dora's voice and is Enodia's own |
| `worker/schema.ts` | **Generate, never copy** | `npm run db:schema` writes it. See pitfalls 5 and 6 |
| `worker/schema-app.ts` | Pattern only | Your own tables, hand written, in a separate file |
| `drizzle.config.ts` | Verbatim | Reads both schema files |
| `vitest.worker.config.ts`, `worker/test-setup.ts`, `worker/env.d.ts` | Verbatim | Tests run inside workerd against a real local D1 |
| `tsconfig.worker.json` | Adapt | D.I.L.A.S. has no root `tsconfig.json` to extend, so this one has to stand alone |

### Setup, in order

```bash
npm install better-auth drizzle-orm
npm install -D wrangler drizzle-kit @cloudflare/vitest-pool-workers vitest typescript
npx wrangler d1 create dilas
```

Put the id it prints into `wrangler.jsonc`, then:

```bash
npm run db:schema
npm run db:generate
npm run db:migrate
npm run types
```

Scripts, from Enodia's `package.json`:

```json
"deploy": "npm run build && wrangler deploy",
"db:schema": "npx auth@latest generate --config worker/auth.config.ts --output worker/schema.ts --y",
"db:generate": "drizzle-kit generate",
"db:migrate": "wrangler d1 migrations apply dilas --local",
"types": "wrangler types",
"test:worker": "vitest run --config vitest.worker.config.ts"
```

Secrets: `.dev.vars` locally, and add `.dev.vars`, `.dev.vars.*` and `.wrangler/` to the tool's `.gitignore` first, because it names none of them today. In production, `npx wrangler secret put BETTER_AUTH_SECRET` in production. Remote migrations are `npx wrangler d1 migrations apply dilas --remote`, run before deploying the code that needs them.

> [!warning] Without `.dev.vars`, every `/api/*` answers 500
> That is the secret guard doing its job, not a regression. Enodia lost time to it in fresh worktrees.

### The gate

**Viewing is free, creating is free, saving locally is free. An account is only needed to share or compete.** That is Enodia's rule (`src/state/account.ts`), and it suits D.I.L.A.S.: nothing that works today should start asking who you are. Enodia keeps an `ACCOUNTS_LIVE` flag in the UI so accounts can be switched off with one line and a deploy. **It is only a UI gate.** The API works for anyone who calls it, so every server route has to be safe on its own.

---

# **Stage 2: Mail And Password Reset**

> [!danger] Do not open accounts until a forgotten password has a way back
> An account you can be locked out of permanently is a trap with a nice form on it. Enodia kept accounts shut until reset worked end to end: the letter sends, the link lands on a real screen, and the new password takes. `ROADMAP.md` records that the reset form once worked, the letter once sent, and the link then landed on a page where nothing happened.

- **Resend, on a subdomain.** Enodia's records sit on `send.enodia.me`, so the apex SPF, where Proton receives mail, never had to be edited (`ROADMAP.md`, "Blocked, and on whom"). Do the same on the D.I.L.A.S. domain. Adding and verifying the domain in Resend is stigly's job, in the dashboard
- `RESEND_API_KEY` is a secret. `MAIL_FROM` is a `var`, because it is printed on every letter and therefore is not secret
- **`/api/capabilities`** tells the UI whether reset exists. `worker/auth.ts` only adds `sendResetPassword` when mail is configured, so nobody ever sees "check your email" for a letter that was never sent
- `revokeSessionsOnPasswordReset: true`. People reset a password because they think somebody else has it
- Plain text, no HTML, no images. Boring subject line, the link near the top, one line saying what the link is for before the reader reaches it (`worker/email.ts`, `resetLetter`)
- Email verification stays **off**. It is a separate decision, and the reasoning is in `worker/auth.ts`
- Rate limit reset requests at 3 an hour: every call mails a stranger's address using the domain's reputation

---

# **Stage 3: Sync Between Devices**

This is the thing D.I.L.A.S.' roadmap actually asks for: "log in elsewhere and your collection is there" (`dilas-roadmap.md`, "Accounts before profiles").

Read `worker/sync.ts`, `src/state/sync.ts`, `src/state/stamps.ts` and `src/state/useSync.ts`, and the `syncItem` docblock in `worker/schema-app.ts`. The design:

| | |
|---|---|
| **One table, one route** | `sync_item (user_id, kind, item_id, payload, modified, deleted)`. One `POST /api/sync` sends what changed here since last time and gets back what changed anywhere else. Two calls would be two chances to half-succeed |
| **Opaque payloads** | The server never reads one. A change to the data format is not a migration |
| **Newest wins, per item** | On the **client's** clock. A device with a wrong year wins every conflict, and stamping on arrival instead is worse: it orders offline edits by who reconnected first |
| **Tombstones** | A delete is `deleted = true` with a fresh `modified`, never a SQL `DELETE`, and tombstones are kept. Otherwise the next device to sync helpfully resurrects the thing |
| **Apply without stamping** | Writing an arriving change must not mark it as a local edit, or two devices hand the same item back and forth forever |
| **Listed keys, never a wildcard** | The `setting` kind syncs whole `localStorage` keys from an explicit list. The device's own bookkeeping keys never sync |
| **Bounded** | 16 KB per item, 2000 items per account, 500 per call, unknown kinds refused |

**Mapping D.I.L.A.S. onto it** is the D.I.L.A.S. session's first design job, and it has to be done from the code, not from memory:

- **Loadouts** (`hd2-loadouts`) as one item per loadout. Each needs a stable id and a `modified` time. Check whether they carry one, and add it if not
- **Locks, favorites, warbonds, profiles, theme, scenario** as whole keys. Newest wins per key: an edit to the same key on two devices inside one sync window loses one of them. Enodia judged that rare enough to accept
- The migration keys D.I.L.A.S. reads once and keeps, such as `hd2-brief-*`, **do not sync**

> [!question] Do profiles survive accounts
> `dilas-roadmap.md` recommends keeping them separate. It is still stigly's call, and sync is the moment it has to be made, because it decides whether `hd2-profiles` is one item or several.

> [!bug] Sync must not remount the screen
> Enodia rendered `<Builds key={libraryAt}>`, so every sync rebuilt the whole screen, and sync runs on every focus. Alt-tabbing back from the game threw away an open build and an unsaved draft (`ROADMAP.md`, "Fixed on 11 September"). Treat the sync signal as "re-read storage", never as a React `key`. D.I.L.A.S.' `App.jsx` holds builder state that the same mistake would destroy.

---

# **Stage 4: Publishing And Short Links**

`worker/publish.ts` and `src/state/publish.ts`. What carries over:

- **The server has no opinion about what a build is.** The payload is packed by the browser, stored as text and handed back packed. No item id is validated server side, and no second copy of the game data lives in the Worker. The browser already does this for share links
- Ids are 10 characters from an alphabet with no `0 O 1 l I`, from `crypto.getRandomValues`
- `POST /api/builds` publishes, `PUT /api/builds/<id>` replaces in place, `DELETE` **takes down**, and `POST /api/builds/<id>/restore` puts back. `GET /api/b/<id>` is public, because a link that needs an account is useless
- **Taking down is `taken_down_at`, not a delete.** Enodia's first version deleted the row, and `on delete cascade` destroyed every run and rating logged against it and the build in every follower's library (`ROADMAP.md`, "Following got its guarantees")
- **The `shape` token.** The browser fingerprints the picks and sends the hash. The server stores and compares it and never reads it. It is how stats know which version of a build a run was played on
- **Facet tokens.** The browser sends short strings describing its own build, such as `primary:<id>` or `faction:bots`. The server stores and groups them for leaderboards and never interprets one. `src/state/facets.ts` owns the vocabulary. D.I.L.A.S.' stable item ids (`CLAUDE.md`, "Ids are the primary key") are exactly what these want
- Caps: 16 KB payload, 120-character name, a per-account total, and a publish rate limit, because republishing over one id replaces rather than adds

> [!bug] Assert the request body in the client tests
> Enodia's `publishBuild` never sent `shape` while `republishBuild` did, so every listing published once and never replaced had its runs silently discarded. Nothing showed it, because zero is what an unplayed build looks like. Neither publish test checked the body.

Short links need a path route, `/b/<id>`, which is where `not_found_handling: "single-page-application"` starts to matter and where the hash router needs one path-based entry.

---

# **Stage 5: Exchange, Friends And Leaderboards**

`worker/exchange.ts`, `worker/friends.ts`, `worker/boards.ts`, and in `worker/schema-app.ts` the tables `exchange_stat`, `build_facet`, `friend_code` and `friendship`. Client halves in `src/state/exchange.ts`, `friends.ts`, `boards.ts`, `offers.ts`, and `src/ui/Leaderboards.tsx`.

### Rules that carry over as they are

> [!danger] Counts, never a score
> Every stat is a tally: takes, players, runs, clears, best difficulty, a mean rating **with how many it is a mean of**. A board orders by **one** counted column and never combines two. That is why Enodia has no clear-rate board: five clears from five runs would outrank ninety from a hundred, and the board would be claiming quality when all it has is less evidence (`worker/boards.ts`). D.I.L.A.S. already keeps its community rating and its own rating separate, so it should hold to the same rule.

- **Stats are keyed per version**, `(build_id, user_id, shape)`. Otherwise an author replaces the build and keeps its numbers
- **User ids never go over the wire.** `mine` is a boolean computed server side. The person who played a build stays private, and who published it never was
- **An author cannot take, play or rate their own build.** Three Enodia routes shipped without that check
- **Friends by code, not by search.** Searching by email lets a stranger test whether an address has an account. Names are not unique. An 8-character code, rotatable, and redeeming it counts as consent from both sides. Two rows per friendship for one indexed lookup
- **Four shelves**: All (public), Friends, Mine (taken-down included, or an author can never put one back), Followed (taken-down included, because a followed build keeps working)
- **All the boards come from one query.** `scan` reads live listings once and each board sorts that array. D1 bills rows read. The `SCAN` ceiling is named, so a truncated board is never silently wrong
- **Following, not copying.** A followed build updates, prose changes apply quietly, and a changed loadout waits as an offer (`src/state/offers.ts`). An offer never outranks a real edit in sync

### What D.I.L.A.S. has to decide, not inherit

> [!question] For stigly
> - **What is a run, and what is a clear?** Enodia's is a Hades run and a boss kill, at a Fear level. D.I.L.A.S.' could be a mission, an operation, extraction, a difficulty, a squad size. Leaderboards cannot exist until this is answered
> - **Which boards.** Candidates from the facets: most followed builds, most runs per faction, most published primary or stratagem, highest difficulty cleared. Counts only
> - **Moderation.** Enodia opened a public shelf knowing it had no report and no hide. The defence is narrow: a listing carries a build name and a display name and no other free text (`worker/exchange.ts`, `worker/index.ts` docblock). D.I.L.A.S. builds carry notes, and LFG would carry more. Decide this before anything discoverable ships
> - **The 39 curated builds are binned** (`dilas-roadmap.md`). Enodia also dropped its curated shelf. Nothing needs porting there

---

# **Stage 6: Live War State, The API**

Independent of accounts, and it pairs with the starmap in Phase 6a. It can ship any time after Stage 0.

> [!success] Built in D.I.L.A.S. 1.25.0, 30 September 2026, as designed below. Not yet deployed
> A Cron Trigger every five minutes, one trimmed row in D1 (`war_snapshot`), `GET /api/war` with `Cache-Control: public, max-age=60`, and the browser refusing anything over thirty minutes old. `worker/war.ts`. What the "verify" list below found:
>
> - **Rate limit:** 5 requests per 10 seconds, from the upstream's README. This design makes 3 per 5 minutes.
> - **Cron allowance:** 5 Cron Triggers per account on the free plan, 10 ms CPU each. Parsing the planet answer measured 1.5 ms.
> - **Endpoints:** `/api/v1/planets` for ownership, health, defences and players; `/api/v1/campaigns` for which planets are fronts; `/api/v1/assignments` for the Major Order, whose failure alone does not fail the fetch. Planet effects are not read yet.
> - **Headers:** both `X-Super-Client` **and** `X-Super-Contact` are required by the live service, which answers 400 without either, although its README calls the contact optional. The contact is a placeholder until stigly picks a project address.
> - **The Cache API on workers.dev** was not needed: the cron snapshot made it moot.

> [!danger] The API decorates, it never carries
> D.I.L.A.S.' own rule, from `dilas-roadmap.md`, and the backend is built around it. The shipped planet table is identity and layout. Live state only colours it in. If the upstream is down, you lose the colouring and nothing else: no spinner on the critical path, and never a stale ownership map presented as current.

### Design

1. **A Cron Trigger fetches the upstream on a schedule** (every 5 to 10 minutes; **verify** the free-plan cron allowance) and upserts a snapshot into D1: one row per endpoint, holding `payload`, `fetched_at` and `ok`. The upstream is then called a fixed number of times a day whatever the traffic, which is the polite way to use a community-run proxy.
2. **`GET /api/war`** reads the snapshot and returns it with `fetched_at`, plus `Cache-Control: public, max-age=60`. **The browser decides whether it is too old to show**: past a threshold, say 30 minutes, it draws the uncoloured map and says why. The server never hides staleness.
3. **Headers.** `api.helldivers2.dev` refuses requests without `X-Super-Client` and `X-Super-Contact` (`dilas-roadmap.md`, "Map positions are patch data"). Both go in `vars`. The contact should be a project address on the new domain, never a personal one, and that is stigly's to pick.
4. **Trim before storing.** Keep only the fields the app draws: owner, liberation, campaigns, active effects, the Major Order. It keeps the D1 row small and the response small.
5. **Join by name**, as the build-time fetch already does. Two sources agreeing on an order is not something to bet a map on.

Why a cron snapshot rather than a pass-through with the Cache API: upstream load stops depending on visitors, a snapshot survives an upstream outage with an honest age on it, and D1 is already bound. The Cache API route is simpler and a valid fallback. **Verify** whether it behaves on `workers.dev` as well as on a custom domain before choosing it.

### What it unlocks

From `dilas-roadmap.md`, "What live state adds once it is there":

- Offering only planets with an active campaign
- Faction filled exactly from who holds the planet
- **Active planet effects feeding `score.js`**: 156 are published (`dilas-data-spike.md`), and the variant enemies already flagged in `enemies.json` switch on from the same list
- The Major Order as context

> [!warning] Verify before building
> - The upstream's rate limits and terms, for `api.helldivers2.dev` and DiveHarder alike. The D.I.L.A.S. spike could not even resolve DiveHarder's host
> - Which endpoint carries planet effects and campaigns today. Read a real response, and keep a fixture of it for the tests
> - The request budget: cron runs count as Worker invocations. At 5 minutes that is 288 a day, which is nothing against 100k

---

# **Stage 7: Live Squad**

> [!warning] Enodia has not built this. No lessons carry over
> Everything here is a lead to verify, not a finding.

Live squad needs subscribe and push, which nothing above does. `dilas-roadmap.md` says to budget it separately, and that is right. The Cloudflare-native shape is **one Durable Object per party**, holding WebSockets with the hibernation API, plus a join code (the friend-code pattern fits). Each member's confirmed loadout goes in, and `src/lib/squad.js` runs over the list unchanged, since it is already a pure function over two to four builds. **Verify**: Durable Objects availability and limits on the free plan, and WebSocket billing.

Open questions the roadmap already asks: what an unconfirmed slot shows ("Party auto-fill on the compare slots"), and whether a party needs accounts at all or only a code.

---

# **Pitfalls Enodia Paid For**

Every one of these passed a type check and a green build. Most were found by measuring.

1. **better-auth's rate limit is off on Workers, and the default reads as on.** `enabled` defaults to `NODE_ENV === 'production'`, and Workers never sets `NODE_ENV`. Measured: 150 wrong passwords in 12 seconds, not one 429. State `enabled: true` (`worker/auth.ts`)
2. **A memory rate limiter is close to no limiter.** Isolates are many and short-lived. `storage: 'database'`
3. **The client IP is `cf-connecting-ip`, never `x-forwarded-for`.** Cloudflare *appends* to the latter, so a caller can put any value in front and reset their own counter. Set `advanced.ipAddress.ipAddressHeaders` (`worker/auth.ts`) and use the same header in your own limiter (`worker/limit.ts`, `keyFor`)
4. **D1 has no interactive transactions.** `transaction: false` on the adapter, stated rather than defaulted. A read-then-write limiter let **25 concurrent requests through a limit of 5**. The fix is one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` (`worker/limit.ts`, `take`). Multi-statement writes go in `db.batch`
5. **`worker/schema.ts` is generated and gets overwritten.** Your tables go in `schema-app.ts`. Anything added to the generated file vanishes at the next `db:schema`
6. **Two schema CLIs, and the obvious one is wrong.** `npx auth@latest`, never `@better-auth/cli`, which lags behind and emits an `account` table missing the `NOT NULL` `issuer` column. Nothing fails until the first sign-up
7. **Your own rate-limit table, not better-auth's.** Its pruning ignores keys and uses its own longest window, so your counters would be deleted on its schedule (`apiRateLimit` docblock in `schema-app.ts`)
8. **The local D1 is keyed by `database_id`.** Change the id and `wrangler dev` silently runs on a fresh empty database. The only symptom is a 500 on any request with a session cookie: `no such table: session`. Re-run `db:migrate` after touching the id
9. **`wrangler deploy` can report success and not land.** Seen three times in a row: a new version id, "100%", and old code still running. `npx wrangler versions upload` then `npx wrangler versions deploy <id>@100% --yes` fixed it. **After every deploy, curl something the new code changes**
10. **`run_worker_first: true` makes every request billable.** Name the paths, `["/api/*"]`
11. **`_headers` joins a header set twice with a comma** rather than overriding it. Put `Cache-Control` only on patterns that cannot both match one file (`assets/_headers`, note 1)
12. **A fresh cached file does not revalidate.** `must-revalidate` only applies once a response is stale. A re-cut image under the same name stayed invisible to returning visitors for a day. Use short max-ages on unhashed art, or rename it (`assets/_headers`, note 3)
13. **Keep `<meta charset="utf-8">` in the built page.** Artifact wrappers inject one and hide the bug, and a plain host then renders `·` as a Chinese character. D.I.L.A.S.' `index.html` has it. Keep it
14. **Rehearse every migration against real rows.** drizzle-kit generated a table rebuild that selected a column not on the source table, SQLite read the double-quoted name as a string literal, and every row got the text `'shape'`. It reported success (`migrations/0009_low_shadowcat.sql`, header)
15. **Never `DELETE` a parent row with cascading children** that belong to other people. Soft-delete with a timestamp
16. **The workerd test pool pins its own compatibility date.** Its workerd refused dates past what it shipped with, so the test config pins an older date than production. Only behaviour gated between the two dates can differ. `vitest.worker.config.ts` says so
17. **A copy guard that reads single lines cannot see wrapped JSX.** Enodia's retired-claims check passed banned phrases for weeks, because the formatter wraps paragraphs. If D.I.L.A.S. gets a "never say this again" check, test it against a wrapped sentence
18. **Retire sentences that stop being true.** "Nothing is tracked about you" became false the day stats existed. Enodia now says what is counted, and has a switch to turn it off (`src/ui/Account.tsx`, Settings)

---

# **Testing**

- **Backend tests run inside workerd against a real local D1**, never in node, where there is no D1 binding, no `cf-connecting-ip` and no workerd. `vitest.worker.config.ts` plus `worker/test-setup.ts`, which replays the real `migrations/` through `applyD1Migrations`. A hand-written fixture schema would pass while production broke
- `npm test` runs the app tests and then the Worker tests. Enodia had 153 inside workerd, one file per worker module, next to it
- **A test is only kept after it was seen failing** against the broken code. Enodia holds every backend bug to that
- **Drive every flow through the UI before flipping a flag.** Enodia's publish button had never been clicked when its API suite was already green
- **Headers and routes are checked against real responses under `wrangler dev`**, on the `workers` launch config at port 8787

---

# **What Stays stigly's**

| | |
|---|---|
| The domain | Choosing and buying it |
| `wrangler login` | Once, in a browser |
| Resend | Adding and verifying the sending subdomain |
| The edge rate-limit rule | A Cloudflare dashboard rule in front of `/api/*`. It rejects before a Worker runs, which the app limiter cannot do. Free, and still not done on Enodia |
| Contact address | For `X-Super-Contact` and `MAIL_FROM` |
| Product calls | What a run and a clear are, which boards exist, moderation, profiles versus accounts, when to retire Netlify, and what an unconfirmed squad slot shows |
| Version number | Accounts landing is a major bump by D.I.L.A.S.' own rule (`CLAUDE.md`, "Versioning And The Changelog"), so 2.0.0 |

---

# **Suggested First Session**

1. `git status`, and ask stigly what to do with the uncommitted work before branching
2. Read this file, then in `C:\Dev\Enodia`: `wrangler.jsonc`, `assets/_headers`, `worker/index.ts`, `worker/auth.ts`, `worker/limit.ts`
3. **Stage 0 on a branch**: vendor the two fonts, `public/_headers`, `wrangler.jsonc` with assets only, the `workers` launch config. Verify under `wrangler dev` by curling headers and loading the page
4. Deploy to `*.workers.dev` once stigly has run `wrangler login`, then curl the live headers
5. Update D.I.L.A.S. `CLAUDE.md` "Hosting" and `dilas-roadmap.md`, and add a changelog entry. The markdown roadmap moves first and `roadmap.json` follows
6. Stage 6 (war state) or Stage 1 (accounts) next. That order is stigly's call: the first needs no account and pairs with the starmap, and the second unblocks everything social
