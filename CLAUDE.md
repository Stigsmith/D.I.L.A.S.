# **D.I.L.A.S.: Claude Instructions**

> Everything a session needs before touching this repo: what the tool is, the rules that must not be quietly reversed, how the parts work, and how to run it. What is still to build is in `dilas-roadmap.md`. How each decision was reached is in git history and `src/data/changelog.json`. **Keep this file to what is true now**: when something changes, rewrite the line, do not append the story.

---

# **What This Is**

**D.I.L.A.S., the Democratic Intelligent Loadout & Armoury System**, live at **https://dilas.me**. A Helldivers 2 tool: tier lists that re-rate every item for where you are dropping, a loadout builder, your collection, a drop screen with a live party, and the galaxy map. Vite 6, React 18, JavaScript, Tailwind 3, served by a Cloudflare Worker with D1. The repo is `C:\Dev\D.I.L.A.S`, public at github.com/Stigsmith/D.I.L.A.S.

**Who it is for.** stigly, the curator, a returning power user whose game knowledge stops around December 2024. He curates the data and decides what the tool does. He did not write this code and does not read it: **describe changes by what they do for the tool, not by identifier.** He does not use a terminal habitually, so give paths and clicks, not just commands.

**The name lives in one file**, `src/lib/brand.js`: the sidebar, drawer, browser tab (written into `index.html` by a plugin in `vite.config.js`), footer, About and the backup file name all read it. The one other copy is the reset letter in `worker/email.ts`, because the Worker's type check cannot import app JavaScript. A rename is those two edits. It was D.D.S. until 2 October 2026; nothing is called dds or armory any more.

### Destinations

A left sidebar for destinations, a top tab bar scoped to the open one. `src/lib/router.js` is a thirty line hash router, no dependency: swap in a real one the moment the route table outgrows it. Tabs live in the route (`#/collection/items`), `LANDING` in `App.jsx` names the tab a bare route opens on, and `OFF_MENU` makes a route reachable without a menu entry.

| Destination | Route | |
|---|---|---|
| **Drop Bay** | `#/bay` | **The front door.** The moment before you go: your slot, the brief, suggestions, and in a party the squad. `src/DropScreen.jsx` |
| **Star Map** | `#/map/:planet?` | The galaxy map for reading the war. `src/StarMap.jsx` |
| **Armoury** | `#/armoury/:tab` | Builds, Coverage and History tabs. `src/Armoury.jsx` |
| **Collection** | `#/collection/:tab` | Warbonds and Items, one tab per ownership axis. `src/Collection.jsx` |
| **Tier Lists** | `#/tiers/:category` | The six lists, with a strip to set front, difficulty and squad. Also the picker inside every build. `src/Tiers.jsx` |
| **Rules** | `#/rules` | Every rule, what it moves here, and a switch. Bottom of the menu. `src/Rules.jsx` |
| The editor | `#/builder/:id?` | Off menu, lit as Armoury. `new`, or `new-bots` for a front. Also opens over Drop Bay. `src/Builder.jsx` |
| Shared build | `#/shared/:code` | Off menu. A build carried in the link. `src/Shared.jsx` |
| The war room | `#/scenario` | Off menu. Where the scenario is set, the map across the screen. `src/WarRoom.jsx` |
| Settings, Support, Roadmap | | Theme, export, import, reset; where the numbers come from; the public roadmap |
| The party menu | top right, every page | `src/Party.jsx`. Where friends and finding a group will live |
| Account | `#/account` | **Built and switched off.** Locked until `ACCOUNTS_LIVE` in `src/lib/account.js` is true |
| Exchange | | Shown in the sidebar, deliberately unreachable |

---

# **Hard Rules**

> [!danger] No em dashes
> Not in UI copy, comments, commit messages or replies. No ASCII substitutes either. This one gets checked.

- **Every word on screen follows `dilas-writing.md`**: say what it does, in the game's words, and stop. The answer at a glance, the reason one click away, meanings and the longer reason on hover through `Tip` (`src/Tip.jsx`), the maths and the limits on About. Read it before writing or changing any UI text.
- **Ids are the primary key, never the name.** See The Reference Invariant.
- **Ownership is never assumed.** Nothing hardcodes what is owned. `src/data/ownership.json` is the only record and it ships empty.
- **Tier scale is `S+ > S > A > B > C > D`.** No E or F; the build fails on an invented tier.
- **Tailwind 3, core utilities only.** Not 4: it drops `placeholder-base-600`, which the code uses, and changes the default border colour.
- **Deploy only when the curator asks, in that conversation.** He saves deploys for a major upgrade. Develop, check, commit, keep adding to the top changelog entry, and say when work is ready to ship. Production migrations wait with the deploy.
- **Push only `main`, and only when asked.** Never push `private-history-with-art`, the old local history with the game art in it. Before any push this must print 0: `git rev-list main | while read c; do git ls-tree -r --name-only $c; done | grep -c '^Image Library/'`
- **Art is never committed.** `Image Library/` and the generated `src/assets/*` folders are gitignored: extracted game art, and the repo is public.
- **Edit each file one way, in place.** Never `sed -i`, which writes a new file and swaps it in. A file sync (Proton Drive, stopped on 4 October 2026) used to rename files it saw replaced; a `(# Name clash ...)` file means it is back on. **If `git status` shows every file deleted, look for `.git/index (# Name clash ...)` and move it back. Never reset.**
- **Blurbs and notes stay direct and opinionated.** Short sentences, no hedging. An admitted gap beats a hedged guess. **Empty states say what to do next.**
- **Measure before shipping anything that re-ranks a list**, and show the curator how many rows moved.

---

# **Locked Decisions**

> [!danger] Do not reverse these without asking
> Every one came from the curator. A fresh session "improving" one undoes work he asked for.

### The shape of the tool

- **Drop Bay is the front door and the Armoury is where builds are made and kept**, the game's own two places. The tier list is the picker inside every build, ranked for the drop, and also in the menu, with quick scenario controls, for watching rules move the list.
- **Curated loadouts are fixed and named, not generated.** Auto-calibration, pick a primary and have the rest adjust, was declined. Do not build it. A roll you ask for is a different thing, on the roadmap.
- **Loadout objects stay readable.** Tier rows are arrays, loadouts are objects, because he may edit them by hand.
- **No squad by hand.** Outside a party Drop Bay is you alone. Squadmate slots exist only in a party, each filled by that member's own confirmed build. "How many of you" survives as one setting beside difficulty, and in a party the party's count decides.
- **An unconfirmed slot says "Still deciding" and nothing else**, and the squad checks ignore it.
- **A party is joined by a code, no account. The host sets the scenario** for everybody.
- **Setting up the collection comes first.** An untouched collection locks nothing and so reads as owning everything. `CollectionNudge` (on the surfaces in `NUDGE_SURFACES`, `App.jsx`), the guide at the top of Collection and the tour all push toward it. `needsSetup` in `src/lib/ownership.js` is the one test: no `setUp` mark and no lock of either kind.

