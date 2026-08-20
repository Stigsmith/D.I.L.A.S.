# **HD2 Armory: Claude Instructions**

> Everything a fresh session needs before touching this repo. What the tool is, which decisions are settled and must not be quietly reversed, the one invariant that has broken twice, how ownership and lock state work, and how to run the thing. Read this before the code.

---

# **What This Is**

> [!warning] The name is a working title and lives in exactly one file
> **Democracy Deployment System**, shown as **D.D.S.** in the wordmark with the full name in small caps beneath it. It is in `src/lib/brand.js` and nowhere else: the sidebar, the mobile drawer, the browser tab, the footer and About all read from it. Renaming it again is one edit. Do not hardcode it anywhere.

A Helldivers 2 tier browser and loadout tool, ported out of a single Claude.ai artifact into a Vite and React project. Navigation is two levels: a persistent left sidebar for destinations, and a top tab bar scoped to whichever destination is open.

| Destination | Route | State |
|---|---|---|
| **Tier Lists** | `#/tiers/:category` | Built. The primary experience. Six categories as top tabs, **one chosen front**, two rating columns, filters, search, locking, favorites, full row expansion |
| **Collection** | `#/collection/:tab` | Built. Two tabs, Warbonds and Items, one per ownership axis |
| **Loadout Builder** | `#/builder/:id?` | Built. Edits one build. With no id it starts a fresh one |
| **Drop Bay** | `#/bay` | Built. The grid, and the only place that browses every build at once |
| **Settings** | `#/settings` | Built. Theme, export, import, reset |
| **Support** | `#/support` | Built. Where the numbers come from |
| **Exchange, Squad, Account** | | v2 and v3. Shown in the sidebar, deliberately not reachable |

> [!info] Routing is hand rolled
> `src/lib/router.js` is a hash router in about thirty lines, not a dependency. The route table is a handful of destinations with at most one parameter, and hash routing needs no server rewrite rules. Swap in a real router the moment that stops being true.
> A destination with tabs keeps the tab in the route, so `#/collection/items` is linkable and survives a reload. `LANDING` in `App.jsx` names the tab the sidebar lands on, because a bare `#/collection` would leave the tab bar and the surface disagreeing about which one is open.

> [!info] Who this is for
> stigly, a returning power user whose game knowledge stops around December 2024. He curates the data and decides what the tool does. He did not write this code and does not read it. Describe changes in terms of what they do for the tool, not by identifier.

What is agreed but not built lives in `helldivers-2_armory-roadmap.md`: the accounts, Exchange and live squad dependency chain, the wider warning set, and the offline build authoring plan. Read it before starting anything that sounds like new scope.

Data authority lives outside this repo, in the Helldivers 2 project files: `helldivers-2_tables.md` for every rating and number, `helldivers-2_tier-list.md` for the decision layer, `helldivers-2_armory-design.md` and `helldivers-2_armory-web-requirements.md` for why the tool works the way it does. The original artifact is kept at `hd2-armory.jsx` in the repo root as a reference implementation. It is not built and not imported.

---

# **State Of Play**

> [!success] The contextual overhaul shipped, 1.3.0 to 1.9.0 on 20 August 2026
> The tool now has **two ratings per row**: the u.gg community vote, and one this project computes for where you are actually dropping. Both stay visible, and every point of difference carries a sentence explaining it.
>
> | Landed | |
> |---|---|
> | **The Brief** | Faction, planet, biome, hazards, mission. One object, persisted, read by the tier list, Drop Bay and the builder |
> | **Faction gates rather than filters** | Three buttons above the table, no table until one is picked, two rating columns instead of three faction columns |
> | **Fetched stats** | 182 items now carry magazine, fire rate, recoil, ergonomics, sway, durable damage, stagger, pushback, projectile drag, call-in codes and the game's own tags. `npm run wiki` |
> | **281 planets** | Biome and hazards, with the mechanic each hazard applies. MIT licensed, shipped as a table, no runtime network |
> | **70 missions** | The real names, per front, each with the line the name does not tell you |
> | **The scoring engine** | `src/lib/score.js`, 33 rules in `src/data/context-rules.json` |
> | **Vehicles** | All eight, rated |
>
> **What is left**, in order: enemy armour for the penetration rule, three judgement tags, loadout and squad scoring, then Drop Bay becoming the drop screen. The plan lives in `helldivers-2_armory-roadmap.md`, which also explains how the phases relate to the v2 and v3 labels in the sidebar.

> [!success] v1 is done
> Sidebar IA, local persistence, export and import, two themes (four, in fact), full row expansion, the Loadout Builder, Drop Bay and Collection are all built and verified. The art is wired in. The data model is on stable ids with structured stats.

### Collection

`src/Collection.jsx`. Two tabs, because owning a warbond and unlocking an item are separate purchases: super credits buy the warbond, medals unlock each item in it.

- **Warbonds tab.** Every warbond grouped by tier, an owned toggle, its tracked item count, and per warbond bulk unlock and bulk lock of its contents.
- **Items tab.** A flat searchable list of all 228 items with acquisition path and availability, filterable by slot, source and availability, with bulk lock and unlock over whatever is currently shown.
- **Availability is derived** on read and stored nowhere. A warbond item is available only when the warbond is owned **and** the item is unlocked. Anything on another acquisition path ignores the warbond axis entirely.

> [!danger] Three rules that are easy to get wrong
> Marking a warbond as owned **must not** mass unlock its items. They keep whatever per item state they had. The explicit bulk action on each warbond tile is how you unlock the contents, since one click warbond operations were a liked property of the artifact.
> Marking a warbond as **not** owned disables its items' per item toggles, in Collection and on the tier rows. The only way back is the warbond toggle. This one way door is deliberate: it stops the two mechanisms fighting, and it is why every bulk action skips anything a warbond is already holding.
> Locked warbond items use a dimmer amber padlock than a per item lock. Both axes are amber, the shade is the tell.

> [!info] The bulk buttons on a warbond tile are a tick and a cross, not two padlocks
> Three padlocks in a row read as the same control repeated. The tick and cross also say the right thing: they set the medal axis for the whole warbond, they do not toggle the warbond.

Armor passives stay out of the warbond axis. The source maps passives to armor set names, not to warbonds, so armor remains on per item unlock only, which is what the Items tab gives it. If a passive to warbond mapping ever appears, wire it into the item's `acquisition` and Collection picks it up with no other change.

### Resuming

Read this file, then run `npm run dev`. `npm run build` runs the image import and the validator first, so a broken reference or a missing id stops it. Nothing in this project lives only in a chat.

---

# **Hard Rules**

> [!danger] No em dashes
> Not in UI copy, not in code comments, not in commit messages, not in replies. No ASCII substitutes either. This one gets checked.

> [!danger] Ids are the primary key, never the name
> Loadouts, lock state, favorites, armor set lookups and the ownership file all reference items by `id`. The display name is an ordinary field. Nothing stored anywhere may reference an item by name. See the next section.

> [!warning] Warbond ownership is never assumed
> Nothing in the code hardcodes what is owned. `src/data/ownership.json` is the only place it is recorded, and it ships empty. Ask rather than guess.

**Tier scale is `S+ > S > A > B > C > D`.** No E, no F. The source scale bottoms out at D, so do not invent lower tiers to make a spread look harsher. The build fails on an invented tier.

**Tailwind 3, core utilities only.** Not Tailwind 4. The component uses `placeholder-base-600`, which 4 removed, and 4 changes the default border colour to `currentColor`.

> [!bug] The embedded preview pane dispatches no viewport events at all
> Resizing it fires **nothing** in the page: no `resize` event, no `matchMedia` change, not even a `ResizeObserver` on the root element. The media query itself flips correctly and the layout switches, so the page *looks* right while every listener stays silent. Measured directly on 20 August 2026 by arming all three and crossing the 640px breakpoint in both directions.
> The consequence is that anything recalculated on a viewport change reads stale in the pane and is fine in a real browser. `--shell-chrome` is exactly that. Dispatching `new Event("resize")` by hand corrects it instantly, which is how you tell a harness artifact from a real bug here.

> [!bug] The embedded preview pane goes blank when scrolled. The app is fine
> Scrolling in the in-editor Browser pane paints nothing below the first viewport, on any page. It was reproduced on the standalone palette study, a plain static HTML file with no React and none of this shell, so it is the pane and not the tool. Confirm anything scroll related in a real browser at `http://localhost:5173` before chasing it in the code.
> The tell is that layout stays provably correct while the capture is blank: at scroll offsets 900, 1800 and 2700 the tier list still has 11 or 12 rows in view and hit testing returns the right item.

> [!warning] Changing tailwind.config.js needs a dev server restart
> The running dev server keeps serving the stylesheet it generated at boot, so a new colour or token builds fine and silently does nothing in dev until you restart. This looked like a real bug for a while.

**Blurbs and notes stay direct and opinionated.** Short sentences, no hedging. An admitted gap beats a hedged guess.

**Empty states say what to do next**, not just that nothing was found.

---

# **The Reference Invariant**

Every item carries a stable `id`, a lowercase hyphenated slug of its name at the time it was added. The id never changes, even when the name does. Arrowhead renames things between patches, and once you are saving your own loadouts a rename that moves the key orphans your data.

```json
{ "id": "las-13-trident", "name": "LAS-13 Trident", "aliases": ["SG-225 Trident"] }
```

An id that stops resolving fails silently: the slot just comes up empty and nothing complains. That is what the guard is for.

### The guard

```bash
npm run validate
```

It runs automatically before `npm run build`, so a break stops the build. It checks:

- Ids are unique and are real slugs, and no alias collides with a live id or a live name
- Every loadout slot resolves to an item **of the right kind**, so a booster cannot end up in the armor slot
- Every armor set key and every ownership entry resolves
- Every item's warbond resolves to a real warbond
- Ratings inside the tier scale, known damage types, slots, stratagem types, traits and roles
- A patch note behind every `stale` flag, and provenance on every rating that has a tier

### Renames

Rename freely. Put the old name in that item's `aliases` array and nothing breaks: ids never moved, and the alias is what lets state saved by an older build still resolve. Two aliases exist from the 7.0.0 data rebuild, `SG-225 Trident` and `AR-23C Liberator Carbine`, both verified to still migrate correctly.

> [!info] Saved state migrates once
> State written before ids existed was keyed by display name. On load, names and aliases resolve to ids, anything that resolves to nothing is dropped, and the result is written straight back. A list that is already ids passes through untouched, so the migration is safe to run on every load.

---

# **Locked Decisions**

> [!danger] Do not reverse these without asking
> Every one came from direct curator feedback. A fresh session "improving" them undoes work already asked for.

### The shape of the tool

- **Tier browsing is the primary tool, not the picker.** He prefers evaluating individual items over accepting curated loadouts, because he may dislike half the S tiers and enjoy some A tiers.
- **Curated loadouts are fixed and named, not generated.** Auto-calibration, pick a primary and have the rest adjust, was considered and declined. Do not rebuild it.
- **Keep the loadout objects readable.** Tier rows are arrays, loadouts are objects, because he may edit loadouts by hand.

### Filtering

- **Biome filters are hard gates, not warnings.** Hot biomes remove heat-venting builds from the pool entirely. He pushed back specifically on an earlier version that merely warned: if the answer is do not bring this, it should not be on the card.
- **Cold biomes advantage heat weapons.** Heat vents slower in cold, so laser and plasma are genuinely better on ice. The first version modelled only the hot penalty and missed this. Three cold builds exist because of the correction: Cryo Beam, Frostline, Frost Lance.
- **Difficulty is a hard band filter.** Builds outside the selected band do not appear at all. Scoring it as a soft nudge made the selector feel decorative.
- **Patch caveats are a hover explanation, not a filter.** A third chip row for filtering stale and unrated items was rejected, on the reasoning that none of this data is fully accurate anyway and one patch rarely buries an item. Flagged rows get a help icon that expands one line. Do not promote these back into chips.

> [!success] Unrated items survive every tier floor
> A minimum tier filter never removes an unrated item. They stay at any floor and sort last, below everything rated. This was a deliberate reversal: filtering to S made new warbond items vanish, and being seen is the only way they ever get tried.
> The floor judges whatever value is being ranked. With a faction filter active that is that faction's tier. With no faction filter it is best of three, so the row passes only if all three are null.

### The front is chosen, not filtered

> [!danger] Reversed on 20 August 2026, deliberately
> The tier list used to rank against all three fronts at once, with a "Rank by" chip that defaulted to All fronts. It now **gates**: three buttons above the filter pane, and no table until one is picked. The choice persists.
>
> The reasoning is the curator's and it is sound. You have already chosen a front before you open this tool, the mission and biome lists differ per front, and there is no useful reading of "how good is this against Terminids" during an Illuminate run.

**The front is shared, and it is the same control everywhere.** The tier list and Drop Bay read one value from `src/lib/brief.js`, so choosing a war in one place is choosing it in the other. The Loadout Builder carries the same bar but bound to `draft.faction`, because a build is *for* a front and keeps that when saved. Changing it there marks the build unsaved and does not move the brief.

**Difficulty is a slider with the game's names on it.** Ten levels, Trivial through Super Helldive, with the game's own icons painted through the theme. The four bands a build declares are unchanged underneath and the slider derives one, so nothing saved had to migrate. The names live in `vocabulary.json` under `difficulties`, which is also where the band mapping is.

**Tier list filters live in the shell, not in `TierBrowser`.** Held in the component they were discarded every time you looked at Drop Bay. They are per category, persisted under `hd2-tier-filters`, and merged over a blank on read so a filter added later does not come back undefined.