### Filtering

- **Biome gates are hard, not warnings.** A hot planet (`intense_heat`) removes builds that vent heat from the pool. **Cold advantages heat weapons.**
- **Difficulty band is a hard filter** on builds.
- **The front is chosen, not filtered.** No table until a front is picked. The choice persists and is shared by every surface (`src/lib/scenario.js`); the editor binds the same bar to `draft.faction` instead, because a build is for a front.
- **Unrated items survive every tier floor** and sort last. With a front chosen the floor judges that front's tier.
- **Patch caveats are a hover explanation, not a filter.** No chip row for stale or unrated.
- **A folded filter is still a filter.** Anything narrowing the list while its control is folded away is named in the folded view with a one click clear.
- **Tier list filters live in the shell**, per category, under `hd2-tier-filters`, merged over a blank on read.

### Presentation

- **Two rating columns**: the u.gg vote, then ours for the scenario. Both are sort buttons; the solid one is the one sorted on, tinted the full height of the column. Ours renders as soon as a front is chosen: **a column that agrees with the vote is a real answer**. The other two fronts live in the expanded row. An item nobody rated shows a dashed `?` in the vote column and an empty box in ours.
- **Faction colours are literal in every theme, never tokens**: bots `#EF4444`, bugs `#F97316`, squids `#A855F7`, on badges, borders, chips and accents alike.
- **Stratagem colour groups follow the game**: blue for support and backpacks, red for Eagle and orbital, green for sentries, emplacements and mines.
- **No damage type icon on `ballistic` and `utility` rows.**
- **Fonts**: Oswald for headers and tier badges, JetBrains Mono for item names, vendored by `npm run fonts`. Never link Google Fonts again: the policy blocks it and it hands every visitor's IP to Google.
- **Every row expands**, the whole row is the click target, one open at a time. Every expanded row states its rating source and patch stamp, and says so when that is behind the game. The tier picker reuses the row but selects instead of expanding.
- **`usesBackpackSlot: null` reads "not recorded in the source yet"**, never "leaves your backpack free".
- **The amber corner dot means the item eats your own backpack slot**, red on a conflict. Never on a backpack stratagem.
- **Tesla Tower is an emplacement, not a sentry.**
- **The difficulty marks are images, not masks**, because they carry the game's colour ramp (grey at 1, bronze at 5, red at 7, near black at 10). Every other single colour mark is masked with `currentColor`.

### Do not rebuild

| Cut | Why |
|---|---|
| Armour rules on single items | A community tier already prices in what an item is for, and 48 of 51 bot primaries share one of two armour readings. Armour is a loadout property |
| Floors and ceilings that force a tier | They flatten the order a tag sits on. Everything is points; reaching further is a bigger coefficient |
| The `approx` rating flag | Leave an item out rather than publish a summary rating as per front |
| Hand-filled squadmates | Nobody rebuilds three loadouts in the game's thirty second drop screen |
| The "Galactic War" half copy map skin | Either exactly the game or clearly the tool's own |
| Badge rivets, bands, double rims, bevel, scratches, filled/outline split | Geometry inside the plate competes with the letter, and wear implies low tiers are damaged |
| Squad-size toggle for assisted reload | Declined; the backpack dot keeps its meaning |

---

# **Data**

Everything lives in `src/data` as JSON. Components read from it and hold no tables of their own. **Generated** files are written by a script and never edited by hand.

| File | Holds |
|---|---|
| `items.json` | Every item. The authority for everything else |
| `loadouts.json` | The 39 curated builds, one readable object each, every slot an id. Legacy AI generations, to be replaced (roadmap) |
| `armor-sets.json` | Curated: armour set names by passive id and weight class |
| `armor.json` | **Generated** by `npm run armor`: every armour set with weight, armour, speed, stamina, passive and source |
| `warbonds.json` | The gateable warbonds by tier, and labels for paths that are never gated |
| `vocabulary.json` | The shared enums the app and validator both read: difficulties and their bands, item tags with provenance, and the curator's `terrain` table per biome |
| `ownership.json` | What you own. Ships empty. `ownership.template.json` lists every warbond as not owned, ready to fill |
| `wiki-stats.json` | **Generated** by `npm run wiki`: the stats the source tables never had, reload times and the One Handed trait |
| `game-stats.json` | **Generated** by `npm run game`: weapon numbers from the game's own tables, laid over the wiki per field |
| `planets.json` | **Generated** by `npm run wiki`: every planet's biome, hazards, sector, cities, map position and supply lines |
| `enemies.json` | **Generated**: every enemy and body part with armour value, health and the difficulty it starts at |
| `missions.json` | The missions by the game's names, their fronts, the traits a rule keys on (ours), and `minutes` (written by `npm run missions`) |
| `difficulty.json` | **Generated** by `npm run difficulty` from the wiki's Difficulty table. Read by the war room through `src/lib/difficulty.js` |
| `context-rules.json` | The item rules, each with a `name` for the Rules page, plus `knownGaps` |
| `build-rules.json` | The rules that move a whole build, plus `knownGaps` |
| `changelog.json`, `roadmap.json` | The Changelog and Roadmap pages |

### Item shape

```json
{
  "id": "plas-101-purifier",
  "name": "PLAS-101 Purifier",
  "aliases": [],
  "slot": "primary",
  "stratType": null,
  "category": "Energy",
  "damageType": "heat",
  "usesBackpackSlot": null,
  "acquisition": { "type": "warbond", "warbond": "polar-patriots" },
  "stats": { "ap": 3, "apClass": null, "dps": 2916 },
  "ratings": { "bots": { "tier": "S+", "source": "ugg", "patch": "6.3.1" } },
  "roles": ["anti-armor"],
  "tags": [],
  "traits": [],
  "flag": null,
  "patchNote": null,
  "effect": null,
  "note": "charge for AOE, best chaff clear on every front"
}
```

- **`slot`** is `primary`, `secondary`, `throwable`, `stratagem`, `armor` or `booster`; the six lists derive from it. Vehicles and exosuits are `stratType: "vehicle"`, in the blue group.
- **A tier of `null`** means nobody rated it: a dashed `?` badge, sorted last. A first class state, not missing data. A rating with a tier always carries its source and patch.
- **`damageType`** drives the filter and row icon. Whether a weapon vents heat is `ventsHeat` in `src/lib/items.js`, which reads the fetched heat block (only the LAS family, the Quasar and a few others overheat; plasma feeds from magazines) and falls back to `damageType` for call-ins and melee.
- **`roles`** (`anti-armor`, `chaff`, `objective`) and **`tags`** are ours. See Tags And Roles.
- **`flag`** is `"stale"` (needs a `patchNote`) or `"new"` (in the game, no rating yet).
- **`effect` versus `note`.** Armour passives and boosters carry an `effect`, what the thing does. Everything else carries a `note`, which is opinion. Never both.
- **`passive`**, armour only: the effect's percentages as numbers a rule can scale off, `{ "fireResist": 75 }`. Keys are a closed list (`PASSIVE_KEYS` in `validate.mjs`); `stimDuration` is seconds, the rest percent. **Change `effect` and `passive` together.**
- **`stats` stay sparse.** Leave a figure absent rather than guess it; fetch it instead.
- **`statsFor(id)`** in `items.js` is how anything reads stats: the wiki's figures with the game's laid over them.