**Two rating columns replace three faction columns.** The community vote, then ours for the current brief. That is the comparison worth putting side by side, and it is what pays for the width the third faction column used to take. **Nothing is lost:** the other two fronts moved into the expanded row.

The second column is a dashed placeholder until the scoring engine exists. Deliberately not a `?` badge, which already means "nobody has rated this" on the first column. Two different absences wearing one glyph is worse than an empty box that says what it is waiting for.

### Presentation

- **Faction theming runs through the whole UI.** Bots red `#EF4444`, bugs orange `#F97316`, squids purple `#A855F7`. Not just labels: badges, borders, chips and card accents all shift.
- **Stratagem colour groups follow the in-game menu.** Blue for support and backpacks, red for Eagle and orbital, green for sentries, emplacements and mines, with a per-subtype icon inside each colour.
- **No damage type icon on `ballistic` and `utility` rows.** Those are the nothing-special defaults, so a glyph there is decoration. The kinds that keep an icon are the ones that change behaviour.
- **Fonts.** Oswald for headers and tier badges, JetBrains Mono for item names.

### Domain calls

- **Tesla Tower is an emplacement, not a sentry.** Arrowhead's Rapid Launch System module note lists it with the emplacements.
- **The amber corner dot means the item eats your own backpack slot.** It marks the nine support weapons that do, and never a backpack stratagem, where it would state the obvious.

> [!failure] `approx` is gone
> An old eighth row field marked items where the source gave a summary rating instead of a per-faction one. The full tables give real per-faction ratings for all 224 rated items, so all 27 `approx` flags were dropped. Do not reintroduce it. If a future source clumps again, prefer leaving the item out to publishing a guess.

> [!success] Second player unlock profiles are built
> This used to read "not built, and not to be built unless he asks". He asked. Lock state now lives inside a named profile, so his brother, who started in August 2026 and owns almost nothing, gets his own. See Ownership And Lock State.

---

# **Corrections To The Source Documents**

> [!warning] Three things the design notes say are no longer true
> They describe an earlier state of the file. The code and the newer requirements document agree against them. Do not "restore" any of these.

| Design notes say | Actually |
|---|---|
| Unrated rows are hidden above a D floor | They survive every floor and sort last |
| Seven backpack-taking support weapons | Nine, plus the Meltagun where the source does not say yet |
| No `localStorage`, use `window.storage` | That was a sandbox constraint of the artifact runtime, not a preference. This is a real web app and uses `localStorage` |

> [!bug] A documented bug that does not exist
> The requirements document lists a dead reference: `LoadoutCard` reading `loadout.fire` when the field is `heat`, so the fire tornado warning has supposedly never rendered. It is wrong. Four loadouts carry `fire: true` and all four are hot-biome builds, so the warning does render. Nothing to fix.

> [!question] One genuine disagreement between the two documents
> The design notes record that a squad-size toggle for assisted reload was proposed and declined, and that the backpack dot keeps meaning "this eats your own backpack slot". The requirements document uses the 7.0.0 assisted reload rework to argue a future loadout builder should warn rather than block on backpack conflicts.
> Both can hold. The dot's meaning is settled and unchanged. The warn-not-block rule applies only to a builder that does not exist yet. Ask before acting on the second one.

---

# **Data**

Everything lives in `src/data` as JSON. Components read from it and hold no tables of their own.

| File | Holds |
|---|---|
| `items.json` | All 236 items. The authority for everything else |
| `loadouts.json` | 39 curated builds, one readable object each, every slot an id |
| `armor-sets.json` | All 107 armor sets, keyed by passive id, grouped by weight class |
| `warbonds.json` | The 24 gateable warbonds by tier, plus the labels for paths that are never gated |
| `vocabulary.json` | The shared enums. The app and the validator both read this one so they cannot disagree |
| `ownership.json` | What you own. Ships empty |
| `ownership.template.json` | Every warbond listed as not owned, ready to fill in |
| `wiki-stats.json` | **Generated.** The stats the tables never had, for 174 items. Never edit by hand |
| `planets.json` | **Generated.** 269 planets, their biome and their hazards. Nothing reads it yet |

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
  "stats": { "ap": 3, "apClass": null, "dps": 2916, "...": null },
  "ratings": { "bots": { "tier": "S+", "source": "ugg", "patch": "6.3.1" } },
  "roles": ["anti-armor"],
  "traits": [],
  "flag": null,
  "patchNote": null,
  "effect": null,
  "note": "charge for AOE, best chaff clear on every front"
}
```

> [!success] Vehicles and exosuits landed in 1.5.0
> Eight of them: the M-102, M-103 and M-104 FRVs, the EXO-45 Patriot, EXO-49 Emancipator, EXO-51 Lumberer and EXO-55 Breakthrough exosuits, and the TD-220 Bastion MK XVI. `stratType` of **`vehicle`**, blue call-in group. Their art had been in the library since 18 August with no item to attach to; the wiki fetch supplied the data that unblocked them. All eight are unrated and shown as such.

- **`slot`** is one of `primary`, `secondary`, `throwable`, `stratagem`, `armor`, `booster`. The six browsable lists derive from it, so the five stratagem call-in menus become one list. You pick a stratagem by faction and tier, not by which menu it sits under.
- **A tier of `null`** means no rating exists. Those rows render a dashed `?` badge and sort last. This is a first class state, not missing data, and a rating with a tier always carries its source and patch.
- **`damageType`** drives the damage type filter and the row icon. **`heat` and `arc` are the thermally affected ones**, which is what the hot exclusion and the cold advantage key off.
- **`roles`** is the editorial layer, and the only field in this project that is not sourced. Two values, `anti-armor` and `objective`. An empty array is the normal case: 185 of the 224 rated rows carry nothing, and there is deliberately no validator rule demanding otherwise.
- **`flag`** is `"stale"` when the rating predates a 7.0.0 change to that exact item, which requires a `patchNote`, or `"new"` when the item is in the game with no rating yet.
- **`effect` versus `note`.** Armor passives and boosters carry an `effect`, which is what the thing actually does. Everything else carries a `note`, which is opinion. They never both appear.
- **`stats` are sparse, and that is now a gap rather than a principle.** AP, DPS, capacity, demo force, cooldown, uses and medal cost came out of the source tables. Magazine size, spare magazines, fire rate, recoil, reload time, projectile count and stagger were recorded here as **not in any source this project has**. The data spike on 20 August 2026 found all of them published, plus ergonomics, sway, durable damage, stagger, pushback and projectile drag. See `helldivers-2_data-spike.md`. Still leave them absent rather than guessing, but the answer now is to fetch them rather than to shrug.

> [!success] The hot biome gate was firing on weapons with no heat mechanic. Fixed in 1.4.0
> `damageType` of `heat` or `arc` marked 26 items as thermally affected, and a hot biome removed any build carrying one. Only ten of them can overheat: the LAS laser family, the Quasar and the Rover's drone. Every plasma weapon feeds from magazines. Three Purifier builds and one Blitzer build were ruled out of every hot planet over a mechanic they do not have.
> `ventsHeat` in `src/lib/items.js` is the answer now, and it reads the fetched heat block. It has three states rather than two: a real yes or no for anything the fetch covers, and a fall back to the old `damageType` guess for the call-ins and melee weapons it does not.

> [!info] Two patch stamps coexist
> Game version is 7.0.0 "Devoid of Liberty", 12 August 2026. Only the armor passive table is stamped 7.0.0. Everything else is u.gg 6.3.1 community consensus applied to a post-patch game. Say so when it matters rather than presenting a stale rating as current.

---

# **Ownership And Lock State**

Two independent sets, unioned at read time.

- `lockedItems`, toggled one at a time on any tier row or Items row, or in bulk through `setItemGroup`, which backs both the per warbond bulk action and "lock everything shown" in the Items tab
- `lockedWarbonds`, toggled per warbond in the Warbonds tab, or per tier group through `setWarbondGroup`

Clearing one never destroys the other. An item locked because its warbond is locked shows a dimmed padlock and its per-item toggle is disabled, so the only way to unlock it is the Warbonds tab. This is deliberate. It stops the two mechanisms fighting.

### Profiles

Both sets live inside a **named profile**, because one set of locks models one player and there are two players.

> [!info] The rest of the app does not know profiles exist
> `state.lockedItems` and `state.lockedWarbonds` still mean exactly what they always did. They just mean it about whichever profile is active. That is why adding profiles touched no surface except the two that manage them.

- **Exactly one profile is active**, application wide. The header names it next to the starred and locked counts, and switching is one control from anywhere, because every padlock on every screen belongs to that profile and it must never be a guess.
- **Creating, renaming and deleting** live in Collection, above the two tabs, next to what a profile actually holds.
- **A new profile starts from nothing owned, everything owned, or a copy of the active one.** Nothing owned is the useful one: adding the handful of things a new player has takes minutes, stripping out the hundred he does not takes an evening.
- **There is always at least one profile.** The last one cannot be deleted. Deleting the active one switches to whatever remains.
- **A profile id never changes when its name does**, the same invariant items carry, because the active profile is stored by id and a rename must not orphan it.

> [!success] Migration from before profiles is lossless and one way
> A browser holding the old `hd2-locked-items` and `hd2-locked-warbonds` keys folds both into a profile named Default on first load. Those two keys are then **left alone rather than deleted**, so a hand written recovery path stays open. Nothing writes them again.

Favorites are deliberately **not** per profile. A favorite says "come back to this", which is a note to yourself, not a fact about who owns what.

### The ownership file

`src/data/ownership.json` records what you **do** own. Lock state is the inversion of it.

```json
{
  "schemaVersion": 2,
  "warbonds": {
    "cutting-edge": true,
    "polar-patriots": false
  },
  "items": {
    "plas-101-purifier": false
  }
}
```

The two axes are separate purchases: super credits buy the warbond, medals unlock each item inside it. Everything on another acquisition path ignores the warbond axis entirely.

| Value | Meaning |
|---|---|
| `false` | Not owned. Locked |
| `true` | Owned. Not locked |
| absent | Not locked |

> [!success] An empty file locks nothing
> Only an explicit `false` locks anything. That is why the shipped file is empty and everything starts unlocked. `ownership.template.json` carries all 24 warbonds at `false`, ready to be filled in and copied over `ownership.json`.

> [!warning] It is a seed, not a source of truth
> It fills lock state the first time the app runs in a given browser, and only then. After that whatever you toggle in the app wins, so clearing locks by hand is not undone on the next reload. To apply a filled file to a browser that already has state, use Import on the Warbonds tab.

Every key is an id, not a name. The validator rejects an id that resolves to nothing.

> [!question] Armor cannot be warbond filtered
> The source data maps armor passives to set names, not to warbonds, so armor stays on per-item locking. If a passive to warbond mapping ever appears, wire it into `item-source.json` and the Warbonds tab picks it up with no other change.

---

# **Persistence, Backup And Transfer**

State lives in `localStorage` under four keys.

| Key | Holds |
|---|---|
| `hd2-loadout-favorites` | Starred loadouts |
| `hd2-favorite-items` | Starred tier rows |
| `hd2-locked-items` | Per-item locks |
| `hd2-locked-warbonds` | Warbond locks |

A key that has never been written reads as null, which is what lets the ownership seed apply exactly once without ever fighting your own toggles.

**Export** writes one JSON file holding all four, with a `schemaVersion`. **Import** accepts that file back, and also accepts an ownership file in the shape above, inverting it into lock state. The two shapes cannot be confused because they use different key names. Both live in Settings, along with the theme and a reset.

Two more keys, `hd2-theme` and `hd2-filter-view`, are display preferences rather than collection data. They are kept out of the export deliberately: they describe this browser, not what you own.

> [!warning] A folded filter is still a filter
> The tier list filter pane folds down to faction and tier, with an arrow at the bottom of the pane to unfold the rest. Anything still narrowing the list while its control is hidden gets named in the folded view with a one click clear. Hiding a control that is still filtering is how you end up staring at an empty list wondering what happened.

---

# **Row Expansion**

The whole row is the click target, not a chevron, and **every item expands**, not just armor and flagged rows. There is always something worth saying.

An expanded row carries the item's art at full size, its numbers, what the source does not record, and where the rating came from. Only one row is open at a time, which the single `openRow` value gives for free.

> [!success] Provenance is shown, not implied
> Every expanded row states the rating source and its patch stamp, and says plainly when that is behind the game. Armor passives read "patch 7.0.0" with no caveat; everything else reads "patch 6.3.1, the game is on 7.0.0, so this is one patch behind". The two stamps are real and the UI should keep admitting it.

> [!warning] The stats gap is stated on the row, not hidden
> Weapons carry a line naming exactly what is missing: magazine size, spare magazines, fire rate, reload time, recoil, projectile count and stagger. Saying so stops anyone reading the absence as zero. Delete that line only when the wiki pass actually fills those fields.

`usesBackpackSlot: null` renders as "not recorded in the source yet", never as "leaves your backpack free". Only the 40-K Meltagun is in that state. Never guess false here.

The picker in the builder reuses the same row but selects instead of expanding, so it shows no chevron and never opens a detail panel.

---

# **Role Tags And The Squad Panel**

Three tags, `anti-armor`, `chaff` and `objective`, and a panel in Drop Bay that uses them to tell you what is going to hurt.

> [!danger] These tags are ours. Nothing else in this project is
> Every per-faction rating is a u.gg vote aggregate carrying a source and a patch stamp. Role tags are a judgment we made. The expanded row states this in its own block with its own provenance line, and the filter is labelled "our call, not a vote". Never let the two sit together looking equally weighed.

### The tagging

`npm run roles` reports, `node scripts/tag-roles.mjs --write` applies. The derivation lives in that script rather than in hand edited JSON, because a derivation you cannot re-run is one nobody trusts after the next patch.

- **`anti-armor` derives** from `apClass` being `AT` or `Heavy`, **gated on lethality** by dropping `damageType` of `utility` and `gas`. That gate is the whole point: `G-23 Stun` is AP6 AT and the EMS Mortar Sentry is AP6 AT with a note reading "non-lethal". AP records what armor a projectile interacts with, not whether it kills.
- **The `AP 4 Heavy` band is decided by hand**, through `HEAVY_INCLUDE`. It holds both the Autocannon and the Flame Sentry and no rule separates them. Five are in: Autocannon, Flamethrower, Cremator, Anti-Materiel Rifle, Laser Cannon.
- **`chaff` derives** from weapon `category` being Assault Rifle, SMG or Shotgun, plus a hand list for the machine guns, flamethrowers, gatling sentries and area call-ins that no category covers.
- **`objective` is hand listed**, assisted by `demoForce` on throwables at 30 or more. Eagles and orbitals are excluded on purpose: the tag means closing a hole from your carried kit, without burning a call-in.

> [!warning] `chaff` is about rate, not capability
> Almost anything kills one hunter, and that is not what the tag means. It means holding off a swarm without reloading into your own death. The Eruptor is deliberately **not** chaff: it kills a hunter and takes a second doing it, and a duo built on Eruptors and Senators has a real hole even though every gun in it can hurt a small enemy. Sidearms are out for the same reason. A Redeemer is an emergency weapon, not a squad's answer to a crowd.

> [!info] 27 anti-armor, 55 chaff, 22 objective, 134 rated rows untagged
> Untagged is correct and common. An earlier draft wanted six tags across every rated row with the build failing on an empty one, which forced boosters and armor passives into a taxonomy with no room for them.

> [!success] The bot penetration check needs no tag at all
> "Nothing you hold gets through Devastator armor" derives from sourced `ap` on held weapons, so it stays out of the editorial layer entirely. The threshold is **AP 4**, and it was measured rather than picked: AP 3 is carried by something in all 39 curated builds so a check there can never fire, AP 5 is missing from 30 of them and would fire on more than half of all bot pairs, and AP 4 is absent from 14 and fires on 6 of 78. Re-measure before moving it.

### The squad panel

Drop Bay, top of the page, when two or more builds are selected with the squad icon on a card. **It is not a room.** No code, no link, no sync, nothing shared. Drop Bay's own faction, biome, mission and difficulty controls are the squad context.

The rules live in `src/lib/squad.js` as a pure function, so the logic is in one place and testable. The panel is **sticky** under the shell chrome and **collapses to a tally**, because the point is fixing something down in the grid and watching the warning clear without scrolling back up.

**Severity reads as critical, warning, note.** Their plurals are written out rather than guessed, since "2 criticals" is not a phrase.

> [!success] Silence is the normal state, and never a claim of coverage
> A squad with nothing wrong says nothing. Below difficulty 7 the coverage checks switch off entirely, and the panel says they are off rather than saying you are covered. A squad with no anti-tank at difficulty 3 is still a squad with no anti-tank; we are choosing not to care, which is not the same as it being fine.

> [!danger] Warnings are advisory. Do not apply the biome hard gate precedent
> Biome filters remove builds from the pool by explicit decision. These do the opposite: nothing is removed from the grid, nothing is blocked. A squad knowingly doubling up on mortars is making a choice about how they play.

Every warning is conditioned on where you are dropping, which is what makes them fire on something true. "You have no anti-tank" is almost always false. "No anti-tank on bugs at 7 and up" is worth reading, and the cave warning only exists because `demoForce` records that 40 closes a hole from outside while 30 needs the throw to go in.

---

# **The Loadout Builder**

Nine slots. Tapping one opens a picker over the whole screen that reuses the tier row, so ratings, flags and provenance are in front of you at the moment you choose rather than one screen away. The picker hides unavailable gear by default with a toggle to show it, and pins favourites to the top.

> [!danger] Opening a preset forks it
> The 39 curated builds are stigly's and are never written to. Opening one in the builder hands you a copy carrying `forkedFrom`, and the banner says so. Saving stores the copy under `hd2-loadouts`; the original is untouched.

### Derived metadata

**`heat` is derived, and the rule was corrected in 1.4.0.** Only gear you hold and manage heat on counts: primary, secondary, and a support weapon or backpack. A call down does not vent in your hands, so orbitals, eagles, sentries, emplacements and mines are excluded. That half was right.

> [!failure] The old "39 of 39" was not a check
> This section used to claim the derivation reproduced every hand authored flag, 39 of 39, and treat that as verification. It was not. The hand authored flags were made from `damageType` and so was the rule, so the two agreed because they shared one wrong premise. Against the source the rule now agrees on **35 of 39**, and the four it disagrees with are three Purifier builds and one Blitzer, none of which can overheat. Two things built the same way agreeing with each other proves nothing.

> [!question] `fire` is a judgement, not a property
> Three derivation rules were tested against the curated builds and the best managed **37 of 39**. A thermite grenade is anti-tank despite its damage type; an incendiary grenade plus fire resist armor is a commitment. So the builder seeds a toggle from the guess and the curator overrides it. Do not "fix" this by deriving it.

> [!bug] `bugs-blender` is flagged `fire: false` and probably should not be
> It carries the Cremator flamethrower, Incendiary Impact grenades, Incendiary Mines and Inflammable armor. Meanwhile `bugs-meat-grinder`, marked `fire: true`, carries an incendiary grenade and fire resist armor and nothing else. Blender is the more committed fire kit of the two. Left alone because the curated set is his, but the fire tornado warning never shows on it.

### The picker recommends

It ranks by **the faction the build is for**, not by an average across all three, and says so in its header. A build declared for bots should lead with what beats bots. The best rating actually reachable in that slot gets a "top pick" marker, so it means top of what you can take rather than a fixed tier. Favourites still pin above everything.

It also warns before the pick rather than after: an item that would be the second thing wanting your back is labelled with what it clashes with.

> [!warning] The same stratagem cannot be taken twice
> You cannot bring one twice in game, so anything already in another slot is removed from the picker for the remaining slots, with the count shown. This was found because a real build had the same emplacement in two slots, which also broke React keys on the loadout card.

### Backpack conflict

At most one thing may occupy your back: the nine support weapons that eat the slot conflict with any backpack stratagem and with each other. This **warns, it does not block**, per the build spec, because a squadmate can carry a pack. The amber dot marks the offending support weapon and turns red on a conflict. It never marks a backpack stratagem, where it would state the obvious.

---

# **Theming**

Every colour goes through a CSS custom property, so a theme is a token set rather than a rewrite. Tokens live in `src/index.css` and are bound to Tailwind colour names in `tailwind.config.js`.

**Both ramps are positional, not literal.** The high end is surface, the low end is ink, in either theme. `bg-base-950` is always the furthest back and `text-base-100` is always the most prominent text, so a class keeps meaning the same thing when the theme flips. That is why the ramp is called `base` and not `zinc`: in the light theme `base-950` is off white, and a class named for a grey would read as a lie.

| Token set | Covers |
|---|---|
| `base-*` | Every surface, border and text colour |
| `accent-*` | The lock and favorite chrome |
| `brand` | The Super Earth yellow |

**Eleven themes ship.** Three base ones: **Dark** (grey), **Light** (off white), **Neon** (near black with `#FFE900`, taken straight off `ui_logo_helldivers_yellow.svg` so the brand colour is the game's own rather than a guess). Then eight warbond skins: Castellan's Creed, Automaton, Bile Titan, Hellpod Drop Bay, Malevelon Creek, Ministry of Truth, Super Destroyer and Viper Commandos.