### Patch stamps

`PATCH` in `src/lib/patch.js` holds the game version, its date, the ratings range and the read date. The footer, About, Support and every expanded row read it, so a restamp is one edit. **Never write a patch number as a literal anywhere else.** u.gg dates each list separately, so ratings carry several stamps; the six lists u.gg prints no stamp for are read as 7.1.0, an inference Support admits.

---

# **The Reference Invariant**

Every item carries a stable `id`, a lowercase hyphenated slug of its name when it was added. **The id never changes, even when the name does.** Loadouts, lock state, favourites, armour set lookups and the ownership file all reference ids. Nothing stored anywhere may reference an item by name. An id that stops resolving fails silently, which is what the guard is for.

**Renames:** put the old name in the item's `aliases`. Saved state written by an older build resolves through aliases, and state from before ids existed migrates once on load (names and aliases resolve to ids, anything unresolved is dropped, the result written straight back). Armour set ids follow the same rule.

### The guard: `npm run validate`

Runs before every build and stops it on a failure. It checks:

- Ids unique and real slugs; no alias colliding with a live id or name (an item's own id is exempt)
- Every loadout slot resolves to an item **of the right kind**
- Every armour set key, ownership entry and warbond resolves; every armour set has a real passive and warbond, and every passive has a set
- Ratings inside the tier scale; known damage types, slots, stratagem types, traits, roles and passive keys; a patch note behind every `stale` flag; provenance on every tiered rating
- **Every rule** in `context-rules.json` and `build-rules.json`: a `say` and a `name` (90 characters at most), a unique id, every item id, tag, game tag, role, mission trait, armour trait, match key and path resolving, a `sayInverted` wherever a rule can invert, and no pairing clause nested in a partner clause
- The `suppressed` tag against the game's own flag

---

# **Ownership, Lock State And Profiles**

Two purchases, two axes: super credits buy a warbond, medals unlock each item in it. Lock state is two independent sets unioned at read time, `lockedItems` and `lockedWarbonds`. Clearing one never touches the other. **Availability is derived** on read and stored nowhere: a warbond item is available only when the warbond is owned **and** the item unlocked. Anything on another acquisition path ignores the warbond axis.

> [!danger] Three rules that are easy to get wrong
> - **Marking a warbond owned must not unlock its items.** They keep their own state. The bulk tick and cross on each warbond tile is how you unlock the contents.
> - **Marking a warbond not owned disables its items' toggles**, in Collection and on tier rows. The only way back is the warbond toggle. Every bulk action skips anything a warbond is holding. This one way door stops the two mechanisms fighting.
> - A warbond-locked item uses a dimmer amber padlock than a per item lock. The shade is the tell.

- **Armour passives stay on per item locks**; the source maps passives to sets, not warbonds. **Armour sets lock with their warbond**: `buildLockedSet` puts set ids into the locked set beside item ids. The header counts items only. Superstore and event sets have no lock yet.
- **Profiles.** Lock state lives in a named profile, for a second player on one machine. Exactly one is active app wide and the header names it. Create, rename and delete live in Collection. A new profile starts from nothing owned, everything owned, or a copy. There is always at least one. **A profile id never changes when its name does.** The rest of the app does not know profiles exist: `state.lockedItems` just means the active profile's.
- **Favourites are not per profile.** A favourite is a note to yourself, not a fact about ownership.

### The ownership file

`src/data/ownership.json`, `schemaVersion` 2, records what you **do** own: `{ "warbonds": { "cutting-edge": true }, "items": { "plas-101-purifier": false } }`. **Only an explicit `false` locks anything**, so the shipped empty file locks nothing. It is a seed, applied the first time the app runs in a browser and never again; after that the app's own toggles win. To apply a filled file to a browser with state, use Import.

---

# **Persistence, Backup And Transfer**

State lives in `localStorage`, per exact address. **What you own and what you made is exported; what describes this browser or tonight's drop is not.** `KEYS` in `src/lib/storage.js` is the exported half, `SETTINGS` the rest. A key never written reads as null, which is what lets the ownership seed apply exactly once.

| Key | Holds | Exported |
|---|---|---|
| `hd2-loadout-favorites`, `hd2-favorite-items` | Starred builds and rows | Yes |
| `hd2-profiles` | Lock state per profile | Yes |
| `hd2-loadouts` | Your builds | Yes |
| `hd2-drop-history` | Every confirmed drop | Yes; an import adds rather than replaces |
| `hd2-scenario-*`, `hd2-drop`, `hd2-party`, `hd2-planner` | Tonight's drop and party | No |
| `hd2-theme`, `hd2-filter-view`, `hd2-map-skin`, `hd2-map-tilt`, `hd2-rules-off`, `hd2-tour-done`, `hd2-tier-filters` | How this browser shows things | No |

**Inherited keys are read once and left in place, never deleted**: `hd2-locked-items` and `hd2-locked-warbonds` (folded into a Default profile), `hd2-brief-*` (copied to `hd2-scenario-*`). Nothing writes them again.

**Export** writes one JSON file with a `schemaVersion`. **Import** takes that back, or an ownership file in the shape above (inverted into locks); the key names keep the two apart. Both are in Settings with the theme and a reset. **Switched-off rules stay out of the export**, an open question for the curator.

---

# **Scoring**

### The scenario

**The scenario** is where you are dropping: front, planet, biome, hazards, mission, difficulty and how many of you. One object, `useScenario` in `src/lib/scenario.js`, called once in `App.jsx` and read by every surface. Never call it "the brief". Rules also see three things that ride on it and are never stored or sent to a party: `rulesOff` (the Rules page's switches), and, inside a build only, `alongside` (the build's other items) and `weight` (its armour weight).

- **Zero means not set** for difficulty and squad, and a rule asking about either is skipped rather than guessing.
- **Difficulty decides which enemies are counted**: every enemy carries `minDifficulty`, and an unknown is treated as level 1. It does not clear when the planet changes.
- Changing front clears a mission the new front lacks (`setFaction`). `QUIET_HAZARDS` and `loudHazards` in `scenario.js` are the one definition of which hazards count.
- **The scenario bar is on every surface that shows a reading** (`SCENARIO_SURFACES` in `App.jsx`), with "N rules off" while any rule is switched off. With no front chosen, the tier list and Drop Bay redirect to the war room (after `useScenario`'s `ready`, replacing history), and Done returns to the surface and tab you left (`lastSurface`).

### Item rules: `src/lib/score.js` and `context-rules.json`

Each row's second rating is the vote's score plus what the scenario's rules add, turned back into a tier by `tierForScore`. A rule has a `when` (front, planet facts, mission traits, terrain, city, minutes, difficulty, squad, peril, pairings), a match clause, points or a `scaleBy`, a `say`, and a `name`. `npm run rules` measures every rule against the pool it can fire on.

> [!danger] A scenario rule has to fire on something that varies with the scenario
> `npm run rules` flags any rule firing on 60% or more of its pool. **A rule touching half a list has to argue quietly.** Run it after adding a rule. The test any armour-on-items idea fails: armour reach per item does not vary with the scenario.

- **Points, never floors or ceilings.** A floor flattens every item sharing a tag into one tier. If a floor and ceiling ever contradict, neither applies and the points stand (`contradiction: true`); `npm run rules` sweeps for it.
- **The clamp** is two tiers, growing past peril 22 (`swingFor`: `28 + max(0, peril - 22) * 0.5`). It is permission, not force.
- **A rule that can invert must carry `sayInverted`**, and the validator checks. Inverted means the delta came out opposite to the sign of `scaleBy.times`, not simply negative.
- **Match keys.** `tags`/`notTags` read our `item.tags`; `gameTags` reads the wiki's `wiki.tags` (screaming caps). `idIn`/`notIdIn` exist and nothing uses them. `noNumber` means "no number at this path". `held` means a held weapon (`isHeldWeapon` in `loadouts.js`). The engine throws on an unknown key, and the validator catches it first.
- **Weather prices a risk, not a state**: a sandstorm planet has storms sometimes. Extreme cold and intense heat are climate and are not softened. Reduced visibility is partly a gift solo, as its own rule.

### Peril

Difficulty and squad size as one number:

```
peril = 6 * (difficulty - 5) + SQUAD_PRESSURE[squad]
SQUAD_PRESSURE = [10, 4, 1, 0]
```

Solo on 7 and two of you on 8 both sit at 22; four on 10 is 30. The squad curve comes from the wiki's patrol multipliers (second player 0.8333, third 0.75); the fourth column is an extrapolation and a guess. `peril()` returns null unless both difficulty and squad are set. **To choose a coefficient**: at what peril should this be worth one tier (about 14 points)? `times = 14 / (thatPeril - from)`.

- **A peril rule never names a squad size in its copy.** Depth reaches peril as readily as being alone. If a rule must talk about how many of you, it gates on `squad` and says so.
- **Stealth is for one or two of you.** Every stealth rule also gates on `squad: { lte: 2 }`. Quiet weapons, stealth armour and storms from peril 22; loud weapons marked down from peril 28 by the game's loudness class (small -0.15, medium and unknown -0.25, large and huge -0.4 per peril point past 16, bots); bugs and squids at six tenths of the bot figures. Not needing stealth is never a penalty, except stealth armour below peril 0.
- **The squad panel reads peril too**: coverage checks from peril 12, the "only anti-tank" warning from 22, falling back to the difficulty band when no level is set.

### Pairings

What a piece is worth beside the rest of its build: True Grit beside a long reload, Gunslinger beside a pistol, Inflammable beside a Cremator. **A pairing is an ordinary item rule with an `alongside` or `notAlongside` clause**, matched against `scenario.alongside`. `readBuild` and the editor set it for every part, slot and picker candidate; **the tier list never does, so a pairing never fires on a bare row.** A pairing may scale off its partner (`alongside.passive.fireResist`). Weight rules read `scenario.weight`; builds with no armour set have no weight and those rules stay silent. `npm run builds` measures pairings by placing their items into seeded random builds.

### The loadout reading: `src/lib/build.js` and `build-rules.json`

A build gets **two badges**: the gear badge, the mean of its nine parts each scored by `scoreItem` in the build's scenario, and the build badge, that plus what the combination adds or takes off. Same score scale and same clamp as items.

- **There is no community base for builds and one must never be invented.** Nobody votes on loadouts.
- **Penetration counts only what you aim** (`facts.heldAp`: primaries, secondaries, support weapons). A Railcannon answers the `anti-armor` role, counted separately. Two questions, both asked.
- **The layer only deducts**, except `answers-everything`. Silence is the normal state and never a claim of coverage.
- `count` calls `score.js`'s own matcher, so a build rule can ask anything an item rule can. `closedGaps` tells the picker which holes a candidate closes; **it marks, never reorders**. A note at zero points (grey) is allowed: a warning that moves nothing.
- **`npm run builds` measures every rule against 300 seeded random legal builds** as well as the 39 curated ones. The random column is the honest denominator; the curated one only describes those 39. The `measured` citations of the 39 in `build-rules.json` expire when the set is replaced.

### Tags and roles

Both are **our judgement, never a vote**, and the UI keeps them visibly separate from ratings ("our call, not a vote").

- **`tags`** (`long-range`, `close-blast`, `suppressed`) are what a rule needs that no fetched field answers. Each declares `source` in `vocabulary.json` (`curator`, `wiki` or `game`; the validator rejects anything else). `suppressed` is the game's `is_suppressed` flag, checked by the validator, with the Re-Educator kept suppressed by hand (`SUPPRESSED_BY_HAND`).
- **`roles`** (`anti-armor`, `chaff`, `objective`) are written by `scripts/tag-roles.mjs`, never by hand: `npm run roles` reports, `node scripts/tag-roles.mjs --write` applies, and **any role set elsewhere is deleted by the next run**. Anti-armor derives from `apClass` AT or Heavy, gated on lethality (no `utility` or `gas`), with the AP 4 Heavy band decided by `HEAVY_INCLUDE`. Chaff derives from category plus `CHAFF_INCLUDE`, and **means rate, not capability**: the Eruptor and sidearms are not chaff. Objective is hand listed, plus throwables at demolition 30 or more; eagles and orbitals are excluded. An empty role list is normal.

### The squad panel: `src/lib/squad.js`

Pure checks over two to four builds, conditioned on the scenario through `dropContext` in `drop.js`. Severity reads critical, warning, note. **Advisory only: nothing is removed or blocked.** The bot penetration check is AP 4, because a Devastator is armour 3 and equal penetration only does 65% (the rule is above armour full damage, equal 65%, below nothing; `src/lib/enemies.js`). Re-measure before moving it.

---

# **Reading The Game's Own Tables**

`npm run game` reads the game's settings tables as **filediver** (github.com/xypwn/filediver, BSD-3) ships them, already decoded, in its source, and writes `src/data/game-stats.json` in the wiki's field names. `statsFor` lays it over the wiki per field. **The game wins a disagreement**, with exceptions in `GAME_EXCEPTIONS` (`items.js`): the Purifier keeps the wiki's damage, the Trident the wiki's rate of fire.

> [!danger] The tool never opens the game install
> The curator's option B. The game's settings files are encrypted, and decrypting them means a memory dump of the running game, which anti-cheat bans and the licence forbids. We read the published output of a project that did, like reading the wiki. Images, names and descriptions live only in the install, so **all art stays with the wiki and the curator's library.**

| Part | Where |
|---|---|
| The dump | `tools/game-dump/main.go` and `dilas_resolve.go`, built with Go inside a filediver clone. Applies each weapon's default attachments |
| The join | `scripts/data/game-ids.json`: our id to the game's entity |
| The fetch | `scripts/fetch-game.mjs`. Report by default, `--write`, `--refresh` to pull filediver and rebuild into `.game-data/` (gitignored). Needs git and Go. **Refuses to write under 80% agreement with the wiki** |

**From the game:** damage, durable damage, AP, demolition, stagger, push, velocity, drag, calibre, pellets, magazine and spares, rate of fire, ergonomics, recoil, loudness (`noise`, 0 suppressed to 4 huge; `NoiseTemplate_None` is unknown, not silent), suppressed, one handed. **Still the wiki:** reload times, heat, stratagems, grenades, eagles, orbitals, mines, lasers and arc weapons, melee, enemy armour, armour sets, names and images.

---

# **Refreshing The Data**

**Ratings.** u.gg is read by hand into a dated snapshot in `scripts/data/` (the last is `ugg-2026-09-26.json`). `scripts/apply-ugg-7-1.mjs` is the template: it reports by default and applies with `--write`, matches rows by name or alias (`UGG_SPELLING` for u.gg's typos), **fails loudly on an unmatched row**, restamps each rating with its list's patch, clears `stale` flags, and edits the hand formatted `warbonds.json` and `armor-sets.json` as text so nothing reflows. The order:

1. Apply the snapshot.
2. `node scripts/tag-roles.mjs --write`, then `npm run roles` must report zero changes.
3. `npm run wiki -- --refresh`, read the report, then `--write`. **Spot check a launcher**: the Recoilless should read AP 6 with 100% durable damage, since the fetch picks a weapon's attack by its designation and never a backblast.
4. `npm run game -- --refresh`, then `--write`.
5. Restamp `src/lib/patch.js`.
6. Measure how many rows changed, and show the curator.

> [!bug] `npm run wiki -- --write` restamps planets and enemies even when it read them from cache
> Their `fetchedAt` moves while the content does not. Check the diff of `planets.json` and `enemies.json` and restore them with `git checkout` if only the date moved.

---

# **Drop Bay**

`src/DropScreen.jsx` draws it, `src/lib/drop.js` holds everything that is not a picture. **A brief** (what the mission asks for and what each planet hazard does, from tables the tool ships, nothing invented), **your slot**, **suggestions**, and in a party **the squad's slots and the squad read**.

- **Choose, then Confirm.** Only a confirmed build counts. Confirming stamps the build's `updatedAt`; **edit the build afterwards and the slot drops back to still deciding**. Presets stamp as the empty string, so `confirmed` is null for not confirmed, never merely falsy.
- **`gateOf` is the one test for both hard gates.** The picker uses it to refuse a build and a slot uses it to say "the picker would not offer this now". A slot keeps a build the scenario would now refuse, and says why. The picker says how many builds each gate took out.
- **Suggestions**: three of your own builds through the same gates, never needing gear you have not unlocked, ranked by the reading (`suggestBuilds`, `rankByReading`), each saying why (`whyFor`). With nothing of yours, presets stand in and say so; with nothing at all, the panel says what ruled everything out and offers to start a build. Hidden once confirmed.
- **The editor opens over Drop Bay.** Saving puts the build in your slot, still to confirm; Save as new keeps the original.
- **The scenario bar is the one place that names the planet and mission.** The brief only says what they do.
- **Your locks hide builds in your slot's picker**, with a toggle. Party members' builds are drawn whatever your locks say.
- **Stored as ids** in `hd2-drop`: `{ mine, confirmed, mates, logged }`. `mates` is read by nothing now and stays for shape.

### History, nudges and share links

- **Every Confirm is recorded** (`src/lib/history.js`): the build, its items at that moment, planet, mission, difficulty and squad. Newest thousand kept, exported. "Change my mind" within 15 minutes (`TAKE_BACK_MS`) takes it back out.
- **Once a front has five drops** (`ENOUGH_DROPS`), Drop Bay adds **For a change** (your best fitting build not used in `STALE_DAYS`, thirty) and gear that reads A or better here that you own and **have never brought against this front**, each with Build around it (`forAChange`, `untriedHere`). Below five drops both stay silent: before then "never" only means "not yet".
- **Share links** (`src/lib/share.js`): `#/shared/<code>`, the build as base64url JSON with short keys. No server. **A link is anyone's text**: it is cleaned exactly like a party member's build (`unpackBuild`), and a mangled link opens nothing and throws nothing.

---

# **The Armoury**

`src/Armoury.jsx` holds three tabs; `src/Builder.jsx` is the editor.

- **Builds**: the grid of every build, with its own local biome, mission and difficulty filters (it is on its way to becoming Exchange). It browses; it does not rank.
- **Coverage** (`src/lib/coverage.js`): fifteen situations per front, rated at Suicide Mission with four of you unless a row says otherwise, through Drop Bay's gates with builds you can field. A or better is covered, B is thin, nothing is a gap with a link to a new build for that front.
- **History**: your drops by front and mission, the builds you return to, and those gathering dust.

**The editor.** Nine slots. Tapping one opens the tier list as a picker over the screen, ranked by our reading for the build's front and the scenario, and saying so in its header. The best reachable item gets a "top pick for this drop" marker. Favourites pin to the top, unavailable gear is hidden behind a toggle, unrated items sort last and are never removed. **A stratagem already in another slot is removed from the picker**, with the count shown. Each slot row shows **one** badge, our reading for the build's front; the vote is the delta marker and its tooltip.

- **Opening a preset forks it.** The curated builds are never written to; the copy carries `forkedFrom`, which nothing reads, so a preset id that disappears is inert.
- **Backpack conflicts warn, never block**: a squadmate can carry the pack.
- **`heat` is derived**: only gear you hold and manage heat on (primary, secondary, a support weapon or backpack). **`fire` is a judgement**: the editor seeds a toggle from a guess and the curator overrides it. Do not derive it.
- **Armour sets.** The picker ranks passives as before and lists each passive's sets under it, with render, weight and stats. A build stores `armorSet` beside the passive in `armor`; `cleanLoadout` keeps them agreeing. Share links carry it as `w`.

---

# **The Live Party**

Squad up with a code: one person opens a party and reads out six characters, up to four join. Each person's **confirmed** build lands in their slot on every screen, the host's scenario becomes everybody's, and the squad read is the same everywhere.

| Part | Where |
|---|---|
| The party | `worker/party.ts`, one Durable Object per code, WebSockets through the hibernation API |
| The routes | `worker/index.ts`: `POST /api/party` opens one; `GET /api/party/<code>` is the WebSocket, or as a plain GET, "does this party exist" |
| The limits | `worker/limit.ts` and `api_rate_limit`: 20 parties opened and 120 joins an hour per address |
| The browser half | `src/lib/party.js`: `useParty` and `usePartySync` |
| The tests | `worker/party.test.ts`, inside workerd against a real Durable Object |

- **The server has no opinion about what a build is.** The browser packs it (`packBuild`, leaving the blurb at home) and every browser cleans what it receives against its own tables (`unpackBuild`, `cleanScenario`). The server enforces size, shape, rate and who may say what.
- **Identity is a token per party** in `hd2-party`: 32 random bytes; the server stores only the SHA-256. A reload or second tab rejoins the same seat. Members see each other by a hash prefix.
- **Four seats**, a fifth is refused. A host who leaves hands over to whoever has been in longest; the host can remove somebody in two presses. **Twelve quiet hours with nobody connected and the party deletes itself.** The host's squad size follows the member count. **Following is not enforcing**: a member who changes their own scenario keeps it until the host's next change, with a one click Follow the party.
- **Origin is required on a POST and a WebSocket, and refused on a plain GET only when present and foreign**, because a same-site GET carries no Origin.
- **It only exists where the Worker does**: under `wrangler dev` and on dilas.me, not under `npm run dev`. There the panel says so. Two players on one machine: `127.0.0.1:8788` and `localhost:8788` are separate addresses with separate storage.
- **Break each party rule on purpose and watch its test fail** before trusting it.

---

# **The Galaxy Map And The Live War**

`src/GalaxyMap.jsx` draws it, `src/lib/galaxy.js` holds everything that is not a picture. It appears in two places, both full screen right of the menu (`room` mode): **the war room**, where a drop is set up, and **the Star Map**, for reading the war.

> [!danger] The API decorates, it never carries
> Positions and supply lines are patch data in `planets.json`. **The map draws, pans and fills the scenario with nothing fetched at run time.** Who holds what is live and only colours it in. **Never ship ownership**: a stale territory map is worse than an uncoloured one.

- **The data's y points up, and the flip lives only in `project()`.** Cyberstan sits up and to the left; `npm run map` checks it.
- **Two views, the game's way**: the galaxy, and one sector, gliding between them (`sectorView`, `glide`). **Sectors are blocks** from a polar grid (`sectorZones`); the game's real borders are not published. Two looks in `hd2-map-skin`, **Tactical** (default) and **Chart**.
- **The tilt** is CSS `perspective() rotateX()`. **Clicks are read through `offStage`, never the SVG's screen matrix**, which flattens a perspective and puts a click a planet's width off. `stageTransform` writes the CSS from the same numbers. Planets and names stand upright; only the ground tilts. The room clips with `overflow: clip`, not hidden.
- **The drop planner** (`suggestFronts`) offers only fronts from a live war fresh enough to trust, **busiest first**. Megacities are pushed down, never hidden. A mission kind narrows the mission list, not the planets.
- **On the Star Map a click reads a planet; Drop here chooses it.** The planet is in the address.
- **Planet renders** come from the wiki: `npm run planet-art`, then `-- --cut` for 256 pixel WebPs. Gitignored. sharp arrives with wrangler.

### The live war

A Cron Trigger fetches `api.helldivers2.dev` every five minutes (planets, campaigns, the Major Order, the war's totals) and keeps one trimmed row in D1 (`war_snapshot`). `GET /api/war` hands it out with its age. `worker/war.ts`, `cleanWar` in `galaxy.js`, `useWar` in `src/lib/war.js` (which asks with `cache: "no-cache"`).

- **Half an hour is the limit** (`WAR_TOO_OLD_MS`). Older is not drawn at all, sets no front, and the line under the map says how old it is.
- **A failed fetch never disguises the age of the last good one**: it moves `tried_at` and sets `ok` to 0, leaving `payload` and `fetched_at`.
- **No server, no colour, no error**: under `npm run dev` the answer is a page, not JSON, and the map draws uncoloured.
- **The server keeps no planet table.** Planets go out under the upstream's names and the browser joins by name, dropping what it does not know. Only planets with something happening are sent.
- **Choosing a planet with fighting on it sets the front**: the attacker in a defence, otherwise the owner.
- **The Major Order's front and reward are inferences** from one real answer (task type 1 values 2, 3, 4 are Terminids, Automatons, Illuminate; reward type 1 is medals). Anything else shows nothing rather than a wrong name.
- **History**: the Cron keeps the planets and totals once an hour for thirty days (`war_history`, `keepHistory`). `GET /api/war/history?planet=<name>`, 503 until the first hour is kept. A failure keeping it never costs the snapshot.
- **The upstream requires both `X-Super-Client` and `X-Super-Contact`**, whatever its README says, or it answers 400. `SUPER_CLIENT` is `dilas.me`, `SUPER_CONTACT` is `https://dilas.me`, in `wrangler.jsonc` vars. Never a personal contact.
- **Budget**: five Cron Triggers per account on the free plan, 10 ms CPU each. The upstream allows 5 requests in 10 seconds; this is 4 in 300. To run one fetch by hand: the `workers` launch config, then `curl "http://localhost:8788/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"`, which is a real request.

---

# **The Rules Page**

`src/Rules.jsx`, `src/lib/rules.js`. Every rule behind our rating: what it does, what it moves where you are dropping now, and a switch. Groups derive from each rule's own `when`, so a new rule files itself. A closed row shows the switch, the name, a "judgement" tag on our calls, and how many items it moves; an open row the sentence, when it applies in plain words (`describeWhen`, `describeMatch`), its size against "a tier is about 14 points", source, judgement, id, and every item or build it moves.

**A switched-off rule is gone everywhere, in this browser only.** `rulesOff` rides on the scenario; `score.js` and `build.js` skip it; `usePartySync` gets the bare scenario so it never reaches a party. `npm run rules` proves switching one off removes it from exactly the items it fired on.

**Commando missions** are Automaton only, with the `commando` trait and eight rules from the wiki's mechanics. A booster the game refuses still reads B, because two tiers is the most a scenario may move anything; a ceiling waits for the curator.

---

# **Theming**

Every colour goes through a CSS custom property in `src/index.css`, bound to Tailwind names in `tailwind.config.js`. Thirteen themes in `THEMES` (`src/lib/theme.js`): Dark, Light, Neon, and ten warbond skins.

- **Both ramps are positional.** `base-950` is always furthest back and `text-base-100` always most prominent, in either theme, which is why the ramp is called `base`, not `zinc`. Tokens: `base-*` surfaces, borders and text; `accent-*` the lock and favourite chrome; `brand` the Super Earth yellow (Neon's `#FFE900` is the game's own).
- **The accent is never the brand colour**, or a lock and the brand mark become the same thing. Amber by default; Hellpod Drop Bay and Super Destroyer take vermillion, the Creek its tracer red, Ministry of Truth the Light ramp.
- **The tier ramp is shared by every theme.** A skin may override it only all six at once.
- **The shell must not paint its own background.** `body` carries `base-950`; the ambient layer sits at `z-index: 0` behind content at `z-10`.
- **A skin is generated, then tuned**: `node scripts/build-themes.mjs` turns a study's `:root` into a pasteable block. Each skin starts as a palette study in `Image Library/Themes/<Warbond>/`; read it first. The Creek is blue, not green. Dark is `#121214`, grey not black.

### The material layer

`src/Ambient.jsx` and the ambient block at the foot of `index.css`, opt in per skin through `FX`: firelight, embers and streaks, rain and drips, gas, stars, texture and underlay, masthead, badge, and grain. Everything sits behind the content except **grain, at z-index 45 over the data at 5.5% overlay**, on purpose. Ministry of Truth is paper and emits no light. A theme that opts out renders no layer at all. **Everything that moves stops under `prefers-reduced-motion`.** Textures go through `themeArt`, never a CSS `url()`, so an empty `src/assets` renders nothing rather than breaking the build.

**Cutting a masthead banner**: wide `masthead.jpg` at 2560 x 184 with the subject inside the centre 1320 x 95; optional phone `masthead-sm.jpg` at 1280 x 128 inside the centre 880 x 85. JPG, not PNG. Without a phone cut the wide one crops.

### The tier badge

`src/TierBadgePlate.jsx`, ported from `Image Library/UI/Tier Badges/hd2-tier-badge-component.html`; read that before touching it. **Rank is never carried by degrading legibility**: a D reads as clearly as an S+. Rank is hue, and optionally sheen and glow. Grain is seeded at 7 on every badge. Delta markers, padlocks and stale flags are DOM siblings over the badge, the marker top left. Row badges are 32px on a phone, 36px from `sm`. **Finish is not theme**: badge finish is a separate setting touching only the badge, and a theme change must never move it. `tierStyle` in `Tiers.jsx` carries the badge gloss for rows and chips alike.

---

# **Art**

`Image Library/` in the repo root is the source and is never written to. **It is gitignored and stays on the curator's machine**: a clone builds art free, every item reading by its name. `npm run images` copies it into `src/assets`, renaming each file to the id it belongs to, so `src/lib/assets.js` is a plain id to file lookup.

- **The filename prefix is the key, the folder is organisation**: `weapon_ar_23_liberator.png` resolves to `ar-23-liberator` wherever it sits. The few that do not line up are listed in `scripts/import-images.mjs`, never fuzzy matched.
- **Four reserved names in a theme folder**: `masthead.*`, `masthead-sm.*`, `emblem.*` and `study_*`. Only those reach the app; `assets.js` globs `study_*`, not the folder.
- **Nothing may depend on art existing.** Delete `src/assets` and every lookup returns null with a text fallback.
- **Single colour art is masked**, painted with `currentColor`, except the difficulty marks.
- **`assetsInlineLimit` is 0** in `vite.config.js`. Leave it: inlining moved hundreds of KB of icons into the main bundle.
- **Art is painted at the size it is displayed.** Check a new mark's pixels against the size it is drawn at.
- **Armour set renders** come from the wiki by `npm run armor-art`, into `Image Library/Armor Sets/`. **The favicon** is our own drawing, `public/favicon.svg`, committed and edited by hand.
- **`Image Library/` has no backup off this machine.** That is the curator's to arrange.

---

# **The Tour**

The Democracy Officer shows you round: steps across several pages, starting in Collection, each lighting one thing and saying it twice, in-universe in large type and plainly in small type. `src/lib/tour.js` holds the steps, `src/Tour.jsx` draws them. **`plain` must stand alone**: someone reading only the small print still knows what every lit thing does. None of the words are the game's. It opens once per browser (`hd2-tour-done`), and Settings has Replay. **Anchors are `data-tour` attributes, never classes.** An `optional` step whose anchor never appears is skipped.

---

# **Running It**

From `C:\Dev\D.I.L.A.S`. Node is on the PATH.

| Command | Does |
|---|---|
| `npm run dev` | The dev server. Reads `PORT`, falls back to 5173; `.claude/launch.json` sets `autoPort` so two sessions can each run one |
| `npm run build` | Runs `images` and `validate` first, then `check-dist` after, which refuses if a file the page asks for is missing |
| `npm run validate` | The guard, on its own |
| `npm run rules` | Item rule health. Flags anything firing on 60% or more of its pool |
| `npm run builds` | Loadout rule and pairing health, against the 39 curated and 300 random builds |
| `npm run drop` | Drop Bay's gates, confirmation, suggestions, history, share links and coverage |
| `npm run map` | The map's arithmetic against the shipped planet table |
| `npm run roles` | Role tagging report |
| `npm run test:worker` | The Worker's tests, inside workerd against a real local D1 |
| `npm run typecheck` | The Worker only (`tsconfig.worker.json` stands alone) |
| `npm run wiki`, `game`, `missions`, `armor`, `difficulty` | Data fetches. **Each reports by default**; `-- --write` applies, `-- --refresh` goes back to the network instead of the cache. Never part of the build |
| `npm run armor-art`, `planet-art`, `fonts` | Art and font fetches |
| `npm run deploy` | Builds, checks `dist`, deploys. **Only when the curator asks** |

**Run `npm run rules` and `npm run builds` after adding a rule. A copy-only change must leave both byte identical.** Every check that can fail exits non zero.

### Local Worker

`npx wrangler dev` (the `workers` launch config) serves the built `dist/` exactly as Cloudflare will, on **port 8788, never 8787**: Enodia's wrangler dev uses 8787 on this machine and the two silently share it. It needs `npm run build` first, and **a `.dev.vars` with `BETTER_AUTH_SECRET`**, or every `/api/*` answers 500. **Restart it after every build**: Vite empties `dist/` and wrangler's asset watcher dies quietly on Windows. Stopping it in the background can orphan `workerd`; check nothing from this folder is still listening before starting another.

### How stigly runs it

File Explorer into `C:\Dev\D.I.L.A.S`, click the address bar, type `cmd`, Enter, then `npm run deploy` (or any command). **Use `cmd`, not PowerShell**, which blocks npm's script wrapper; from PowerShell, `npm.cmd run build` works. Do not change his execution policy for him.

---

# **Hosting**

**https://dilas.me**, a custom domain on the Cloudflare Worker `dilas`, plus `dilas.stigsmith.workers.dev`. Same account as Enodia. Static assets serve first; the Worker answers `/api/*` only (`run_worker_first`, which keeps every other request free: **never set it to `true`**). D1 database `dilas`, binding `DB`. Everything a person does in the tool still happens in the browser, except the party and the war. Netlify served it before Cloudflare; switching that off is the curator's call. **Moving address empties everybody's collection**: localStorage is per address, so it is Export there, Import here.

| File | Does |
|---|---|
| `wrangler.jsonc` | The deploy config. Every key carries its reason |
| `public/_headers` | Cache rules and security headers for static assets |
| `public/fonts/`, `src/fonts.css` | The vendored fonts, **generated by `npm run fonts`** |

> [!danger] A deploy that reports success is not evidence that it landed
> After every deploy, check the `index-*.js` name in the live page matches `dist/assets` and the footer shows the new version. If not: `npx wrangler versions upload`, then `npx wrangler versions deploy <id>@100% --yes`. **Production migrations run before the code that needs them**: `npx wrangler d1 migrations apply dilas --remote`, then deploy.

**Security headers.** A Content-Security-Policy allowing nothing from any other address, **`img-src 'self'` with no `data:`** (nothing draws a data URI; if one ever must, add it on purpose in the same change, because the browser drops the image silently), `style-src 'unsafe-inline'` for React's style attributes, `connect-src 'self'`. HSTS for a year with `includeSubDomains` and **no `preload`** (stigly's call). `nosniff`, `strict-origin-when-cross-origin`. `/assets/*` and `/fonts/*` immutable for a year; the page revalidates every visit. **A header set twice is joined with a comma, not overridden**, so `Cache-Control` lives only on patterns that cannot both match. `_headers` does not reach the API, so `harden()` in `worker/index.ts` adds `nosniff` and `no-store` to every Worker answer.

**Retire sentences that stop being true.** Support's "Your data stays yours" says what a party sends and that there are no accounts yet; the "no accounts yet" half must change the day accounts open, and Account's "What an account does: Nothing yet" the day sync lands. The README's privacy table says the same as Support: change both together.

---

# **Accounts**

**Built and switched off.** better-auth, email and password, on the Worker and D1, ported from Enodia (`C:\Dev\Enodia`), whose docblocks carry the reasoning. `ACCOUNTS_LIVE` in `src/lib/account.js` is `false`, so the sidebar keeps Account locked.

| | |
|---|---|
| `worker/index.ts` | The routes: `/api/auth/*`, `/api/capabilities`, `/api/me`, the party, `/api/war` and its history, and the `scheduled` handler. Anything else is a JSON 404 |
| `worker/auth.ts` | Every better-auth option with its reason. Rate limit `enabled: true` with database storage, the client IP from `cf-connecting-ip`, `transaction: false` |
| `worker/email.ts` | The mail swap point, inert until password reset (roadmap) |
| `worker/schema.ts` | **Generated** by `npm run db:schema`. Never edit; our tables go in `worker/schema-app.ts` |
| `migrations/` | `npm run db:generate` writes them, `npm run db:migrate` applies them locally |
| `worker/optional-env.d.ts` | Types `RESEND_API_KEY` and `MAIL_FROM` as optional until they exist. Delete it once they are configured |

- **The switch is a UI gate and only a UI gate.** `/api/auth/*` is reachable whatever it says; the rate limiting protects it. To really close accounts, do it in the Worker.
- **Never open accounts before password reset works.** An account you can be locked out of permanently is a trap.
- **`npm run db:schema` runs the better-auth CLI at the installed version, never `@latest`**: a newer CLI dropped the NOT NULL `issuer` column the installed core writes on every sign up. `scripts/db-schema.mjs` reads the version.
- **`BETTER_AUTH_SECRET`** signs session cookies: random in `.dev.vars` (gitignored), a different random value in production via `npx wrangler secret put`. Without it the Worker answers 500 rather than signing with `undefined`.
- **Changing the D1 `database_id` orphans the local database**; re-run `npm run db:migrate`.
- **To drive the account screen locally**, set `ACCOUNTS_LIVE` to true, build, restart wrangler, test, set it back, rebuild, and grep the bundle to prove the test build is gone.
- **Every protection was seen failing before it was trusted.** Keep it that way.

---

# **The README**

`README.md` follows the curator's W.A.R.P. project's style. **Every claim in it is checked against the code.** Screenshots in `docs/images/` are 1600 x 900 from headless Edge with a scratch profile (`--headless=new --user-data-dir=<scratch> --screenshot --window-size=1600,900 --virtual-time-budget=9000`), with `localStorage` seeded through a throwaway script page in `dist/` (scenario, drop and `hd2-tour-done`, or the tour covers every shot), saved as JPG at quality 84. Retake them when a screen they show changes.

---

# **Versioning And The Changelog**

`src/data/changelog.json`, newest first. **One version is one deploy**, not one day: keep adding to the top entry as work lands, and its `date` is when it shipped. Patch for fixes, minor for a new surface or capability, major when the tool becomes a different thing (accounts opening is 2.0.0). Set the same version in `package.json`; the footer and Changelog page read `CHANGELOG[0].version`, and nothing else hardcodes one.

**An entry** is a `title`, a one line `say` with dry Ministry of Truth flavour, and three to six short `changes`: what is different on screen, one sentence each, never the reasoning.

**Two roadmap files, and the markdown one moves first.** `dilas-roadmap.md` is the working backlog. `src/data/roadmap.json` is the public summary on the Roadmap page, one sentence per milestone. When something ships, delete it from the markdown, then check the summary still reads true.

---

# **Traps**

> [!bug] The embedded preview pane dispatches no viewport events
> Resizing it fires no `resize`, no `matchMedia` change and no `ResizeObserver`, although the media queries themselves flip. Anything recalculated on a viewport change (`--shell-chrome`) reads stale there and fine in a real browser. Dispatching `new Event("resize")` by hand tells the two apart.

> [!bug] The embedded preview pane goes blank when scrolled
> Nothing paints below the first viewport, on any page, even static HTML. Check anything scroll related in a real browser at the dev server's address, and check positions with `getBoundingClientRect` or a hit test, never a screenshot.

> [!warning] Changing `tailwind.config.js` needs a dev server restart
> The running server keeps the stylesheet it generated at boot, so a new token builds fine and silently does nothing in dev.

> [!warning] A missing asset gets cached as the page for a year
> `_headers` marks `/assets/*` immutable, and a missing file answers with the page. A rebuild with unchanged code reuses the file name, so a page left blank that way stays blank until that file is fetched with `cache: "reload"`. `check-dist` exists so it never ships.