Two are light, Light and Ministry of Truth, which the token architecture allows on purpose. Bile Titan is a generic Terminid skin rather than a warbond.

> [!tip] A skin is generated, then tuned
> `node scripts/build-themes.mjs` reads each study's `:root`, converts its surface vocabulary into the positional ramp, and prints a CSS block to paste into `src/index.css`. It exists so a new skin is a config entry rather than 22 hand mixed values. It does **not** write the file: generated colour is a starting point, and every skin here was looked at and adjusted afterwards.

> [!info] Warbond skins start as a palette study
> `Image Library/Themes/<Warbond>/` holds the reference art and a standalone HTML study per skin. The study is the source: it fixes the palette, argues the reasoning, and shows the ladder and cards before any of it reaches the app. Read it before implementing a skin.
> Castellan's Creed picks green as its primary for a specific reason worth keeping: no faction owns green, so bots red, bugs orange and squids purple all stay legible against it.

### The material layer

A study is not only colour. The Creek throws tracers and drifts embers, the Foundry glows out of the plate, Viper Commandos lays camo under everything. None of that fits in a colour token, so it lives in `src/Ambient.jsx` and in the ambient block at the foot of `src/index.css`.

Three effects, all opt in per skin through `FX` in `Ambient.jsx`:

| Effect | What it is | Skins using it |
|---|---|---|
| **firelight** | Large soft radial blobs at the corners, flickering on the study's own keyframe | Most skins |
| **embers** and **streaks** | Rising sparks and tracer fire, seeded so a re-render never makes the sky jump | Creek, Foundry, Bile Titan, Entrenched |
| **rain** and **drips** | Falling. A drip keeps a heavy glowing head, which is what separates it from rain | ODST, Bile Titan |
| **gas** | Nine blurred clouds crossing the full width over 48 to 96 seconds, slow enough that you notice the room has changed rather than seeing anything move | Entrenched Division |
| **stars** | Twinkling points behind the panels | Super Destroyer |
| **texture** and **underlay** | A tiled image or a single pressed image under everything | Viper camo, Ministry blueprint |
| **masthead** | Art inside the header, behind the title | Creek poster, Destroyer hull |
| **badge** | A still patch, bottom right | Viper Commandos |
| **grain** | The one texture allowed **over** the data | Entrenched Division |

> [!danger] Grain is the exception and it is deliberate
> Everything else in this layer sits behind the content at `z-index: 0`. Grain sits at **45, above the sticky chrome**, blended through `mix-blend-mode: overlay` at 5.5%. Grain is a property of the lens rather than of any surface, so it has to touch the data or it is not grain. At a few percent it reads as film; raise it much and it reads as a dirty screen.

> [!failure] Paper cannot emit light
> Ministry of Truth sets `--fx-glow-strength: 0` and has no particles at all. It gets weight instead: pressed shadows under panels, a hard offset on the row hover, and a gold rule available through `.fx-rule`. Do not give it a glow to match the others.

> [!warning] The Creek is blue, not green
> The first pass invented a green black ground. The updated study corrects it to the night blue the Remember the Creek poster actually uses, and that poster is now the masthead. Do not drift it back toward jungle green.

Surface glow rides on hover states that already exist, through three variables: `--fx-glow`, `--fx-glow-strength` and `--fx-strike`. `.fx-row` lights a row's leading edge and bleeds inward, `.fx-panel` puts a halo around the filter pane, `.fx-stripe` makes the brand rule glow.

> [!success] A theme that opts out is untouched
> Strength defaults to `0` and strike to `0px`, so both insets collapse and no layer renders at all. Dark, Light and Neon are provably unchanged: no `.fx-layer` in the DOM, `--fx-glow-strength: 0`.

> [!danger] The shell must not paint its own background
> The ambient layer is fixed at `z-index: 0` and the content sits at `z-10`. `body` carries `base-950` and the shell carries none. Give the shell a background colour again and the whole layer vanishes behind it.

> [!warning] Motion is optional and art is optional
> Everything that moves stops under `prefers-reduced-motion`, and the particles hide entirely rather than freezing mid-air. Textures go through `themeArt`, so an empty `src/assets` renders no texture rather than a broken URL. This is why the texture cannot be a CSS `url()`: that would break the build on a fresh clone, where the generated art directories are gitignored and genuinely absent.

> [!info] Cutting a masthead banner
> **Two cuts per skin, and the second one is optional.** The wide box and the phone box are too far apart in shape for one image to serve both without throwing away half of it.
>
> | | Cut at | Keep the subject inside | Filename |
> |---|---|---|---|
> | **Wide**, `sm` and up | **2560 x 184** | centre **1320 x 95** | `masthead.jpg` |
> | **Phone**, below `sm` | **1280 x 128** | centre **880 x 85** | `masthead-sm.jpg` |
>
> A skin with no `masthead-sm` falls back to the wide cut and crops, which is what every skin did before the phone variant existed. Nothing breaks; you just see the middle third.
>
> **Why those numbers.** The box is the viewport minus the 224px sidebar minus the scrollbar, by `--brand-box` tall. On `sm` and up that runs from 625 x 86 at a 640px window to 2321 x 86 at 2560, a ratio band of **7.3:1 to 27:1**. On a phone the header is gone and the art paints behind the single 44px nav row instead, so the band is **6.9:1 to 14.2:1**. Each cut sits at the geometric middle of its own band, and the safe zone is the part that survives the crop at both ends of it.
>
> With both cuts, 70% of each image survives the worst case. With only the wide one, 52% does.
>
> **Cut as JPG, not PNG.** The art sits behind an opaque header at 20 to 42% opacity and never needs an alpha channel. Two skins still ship PNG mastheads costing 654KB and 644KB, against 26KB for the Viper JPG, and `hellpod-drop-bay` is 10861px wide for an 86px box. Re-cut those two when convenient.
>
> The phone cut is also **dimmed to 60%** in code, because there it sits behind the only navigation on the screen rather than behind a title.

> [!warning] Art is painted at the size it is displayed, not the size it arrived
> The Bile Titan emblem landed at 2304 x 1852 and 399KB, and it renders as a 40 x 32 mask. Scaled to 320px wide it is 21KB, which is a 95% saving on one file. The full resolution original stays in the library as `bile_titan_emblem_source_2304.png`, which matches no reserved prefix and so is never bundled. Check the pixel dimensions of any new mark against the size it is actually drawn at.

> [!tip] When a new theme packet lands
> Run `npm run images`, then `themeArtNames("<theme-id>")` from `src/lib/assets.js` lists what that packet actually shipped without opening the HTML. Point `FX[<id>].texture.file` at the new name. The importer reads art out of both `<img src="data:">` tags and CSS `url(data:)` backgrounds, so a study that sets its art as a background is no longer skipped.

> [!tip] Draw with the study's own art, not the loose references
> `npm run images` extracts every data URI image embedded in a study into `src/assets/themes/<id>/study_<class>.<ext>`. Those copies are already cut to transparency and coloured for the skin, so they mask cleanly and take the brand token. The loose files next to the study are flat art on white grounds and need mangling before they are usable.
> The Castellan's Creed mark is the aquila the study embeds, painted with the brand gold through an alpha mask. The `emblem_aquila_imperial.jpg` sitting beside it is the same eagle and the wrong asset for the job.

> [!warning] The accent is never the brand colour
> Painting the lock and favorite accent with the brand colour makes a locked item and the brand mark the same thing, and the lock stops meaning anything. `brand` and `accent` are different roles, not two names for one hue.
> Amber is the default and eight themes inherit it untouched. Three restate it, and each for a reason: **Hellpod Drop Bay** and **Super Destroyer** have yellow brands that swallowed an amber padlock whole, so both take a vermillion that reads as a warning light. **Malevelon Creek** takes the study's own `--tracer` red, which was otherwise unused and is the thing the Creek is actually remembered for. **Ministry of Truth** restates the Light theme's hand tuned ramp, because amber tuned for a dark ground washes out on paper.

> [!question] The studies disagree with the accent rule
> Several drafts paint their signature colour on the stale chip and the lock, treating the theme as having one colour rather than two roles. That is a real disagreement and it is recorded rather than applied, because a static mockup has no lock state to confuse. Worth settling if the skins ever get redrawn.

> [!failure] Castellan's Creed no longer fades the tier ramp
> The first study restyled the whole ladder so it read as one material. The v2 study relabels the ramp **invariant**, with the note "tier badges and faction hues are the same values in every theme", so the override is gone and every skin now shows the same badge. The v2 studies also draw that ramp at slightly different values than the app uses, S+ `#F59E0B` against the app's `#fbbf24` and A blue against the app's teal. **The app's ramp was left alone**, because changing it would repaint Dark, Light and Neon too. Unresolved.

> [!danger] Faction colours are not tokens, ever
> Bots red, bugs orange, squids purple are a locked decision and stay literal in every theme, warbond skins included.

**The tier ramp is a token set, with one rule.** Dark, Light and Neon share one ramp and never touch it, because the badge encodes the rating and an S+ has to read as the same S+ across them. A warbond skin may override it, but only **all six at once**. Overriding one tier and leaving the rest is what breaks the badge.

Castellan's Creed uses that exemption: only S+ is a solid chip, and S through D fade through gold, olive, teal, bone and muted so the ladder reads as one material rather than a rainbow.

Biome panels tint from the biome's own colour at low alpha rather than a fixed dark wash, which is what lets them read correctly in both themes.

**Dark is grey, not black.** The artifact sat at near black `#09090b`. The dark theme lifts it to `#121214`, which is what the build spec asks for. To go back, set `--base-950` to `9 9 11` and `--base-900` to `24 24 27` in `src/index.css`.

**A theme declares its own base.** Nothing forces a future theme to ship both a light and a dark variant. The Warhammer 40,000 one is inherently dark and should just be dark.

---

# **Art**

`Image Library` in the repo root is the source of truth and is never written to. `npm run images` copies out of it into `src/assets`, renaming each file to the id it belongs to, so the resolver in `src/lib/assets.js` is a plain id to file lookup with no mapping to maintain.

### How the library is organised

It used to be 277 loose files in one directory. It is now sorted, and the importer **walks subfolders** rather than reading one flat list, so a file works from wherever it sits.

| Folder | Holds | Files |
|---|---|---|
| `Weapons` | `weapon_*` | 76 |
| `Stratagems` | `stratagem_*` | 83 |
| `Throwables` | `throwable_*` | 21 |
| `Armor` | `armor_*` | 27 |
| `Boosters` | `booster_*` | 18 |
| `Warbonds` | `warbond_*` | 24 |
| `UI` | `ui_*`, `faction_*`, `module_*` | 24 |
| `Key Art` | `art_*` | 4 |
| `Themes` | One folder per skin | 69 |

> [!danger] The folder is organisation. The prefix is the key
> A file is matched to an item id by its **filename prefix**, not by which folder it is in. `weapon_ar_23_liberator.png` resolves to `ar-23-liberator` whether it sits in `Weapons` or anywhere else. That is deliberate: a file stays self identifying if it is ever moved, and reorganising the library can never silently break a lookup. Rename a file and you may break it; move it and you will not.

> [!warning] Four reserved names inside a theme folder
> `masthead.*` is the header image, `masthead-sm.*` is its optional phone cut, `emblem.*` is the mark that replaces the skull, and `study_*` is art the palette study embedded. **Only those four reach the app.** Everything else in a skin folder, the study itself, its preview render, and the loose reference art, stays behind. Name a new file with one of those prefixes or it will not be bundled.

| Kind | Count | Notes |
|---|---|---|
| Item art | 227 of 228 | Only Electrical Conduit has none |
| Warbond covers | 24 of 24 | 512px cover art |
| Generic | 28 | Skull, faction marks, logos, category and tier badges |

Three different art styles are in there and they are not interchangeable. Stratagems are flat in-game icons at about 4KB, already colour coded by call-in menu group, which is why they read so well at row size. Weapons are hero renders at about 93KB. Warbonds are cover art.

> [!danger] Nothing may depend on art existing
> Delete `src/assets` and every lookup returns null, every item still reads through its text fallback, and nothing throws. This is deliberate. The build spec is explicit that extracted game art is the most likely thing to have to come out, so the asset layer stays swappable. The generated directories are gitignored, so a fresh clone genuinely runs art free until `npm run images`.

Item ids come from the display name, so the file naming lines up on its own for 227 of 228. The handful that do not are listed explicitly in `scripts/import-images.mjs` rather than fuzzy matched, so a wrong pairing is visible in review.

**Single colour art is masked, not recoloured by hand.** The skull and the faction marks are painted with `currentColor` through a CSS mask, so they take the theme token or the locked faction hex without a second copy of the file per colour.

> [!warning] Vite inlines small assets into the JS bundle
> The default `assetsInlineLimit` is 4KB and most stratagem icons sit just under it, which quietly moved a few hundred KB of art into the main bundle and defeated the lazy loading on the rows. `vite.config.js` sets it to 0. Leave it there.

---

# **Running It**

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` runs the validator first and stops if names do not line up. Run the check on its own with `npm run validate`.

```bash
npm run wiki
```

Re-fetches the weapon stats and the planet table, and **reports what would change without writing anything**. Add `-- --write` to apply it and `-- --refresh` to go back to the network instead of the cache in `.wiki-cache`. It is deliberately not part of the build: a build that needs the internet is a build that breaks on a train.

> [!info] Node is on the PATH
> Verified 18 August 2026: a fresh PowerShell resolves `node` to `C:\Program Files\nodejs\node.exe` and `npm` works with no setup. This used to need prepending, because a shell opened before the install could not see it. That is no longer true.

> [!tip] How stigly actually builds it
> File Explorer into `C:\Dev\hd2-armory`, click the address bar, type `powershell`, Enter. That opens a terminal already in the folder. Then `npm run build`, and drag `dist` onto Netlify. He does not use a terminal habitually, so give the path and the clicks, not just the command.

> [!bug] PowerShell refuses to run npm
> `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.` PowerShell blocks the npm script wrapper by default. **Use `cmd` in the address bar instead of `powershell`**, where plain `npm run build` works. From an already open PowerShell, `npm.cmd run build` skips the wrapper and works too. Neither needs a system change. `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` is the permanent fix but is not required, so do not run it on his behalf.

---

# **Versioning And The Changelog**

`src/data/changelog.json` is the record, newest first. **One version is one deploy**, not one day: a version can gather several days of small changes, and its `date` is when it shipped. That is the whole reason it is versioned rather than dated, since work here arrives in bursts and trickles that do not line up with a calendar.

| Bump | When |
|---|---|
| **Patch**, 1.2.x | Fixes and small tweaks only. Nothing new to learn |
| **Minor**, 1.x.0 | A new surface, a new capability, a batch of skins. The normal bump |
| **Major**, x.0.0 | The tool becomes a different thing. Accounts landing would qualify |

> [!danger] Three places have to agree, and two of them are automatic
> Add the entry to `changelog.json` with a new `version`, then set the same string in `package.json`. The footer and the Changelog page both read `CHANGELOG[0].version`, so they cannot drift. **Nothing else hardcodes a version.**

> [!tip] Write the entry as the work lands, not at the end
> Adding a line to the top entry costs nothing. Reconstructing a week of small changes from memory is how a changelog quietly becomes fiction.

---

# **Hosting**

`npm run build` writes `dist`, and `dist` is the whole product. There is no server, no API and no database, so any static host works.

| Fact | Consequence |
|---|---|
| Hash routing, `#/tiers/primary` | **No rewrite rules needed.** The path never reaches the server, so there is nothing to configure |
| Asset paths are absolute, `/assets/...` | Must be served from a **domain root**. A subpath deploy needs `base` set in `vite.config.js` |
| 15MB across 297 files | Comfortably inside every free tier |
| State is `localStorage` | Per origin. Nothing follows you from `localhost` to a hosted URL, and nothing syncs between two people |

> [!warning] Moving between origins loses your collection
> Profiles, locks and favorites live in `localStorage`, which is scoped to the origin. Going from `localhost:5173` to a hosted URL starts empty. Export from Settings first and Import on the other side; that is exactly what the backup file is for.

> [!danger] Only `study_*` art is bundled
> `src/lib/assets.js` globs `../assets/themes/*/study_*`, not the whole folder. A theme folder also holds its palette study, a preview render and the loose reference art the skin was drawn from, none of which the app renders. Globbing everything shipped **22.7MB of dead weight, 60% of the built output**. If a skin needs a new file at runtime, name it `study_*` or it will not be bundled.

> [!warning] The art is extracted from shipped games
> Item art comes from Helldivers 2, and the crossover skins carry Games Workshop and Halo material. The asset layer is deliberately swappable and every lookup returns null with a text fallback, so the tool runs art free if any of it ever has to come out. Worth keeping the URL unlisted rather than indexed.

---

# **Deferred, Not Rejected**

> [!todo] Wanted, decided against for this pass only
> These are in the requirements document as real intentions. They were left out of the port to keep behaviour identical, not because they were turned down.

- **Weapon stats beyond the tables.** Magazine size, spare magazines, fire rate, recoil, reload time, projectile count and stagger are not in the source data. They would come from helldivers.wiki.gg.
- **Vehicles and mechs.** No EXO-45, EXO-49, FRV or GATER anywhere in the source tables. The stratagem list is incomplete without them.
- **A smart roll-the-dice generator in the builder.** Roll a build that is deliberately not just the top rated item in every slot, plus playstyle options to steer it. Wanted, and explicitly parked: it needs the coverage logic to be much better first. **This is not the auto-calibration that was declined.** That was a live picker that re-adjusted your other slots as you chose. This is a deliberate roll you ask for.
- **Better curated base loadouts, authored offline.** The current 39 are tier maximised and it shows: 35 of 39 use an S or S+ primary, only 13 distinct primaries appear across all of them, and the Grenade Pistol is in 16. On bugs and squids, 31 primaries are rated A or better and 8 get used. Three A tier marksman rifles for bots appear zero times. The plan is a separate tool that reads this project's data plus a logic document and writes `loadouts.json`, with variety as a hard constraint rather than a hope.
- **A bug and feature request form on Support.** Needs somewhere for a submission to go, so it waits on the same shared storage that accounts need. The footer no longer claims no data leaves your browser, so this is unblocked on the copy side.

---

# **Open Threads**

- The 19 stale flags should be reviewed once u.gg restamps to 7.0.0. Anti-Tank Mines is the most likely rating to move, since demo 30 to 40 crosses the threshold that closes holes from outside.
- The four Castellan's Creed weapons have no ratings and render as `?` until u.gg has data.
- **True Grit is in no curated loadout.** It is S+ on all three fronts and gives +30% support weapon reload, which is large on the Autocannon, Recoilless and Grenade Launcher builds. Swapping it in is an obvious improvement, but the curated set is his, so it was left alone pending his call.
- Where credible sources disagree by a full tier, for example the SG-8 Punisher Plasma at S+/S/S+ on u.gg against B/B/B on GamesRadar, the UI currently shows only one of them. Averaging it away would lose the most useful signal in the data.
