# **D.I.L.A.S.: Claude Instructions**

> [!warning] The repo lives at `C:\Dev\dilas` and nothing is called armory any more
> Renamed 21 August 2026, folder included. `Armory.jsx` is `Tiers.jsx`, `useArmoryState.js` is `useCollectionState.js`, and the four `helldivers-2_armory-*.md` documents are `dilas-*.md` (they were `dds-*.md` until 3 October 2026). The original Claude.ai artifact is `original-artifact.jsx`.
>
> **The product name still lives in exactly one file.** `src/lib/brand.js`, unchanged. Renaming the repo did not change that, and it must not: the folder is a path, the brand is a value.

> [!warning] Every word on screen follows `dilas-writing.md`
> The curator's writing guide, final since 9 October 2026: **say what it does, in the game's words, and stop.** The answer at a glance, the reason one click away, meanings and the longer reason on hover through `Tip` (`src/Tip.jsx`), the maths and the limits on About. Read it before writing or changing any UI text. His annotated samples are in `docs/writing/round-1.md`.

> Everything a fresh session needs before touching this repo. What the tool is, which decisions are settled and must not be quietly reversed, the one invariant that has broken twice, how ownership and lock state work, and how to run the thing. Read this before the code.

---

# **What This Is**

> [!warning] D.I.L.A.S. since 2 October 2026, and the name lives in one file
> **D.I.L.A.S., the Democratic Intelligent Loadout & Armoury System**, shown as **D.I.L.A.S.** in the wordmark with the full name in small caps beneath it. It was **D.D.S., the Democracy Deployment System**, until every short `.me` address for it turned out to be gone; the curator bought **dilas.me** on Cloudflare and took the name to match. He also judged the old name wrong on its own terms: the tool is an armoury, not a deployment system.
>
> It is in `src/lib/brand.js` and nowhere else: the sidebar, the mobile drawer, the browser tab (written into `index.html` by a small plugin in `vite.config.js`; it was a hardcoded title until the rename found it), the footer, About and the backup file's name all read from it. **The one other copy is the reset email in `worker/email.ts`**, because the Worker's type check cannot import the app's JavaScript. Renaming again is those two edits. Do not hardcode it anywhere else.
>
> **Nothing is called dds any more, the folder included.** The curator's call, 3 October 2026: the repo moved from `C:\Dev\dds` to `C:\Dev\dilas`, the documents became `dilas-*.md`, the package `dilas`, and on Cloudflare a new Worker `dilas` and a new database `dilas` replaced the `dds` ones, since neither can be renamed in place. The old `dds` Worker and its `dds.stigly-official.workers.dev` address went with it.

A Helldivers 2 tier browser and loadout tool, ported out of a single Claude.ai artifact into a Vite and React project. Navigation is two levels: a persistent left sidebar for destinations, and a top tab bar scoped to whichever destination is open.

| Destination | Route | State |
|---|---|---|
| **Drop Bay** | `#/bay` | Built. **The front door since 1 October 2026**: the page the tool opens on. The screen for the moment before you go. See The Drop Screen |
| **Star Map** | `#/map/:planet?` | Built, 2 October 2026. The galaxy map as its own place, for reading the war: the fronts, a planet's intel and its history, and Drop here. See The Galaxy Map, "The Star Map" |
| **Armoury** | `#/armoury/:tab` | Built. Your builds. Two tabs: **Builds**, the grid that browses every build at once, and **Coverage**, what your builds answer per front. See The Armoury |
| **Collection** | `#/collection/:tab` | Built. Two tabs, Warbonds and Items, one per ownership axis |
| **Rules** | `#/rules` | Built. Every rule behind our rating, what it moves here, and a switch to turn it off. Bottom of the menu. See The Rules Page |
| **Tier Lists** | `#/tiers/:category` | Built. **Back in the menu since 3 October 2026**, the curator's call, after two days off it: the quickest way to see what a rule does is to watch the list move. A strip on the page sets the front, difficulty and how many of you without leaving it. Still the picker inside every build |
| **The editor** | `#/builder/:id?` | Off the menu, lit as Armoury. Edits one build; `new` starts one, `new-bots` starts one for a front |
| **Shared build** | `#/shared/:code` | Off the menu. A build carried in the link itself. See Drop History And Share Links |
| **The war room** | `#/scenario` | Built, 2 October 2026. Off the menu: the scenario bar's Adjust, and every surface that needs a front first, send you here. Where the scenario is set, the galaxy map across the screen. See The Galaxy Map, "The war room" |
| **Settings** | `#/settings` | Built. Theme, export, import, reset |
| **Support** | `#/support` | Built. Where the numbers come from |
| **Roadmap** | `#/roadmap` | Built. One timeline, what is next and what it waits on |
| **Exchange** | | v3. Shown in the sidebar, deliberately not reachable |
| **The party menu** | top right, every page | Built. The party's controls, and where friends and finding a group will live. See The Live Party |
| **Account** | `#/account` | **Built and switched off.** Locked in the sidebar until `ACCOUNTS_LIVE` in `src/lib/account.js` is true. See Accounts |

> [!info] Routing is hand rolled
> `src/lib/router.js` is a hash router in about thirty lines, not a dependency. The route table is a handful of destinations with at most one parameter, and hash routing needs no server rewrite rules. Swap in a real router the moment that stops being true.
> A destination with tabs keeps the tab in the route, so `#/collection/items` is linkable and survives a reload. `LANDING` in `App.jsx` names the tab the sidebar lands on, because a bare `#/collection` would leave the tab bar and the surface disagreeing about which one is open.

> [!info] Who this is for
> stigly, a returning power user whose game knowledge stops around December 2024. He curates the data and decides what the tool does. He did not write this code and does not read it. Describe changes in terms of what they do for the tool, not by identifier.

> [!success] Drop Bay is the front door. The curator's call, 1 October 2026
> The tool now follows the game's own two places: **the Armoury**, where builds are made and kept (the game's armoury, plus saving, naming and stratagems, which the game does not keep), and **Drop Bay**, the drop screen right before you go. The tier list left the menu: **it is the picker inside every build**, ranked by our reading for where you are dropping, and still whole at `#/tiers` for anyone who prefers it. The value proposition in his words: repeatability, and showing what you actually have for each occasion.
>
> | Landed the same day | |
> |---|---|
> | **Suggestions** | Drop Bay suggests three of your builds, ranked by the reading, each saying why. Ranking was "a decision nobody has made" until this |
> | **The editor over the drop** | Adjusting a build opens the editor over Drop Bay; saving puts it in your slot, still to confirm |
> | **How many of you** | Seats on Drop Bay for a day; since 2 October 2026 one setting beside difficulty in the war room, and in a party the party counts. See The Drop Screen |
> | **Drop history** | Every Confirm is recorded, so "you have never dropped with a Railgun against bots" can be built on it |
> | **Coverage** | The Armoury answers "do I have something for each occasion", per front |
> | **The Rules page** | Every rule, what it moves here, and a switch |
> | **Share links** | A build in the link itself, no server |
> | **Commando missions** | Automaton only, with their own trait and eight rules: the reinforcement and call-in limits, from the wiki |

What is agreed but not built lives in `dilas-roadmap.md`: the accounts, Exchange and live squad dependency chain, the wider warning set, and the offline build authoring plan. Read it before starting anything that sounds like new scope.

Data authority lives outside this repo, in the Helldivers 2 project files: `helldivers-2_tables.md` for every rating and number, `helldivers-2_tier-list.md` for the decision layer, `dilas-design.md` and `dilas-web-requirements.md` for why the tool works the way it does. The original artifact is kept at `original-artifact.jsx` in the repo root as a reference implementation. It is not built and not imported.

---

# **State Of Play**

> [!success] The contextual overhaul shipped, 1.3.0 to 1.9.0 on 20 August 2026
> The tool now has **two ratings per row**: the u.gg community vote, and one this project computes for where you are actually dropping. Both stay visible, and every point of difference carries a sentence explaining it.
>
> | Landed | |
> |---|---|
> | **The Scenario** | Faction, planet, biome, hazards, mission, difficulty. One object, persisted, read by the tier list, Drop Bay and the builder. Called the brief until 1.10.1 |
> | **Faction gates rather than filters** | Three buttons above the table, no table until one is picked, two rating columns instead of three faction columns |
> | **Fetched stats** | 182 items now carry magazine, fire rate, recoil, ergonomics, sway, durable damage, stagger, pushback, projectile drag, call-in codes and the game's own tags. `npm run wiki` |
> | **281 planets** | Biome and hazards, with the mechanic each hazard applies. MIT licensed, shipped as a table, no runtime network |
> | **70 missions** | The real names, per front, each with the line the name does not tell you |
> | **The scoring engine** | `src/lib/score.js`, 31 rules in `src/data/context-rules.json`. `npm run rules` checks they still discriminate |
> | **Enemy armour** | 80 enemies, 594 body parts. Shown on every row as a fact, moves no rating, waits for loadout scoring |
> | **Vehicles** | All eight, rated |
>
> **What is left**, in order: three judgement tags, then Drop Bay becoming the drop screen. Loadout scoring landed in 1.20.0. **The tool moved to Cloudflare in 1.21.0**, Stage 0 of `dilas-cloudflare-handover.md`, which is the plan for accounts, sync, Exchange and the live war map. The plan lives in `dilas-roadmap.md`, which also explains how the phases relate to the v2 and v3 labels in the sidebar.

> [!success] Armour moves a rating again, at the loadout level. 1.20.0. Do not put it back on the item
> Five armour rules shipped in 1.10.0 and came out in 1.13.0. They were the wrong altitude and the measurement is blunt: **48 of 51 primaries on the Automaton front share one of two identical armour readings**, and the rules took a tier off 42 of them. Only the Eruptor, the Double-Edge Sickle and the Torcher differ.
>
> **A community tier already prices in what an item is for.** Voters know an assault rifle does not open a Hulk, so the Liberator's B on bots is a B *given* that it is a chaff gun. Penalising it again charges twice for one fact.
>
> The curator found it within minutes of the feature shipping, and the second half of his argument is the one that settles it: even the item that **is** good at armour is not straightforwardly better, because bringing an Eruptor on bugs forces a Stalwart to cover chaff. That trade is invisible to per item scoring. **Armour is a loadout property.**
>
> `src/lib/squad.js` already had this right, asking whether *anyone in the squad* carries AP 4 or better rather than judging each weapon alone. **That is the shape it came back in, on 22 August 2026.** `penetration-misses-the-front` in `build-rules.json` reads the best thing a build holds, and the same reading that split 51 primaries 48 to 3 splits the 39 curated builds **36, 41 and 23 percent** three ways. See The Loadout Reading.
>
> **The test any replacement must pass:** a scenario rule has to fire on something that varies with the scenario. Armour reach per item does not. `npm run rules` measures this for every rule and flags any firing on 60% or more of its pool, and `npm run builds` does the same for the loadout rules against 300 random builds.

> [!success] Enemy armour landed in 1.10.0, 21 August 2026
> The tool showed an armor penetration number for months with nothing to measure it against, so every judgement about it was a threshold somebody picked. `src/data/enemies.json` is the other half: **80 enemies, 594 body parts**, each with its armor value, health and durable share.
>
> The rule is the game's own and it is three states rather than a scale. **Above the armor value is full damage, exactly equal is 65%, below it the round bounces for nothing.** It is written down in exactly one place, `src/lib/enemies.js`.
>
> That middle case earns its keep. A Devastator is armored to 3, so an AP 3 weapon only ties it and **AP 4 is the first clean answer to one**, which is the second and better reason the squad threshold sits where it does.

> [!success] Rules can read difficulty and squad size. 1.16.0
> `when` now takes `difficulty` and `squad` as number tests, the same shape an item stat takes: `{ "difficulty": { "gte": 7 }, "squad": { "lte": 1 } }`.
>
> **Neither fires on an unset value.** Zero means not said, and a rule asking about either is skipped rather than guessing. Assuming somebody is solo because they have not told you is how a list confidently ranks for a game nobody is playing.
>
> **Squad size is the sharper of the two.** Solo on Impossible and a four stack on Impossible are different games, and the first rules to use it prove the tool can say something the crowd structurally cannot: the community vote gives six S+ primaries on bots and none is suppressed, because a vote has no idea whether you are alone. Drop solo at 8 and the Censor is the only S+ left, with the AR-59 Suppressor and the M7S SMG climbing out of B and C.
>
> **At a full squad the same list goes back to agreeing with u.gg.** That was written up as the correct output rather than a failure. **It is not. It is a gap, and it was measured on 21 August 2026.**
>
> Only **3 of 34 rules read squad** and **2 read difficulty**, and every one of them is `faction: bots` with `squad: {lte: 1}`. The consequences:
>
> | Front | 24 combinations of difficulty and squad produce |
> |---|---|
> | bugs | **1 distinct list** |
> | squids | **1 distinct list** |
> | bots | 2 distinct lists, solo against everything else |
>
> Difficulty on bugs at 1, 4, 7 and 10 gives the same 37 moved items every time. **The ten level slider moves nothing on its own, on any front.** Squad on bots goes 78 moved at solo, then 25 at two, three and four alike: one cliff, no gradient.
>
> **And agreement with u.gg is not a meaningful baseline to return to.** A u.gg rating is an unweighted blur over Super Helldive veterans and new players soloing at difficulty 3, over every planet and every condition, with faction as its only axis. It is not the four player rating. Comparing a four stack at 9 in a sandstorm against it and calling the match "nothing to add" compares a situation against an average of situations that never happen in isolation.
>
> The curator made this argument on 21 August 2026 and it is the right one. **Do not quote the old line as a principle.** What is actually true is that the rule set has no non solo squad rules and no difficulty gradient yet. See `dilas-roadmap.md`, "Warning logic, a wider set", which already asks whether difficulty should scale thresholds rather than gate them, and is now a measured question rather than an open one.
>
> `notIdIn` was added alongside, symmetric with `notTags`, so a rule can say "everything except these". It is what lets the loud half of a list fall at the same moment the quiet half rises.

> [!warning] Suppressed is the one trait read from a wiki article rather than a module
> Five weapons carry it: the R-72 Censor, AR-59 Suppressor, P-35 Re-Educator, M6C-SOCOM and M7S SMG. **It is sourced, not judged**: the wiki puts Suppressed in each weapon's infobox and states the audible range as 12 metres against 100 for everything else.
>
> It lives as a list of ids inside the rule because `fetch-wiki.mjs` reads modules and enemy anatomy tables, not weapon article infoboxes. **Move it into the fetch when that changes**, the same way enemy armour moved out of a guess and into data.

> [!success] The scenario is a screen, and the bar is the only copy of it. 1.15.0
> `#/scenario`, reachable from a one line bar in the sticky chrome and **deliberately absent from the sidebar**: it is a sub screen of the surfaces that read it, not a destination. `OFF_MENU` in `App.jsx` is what makes a route reachable without a menu entry.
>
> It used to be a panel repeated at the top of every tier list tab. Two problems in one coat: it ate the height the table wanted, and **repeating a control on every tab says that control is scoped to the tab**. It never was. `useScenario` is called once in `App.jsx` and the value is shared, so the UI was lying about its own behaviour.
>
> **The gate is a redirect, since 2 October 2026.** With no front chosen, the tier list and Drop Bay send you to `#/scenario`, the war room, replacing the history entry so Back does not bounce you there again, and **Done** brings you back once a front is chosen. Done is hidden until then, since it would only send you straight back. Drawing the war room in their place, the first version, swapped the whole screen out the moment a front was picked, with the planet and the mission still to come. **The redirect waits for `useScenario`'s `ready`**: before storage is read, no front means not loaded yet, and acting on it sent everybody to the war room on every load.
>
> **Done returns you to the tab you left**, tracked by a ref in `App.jsx`. Adjusting from Stratagems and landing on Primaries is the kind of small wrong that makes a round trip feel like a detour.
>
> **The three tall faction banners are gone since 1.25.0.** The curator's point, 30 September 2026: with the galaxy map setting the front from the planet, opening on a choice of front was the long way round. The front is the planner's first question, as three compact buttons. See The Galaxy Map, "The drop planner". **Since 2 October 2026 the screen is the war room**, the map across the space right of the menu with everything else laid over it; `ScenarioScreen`, `DropPlanner` and `PlanetChooser` are gone. See The Galaxy Map, "The war room".

> [!danger] The difficulty marks are the one UI art set that is not masked
> Every other single colour mark in this project is painted with `currentColor` through a CSS mask so it takes the theme. **The difficulty marks are drawn as images instead**, because they carry the game's own colour ramp: grey `#4a494a` at 1, bronze `#ad7529` at 5, red `#8c0c10` at 7, near black `#310c10` at 10, with the white skull and chevrons over the top. Masking them collapsed ten distinct marks into one flat brand colour. The white sits on a coloured backing, so they read on the light themes too.

> [!info] Both rating columns are sort buttons, and the solid one is the live one
> Ours is the default. The faction tint runs the height of the sorted column, on the header **and** on every row's cell, so the two cannot disagree about which column you are reading. The other column drops to 50%.
>
> This replaced marking *agreement* between the two columns, which was the wrong thing to spend contrast on: about half of any list agrees, so half the column sat faded and read as a rendering fault. Only one column at a time is the one you are actually reading.
>
> `tierStyle` in `src/Tiers.jsx` carries the badge gloss, so the row badges and the filter chips cannot drift. It is white and black at low alpha over the tier colour rather than a second token per tier, which is what lets it work on all six tiers, every skin and both light themes with nothing new to keep in step.

> [!info] It is the scenario, not the brief. Renamed 21 August 2026
> The five answers about where you are dropping, front, planet, biome, hazards and mission, are **the scenario**. The code called it the brief for a week and the word had started leaking into on screen copy without ever being defined, which is exactly how a reader ends up staring at a term the tool never explains.
>
> The curator's word is better and the reasoning is his: a brief is a document somebody hands you, and this is the situation you are walking into. `src/lib/scenario.js`, `useScenario`, `scenarioIsSet`, and the storage keys `hd2-scenario-faction` and `hd2-scenario-env`.
>
> **The two old storage keys are inherited, not abandoned.** A browser that was here before the rename reads `hd2-brief-*` once, copies it across, and keeps its front and planet. The old keys are left in place rather than deleted, the same call the profiles migration made.
>
> **Difficulty is the sixth field and it landed in 1.11.0**, which that file's header had been predicting since the day it was written.

> [!success] Difficulty is a scenario field, and it decides which enemies are counted
> Every enemy carries `minDifficulty`. The armour reading counts **the roster you can actually meet at your level**, not everything the front can field: 33 of the 54 baseline enemies at difficulty 3, 46 at 5, 50 at 7, all 54 at 10. A Factory Strider is difficulty 4 and up, and warning about one on a Challenging drop is warning about the wrong thing.
>
> **Zero means not set**, which is the absence of a difficulty rather than a low one, and it is what the slider already spelled. With it unset the whole front is judged and the panel says so.
>
> **The slider is `DifficultySlider`, the one Drop Bay already used**, not a second control. It sits in the open half of the scenario panel rather than behind the fold with biome and hazards, because it changes which enemies are counted and a hidden control that narrows what you are reading is the folded filter mistake in a new place. **In the war room it is a stepper since 2 October 2026**, two arrows either side of the mark and the name, the way the game steps it, always in view along the bottom; the slider stays in the Armoury's filters.
>
> **It does not clear with the environment.** Changing planet does not mean you stopped playing at the level you play at.
>
> Two wiki infoboxes leave the field blank and both are variants, so no baseline is affected. **An unknown is treated as level 1**, which keeps an enemy in the reckoning rather than quietly hiding one you might meet.

> [!success] v1 is done
> Sidebar IA, local persistence, export and import, two themes (four, in fact), full row expansion, the Loadout Builder, Drop Bay and Collection are all built and verified. The art is wired in. The data model is on stable ids with structured stats.

### Collection

`src/Collection.jsx`. Two tabs, because owning a warbond and unlocking an item are separate purchases: super credits buy the warbond, medals unlock each item in it.

- **Warbonds tab.** Every warbond grouped by tier, an owned toggle, its tracked item count, and per warbond bulk unlock and bulk lock of its contents.
- **Items tab.** A flat searchable list of every item, 247 as of 1.23.0, with acquisition path and availability, filterable by slot, source and availability, with bulk lock and unlock over whatever is currently shown.
- **Availability is derived** on read and stored nowhere. A warbond item is available only when the warbond is owned **and** the item is unlocked. Anything on another acquisition path ignores the warbond axis entirely.

> [!danger] Three rules that are easy to get wrong
> Marking a warbond as owned **must not** mass unlock its items. They keep whatever per item state they had. The explicit bulk action on each warbond tile is how you unlock the contents, since one click warbond operations were a liked property of the artifact.
> Marking a warbond as **not** owned disables its items' per item toggles, in Collection and on the tier rows. The only way back is the warbond toggle. This one way door is deliberate: it stops the two mechanisms fighting, and it is why every bulk action skips anything a warbond is already holding.
> Locked warbond items use a dimmer amber padlock than a per item lock. Both axes are amber, the shade is the tell.

> [!info] The bulk buttons on a warbond tile are a tick and a cross, not two padlocks
> Three padlocks in a row read as the same control repeated. The tick and cross also say the right thing: they set the medal axis for the whole warbond, they do not toggle the warbond.

> [!danger] Setting it up comes first. The curator's call, 3 October 2026
> **An untouched collection locks nothing, so it reads as owning every warbond and every item**, and every suggestion and picker offers gear the player may not have. Three things push toward fixing that:
>
> - **The nudge**, `CollectionNudge`, over Drop Bay, the Armoury, the Tier Lists, the editor and a shared build (`NUDGE_SURFACES` in `App.jsx`) while the active profile needs it: **Set up my collection**, or **I own everything**
> - **The guide**, `CollectionGuide`, at the top of Collection: a quick start (**I am fairly new** resets the profile to nothing owned, **I have played a lot** to everything owned), and one card per kind of button, because the page's buttons act on different things
> - **The tour starts there**, one stop per kind of button
>
> `needsSetup` in `src/lib/ownership.js` is the one test: no `setUp` mark and no lock of either kind. **Any lock counts as a collection somebody has touched**, so nobody who already set theirs up is nagged. `setUp` lives on the profile, so it is exported with it, and `cleanProfile` keeps it.

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

- Ids are unique and are real slugs, and no alias collides with a live id or a live name. **An item's own id is exempt**: the Melta Mine keeps its old name "G/40-K Meltamine" as an alias, and that slugs to the item's own unchanged id, which is a rename working as designed rather than a collision. Narrowed in 1.23.0 and proven to still catch a real one
- Every loadout slot resolves to an item **of the right kind**, so a booster cannot end up in the armor slot
- Every armor set key and every ownership entry resolves
- Every item's warbond resolves to a real warbond
- Ratings inside the tier scale, known damage types, slots, stratagem types, traits and roles
- A patch note behind every `stale` flag, and provenance on every rating that has a tier
- **Every scoring rule in `context-rules.json`**: that it carries a `say`, that its id is unique, and that every item id, tag, game tag and role it names actually resolves. A rule asking for a tag nothing carries is caught too, since that rule can never fire

### Renames

Rename freely. Put the old name in that item's `aliases` array and nothing breaks: ids never moved, and the alias is what lets state saved by an older build still resolve. Two aliases exist from the 7.0.0 data rebuild, `SG-225 Trident` and `AR-23C Liberator Carbine`, both verified to still migrate correctly. A third arrived in 1.23.0: `g-40-k-meltamine` is now named "G/40-K Melta Mine", as the game spells it, with the old name kept as its alias.

> [!info] Saved state migrates once
> State written before ids existed was keyed by display name. On load, names and aliases resolve to ids, anything that resolves to nothing is dropped, and the result is written straight back. A list that is already ids passes through untouched, so the migration is safe to run on every load.

---

# **Locked Decisions**

> [!danger] Do not reverse these without asking
> Every one came from direct curator feedback. A fresh session "improving" them undoes work already asked for.

### The shape of the tool

- **Tier browsing was the primary tool until 1 October 2026, and he reversed it himself.** He still prefers judging items over accepting packaged builds, which is why the tier list survives as the picker in every build, ranked for the drop, and stays whole at `#/tiers`. What changed is the front door: Drop Bay, then the Armoury, the game's own two places. **He put it back in the menu himself on 3 October 2026**, with quick scenario controls on the page, for watching rules move the list. Drop Bay stays the front door.
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

**The front is shared, and it is the same control everywhere.** The tier list and Drop Bay read one value from `src/lib/scenario.js`, so choosing a war in one place is choosing it in the other. The Loadout Builder carries the same bar but bound to `draft.faction`, because a build is *for* a front and keeps that when saved. Changing it there marks the build unsaved and does not move the scenario.

**Difficulty has the game's names and marks on it.** Ten levels, Trivial through Super Helldive, with the game's own icons: a stepper in the war room, a slider in the Armoury's filters. The four bands a build declares are unchanged underneath and the slider derives one, so nothing saved had to migrate. The names live in `vocabulary.json` under `difficulties`, which is also where the band mapping is.

**Tier list filters live in the shell, not in `TierBrowser`.** Held in the component they were discarded every time you looked at Drop Bay. They are per category, persisted under `hd2-tier-filters`, and merged over a blank on read so a filter added later does not come back undefined.

**Two rating columns replace three faction columns.** The community vote, then ours for the current scenario. That is the comparison worth putting side by side, and it is what pays for the width the third faction column used to take. **Nothing is lost:** the other two fronts moved into the expanded row.

The second column was a dashed placeholder until the scoring engine existed. It still is for an item nobody has rated, and that is deliberately not a `?` badge, which already means "nobody has rated this" on the first column. Two different absences wearing one glyph is worse than an empty box that says what it is waiting for.

> [!danger] The column renders as soon as a front is chosen. It used to demand an environment too
> `scenarioIsSet` required a biome, hazard or mission on top of the faction, on the reasoning that a
> faction alone moves almost nothing. **Measured on 21 August 2026, that is false.** On bugs a front
> alone already puts **37 rated items at a different tier** and 74 carry a reason. A front with
> difficulty and squad set moves **93 on bots**.
>
> All of it was hidden, which meant everything 1.16.0 added was unreachable unless you also picked a
> planet, and `scenario.js` says most sessions never do. The tool's headline feature was invisible by
> default.
>
> **A column that agrees is not an empty column.** Agreeing with the crowd is a real answer, the same
> answer where it is genuinely true. The copy for it, "Nothing about where you are dropping changes
> where this sits", was already written and had never once rendered.
>
> **Rendering it also stops the tool hiding its own gaps.** With the column blank you could not see
> that difficulty moves nothing on two of three fronts. Now you can, which is the first step to
> fixing it.

### Presentation

- **Faction theming runs through the whole UI.** Bots red `#EF4444`, bugs orange `#F97316`, squids purple `#A855F7`. Not just labels: badges, borders, chips and card accents all shift.
- **Stratagem colour groups follow the in-game menu.** Blue for support and backpacks, red for Eagle and orbital, green for sentries, emplacements and mines, with a per-subtype icon inside each colour.
- **No damage type icon on `ballistic` and `utility` rows.** Those are the nothing-special defaults, so a glyph there is decoration. The kinds that keep an icon are the ones that change behaviour.
- **Fonts.** Oswald for headers and tier badges, JetBrains Mono for item names. **Served from this origin since 1.21.0**, vendored by `npm run fonts`. Never link them from Google again: the security policy blocks it. See Hosting.

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
| `items.json` | All 247 items. The authority for everything else |
| `loadouts.json` | 39 curated builds, one readable object each, every slot an id |
| `armor-sets.json` | The 109 armor set names, keyed by passive id, grouped by weight class. The curated index; `armor.json` is the fetched whole |
| `armor.json` | **Generated** by `npm run armor`. All 110 armour sets: weight, armour, speed, stamina, passive, where each comes from. See Pairings, "Armour sets". Never edit by hand |
| `warbonds.json` | The 25 gateable warbonds by tier, plus the labels for paths that are never gated |
| `vocabulary.json` | The shared enums. The app and the validator both read this one so they cannot disagree. Since 1.30.0 also the `terrain` table, the curator's reading of each biome's ground |
| `ownership.json` | What you own. Ships empty |
| `ownership.template.json` | Every warbond listed as not owned, ready to fill in |
| `wiki-stats.json` | **Generated.** The stats the tables never had, for 195 items, and since 4 October 2026 a reload time for 91 held weapons and the One Handed trait for 35, read from each weapon's own wiki infobox. Never edit by hand |
| `planets.json` | **Generated.** 281 planets: biome, hazards, sector, their cities by size, and for 274 of them a place on the galaxy map and the supply lines to their neighbours. Read by the scenario, the map and the drop planner |
| `enemies.json` | **Generated.** 80 enemies, 594 body parts, each with an armor value, plus the difficulty each enemy starts appearing at. What every penetration figure is measured against. Never edit by hand |
| `context-rules.json` | The 105 rules that move one item rating, each with a `name` for the Rules page. 42 of them read the build, pairings and armour weight, and fire only inside one. Read by `score.js`, checked by `npm run rules`, and the pairings by `npm run builds` |
| `missions.json` | The 70 missions by the game's names, the fronts each appears on, the nine traits a rule keys on, and each one's time limit in `minutes`. Hand kept from the wiki; the names and fronts are the wiki's, the traits are ours, the minutes are written by `npm run missions` |
| `build-rules.json` | The 10 rules that move a whole build. Read by `build.js`, checked by `npm run builds` |
| `difficulty.json` | **Generated** by `npm run difficulty` from the table on the wiki's Difficulty page: per level, missions in an operation, medals, objectives, outposts by size, what the level introduces, and the reward multiplier. Read by the war room's difficulty bar through `src/lib/difficulty.js`. Never edit by hand |

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
  "tags": [],
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
- **`roles`** is the editorial layer. Three values, `anti-armor`, `chaff` and `objective`, and `chaff` is the most used of the three. An empty array is the normal case: 145 rated rows carry nothing, and there is deliberately no validator rule demanding otherwise.
- **`tags`** is the other curated layer and it is not the same thing as `roles`. A role says what job an item does for a squad. A tag says something a scoring rule needs to ask about that no fetched field answers. Three exist, `long-range`, `close-blast` and `suppressed`, and **each declares its own provenance in `vocabulary.json`**: `long-range` and `close-blast` are `curator`, `suppressed` is `wiki`. See The Tag Layer.
- **`flag`** is `"stale"` when the rating predates a confirmed change to that exact item, which requires a `patchNote`, or `"new"` when the item is in the game with no rating yet. **None is stale as of 1.23.0**: the nineteen that were all cleared when u.gg's votes came to postdate the changes, flag and note both set to null. Only the P/40-K Bolt Pistol is `new`. The machinery stays for the next patch.
- **`effect` versus `note`.** Armor passives and boosters carry an `effect`, which is what the thing actually does. Everything else carries a `note`, which is opinion. They never both appear.
- **`passive`**, on armor only since 4 October 2026: the effect's percentages as numbers a rule can scale off, `{ "fireResist": 75 }`. Read off the `effect` text, never judged. Every armor carries the object, empty when nothing in it is a number a rule asks about. The keys are a closed list in `validate.mjs` (`PASSIVE_KEYS`), because a misspelt key is a rule that never fires. `stimDuration` is in seconds, the rest in percent. **Change `effect` and `passive` together.**
- **`stats` are sparse, and that is now a gap rather than a principle.** AP, DPS, capacity, demo force, cooldown, uses and medal cost came out of the source tables. Magazine size, spare magazines, fire rate, recoil, reload time, projectile count and stagger were recorded here as **not in any source this project has**. The data spike on 20 August 2026 found all of them published, plus ergonomics, sway, durable damage, stagger, pushback and projectile drag. See `dilas-data-spike.md`. Still leave them absent rather than guessing, but the answer now is to fetch them rather than to shrug.

> [!success] The hot biome gate was firing on weapons with no heat mechanic. Fixed in 1.4.0
> `damageType` of `heat` or `arc` marked 26 items as thermally affected, and a hot biome removed any build carrying one. Only ten of them can overheat: the LAS laser family, the Quasar and the Rover's drone. Every plasma weapon feeds from magazines. Three Purifier builds and one Blitzer build were ruled out of every hot planet over a mechanic they do not have.
> `ventsHeat` in `src/lib/items.js` is the answer now, and it reads the fetched heat block. It has three states rather than two: a real yes or no for anything the fetch covers, and a fall back to the old `damageType` guess for the call-ins and melee weapons it does not.

> [!info] The ratings carry four patch stamps, and `src/lib/patch.js` is the one place that says which game
> Game version is **7.1.1** "Devoid of Liberty", 24 September 2026, a crash fix patch that changed no weapon. The last balance changes were 7.1.0 on 22 September. Ratings were read off u.gg on **26 September 2026**, and u.gg dates each of its eleven lists separately:
>
> | Stamp | Lists | Ratings |
> |---|---|---|
> | **7.1.1** | Primaries | 165 |
> | **7.0.2** | Support weapons, backpacks, eagles, sentries | 216 |
> | **7.1.0** | Secondaries, throwables, orbitals, boosters, armor passives, vehicles | 353 |
> | **6.3.1** | The P-33 Missile Pistol alone | 3 |
>
> **The six 7.1.0 lists print no stamp at all.** They are read as 7.1.0 because every one of them already carries Ironclad Democracy content, which only exists from 7.1.0. That is an inference and Support says so. **The P-33 dropped off u.gg's secondary list while staying in the game**, so it keeps its old 6.3.1 rating rather than losing one.
>
> `PATCH` in `src/lib/patch.js` holds the game version, its date, the ratings range and the read date. **The footer, About, Support and every expanded row read it**, so a restamp is one edit. It lived in `Pages.jsx` until 1.23.0 while the expanded row hardcoded its own "the game is on 7.0.0", and the two had already disagreed once. `Pages.jsx` re-exports it.

---

# **Refreshing The Ratings**

> [!success] Done once by script, 26 September 2026, 1.23.0. The next refresh copies it
> u.gg was read by hand into **`scripts/data/ugg-2026-09-26.json`**: eleven lists, each with the stamp u.gg printed or null, every row as name and three faction tiers, plus the few facts u.gg carries that no other source had yet. It is committed, so the update can be re-derived and audited without trusting a chat.
>
> **`scripts/apply-ugg-7-1.mjs`** reports by default and applies with `--write`, the same shape as `add-vehicles.mjs`. Every rating it writes is read from the snapshot, never typed into the script. It:
>
> - matches u.gg rows by name or alias, with `UGG_SPELLING` for u.gg's own typos ("G-89 Smokecreen"), and **fails loudly on an unmatched row** rather than skipping it
> - restamps every matched rating with its list's patch, and clears `stale` flags on anything u.gg listed
> - writes the new items in full, each field commented with where it came from
> - edits `warbonds.json` and `armor-sets.json` **as text**, through `insertText`, because both are hand formatted and a `JSON.stringify` round trip would reflow every line. The result is `JSON.parse` checked before it is written

> [!warning] The order matters, and the last step is the one that gets skipped
> 1. Apply the snapshot.
> 2. `node scripts/tag-roles.mjs --write` for the new items' roles, then `npm run roles` must report zero changes.
> 3. `npm run wiki -- --refresh`, read the report, then `--write`.
> 4. Restamp `src/lib/patch.js`.
> 5. **Measure before shipping.** In 1.23.0, of 2,124 item and loadout rows across the scenarios checked, our column changed on 51: 45 because the vote moved and 6 because of new wiki figures. Show that number to the curator before anything that re-ranks a list.

> [!danger] The wiki reorders a weapon's attacks, so the fetch picks the attack by name
> `fetch-wiki.mjs` used to take the first level 1 attack as a weapon's own. By 26 September 2026 the wiki's data module listed the Recoilless Rifle's **backblast** first and several charged shots ahead of the plain one, so a refresh would have read the backblast as the Recoilless's damage.
>
> It now looks for the attack named after the weapon's designation, `GR-8_P` for the GR-8, falls back to the first level 1 attack only when there is none, and never takes a status effect or anything named BACKBLAST. **After any refresh, spot check a launcher**: the Recoilless should read AP 6 with 100% durable damage.

> [!bug] `npm run wiki -- --write` restamps planets and enemies even when it did not fetch them
> Their `fetchedAt` moves to today while the content comes from the cache, so the diff shows two data files changing when neither did. In 1.23.0 both were restored with `git checkout` because only the date had moved. Check the diff of `planets.json` and `enemies.json` before committing a refresh.

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
> Only an explicit `false` locks anything. That is why the shipped file is empty and everything starts unlocked. `ownership.template.json` carries all 25 warbonds at `false`, ready to be filled in and copied over `ownership.json`.

> [!warning] It is a seed, not a source of truth
> It fills lock state the first time the app runs in a given browser, and only then. After that whatever you toggle in the app wins, so clearing locks by hand is not undone on the next reload. To apply a filled file to a browser that already has state, use Import on the Warbonds tab.

Every key is an id, not a name. The validator rejects an id that resolves to nothing.

> [!question] Armor cannot be warbond filtered
> The source data maps armor passives to set names, not to warbonds, so armor stays on per-item locking. If a passive to warbond mapping ever appears, wire it into `item-source.json` and the Warbonds tab picks it up with no other change.

---

# **Persistence, Backup And Transfer**

State lives in `localStorage`. **What you own and what you made is exported; what describes this browser or tonight's drop is not.** `KEYS` in `src/lib/storage.js` is the exported half, `SETTINGS` the rest.

| Key | Holds | Exported |
|---|---|---|
| `hd2-loadout-favorites`, `hd2-favorite-items` | Starred builds and tier rows | Yes |
| `hd2-profiles` | Lock state, per named profile. The older `hd2-locked-items` and `hd2-locked-warbonds` were folded into it and left alone | Yes |
| `hd2-loadouts` | Your builds | Yes |
| `hd2-drop-history` | Every drop you confirmed, since 1 October 2026 | Yes, and an import adds to it rather than replacing it |
| `hd2-scenario-*`, `hd2-drop`, `hd2-party`, `hd2-planner` | Where you are going tonight, with whom | No |
| `hd2-theme`, `hd2-filter-view`, `hd2-map-skin`, `hd2-map-tilt`, `hd2-rules-off`, `hd2-tour-done` | How this browser shows things | No |

A key that has never been written reads as null, which is what lets the ownership seed apply exactly once without ever fighting your own toggles.

**Export** writes one JSON file with a `schemaVersion`. **Import** accepts that file back, and also accepts an ownership file in the shape above, inverting it into lock state. The two shapes cannot be confused because they use different key names. Both live in Settings, along with the theme and a reset.

> [!warning] Switched off rules stay out of the export on purpose, and that may be the wrong call
> They change every rating, which argues for keeping them; they are also an experiment, which argues for not carrying one between addresses by accident. Left out for now. Ask before changing it.

> [!warning] A folded filter is still a filter
> The tier list filter pane folds down to faction and tier, with an arrow at the bottom of the pane to unfold the rest. Anything still narrowing the list while its control is hidden gets named in the folded view with a one click clear. Hiding a control that is still filtering is how you end up staring at an empty list wondering what happened.

---

# **Row Expansion**

The whole row is the click target, not a chevron, and **every item expands**, not just armor and flagged rows. There is always something worth saying.

An expanded row carries the item's art at full size, its numbers, what the source does not record, and where the rating came from. Only one row is open at a time, which the single `openRow` value gives for free.

> [!success] Provenance is shown, not implied
> Every expanded row states the rating source and its patch stamp, and says plainly when that is behind the game. A primary reads "u.gg community votes, patch 7.1.1" with no caveat, because it matches `PATCH.game`; anything else adds "· the game is on 7.1.1". The stamps are real and the UI should keep admitting it. The comparison reads `PATCH` from `src/lib/patch.js`, never a literal.

> [!success] The stats gap closed, and the row now shows the numbers. 1.14.0
> The row used to name seven fields as missing from every source. **The wiki pass filled five of them**, in 1.8.0, and the line went on apologising for their absence for another week. That is worse than never claiming a gap: it tells a reader the tool does not know something it is holding.
>
> Weapons now carry a **Handling and ammo** section reading straight off the fetched block: magazine and spares, resupply count, rate of fire, ergonomics, recoil climb, sway, durable damage share, stagger and pushback, and pellet count where it is above one.
>
> **The admission survives, narrowed to what is actually still absent:** projectile count. **Reload time arrived on 4 October 2026**, from each weapon's infobox, and the row shows it, a round at a time and rooted to the spot where those apply. A weapon with no reload on its page says it never reloads or the page does not say, since the tool cannot tell those apart. Do not delete the admission. Restate it if a later fetch fills projectile count.
>
> **A weapon the wiki has no data page for** gets a different line saying those figures are genuinely unknown rather than merely unlisted. That is the only case where the section does not render. It was six melee weapons until 26 September 2026, when the wiki published them; since 1.23.0 all nine melee weapons show handling and nothing held is in that state. The line stays for the next item that arrives before its page does. The TD-110 Maelstrom is the one call-in with no wiki data yet.

`usesBackpackSlot: null` renders as "not recorded in the source yet", never as "leaves your backpack free". Only the 40-K Meltagun is in that state. Never guess false here.

The picker in the builder reuses the same row but selects instead of expanding, so it shows no chevron and never opens a detail panel.

---

# **Peril**

Difficulty and squad size, collapsed into one number the rules scale off.

```
peril = 6 * (difficulty - 5) + SQUAD_PRESSURE[squad]
SQUAD_PRESSURE = [10, 4, 1, 0]
```

|  | d1 | d3 | d5 | d7 | d8 | d10 |
|---|---|---|---|---|---|---|
| **solo** | -14 | **-2** | 10 | **22** | 28 | **40** |
| **duo** | -20 | -8 | 4 | 16 | **22** | 34 |
| **trio** | -23 | -11 | 1 | 13 | 19 | 31 |
| **four** | **-24** | -12 | **0** | 12 | 18 | 30 |

> [!warning] The squad half is measured for two of its four points, and one source disagrees
> `helldivers.wiki.gg` publishes patrol spawn intervals and the player count multipliers on them: a
> second player takes the interval to **0.8333** of solo and a third to **0.75**. More players means
> more patrols overall and far fewer per gun. Danger per player comes out at **solo 1.0, duo 0.60,
> trio 0.44, four 0.375**.
>
> **The shape matters more than the values: it is not linear.** Most of the relief is in the second
> player, and a fourth adds little the third did not. `SQUAD_PRESSURE` is that curve rounded against
> a difficulty step worth 6, which puts solo at 7 and a duo at 8 on the same 22.
>
> **Two caveats, and they are not small.** The wiki says plainly it never tested a fourth player, so
> the four player figure is an extrapolation of a two point trend. And a secondary source claims solo
> takes a quarter of the patrol count a four stack does, which would flatten this curve to nothing or
> invert it. That reading is hard to square with the measured 0.8333 and 0.75, so it was not followed,
> but it has not been ruled out either. **Treat the shape as good and the fourth column as a guess.**
>
> The difficulty half is the curator's calibration from play: a four stack is comfortable through 5,
> solo through 3. **Enemy composition by difficulty is not published**, so anything claiming that a
> given difficulty demands a given armour penetration is judgement and has to say so.

> [!danger] There are no floors and there must not be new ones
> The rule set carried exactly one and it is gone. **A floor flattens every item sharing a tag into
> the same tier**, which destroys the ordering the tag is sitting on top of. At solo Super Helldive
> the five suppressed weapons now land on S+, S+, S, S and A, ordered by what they already were. The
> floor made them all S.
>
> Everything is points, and points preserve order. If a rule needs to reach further, that is a bigger
> coefficient, not a new instrument.

> [!danger] Stealth is for one or two of you. The curator's call, 4 October 2026
> **"Let's just assume people diving at Super Helldive know what they're doing."** He clears Super Helldive in a four stack without stealth armour, and the old rules marked his Autocannon and Leveller down there and lifted the Censor to S+. A four stack at difficulty 10 sat at peril 30, above a duo on Helldive at 28, which is the wrong way round for stealth.
>
> **The peril formula did not change.** The squad panel and the coverage rules read it and nobody objected to them. What changed is that every stealth rule now also gates on `squad: { lte: 2 }`, which is the only way to put two of you on Helldive above four of you on Super Helldive:
>
> | | Fires from | At solo Super Helldive |
> |---|---|---|
> | Quiet weapons, stealth armour, storms | **peril 22**: solo on Suicide Mission, two of you on Impossible | about a tier |
> | Loud weapons marked down | **peril 28**: solo on Impossible, two of you on Helldive | -6, under half a tier |
> | Silenced weapon **without** stealth armour, and the reverse | peril 22, pairings | -5 and +5 |
> | Stealth armour on an easy drop | **peril 0 or less** | down to -8 at four on Trivial |
>
> Each counts **from peril 16**, so it starts small and grows. Three or four of you get nothing at any level. Bugs and squids have their own quiet and stealth armour rules at about six tenths of the bot figure: the wiki's Stealth page says every faction detects by sound then sight, and stealth is most viable against bots.
>
> **The inverted halves are gone.** Not needing stealth is not a reason to mark it down, so a silenced weapon on an easy drop is no longer penalised and a loud one no longer lifted. The one negative left is stealth armour below zero peril, his "on low difficulties it can be reduced". A rule gated to one side of its own zero needs no `sayInverted`, and the validator now knows that.
>
> Measured against 1.28.0 across eight scenarios and three fronts: **711 of 5,896 tier rows moved**, nearly all back toward the vote at four players on hard levels.

> [!info] How a coefficient is chosen
> One question: **at what peril should this be worth one tier?** A tier is about 14 points, so
> `times = 14 / (thatPeril - from)`. Being unheard, counted from 16, is worth about a tier at solo
> Super Helldive, peril 40, so 0.6. The loud rule is 0.25 because it matches nearly half of
> everything you can hold, and **a rule touching half a list has to argue quietly.**

> [!info] The clamp grows past peril 22
> `swingFor` runs `28 + max(0, peril - 22) * 0.5`, reaching 37 at solo Super Helldive. Two tiers is
> the standing licence a scenario has to argue with a vote; past the point where things are dire it
> earns a little more, because a community average taken across every difficulty and squad size is at
> its least applicable exactly there.
>
> **The clamp is permission, not force.** It allows a B to reach S+ at extreme peril; whether one
> actually does is decided by the rule's own coefficient.

> [!danger] A rule that can invert must carry sayInverted, and the validator checks it
> A scenario scaled rule crosses zero and runs both ways, but its `say` was written for one
> direction. Without a second sentence the tool explains a penalty using the wording meant for a
> bonus. Both directions were caught doing exactly that during 1.19.0.
>
> **Inverted means the delta came out opposite to the rule's own direction, not simply negative.**
> `peril-bots-punishes-loud` has a negative coefficient, so below zero peril it hands out a bonus,
> and that is its inverted case even though the number is positive. The engine compares the sign of
> the delta against the sign of `scaleBy.times`. Testing `delta < 0` gets one of the two rules
> backwards, which is the bug that shipped for about ten minutes.

> [!danger] A peril rule must not name a squad size in its copy
> Peril is 6 * (difficulty - 5) + SQUAD_PRESSURE[squad], so **depth reaches it as readily as being alone does**: four players on Super Helldive sit at 30, the same figure as a duo on Impossible plus a step.
>
> All three bot peril rules shipped in 1.19.0 asserting the reader was outnumbered, and their inverted halves asserted the reader was not. A full squad at difficulty 10 read "there are not enough of you to hold them". Both directions were claiming a party size the rule never checked.
>
> Fixed on 22 August 2026 by describing the pressure instead: "at this level there is not enough slack to absorb one more fight". **`npm run rules` was byte identical before and after**, which is the only acceptable outcome for a copy change. If a rule ever genuinely needs to talk about how many of you there are, it has to gate on `squad` and say so.

> [!danger] Peril does not fire on an unset value
> `peril()` returns null unless **both** difficulty and squad are answered, and a rule scaling off it
> then does not fire at all. Zero means not said. Assuming a squad size is how a list confidently
> ranks for a game nobody is playing.

> [!success] The squad panel reads it too, so one number gates both surfaces
> `squad.js` used to switch its coverage checks off by difficulty **band**, which cannot see how many
> of you there are. Four players on Suicide and one player on Extreme were both called live.
>
> Coverage now runs at **peril 12 and up**, which keeps the old four-at-7 case and adds the ones the
> band could not see. The "one of you is carrying the only anti-tank" warning moved from
> `difficulty === "extreme"` to **peril 22**, the same figure the tier rules anchor on.
>
> **Both fall back to the band when no level is set**, so nothing regressed for a squad that has not
> said where it is dropping.

> [!info] Eight tier rules read it, five of them on the bot front
> Since 4 October 2026 bugs and squids have a quiet weapon and a stealth armour rule each, and the
> easy drop rule reads every front. Outside stealth, difficulty and squad still move nothing on bugs
> or squids in the tier list. The squad panel is front agnostic and reads peril on every front.

---

# **The Loadout Reading**

> [!success] A build is scored as a build. 1.20.0, 22 August 2026
> `src/lib/build.js`, 10 rules in `src/data/build-rules.json`, `npm run builds` to check them. Pure, same shape as `score.js`, `squad.js` and `enemies.js`: no React, no storage, runnable from a script.
>
> **Two readings, and the difference between them is the product.** The gear badge is the mean of what the nine items are worth where you are dropping, each scored by `scoreItem` against the same 34 rules the tier list shows. The build badge is that plus what the combination adds or takes off. A kit whose parts average an A and which fits together like a B is the interesting case, and showing only the B makes it a verdict nobody can argue with.

> [!danger] There is no community base here and one must never be invented
> A tier row shows two ratings because there is an outside opinion to disagree with. **Nobody votes on loadouts.** The base is the build's own parts, which is the only outside opinion available, and inventing a sourced looking column would launder our own judgement through something that looks like a vote. `whyThereIsNoCommunityBase` in `build-rules.json` says this next to the rules.

> [!info] The scale is the item scale, deliberately unchanged
> A build scoring 68 and an item scoring 68 mean the same thing, so the two numbers sit on one screen with no translation step and a build inherits `tierForScore` rather than growing a second ladder nobody has learned. The clamp is the same too: two tiers, growing past peril 22, so the combination may argue with the parts and may not rewrite them.
>
> **The score is uncapped above 95 and that is fine.** It is a ranking device, the same way an item's is, and `tierForScore` tops out at S+ regardless. Nothing renders the raw number as a percentage.

> [!danger] Penetration counts only what you aim, and that is not a detail
> `facts.heldAp` reads primaries, secondaries and support weapons. A sentry cannot pick a weak point and an orbital does not care where the plate is thin, so a build whose only AP 6 is a Railcannon has **not** answered what to do about the thing already on top of you. What the Railcannon does answer is the `anti-armor` role, counted separately over everything in the build. **Two questions, both asked**, and conflating them is how the rule stops meaning anything.
>
> `isHeldWeapon` in `loadouts.js` is the one definition. It lived in three places until 1.20.0: inside `heldGear`, inside `squad.js`, and inside `score.js` as the `held` match key, whose comment read "mirrors heldGear in loadouts.js". **`heldGear` is wider by exactly one thing, a backpack**, because a pack vents with you but is not something you aim.

> [!danger] The 39 curated builds are not a fair denominator, and `npm run builds` says so in two columns
> The curator's call, 22 August 2026: **they are legacy AI generations**, made before this project had stats or scoring behind it, and using the tool's own tiering and warnings would net better ones. `dilas-roadmap.md` already had the measurement: 35 of 39 use an S or S+ primary, 13 distinct primaries appear across all of them, and three A tier marksman rifles for bots appear zero times.
>
> So the health check reports every rule against **300 random legal builds**, 100 per front, seeded so two runs stay comparable. That is the honest denominator for whether a rule discriminates. The curated column stays beside it because those 39 are what is on screen today, **and the gap between the two columns is itself a reading**: a rule firing far more often on the curated set than on a random one is describing his 39.

> [!failure] Two rules were written, measured and cut before they shipped
> The 1.13.0 lesson applied before the fact instead of after. Both were only visible against the random denominator.
>
> | Cut | Why |
> |---|---|
> | `hole-closers-need-the-angle` | Asked for a demolition 40 hole closer in a cave. **86% of random builds carry none.** `squad.js` can ask that across four builds and get a real answer; over one build it cannot |
> | `penetration-reaches-everything` | Fired on **45% of random builds and only ever on bots**, because AP 5 is where that front stops needing a weak point and most builds carrying any support weapon are already past it |
>
> Both facts are true. Neither discriminates. They are recorded in `knownGaps` rather than shipped.

> [!warning] The layer only deducts, with one exception, and that is deliberate
> `squad.js` settled this first: **silence is the normal state and never a claim of coverage.** A build with no holes scores exactly what its parts are worth rather than being congratulated for it. The single positive is `answers-everything`, and it survives because carrying armour, crowd and hole answers **in your hands** is 22% of random builds where carrying them anywhere is 54%. The first is a property, the second is the pool.

> [!info] What a rule may ask about a build
> `covers` and `notCovers` for roles, `count` for how many items match an ordinary context-rule clause, `has` and `notHas`, and `number` reading `facts.*`, `reach.*` or `scenario.*`.
>
> **`count` calls `score.js`'s own item matcher**, which is why a build rule can say `{ "of": { "roles": ["chaff"], "held": true }, "lte": 0 }` and read any field a tier rule can read. One item matcher, two engines, no second vocabulary to keep in step. `matches`, `applies`, `numberTest` and `reach` are exported from `score.js` for exactly this.
>
> The engine **throws** on an unknown match key rather than skipping it, and `npm run validate` checks every key, path, role and severity so the throw never reaches a browser.

> [!info] Where it renders, and the one contradiction that got caught
> `LoadoutReading` in `Tiers.jsx`, on the Drop Bay card in `compact` form and in the Builder with the arithmetic underneath. The Builder recomputes on every edit, which is the point of putting it there: change a slot and watch the gap close.
>
> **The caption keys on the points, not on the badge.** It chose its sentence on whether the tier moved at first, so a build that gained 8 points without crossing a band rendered "nothing about how this fits together changes what the gear is worth" directly above a green +8. Three states, three sentences: the badge moved, the points moved but the badge did not, and genuinely nothing happened.

> [!warning] Every surface that shows a reading carries the scenario bar
> `SCENARIO_SURFACES` in `App.jsx`: Drop Bay, the Armoury, the editor, the tier list, the Rules page and a shared build. A control that changes what is on screen has to be on screen, the same rule the folded filter pane keeps. **The bar also says how many of you, and "N rules off" whenever a rule is switched off**, one click to the Rules page.
>
> **The Armoury's Builds grid keeps its own biome, mission and difficulty filters, local.** The drop screen reads the scenario instead. The grid kept its filters because it is on its way to becoming Exchange, and there they describe builds rather than a drop.

> [!success] Drop Bay ranks, since 1 October 2026. The curator's decision
> This section used to say ranking builds was a product decision nobody had made. He made it: Drop Bay suggests from your builds. `suggestBuilds` and `rankByReading` in `src/lib/drop.js`, by the same reading every badge shows, so a suggestion and the badge beside it cannot disagree. The Armoury's grid is still unranked: it browses, it does not recommend.

> [!tip] The scripts share one loader now
> `scripts/lib/app.mjs` inlines the JSON imports and hands back the real `src/lib` modules, so a script measures the code that ships rather than a copy of it. `check-rules.mjs` and `check-builds.mjs` both use it.
>
> It exists because the first copy of those twenty lines **carried a stale peril formula, 4 times difficulty minus squad minus 1, for two versions after `SQUAD_PRESSURE` replaced it.** Every rule gating on peril was being sampled in a situation the engine no longer produces. It calls `score.peril` now and cannot drift again.

---

# **Pairings**

> [!success] What a piece is worth beside the rest of its build. 1.29.0, 4 October 2026, the curator's ask
> True Grit is worth more beside a Recoilless than beside an Arc Thrower, Inflammable more beside a Cremator, Gunslinger more beside a Senator than an Ultimatum. **A pairing is an ordinary item rule in `context-rules.json` with an `alongside` or `notAlongside` clause**, an item clause matched against the other items in the build, with the same matcher.
>
> **The rest of the build rides on the scenario as `scenario.alongside`**, an array of the other items, the way `rulesOff` does. `readBuild` sets it for every part, and the builder sets it for every slot and for the picker, so a slot, its part and the gear badge never disagree. **The tier list never sets it, so a pairing never fires on a bare row.** It is never saved or sent to a party: `usePartySync` gets the bare scenario.
>
> A pairing may scale off its partner: `alongside.passive.fireResist` is the armour's figure read from the Cremator's side. The partner found by one rule is cleared before the next, and a partner clause cannot ask about pairings in turn; the validator refuses both mistakes.

| Pairing | Fires when | Points |
|---|---|---|
| **True Grit** | beside a support weapon with a reload of 3.5s or more and a magazine of 120 or less; a reload that roots you; or a reload after every shot. Heat weapons excluded | weapon +6, +4, +4, stacking; True Grit +8. **-6 with nothing that reloads** |
| **Gunslinger** | beside a secondary in the Pistol category | pistol +6, Gunslinger +8. **-6 without one** |
| **Melee** | a melee weapon beside Peak Physique, Rock Solid or Reinforced Epaulettes | scaled by the bonus: up to +8 weapon, +10 armour |
| **Fire, arc, gas resistance** | armour resisting what the build brings | armour by its figure, 75% fire is +14; the gear up to +6 |
| **C4 and throw range** | the C4 Pack beside Servo-Assisted or Desert Stormer | C4 up to +8, armour up to +6 |
| **Stealth** | one or two of you from peril 22: a silenced weapon with or without stealth armour | -5 without, +5 to the armour with |
| **True Grit, big belt** | beside a support weapon with a reload of 3.5s or more and a magazine **over** 120 (Stalwart, Machine Gun, Flamethrower, Sterilizer). 1.31.0 | weapon +2, and it counts for True Grit's own +8 |
| **Siege-Ready, small magazine** | a primary with 6 rounds or fewer and a reload of 3s or more, which adds the Explosive Crossbow. 1.31.0 | as the other Siege-Ready cases |

> [!warning] Points preserve order, so the vote still decides a lot
> With a Cremator on bots, Acclimated goes A to S and Inflammable B to A: Inflammable gains more, +14 to +9, but the vote puts it two tiers lower to start. On bugs, where the vote has Inflammable at S+, it tops the picker. **This is deliberate and the curator should know it.** A pairing is a strong argument, not a floor, and making it one would be the floor mistake again.

> [!info] Reload times are fetched, and the stationary flag reads two sources
> `npm run wiki` pulls each primary, secondary and support weapon's own article, ten at a time because the API cuts long batches short, and reads `reload_time`, or `rounds_reload_full_time` for a weapon loaded a round at a time. A value marked (Base) wins, otherwise the first unmarked one. **90 weapons carry one**; the rest never reload (melee, expendables, Quasar, Arc Thrower, Cremator) or their page does not say. `reload.stationary` is true when either the infobox or the game's own tag says Stationary Reload: the module tags the Anti-Materiel Rifle and Laser Cannon and misses the Autocannon, Recoilless, Spear and W.A.S.P., the infobox the other way round. Cached as `.wiki-cache/weapon-pages-*.json`.

> [!info] `npm run builds` measures them, not `npm run rules`
> A pairing never fires on a tier row, so the item check skips them and says so. The build check places every item a pairing is about into 60 seeded random builds, 20 per front, in the gentlest scenario the rule's gate allows, and reports how often it fires: near 0% is a pairing nobody meets, 95% or more is a rule that fires whatever else you bring. All twenty fire; the highest is "a silenced weapon without stealth armour" at 92%, because a random build rarely carries stealth armour, which is the point of it.

> [!success] Round two, 1.30.0, 5 October 2026: the ground, the clock, the city and every armour set
> The curator asked for more of the "Intelligent": what the planet is like underfoot, how long the mission gives you, whether there is a city, and every armour set with its art. The research and the full list of what was proposed, kept and cut is in the plan he approved; what shipped is here.
>
> | New | Where |
> |---|---|
> | **Terrain per biome** | `terrain` in `vocabulary.json`: `ground` wet, snow, dry or mixed; `relief` flat, rolling or steep; `driving` easy, normal or rough. **The curator's reading, drafted from his examples and his to correct**; null for a biome nobody has walked. Of the deserts only Rocky Canyons drives rough, his answer. `when.terrain` reads it through the scenario's biome |
> | **The clock** | `minutes` on every mission, from its wiki article, by `npm run missions`. Eradicate 15, Blitz 12, most others 40. `when.minutes` is a number test |
> | **The city** | `when.city`: true when the scenario's planet lists a megacity. **A guess, his call**: the mission may be outside the city, so city rules carry half weight and say so |
> | **No storm** | `when.notHazard`, so Muscle Enhancement's dry ground rule can say "and no sandstorm" |
> | **One handed** | `wiki.oneHanded`, the game's One Handed trait read from each weapon's infobox by `npm run wiki`. 35 carry it: every sidearm, most SMGs, the Crossbow. The Ballistic Shield reads it |
> | **Two passive numbers** | `stimDuration` (Med-Kit, Adreno-Defibrillator) and `crouchRecoil` (Fortified, Engineering Kit) |
> | **Every armour set** | See "Armour sets" below. Weight arrives with the set |
>
> `src/lib/place.js` holds the terrain, city and minutes lookups, pure, so `score.js` and the scripts read them. 36 rules came with it, 104 item rules in all: Muscle Enhancement on wet, snowy or stormy ground and down on dry, the Jump Pack up on steep ground and down in a city, the Warp Pack the other way round and up when you are alone (it opens two person bunker doors), FRVs on easy and rough ground, the Orbital Laser on a 15 minute clock, Stamina Enhancement in the heat, Integrated Extinguishers on burning planets and beside your own fire, the Shield Generator Pack in acid storms, sandstorms and blizzards (the bubble keeps them out; **he had not known that**), explosive resistance beside blasts you set off close, Siege-Ready beside a primary that eats ammo, crouched recoil beside a planted weapon (tentative), Vitality with gas armour, Med-Kit with the Stim Pistol, the Ballistic Shield with and without a one handed primary, and nine weight rules. The Rules page files them under **The ground and getting around**, **The mission** and **What it is paired with**.
>
> **Cut by the curator, recorded in `knownGaps`**: True Grit worth more solo and team weapons down solo ("nobody team reloads"), Peak Physique with heavy weapons ("they want other passives"), impact mitigation with jump packs and vehicles ("just get good"). **Fire against bots is not a gap**: the wiki has no front wide fire resistance, and the vote already prices flame's range against a front that shoots from afar.

> [!success] Armour sets, 1.30.0. Every one, with its art, the curator's ask
> `npm run armor` reads every article using the wiki's `Infobox Armor` into `src/data/armor.json` (**generated**): **110 sets**, 30 light, 50 medium, 30 heavy, each with armour, speed, stamina regen, its passive as an item id, and where it comes from. IX-Voidwalker is a helmet alone and is not a set. `npm run armor-art` fetches each render into `Image Library/Armor Sets/` and cuts a 256 pixel WebP, 1.3 MB for all 110; `npm run images` copies them into `src/assets/armor-sets/`, gitignored like all game art. **A set id is a slug of its name and keeps it through a wiki rename**, the old name going into `aliases`, the reference invariant. The validator checks every set id is a slug, never an item id, carries a real passive and a real warbond, and that every passive has at least one set.
>
> **The passive is still the rated item.** A build stores the set as `armorSet` beside the passive in `armor`; `cleanLoadout` keeps them agreeing (a set with no passive brings its own, a set with another passive is dropped, the passive stays). **Every build from before, and every preset, has no set and so no weight**, and the weight rules stay silent on them rather than guessing medium. Share links carry it as `w`, the party's packed build as `armorSet`; both clean it on arrival.
>
> **The picker** ranks passives exactly as before, and under each passive lists its sets with render, weight and armour / speed / stamina, with a weight filter. Picking a set picks its passive. The slot shows the set's render and name, the passive and the weight's numbers, and the passive's badge.
>
> **Sets lock with their warbond.** 62 sets come from a warbond, so a warbond you do not own hides its sets in the picker behind the usual locked toggle, and a build wearing one counts as needing locked gear on Drop Bay and in the Armoury. `buildLockedSet` puts set ids into the locked set beside item ids; **the header counts items only**. Superstore, starter and event sets have no per set lock yet.
>
> **Weight reaches the rules on the scenario as `scenario.weight`**, set by `readBuild` and the builder next to `alongside`, never by the tier list. Heavy wants Stamina Enhancement, Dead Sprint and a Jump or Warp Pack; light wants the Shield Generator Pack; heavy is up against bots and down against bugs, light up against bugs (community advice, his medium habit being the question); heavy is down in intense heat; sentries and emplacements are nudged up in heavy. `npm run builds` dresses its pairing hosts in a real set so these are measured: 4% to 27%.

> [!success] Round three, 1.31.0, 9 October 2026: the curator's notes on reloads, blasts and launchers
> Written up with another assistant, judged here against the code; `dilas-roadmap.md`, "Reloads, blasts and launchers", has every verdict. Most was already built. What changed:
>
> - **The picker says what a candidate closes.** `closedGaps` in `build.js` compares the build's red and amber notes before and after trying each candidate in the open slot; the builder shows "Closes: No crowd clear" above it. **It marks, it never reorders.** Ninety three trial readings take about 40 ms
> - **`expendable-beside-a-support-weapon`**, a build rule at **zero points, grey**: carrying an expendable and a permanent support weapon means dropping one to fire the other, and bringing launchers for the squad is a real reason. The Solo Silo is left out. 15% of random builds
> - **The close blast list is the `close-blast` tag**, and it took in the Plasma Punisher. `npm run rules` and `npm run builds` were identical before it was added. The Autocannon stays off, the curator's default
> - **Cut after measuring**: a primary and a sidearm that both explode. 0% random, 29% curated, all through the Grenade Pistol, which closes holes rather than fighting up close. In `knownGaps`

---

# **The Drop Screen**

> [!success] Drop Bay's first tab, 1.24.0, 27 September 2026. Local, no server
> `src/DropScreen.jsx` for the screen, `src/lib/drop.js` for everything that is not a picture. The moment before you dive: **a brief**, **four slots**, and **the squad read**. Picking a loadout happens in a picker over the screen, the builder's pattern, so the main screen says nothing about choosing. `dilas-roadmap.md`, "What Drop Bay turns into", is the plan it was built from.

| Part | What it is |
|---|---|
| **The brief** | What the scenario's mission asks for and what each planet hazard does. Both come from tables the tool already ships; nothing is invented for flavour |
| **Your slot** | Choose a build, then **Confirm**. Only then does it count |
| **Squadmate slots** | **Only in a party**, each filled by that member's own confirmed build. See The Live Party |
| **The squad read** | `squadWarnings` over the builds that count. Only in a party: outside one there is nobody else to read |

> [!danger] An unconfirmed slot says "Still deciding" and nothing else, and does not count
> **The curator's call, 27 September 2026.** The squad checks read confirmed loadouts and hand filled slots only, so a half picked kit never sets off a false alarm. Confirming stamps the build's `updatedAt`; **edit the build afterwards and the slot drops back to still deciding**, because what you confirmed is not what you now hold. The live party will publish that confirmed version, so the two must agree. Presets have no `updatedAt` and stamp as the empty string, which is why `confirmed` is null for not confirmed rather than falsy.

> [!danger] The picker keeps both locked hard gates, and one function decides them
> **A hot planet removes builds that vent heat, and a difficulty band removes builds declaring another.** Both are locked decisions, read here off the scenario rather than off a second set of filters. `gateOf` in `drop.js` is the single test: the picker uses it to refuse a build, and a slot uses it to say "the picker would not offer this now". They cannot disagree.
>
> **A slot keeps a build the scenario would now refuse**, and says why in its own line, amber for heat. It is still what somebody chose. The picker says in one line how many builds each gate took out, because a list that silently shrinks reads as a bug.
>
> **Hot comes from the `intense_heat` hazard**, the same thing the scoring rules read, through `gateBiome`. Cold is `extreme_cold`, foggy is `thick_fog`. Urban and cave have no hazard behind them, so the scenario never says either and a build declaring only those survives everywhere.

> [!danger] No squad by hand. The curator's call, 2 October 2026
> The three squadmate slots used to be filled by hand, from your builds and the presets, with seats saying how many of you there were. **Both are gone.** His reasoning: nobody rebuilds three other people's loadouts in the thirty seconds the game gives you in its own drop screen, which is barely enough for your own. Outside a party Drop Bay is you alone; the squad, its slots and its read exist only in a party, where each member's build arrives by itself. Do not bring hand filling back.
>
> **"How many of you" survives as one setting**, beside difficulty in the war room's bottom bar, because solo and four of you rate gear differently and a solo player is in no party to count. Nothing is built with it. In a party the party's count decides and the bar only says it.

> [!info] Your lock list hides builds in your slot
> Builds needing gear you have not unlocked are hidden in the picker by default, with a toggle, the builder's precedent. Party members' builds are drawn whatever your locks say: your collection says nothing about what they own.

> [!info] Stored as ids in `hd2-drop`, and out of the export
> `{ mine, confirmed, mates, logged }`, ids only, the way the old comparison was, so an edited build is re-read rather than held stale. A slot whose build was deleted reads as empty. `logged` is the history entry the last Confirm wrote. **`mates` is read by nothing since hand filled slots went**, and stays in the shape so older storage cleans the same way. It is what you are dropping with tonight, not what you own, so it stays out of the export like the scenario does.

> [!success] Suggestions, the editor over the screen, and history. 1 October 2026
> - **Suggested for this drop**: three of your own builds, through the same gates as the picker and never one needing gear you have not unlocked, ranked by the reading. Each says why: the piece the scenario lifts most, in that rule's own words, or failing that the build's worst hole (`whyFor`). With nothing of yours fitting, the presets stand in and say so; with nothing at all, the panel says what ruled everything out and offers **Start a build for this drop**. Hidden once you have confirmed.
> - **The picker ranks** favourites first, then by reading, the order the suggestions use.
> - **Adjust and New open the editor over Drop Bay** rather than navigating away. Saving puts the build in your slot, still to confirm; **Save as a new build** keeps the original; closing with changes asks first. Somebody with no builds sees **Pick a primary** in their slot, which opens the editor straight onto the primary list, already ranked for this drop.
> - **One copy of everything, 2 October 2026.** The curator saw the scenario said twice, Squad up twice and a squad picker beside a party. Now: **one Squad up**, in the header; **the scenario bar is the one place that names the planet and mission**, and the brief under it only says what they do; **no seats and no hand filled squadmates** (see the danger block above). With no planet, the brief offers **Choose in the war room**.
> - **Confirm writes the drop to your history**, and "Change my mind" within 15 minutes takes it back out (`TAKE_BACK_MS`): that was a change of mind, not a drop.

> [!tip] Done in the war room returns to where you opened it
> It remembered only the tier list's category until 1.24.0, so adjusting the scenario from the drop screen threw you onto a tier list. `lastSurface` in `App.jsx` now remembers any surface that reads the scenario, tab included.

**`npm run drop`** checks it against the real builds: both hard gates, what counts as the squad, that editing a confirmed build un-confirms it, and that a real mission name reaches the demolition warning. It exits non zero on a fail. `scripts/lib/app.mjs` loads `drop.js` like the other libs, so it measures the shipped code.

---

# **The Live Party**

> [!success] Built, 1.25.0, 29 September 2026. **Not deployed yet**: that waits for the curator
> Squad up with a code on the drop screen. One person opens a party and reads out six characters; whoever types them in is in, up to four. Each person's **confirmed** loadout lands in their slot on everybody's screen, the host's scenario becomes everybody's, and the squad read is the same on every screen because it counts the same builds. Stage 7 of `dilas-cloudflare-handover.md`, which Enodia never built, so nothing was ported.

| Part | Where |
|---|---|
| **The party** | `worker/party.ts`. One Durable Object per code: members, their confirmed builds, the host's scenario, and every open WebSocket |
| **The two routes** | `worker/index.ts`. `POST /api/party` opens one and answers with its code; `GET /api/party/<code>` is the WebSocket, or, as a plain GET, the question "does this party exist" |
| **The limits** | `worker/limit.ts` and the `api_rate_limit` table, ported from Enodia. 20 parties opened and 120 joins an hour per address |
| **The browser half** | `src/lib/party.js`: `useParty` holds the connection, `usePartySync` keeps the party and this browser in step |
| **The menu** | `src/Party.jsx`: the button in the header, top right on every page, and its panel: open or join, the code, every member with their build or "Still deciding", host removal, Follow the party, Leave |
| **The slots** | `src/DropScreen.jsx`: the members' slots and open seats, and one line naming the party and whose scenario you follow |
| **The tests** | `worker/party.test.ts`, 25 of them, inside workerd against a real Durable Object |

> [!danger] Three calls, all the curator's, and the code is shaped around them
> **A code, not an account** (27 September 2026). Accounts cannot open before password reset, which needed a domain (dilas.me, bought 2 October 2026) and still needs mail. A code needs only the Worker. **An unconfirmed slot shows "Still deciding" and nothing else**, so the browser sends null until you confirm and the server never holds a half picked kit. **The host sets the scenario** (28 September 2026), the way the host picks the mission in game; everybody else's scenario follows it.

> [!danger] The server has no opinion about what a build is
> The handover's rule for published builds. A confirmed build is packed by the browser (`packBuild` in `drop.js`, which leaves the blurb at home) and handed to the others exactly as it came. **Every browser cleans what it receives against its own tables** (`unpackBuild`, `cleanScenario`), so an item in the wrong slot, or no item at all, is dropped rather than drawn. The server enforces only size, shape, rate and who may say what.

> [!info] Identity is a token per party, kept in `hd2-party`
> The browser makes 32 random bytes per party and keeps them; the server stores only the SHA-256. **A reload, a dropped line or a second tab on the same address rejoins the same seat** rather than taking a new one. Members see each other by a prefix of that hash, never the token. `hd2-party` also keeps the name you go by, and stays out of the export: it belongs to this browser.

> [!success] The party menu lives top right, on every page. The curator's call, 1 October 2026
> It was a panel on Drop Bay. The party was always app wide underneath (your confirmed build reaches it from any page, the host's scenario reaches you anywhere), so its controls moved next to the profile switcher in the header, the way the game keeps your squad in a corner. The header button reads "Squad up" on your own, and the code with a dot per seat in a party. **Drop Bay keeps one line, and only in a party**: whose scenario you follow. Its own Squad up card went on 2 October 2026, as the same button twice. **The panel is fixed under the chrome rather than hanging from the header**, because the header clips its overflow for the masthead art. **Friends and finding a group will live behind this menu**, so the locked Squad entry left the sidebar the same day.
>
> **The party counts.** In a party the member count decides how many of you there are, and the war room's bar says so rather than offering buttons; outside one, that bar's "How many of you" says it.

> [!info] How a party behaves
> - **Four seats.** A fifth person is refused with "That party is full", not queued.
> - **A host who leaves hands the party to whoever has been in longest.** The last one out ends it. The host can remove somebody, in two presses.
> - **Twelve quiet hours and nobody connected, and the party is deleted** by its own alarm. An open tab keeps it alive.
> - **The host's squad size follows the party.** The scenario's "how many of you" is set to the member count, since that is the true answer and the peril rules read it.
> - **Following is not enforcing.** A squadmate who adjusts their own scenario keeps it until the host's next change, and the party panel says so with a one click "Follow the party".
> - **Party slots are members only**, and outside a party there are none.

> [!bug] A same-site GET carries no Origin header, and the first version demanded one
> Found in the browser on 29 September 2026. A socket that fails to open tells the page nothing, so the party asks over a plain GET whether the code exists. That GET arrived with no Origin, the same-origin check refused it with a 403, the page read the 403 as a dropped line, and it retried a dead code forever. **Origin is now required on a POST and a WebSocket, where browsers always send it, and only refused on a plain GET when it is present and foreign.** Reproduced in `party.test.ts` against the unfixed server first.

> [!warning] It only exists where the Worker does
> A party needs `/api/party`, so it works under `wrangler dev` and at the Cloudflare address, and **not on Netlify or under `npm run dev`**. There the panel says "Parties need the tool's own server, and this address does not have one", because the answer comes back as a page rather than the server's JSON. Two players on one machine for testing: `127.0.0.1:8788` and `localhost:8788` are different addresses to the browser, so each gets its own storage and its own token.

> [!info] Every party rule was broken on purpose to see its test fail
> The squad cap, host only scenario, host only removal, the returning seat, the host handover and the loadout size cap, on 29 September 2026. Each broke exactly the test aimed at it. Do the same for any new rule.

**Shipping it** is two steps, in this order, and both wait for the curator: `npx wrangler d1 migrations apply dilas --remote` for the `api_rate_limit`, `war_snapshot` and `war_history` tables, then `npm run deploy`, which also creates the Durable Object class from the `v1` migration in `wrangler.jsonc` and registers the five minute Cron Trigger. Then open a party on the live address from two browsers, and after five minutes check `/api/war` answers 200, before calling it done.

---

# **The Galaxy Map**

> [!success] Built, 1.25.0, 29 and 30 September 2026. **Not deployed yet**, it ships with the live party
> Click the planet where you clicked it in the game and its biome and hazards fill themselves in. The curator's framing from 20 August 2026, and the reason it is a map rather than a longer list: finding a place again in the same shape is instant, and finding it among 281 names is not. `src/GalaxyMap.jsx` draws it, `src/lib/galaxy.js` holds everything that is not a picture.

| Where it appears | |
|---|---|
| **The Star Map** | `#/map`, `src/StarMap.jsx`, in the menu since 2 October 2026. The same map for reading the war rather than setting up a drop. See "The Star Map" below |
| **The war room** | `#/scenario`, `src/WarRoom.jsx`, since 2 October 2026, and **the one place a drop is set up on the map**. The map fills everything right of the menu, the planner and search fold out on the left, the Major Order and the war's totals sit over the top right, difficulty and how many of you along the bottom. See "The war room" below |
| **Drop Bay** | **No map of its own since 2 October 2026.** With no front it sends you to the war room; with no planet its brief offers **Choose in the war room**. In a party only the host is offered it, because the host sets the scenario. The by hand biome and hazards were retired on 30 September 2026, once the map and planner covered them |

> [!danger] The layout is patch data and the map needs no network
> Positions and supply lines ship in `planets.json`, fetched once by `npm run wiki` from `api.helldivers2.dev`. A planet does not move. **The map draws, pans and fills the scenario with nothing fetched at run time.** Who holds what is live and arrives separately, if it arrives: it decorates the map and never carries it. **Never ship ownership**; a stale territory map is worse than an uncoloured one. `dilas-roadmap.md`, "The live starmap".

> [!danger] The data's y points up, and the flip lives in exactly one place
> `project()` in `galaxy.js`. Cyberstan, the Automaton home world, sits up and to the left in game and does here; `npm run map` checks it, and a map drawn without the flip fails that check and nothing else.

> [!success] Two views, the game's way. The curator's call, 30 September 2026
> **The galaxy, and one sector.** In the galaxy, hovering names the sector under the cursor (holder, planets, fronts open) and a click, a scroll in or a pinch **glides into that sector**. Inside you pan, zoom in, and may zoom out a little; **past 60% of the sector's own zoom it glides back to the whole galaxy**, never stopping halfway. Escape and the "Galaxy / <sector>" crumb do the same. A click on another sector's ground moves there. Choosing from the planner, search or list glides into that planet's sector. `sectorView`, `leavesSector`, `glide` and `towards` in `galaxy.js`.
>
> **The wheel eases.** Each notch moves a target and the view catches up over about a tenth of a second (`towards`), so a spin reads as one zoom; the curator asked for "more glidey, less ticky". The buttons ease the same way. Reduced motion turns glides into cuts.
>
> **Super Earth is in no sector**, so there is nothing to glide into: in the galaxy a click on it chooses it, and hovering shows its own card. The curator's point, 2 October 2026; it has been a battlefield.
>
> **Sectors are blocks**, the curator's correction to a rounded hull: a polar grid of 12 rings, each cell given to the sector of the nearest planet (`TABLE`, `sectorZones`), and each sector drawn as **one block with only its outer edge** (`sectorOutlines`, which drops every line between a sector's own cells: 813 edges drawn instead of 1,464). A click anywhere inside a block is a click on that sector (`zoneAt`). The game's exact borders are not published; 254 of 271 planets land inside their own sector's block.

> [!info] Two looks, switched in the map's corner and remembered per browser in `hd2-map-skin`
> **Tactical**, the default since 30 September 2026: sleek, in the theme's own colours. Every held sector is a block with a gentle glow of its holder's colour and a soft glowing edge, brighter where there is a front; a contested sector takes the colour of whoever the fighting is against (`against` in `sectorHolders`). **The hazard pinstripes show only inside a sector**, never in the galaxy, as in the game. Held planets carry a territory glow that **the radar sweep lights as it passes**: each rests at 70% and comes up to full the moment the sweep reaches its angle, then fades over the 20 second turn, on the SVG's one animation clock so the timing is exact (the curator's idea). Fronts pulse; inside a sector they carry a slow rotating ring and a liberation bar. Faction names sit on the rim. **Inside a sector the planets are the game's own renders.**
>
> **Chart**: plain dots and lines in theme colours, with an edge round each sector that has a front.
>
> **A half copy of the game's own screen was built and cut the same day**: exactly the game or clearly the tool's own, not something between. Do not rebuild the "Galactic War" table skin.

> [!success] The war room. The curator's call, 2 October 2026
> The scenario screen, laid out like the game's Galactic War screen: **the galaxy map fills everything right of the menu** (`GalaxyMap` with `room`), and the rest sits over it. It replaced a full screen layer over the page, built the day before, whose Major Order and difficulty overlapped the map; the curator asked for "the whole part right of the menu" instead, with "Where would you like to play?" as a fold out bar on the left.
>
> | | |
> |---|---|
> | **Left** | "Where would you like to play?": the planet search with its results, the planner and Go here, then what you are dropping on and the mission. **On a wide room it takes its width off the map**, passed as `insets` to `stageFit`, so the galaxy is never drawn under it. On a room under 900 pixels it lays over the map, starts folded, and folds again once you choose a planet. Folded, it is a tab on the left edge |
> | **Top right** | The Major Order and **the war so far**, each folding to its title. Laid over the map rather than taking room from it, the way the game lays its own |
> | **Bottom** | **A floating card, centred under the open map** like the game's difficulty picker (the curator's call of 3 October 2026, after a full width bar read as chrome): the difficulty stepper and **How many of you** side by side, since the ratings read the two together, and under them what the level brings as **labelled tiles** (operation, medals, outposts, samples as three dots in the game's colours, modifiers, rewards, enemies counted and what is new), each tile's full sentence in its tooltip. **Done** floats on its own at the right once a front is chosen. On a phone the card fills the width and Done sits under it. The cards' measured height is the map's bottom inset |
> | **The map's own controls** | Where you are at the top left of the open space, the look and the tilt at its bottom left, the zoom at its bottom right, so the top right is free for the Major Order |
>
> **The room clips with `overflow: clip`, not hidden.** The drawing reaches past the room's edges so a tilted sector fills it, and a box that merely hides its overflow can still be scrolled by focus or by a script bringing something into view: found in the browser, where a click scrolled the whole room 325 pixels sideways. Every mark, name and render is drawn 1.3 times bigger there (`FULL_MARKS`), and the hover card's render grows to match.
>
> **The tilt is on by default in the war room, with a switch to lay it flat**, remembered per browser in `hd2-map-tilt`, out of the export. The war room and the Star Map are the map's two homes, both in `room` mode, so the flat square on the page is unused; `room` false still draws it, for the next surface that wants a small map.

> [!success] The Star Map. The curator's ask, 21 August 2026, built 2 October
> **The galaxy map as its own place, for reading the war rather than setting up a drop**, in the menu under Drop Bay. `src/StarMap.jsx`, the same room as the war room and the pieces it shares (`useSize`, `PlanetSearch`, `WarTotals`, exported from `WarRoom.jsx`).
>
> | | |
> |---|---|
> | **Left** | **The fronts**, grouped by who you would fight there, busiest first, with search. Choose one, on the list or the map, and the panel becomes **that planet's intel**: its render, who holds it and how far along, how many are there, **Drop here**, its history, the biome and hazards with what they do, its cities, and its supply lines, each one click to its own intel |
> | **Top right** | The Major Order, and the war so far with **how many were fighting, hour by hour** |
>
> **A click here reads a planet rather than choosing it.** Choosing is Drop here, which sets the scenario's planet, and its front from the live war, and opens Drop Bay. A look around the war never moves where you are dropping. **The planet is in the address**, `#/map/<planet>`, so one can be linked and Back goes back; a map opened on one glides straight into its sector (`openOnChosen`).

> [!info] The war's history is the tool's own. `war_history`, 2 October 2026
> Nobody publishes the war's past, so **the Cron Trigger keeps a copy once an hour, for thirty days**, from the day the server first runs: the trimmed planets and the totals, the snapshot's own shape, one row an hour (`keepHistory` in `worker/war.ts`, migration `0003`). One row an hour rather than one per planet, because D1 on the free plan allows fifty queries a run and a hundred bound values a query. About seven megabytes at thirty days. **Only a good fetch is kept, and a failure keeping it never costs the snapshot**, tested by dropping the table.
>
> `GET /api/war/history?planet=<name>` answers that planet's hours, oldest first, only the hours something was happening there; without a planet, the war's own, players and open fronts. 503 until the first hour is kept, which the page reads as "nothing kept yet" and says so. **It starts empty on deploy and fills from there**; nothing before that day can be had. `cleanPlanetHistory` and `cleanWarTrend` in `galaxy.js` clean it like the snapshot.
>
> **Planets and names stand upright; only the ground tilts.** The curator's point, 1 October 2026: tilted with everything else, the renders squashed into ovals and the names leaned like italics. Planets, picks and names are drawn once round their own centre (`drawMark`, `drawPick`, `drawName`) and placed either on the map, when flat, or on an upright layer over the tilted ground at the point the tilt puts them, scaled by `stageDepth` so the far side is still smaller. The gestures sit on a surface round both layers, with the corner buttons outside it, so a press on a button is never a drag.
>
> **How the tilt is built, and the trap it avoids.** It is a CSS `perspective() rotateX()` on the map's SVG, **40 degrees with the eye at 1.8 map widths**, as steep as the game's own table: the curator's correction of 2 October 2026, after 22 degrees read as barely tilted. A click is read through `offStage` in `galaxy.js`, the same projection solved backwards, never through the SVG's screen matrix, **which flattens a perspective to a plain 2D matrix and puts a click about a planet's width off**. `stageTransform` writes the CSS from the same numbers, so picture and click cannot disagree. `npm run map` checks the round trip to 10^-13, and broken on purpose it fails by 41 map units. `stageCover` widens the drawing past the map's own square to the screen's edges, so a sector fills the screen rather than ending in a floating trapezoid.

> [!info] Planet renders, from the wiki. `npm run planet-art`
> **Half the wiki's "originals" are crops of the game's own map, not renders**: 133 of 271 are 48 to 85 pixels on the map's dark ground, five more are full size on a solid ground, 138 with no transparency in all. Drawn as they were, each sat in a dark square. `npm run planet-art -- --cut` now cuts any original without transparency round, keys the dark ground out of its outer ring only (a planet's night side is left alone), trims it to the planet, and sizes it from its own source, doubled with a sharp filter rather than padded out to 256, which had drawn them a quarter of their neighbours' size. Add `--force` to recut everything.
>
> The curator approved the small copies on 30 September 2026 and **the full size originals on 1 October**: each planet's "<Planet> Planet Icon.png" from helldivers.wiki.gg, **271 of 272 planets, 1720 pixels square, 350 MB** in `Image Library/Planets/Originals/`. **Nothing that size reaches a browser.** `npm run planet-art -- --cut` cuts a **256 pixel WebP** from each original with sharp, offline, 2.1 MB for all 271: twice the resolution of the 128 pixel PNG it replaces at under half the weight, which is what keeps a render sharp drawn large in the war room. The wiki's own 128 pixel thumbnails stay as the fallback where there are no originals, and `npm run images` takes the cut over them. **sharp arrives with wrangler** rather than as a dependency of ours; without it the cut says so and changes nothing. **All of `Image Library/` and `src/assets/planets/` are gitignored**: extracted game art, and the repo is public. See Art. Inside a sector only the planets in view, and those of the sector being glided to, are drawn as renders.

> [!danger] A file sync app watched this folder and renamed what the build rewrites. Stopped 4 October 2026
> **The curator stopped Proton Drive syncing `C:\Dev` on 4 October 2026**, and every clash and delete conflict copy in the repo was cleared the same day: 23 to the Recycle Bin, and two theme art folders, byte identical to the live one, deleted outright. If a `(# Name clash ...)` file ever appears again, the sync is back on. The safeguards below stay, because they cost nothing.
>
> **`Image Library/` has no backup now.** It is gitignored because the repo is public, so Proton was the only copy off this machine. It is never edited, so syncing that one folder would not clash; that is the curator's to arrange.
>
> The history, kept because it explains the safeguards. On 30 September and 1 October 2026 it renamed every generated art folder, and once `dist/assets`, to copies named `... (# Name clash <date> <id> #)`, leaving the app with no art or no scripts. `.gitignore` carries `*Name clash*`. **Both the image importer and the build now empty their folders in place** rather than deleting and remaking them (`scripts/lib/empty-in-place.mjs`; the build's half is a small plugin in `vite.config.js` with Vite's own `emptyOutDir` off). Since then no build has been renamed. **`scripts/check-dist.mjs` runs after every build and again inside `npm run deploy` just before the upload**, and refuses if a file the page asks for is missing or a clash copy sits in `dist`.
>
> It reaches further than build output. **It renamed a source file** after an edit made with `sed -i`, which writes a new file and swaps it in: edit files in this repo in place, never by replace. **On 2 October 2026 it renamed two more**, `src/App.jsx` and `worker/war.test.ts`, each edited with an editor tool moments after a script had rewritten it in place; the copies were whole and moved back. Use one in place method per file, and if a file goes missing, look for its clash copy first. **It has renamed files inside `.git`**: a copy of the index and three of the branch logs, from 29 and 30 September. Checked on 1 October 2026 and the repository is intact, every branch and commit present, but a rename landing on a branch file could lose that branch. **On 4 October 2026 it took `.git/index` itself**, along with `src/lib/score.js`, `scripts/fetch-wiki.mjs` and `scripts/validate.mjs`, all within five minutes of editor tool edits. With no index, `git status` showed every tracked file as deleted and staged while the working tree was untouched; moving the clash copy back to `.git/index` restored it exactly. **If `git status` ever shows everything deleted, look for `.git/index (# Name clash ...)` before anything else, and never run a reset to "fix" it.** **It is Proton Drive**, identified on 4 October 2026: its `Mappings.json` listed `C:\Dev` as a synced folder, so every project under it was backed up, this one included, and the "Name clash" and "Delete conflict" names are its conflict format. The curator stopped that sync the same day; see the top of this block.
>
> A side effect worth knowing: while `dist/assets` was missing, the browser asked for the script, got the page instead, and **cached that page under the script's name for a year**, because `_headers` marks `/assets/*` immutable. A rebuild with unchanged code has the same file name, so the page stayed blank until that one file was fetched with `cache: "reload"`. In production a missing asset meets the same single page fallback; it only bites a URL that is later reused, which hashed names almost never are.

> [!bug] An ordinary planet counted normal temperature as a hazard
> Fixed alongside the map. The hazard table calls it `normal_temp`, and the scenario screen's filter looked for `normal_temperature`, so it never matched: every ordinary planet read "2 hazards", and Normal Temperature was offered as a hazard toggle. `QUIET_HAZARDS` and `loudHazards` in `scenario.js` are the one definition now; the drop screen's brief had its own copy, which was right, and uses the shared one.

> [!success] The live war colours it in, same version
> **Stage 6 of `dilas-cloudflare-handover.md`, built the way that plan designed it.** A Cron Trigger fetches `api.helldivers2.dev` every five minutes and keeps one trimmed row in D1; `GET /api/war` hands it out with its age; the browser decides whether it is young enough to draw. `worker/war.ts` for the server, `cleanWar` in `galaxy.js` and `useWar` in `src/lib/war.js` for the browser.
>
> | On the map | |
> |---|---|
> | **A planet somebody holds** | Takes their locked faction hex |
> | **A front you can drop on** | Larger, ringed in the colour of who you would fight, and named at every zoom, busiest first |
> | **A quiet planet Super Earth holds** | Steps back a shade, so the war reads first |
> | **The hover card** | Who holds it, how far liberated or defended, time left on a defence, and how many Helldivers are there |
> | **The line under the map** | "Live, read N minutes ago", and how many fronts are open |
>
> **Choosing a planet with fighting on it sets the front too.** That is the other half of "the whole scenario fills itself": the attacker in a defence, otherwise whoever holds it. A quiet planet leaves the front alone. In a party the host's choice carries the front to everybody, since it is part of the scenario.
>
> **The Major Order sits over the war room's map, top right**: its briefing in the game's words, the time left, a bar per task in the colour of the front it is on, and what it pays. Nothing says what a task asks, because task types are not published and the briefing already says it. **A task's front is read from the value the upstream marks as type 1, in the game's numbering, 2 Terminids, 3 Automatons, 4 Illuminate. That is an inference from one real answer on 30 September 2026**, recorded as one. **So is the reward**: the server keeps it as the upstream sends it, a type and an amount, and the browser reads type 1 as medals because that one order paid type 1 amount 40. Any other type is shown as nothing rather than named wrongly. If the order alone fails to fetch, the war still lands with no order; an order that has ended, or was read over half an hour ago, is not shown.
>
> **The war so far**, under it: Helldivers in the war right now, and every Terminid, Automaton and Illuminate killed, Helldiver lost, bullet fired and mission won or lost, from `/api/v1/war`, a fourth fetch that may fail on its own like the order. **Field names read off a real answer on 2 October 2026** (`STAT_FIELDS` in `worker/war.ts`). Two fields in it were left out because they count nothing: `accuracy` read 100 with more bullets hit than fired, and `revives` read 2. Held to the same half hour as the map.
>
> **Fronts are emphasised, not enforced.** The roadmap said "only offering planets with an active campaign"; every planet stays choosable, because the scenario is also for pre building while nobody is online. Fronts come first in the search list. If the curator wants the rest hidden, it is one filter.

> [!danger] The API decorates, it never carries, and the rules that make that true
> - **Half an hour is the limit.** A snapshot older than `WAR_TOO_OLD_MS` is not drawn at all, not drawn faded, and the line under the map says how old it is. It also fills in no front. A stale territory map is worse than an uncoloured one because it looks exactly like a current one.
> - **A failed fetch never disguises the age of the last good one.** It moves `tried_at` and sets `ok` to 0; `payload` and `fetched_at` stay exactly as they were. The server never hides staleness and never throws a snapshot away.
> - **No server, no colour, no error.** Under `npm run dev`, on Netlify, or with the Worker down, the answer is the app's own page rather than JSON, and the map draws uncoloured with its ordinary hint. Checked on 30 September 2026.
> - **The server keeps no planet table.** Planets go out under the upstream's upper case names and every browser joins them to its own table by name, dropping anything it does not know and any owner nobody has heard of. All 62 names in the first real answer resolved.
> - **Only planets with something happening are sent.** Enemy held, a campaign, or a defence. Most of the galaxy is none of those, so the snapshot is about 7.5 KB rather than 300.

> [!warning] The upstream requires both headers, whatever its README says
> `api.helldivers2.dev` answers **400 "The X-Super-Client and X-Super-Contact headers are required"** to a request missing either. Its README still calls the contact optional. Found on 30 September 2026 against the real service, after an eight second timeout had hidden it the first time.
>
> **`SUPER_CLIENT` is `dilas.me` and `SUPER_CONTACT` is `https://dilas.me`** since the domain was bought on 2 October 2026; both were the workers.dev address before. The contact is a project address, never a personal one. **A mailbox on the domain would be a better contact**, and which one is stigly's to pick; Cloudflare's email routing can forward one without a mail server. `npm run wiki` and `npm run planet-art` name the tool the same way; the wiki fetch used to give the API's own organisation as our contact.

> [!info] The numbers behind the schedule
> Every five minutes is 1,152 upstream requests a day, four paths each run (planets, campaigns, the Major Order, the war's totals), whatever the traffic. The service publishes a limit of 5 requests in 10 seconds; this is 4 in 300. **Five Cron Triggers per account on the free plan, 10 ms of CPU each**, verified 29 September 2026; Enodia uses none. Parsing and trimming the 300 KB planet answer measured 1.5 ms. The timeout is 20 seconds, because waiting is not CPU and the service took 10 seconds to answer once.
>
> Locally, `wrangler dev --test-scheduled` (the `workers` entry in `.claude/launch.json` passes it) and then `curl "http://localhost:8788/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"` runs one fetch by hand. That is a real request to the real service.

> [!success] The drop planner: "where would you like to play?" 1.25.0, 30 September 2026
> The curator's idea: say what you are after and the tool says where to go, marked on the map. Three questions in the war room's left panel, then **Go here**, the top three fronts as buttons that choose the planet. On the map the picks carry a numbered ring in the brand colour, the other fronts that fit stay lit, and everything else steps back. `suggestFronts` in `galaxy.js`; the answers keep between visits in `hd2-planner`, out of the export.
>
> | Question | What it does |
> |---|---|
> | **1. Against** | **The scenario's own front**, where the three banners went. A planet with fighting on it answers it for you; this is the way to browse a front with no planet, and the only way when the live war is not here |
> | **2. Kind of mission** | The eight mission traits. **Narrows the mission list, not the planets**: the data says which fronts offer which missions, not which planets do, and every front offers every kind except high value targets on the Illuminate, which is greyed out there |
> | **3. Kind of planet** | **Caves: avoid, any or only**, the Hive Worlds being where the wiki puts them. **Megacities: fewer, any or more**, pushing the 29 planets with one below or above the rest rather than hiding them. Both three way since the curator's "sometimes you do want to do caves or megacities", 30 September 2026; the old yes or no answers carry across. Hazards you would rather not have push down, after megacities |
>
> **Busiest first** among what is left, the curator's call: where the war is and where a game is easiest to find. **Only fronts you can drop on, from a live war fresh enough to trust**; with no war, or an old one, Go here says so and the map still works.
>
> **Megacities are patch data now.** `npm run wiki` keeps each planet's city regions by size as `cities` in `planets.json`, which it used to throw away. 81 planets list cities, 29 of them a megacity. Caves are read from the biome, `bug_hiveworld`, per the wiki.

> [!bug] A Terminid mission stayed chosen on an Automaton planet
> Found by the curator on 30 September 2026. Changing front kept whatever mission was set, even one the new front does not have. `setFaction` in `scenario.js` now clears a mission the new front lacks. On an address with no live war (`npm run dev`, Netlify) a planet cannot tell the tool its front, so there the planner's first question is how you set it.

> [!bug] The browser served a nineteen hour old war despite a one minute cache header
> Found on 30 September 2026 in the browser pane: `/api/war` says `public, max-age=60`, and the pane's cache answered with yesterday's copy anyway. `useWar` now asks with `cache: "no-cache"`, so every poll goes to the server. The half hour rule would have refused to draw it either way; this makes sure the fresh copy is what arrives.

> [!info] Names are placed, not just drawn
> Every name that wants to show is placed in priority order and skipped if it would overlap one already placed: the chosen planet and search matches always, then fronts by how many Helldivers are on them, then any planet with room. `placeLabels` in `galaxy.js`. Thirty eight fronts named at once had run into each other in the dense clusters; now a name that does not fit waits for a closer zoom.

**`npm run map`** checks the arithmetic against the shipped table: the right way up, every planet inside the disc, each supply line drawn once and none missing, search, that zooming holds the point under the cursor still, how the browser reads a war snapshot, its order's reward and its totals, which names fit, what the planner suggests, that the table's rings close and its zones hold their planets, that the map fits beside a panel, and the war room's difficulty line against the wiki's table. Seven of its rules were broken on purpose on 29 and 30 September 2026 and each broke exactly its own check. The server half is in `worker/war.test.ts`, twenty tests with the upstream stood in for, the Major Order and the totals fixtures being real answers; nine of its rules were broken the same way, the last on 2 October 2026, when the totals were made to take the war down with them and exactly their test failed.

---

# **The Tag Layer**

Three tags on items, read by the scoring rules. They exist because six rules used to spell out the same
lists of item ids, and a concept written down six times is a concept that drifts.

| Tag | Provenance | Carried by | What it means |
|---|---|---|---|
| `long-range` | `curator` | 6 support weapons | The ones you aim at something far away |
| `close-blast` | `curator` | 7 weapons | Their own blast reaches you when you fire close. Since 1.31.0, replacing an id list typed twice |
| `suppressed` | `wiki` | 5 weapons | Audible at 12 metres rather than 100 |

> [!danger] A tag declares where it came from, and that is the whole point
> `vocabulary.json` carries an `itemTags` entry per tag with an `id`, a `label`, a `source` and a `note`
> saying why it exists. **`source` is `curator` or `wiki`, and the validator rejects anything else.**
>
> `long-range` is ours: nothing published separates a long range support weapon from a close one, and
> projectile velocity does not, since laser weapons read 1300 and assault rifles read 820. The three
> rules that read it carry a `judgement` field saying so.
>
> `suppressed` is **sourced**, not judged. The wiki puts it in each weapon's infobox and gives the
> audible range. It is curated here only because `fetch-wiki.mjs` reads modules and enemy anatomy
> tables rather than weapon article infoboxes. **Move it into the fetch when that changes**, and it
> carries no `judgement` field because it has nothing to apologise for.

> [!warning] `tags` is ours, `gameTags` is the game's, and a rule must never confuse them
> A rule matching `{ "tags": ["suppressed"] }` reads `item.tags`. A rule matching
> `{ "gameTags": ["ANTI-TANK"] }` reads the fetched `wiki.tags`, which arrive in screaming caps and
> keep them. Both have a `not` form. The game's matcher was called `tags` until 1.19.0, which made a
> rule's provenance a thing you had to already know.

> [!success] The refactor moved no rating, and that was the test
> All 34 rules fire on exactly the same items in exactly the same scenarios as before. `npm run rules`
> was the before and after, and every fired count and tier move is unchanged. **A refactor of a
> scoring engine that changes a score is not a refactor.**

> [!info] `idIn` and `notIdIn` still exist and there are no uses left
> The escape hatch stays in the matcher for the case where a concept genuinely fits one item, but
> nothing uses it now. The validator checks it anyway, because the next use is the one that breaks.

---

# **The Rules Page**

> [!success] Built 1 October 2026, the curator's idea. `src/Rules.jsx`, `src/lib/rules.js`
> Every rule behind our rating in one place, at the bottom of the menu with the pages about the tool: what each does, what it moves where you are dropping right now, and a switch to turn it off. His reasons: an overview of which rules exist, and a way for him and others to see what each one changes, so rules can keep being added without becoming a black box.

| | |
|---|---|
| **Groups** | The front; how hard and how many of you; climate; weather and terrain; the mission; how a build fits together. **Derived from each rule's own `when`**, so a new rule files itself |
| **A closed row** | The switch, the name, where it applies, a "judgement" tag on rules that are our call, and how many items it moves here, up and down |
| **An open row** | The sentence, the inverted sentence, when it applies and what it looks at in plain words (`describeWhen`, `describeMatch`), its size against "a tier is about 14 points", its source and judgement, its id, and **every item or build it moves here, with the tier now and the tier the other way round** |
| **Scale** | Search, folding groups, and two filters: changing something here, and switched off. Built for dozens of rules |

> [!danger] A switched off rule is gone everywhere, and only in this browser
> The set rides on the scenario every surface reads (`rulesOff`, a Set, built in `App.jsx`), and `score.js` and `build.js` skip it. **It is never on the scenario the party sends**: `usePartySync` gets the bare one. `hd2-rules-off`, out of the export. The scenario bar shows "N rules off" on every surface while any is off, the folded filter rule again. `npm run rules` proves that switching one off removes it from exactly the items it fired on and moves nothing else.

> [!warning] Every rule carries a name now, and the validator demands one
> Ninety characters at most. The validator also checks two things that used to fail silently: **a mission trait a rule gates on must exist in `missions.json`**, and **an armor trait a rule matches must exist in `vocabulary.json`**. Either typo made a rule that could never fire.

> [!success] Commando missions, sourced. 1 October 2026
> The wiki's Commando Missions page, read that day: **Automaton only**, three missions (Secure Black Box, Acquire Evidence, Extract Intel). Stratagems only while the Super Destroyer is overhead: 60 seconds on landing, and one return per Helldiver per mission. **Zero reinforcements until you activate the pods**, four sets of three, twelve in all whatever the squad size, and the reinforcement boosters cannot be chosen. Every bot that calls for help raises the threat level.
>
> `missions.json` listed all three on every front, tagged standard or carry; **they are Automaton only now, with a ninth trait, `commando`**. Eight rules key on it: reinforcement boosters (−28, the most a scenario may move anything), call-ins that earn their keep by repeating every two minutes or less (−10), long cooldowns (+8), throwaway launchers by the game's own EXPENDABLE tag (−12), **heat weapons and arc weapons, which need no ammo (+14 each)**, bringing your own supplies (+10), suppressed weapons and stealth armour (+8).
>
> **The +14 is the curator's call**: a weapon with unlimited ammo is "almost a given to bring" here, the Quasar is S+ not S. Heat feed and arc damage are two different signals in the data, hence two rules: the Quasar, Laser Cannon, Scythe, Sickles, Trident, Sai, Dagger and Talon on one, the Blitzer and Arc Thrower on the other. A booster the game refuses still reads B rather than D, because two tiers is the most any scenario may move a rating; its sentence says it cannot be brought. A ceiling would fix that and is a change of principle, so it waits for the curator.

---

# **Drop History And Share Links**

> [!info] Every confirmed drop is recorded. `src/lib/history.js`
> Which build, its items at that moment (a build is edited and deleted over time, and what you carried that night is the fact), the planet, mission, difficulty and squad. Oldest first, the newest thousand kept, exported. **Started before anything reads it much, on purpose**: the curator wants "you have never dropped with a Railgun against bots" and "try this for a change", and those need a history to exist first. The suggestions say how often and how lately you dropped with each build, and **once a front has `ENOUGH_DROPS` (five) in the history**, Drop Bay adds two things he asked for: a **For a change** card, your best fitting build not dropped with in `STALE_DAYS` (thirty), and a line of gear that reads A or better here, that you own, and that you have **never brought against this front**, each with **Build around it**, which opens the editor over Drop Bay with that item in its slot. Below five drops both stay silent, because before then "never" only means "not yet". `forAChange` and `untriedHere` in `drop.js`.

> [!info] A build in a link. `src/lib/share.js`
> `#/shared/<code>`: the build written into the link as base64url JSON with short keys, about 400 characters for a full build. No server, so it works on every address the tool lives on. **A link is anyone's text**: it is cleaned exactly like a party member's build (`unpackBuild`), and the front, difficulty bands and biomes are held to the lists the tool knows. A mangled link opens nothing and throws nothing. The editor's **Share** button copies one; the page it opens offers **Keep a copy in my Armoury** and **Keep it and drop with it**.

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

> [!danger] The vehicles' roles live in the script, and re-running it used to strip them
> The eight vehicles came in with 1.5.0 through their own one-off script, which set their roles by hand. `tag-roles.mjs` never knew, so the first `--write` after that, on 26 September 2026, would have taken chaff off five of them and objective off the Bastion. **They are in `CHAFF_INCLUDE` and `OBJECTIVE_INCLUDE` now**, and `npm run roles` reports zero changes on the shipped data. The same pass found the demolition floor applying to every slot in code, which would have tagged three exosuits as hole closers on their demolition figure alone; it now asks `slot === "throwable"`, which is what the bullet above always said. **If a role is ever set anywhere but this script, the next run deletes it.**

> [!warning] `chaff` is about rate, not capability
> Almost anything kills one hunter, and that is not what the tag means. It means holding off a swarm without reloading into your own death. The Eruptor is deliberately **not** chaff: it kills a hunter and takes a second doing it, and a duo built on Eruptors and Senators has a real hole even though every gun in it can hurt a small enemy. Sidearms are out for the same reason. A Redeemer is an emergency weapon, not a squad's answer to a crowd.

> [!info] 34 anti-armor, 61 chaff, 24 objective, 145 rated rows untagged. Counted at 1.23.0
> Untagged is correct and common. An earlier draft wanted six tags across every rated row with the build failing on an empty one, which forced boosters and armor passives into a taxonomy with no room for them.

> [!success] The bot penetration check needs no tag at all
> "Nothing you hold gets through Devastator armor" derives from sourced `ap` on held weapons, so it stays out of the editorial layer entirely. The threshold is **AP 4**, and it was measured rather than picked: AP 3 is carried by something in all 39 curated builds so a check there can never fire, AP 5 is missing from 30 of them and would fire on more than half of all bot pairs, and AP 4 is absent from 14 and fires on 6 of 78.
>
> **Re-measured against enemy armour in 1.10.0 and it holds, for a better reason than the first one.** A Devastator's plate is AV 3 and penetration equal to an armor value is 65% rather than full, so AP 3 only ties a Devastator and AP 4 is the first clean answer to one. It is not a clean answer to the front: at AP 4 five of the 22 Automaton enemies still take damage in one spot only, and the Dropship at AV 5 all over takes none at all. **AP 5 is where bots stop needing a weak point entirely.** Re-measure again before moving it.

### The squad panel

**On the drop screen since 1.24.0**, under the four slots. It used to be a sticky panel over the Builds grid, fed by a squad icon on each card; both are gone. A squad member's slot is the comparison now. See The Drop Screen.

The rules live in `src/lib/squad.js` as a pure function, so the logic is in one place and testable. It reads **the scenario**, spoken to it by `dropContext` in `src/lib/drop.js`, rather than the grid's own filters. A real mission name reaches the checks through its traits, which is how "Destroy Command Bunkers" fires the structure demolition warning.

**Severity reads as critical, warning, note.** Their plurals are written out rather than guessed, since "2 criticals" is not a phrase.

> [!success] Silence is the normal state, and never a claim of coverage
> A squad with nothing wrong says nothing. Below difficulty 7 the coverage checks switch off entirely, and the panel says they are off rather than saying you are covered. A squad with no anti-tank at difficulty 3 is still a squad with no anti-tank; we are choosing not to care, which is not the same as it being fine.

> [!danger] Warnings are advisory. Do not apply the biome hard gate precedent
> Biome filters remove builds from the pool by explicit decision. These do the opposite: nothing is removed from the grid, nothing is blocked. A squad knowingly doubling up on mortars is making a choice about how they play.

Every warning is conditioned on where you are dropping, which is what makes them fire on something true. "You have no anti-tank" is almost always false. "No anti-tank on bugs at 7 and up" is worth reading, and the cave warning only exists because `demoForce` records that 40 closes a hole from outside while 30 needs the throw to go in.

---

# **The Armoury**

The Loadout Builder until 1 October 2026, renamed for the game's own armoury, the curator's word. `src/Armoury.jsx` holds the two tabs; `src/Builder.jsx` is the editor, at `#/builder/:id` on its own page or over Drop Bay. The Builds grid moved here from Drop Bay the same day, and an old `#/bay/builds` link lands on it.

> [!info] History: where your evenings went
> The Armoury's third tab, 1 October 2026. How many drops and how they spread across fronts and missions, the builds you keep coming back to, the ones **gathering dust** (not taken in thirty days, or ever, each with "Drop with it", which puts it in your Drop Bay slot), and every drop newest first, a deleted build shown by the name it had. The Builds grid's cards say "3 drops, last 2 days ago" on their label line. Empty until the first Confirm, and the empty state says so.

> [!info] Coverage: do you have something for each occasion
> The curator's question, 1 October 2026: something to play solo on Super Helldive, something for a frozen planet, something for a Commando mission? `src/lib/coverage.js` reads fifteen situations per front (solo and four of you on Super Helldive, four on Hard, hot, frozen, sandstorms, ion storms, and each kind of mission) at Suicide Mission with four of you unless a row says otherwise, through the drop screen's gates and only with builds you can field. **A or better is covered, B is thin, nothing is a gap**, and a gap says what ruled your builds out and links to a new build for that front. With no builds of your own the presets stand in, and the page says so. They cover every situation on every front, which is why the useful reading is yours.

Nine slots. Tapping one opens a picker over the whole screen that reuses the tier row, so ratings, flags and provenance are in front of you at the moment you choose rather than one screen away. **That picker is the tier list now**, for most people the only way they meet it. It hides unavailable gear by default with a toggle to show it, and pins favourites to the top.

> [!danger] Opening a preset forks it
> The 39 curated builds are stigly's and are never written to. Opening one in the builder hands you a copy carrying `forkedFrom`, and the banner says so. Saving stores the copy under `hd2-loadouts`; the original is untouched.
>
> **The mechanism outlives the set**, and replacing `loadouts.json` wholesale is safe. Checked on 22 August 2026, because the 39 are getting binned:
>
> - **`forkedFrom` is written and never read.** `forkPreset` sets it and nothing anywhere looks at it, so a saved build pointing at a preset id that no longer exists is inert rather than broken. `cleanLoadout` does not validate it and does not need to. **If anything ever does read it, that reader owns the dangling case**, because nothing else will catch it: the validator checks slots, not provenance.
> - **The forked banner reads the route, not the link.** It renders from `presets.find(p => p.id === loadoutId)` and is guarded on that being found, so a dead id renders nothing rather than "Forked from undefined".
> - **Favourites and the Drop Bay comparison both filter to what resolves**, so a starred or compared preset that stops existing disappears quietly.

> [!danger] A slot row shows one badge, for the front the build is for
> It rendered all three faction ratings until 1.20.0, unlabelled, so you could not tell which was which and two of them answered a question nobody asked. **A build declares a front and keeps it when saved.** The tier list dropped its three faction columns in 1.9.0 for exactly this reason and the builder slot was the last place they survived.
>
> **It shows our reading, not the vote**, because the gear badge above it is the mean of these nine and two halves of one screen must not disagree about the same weapon. The vote is not hidden: it is the delta marker, the same top left dot the tier row uses, and the tooltip opens with what the crowd said. The full community rating is one tap away in the picker, which reuses the whole tier row.

### Derived metadata

**`heat` is derived, and the rule was corrected in 1.4.0.** Only gear you hold and manage heat on counts: primary, secondary, and a support weapon or backpack. A call down does not vent in your hands, so orbitals, eagles, sentries, emplacements and mines are excluded. That half was right.

> [!failure] The old "39 of 39" was not a check
> This section used to claim the derivation reproduced every hand authored flag, 39 of 39, and treat that as verification. It was not. The hand authored flags were made from `damageType` and so was the rule, so the two agreed because they shared one wrong premise. Against the source the rule now agrees on **35 of 39**, and the four it disagrees with are three Purifier builds and one Blitzer, none of which can overheat. Two things built the same way agreeing with each other proves nothing.

> [!question] `fire` is a judgement, not a property
> Three derivation rules were tested against the curated builds and the best managed **37 of 39**. A thermite grenade is anti-tank despite its damage type; an incendiary grenade plus fire resist armor is a commitment. So the builder seeds a toggle from the guess and the curator overrides it. Do not "fix" this by deriving it.

> [!bug] `bugs-blender` is flagged `fire: false` and probably should not be
> It carries the Cremator flamethrower, Incendiary Impact grenades, Incendiary Mines and Inflammable armor. Meanwhile `bugs-meat-grinder`, marked `fire: true`, carries an incendiary grenade and fire resist armor and nothing else. Blender is the more committed fire kit of the two. Left alone because the curated set is his, but the fire tornado warning never shows on it.

### The picker recommends

It ranks by **our reading for where you are dropping, against the front the build is for**, and says so in its header: "Ranked for the Automatons, on Merga IV, Commando: Extract Intel". It ranked by the vote until 1 October 2026, which made "already sorted for my drop" untrue the moment a scenario said anything. The vote is still on every row, beside our column. The best reading actually reachable in that slot gets a "top pick for this drop" marker, so it means top of what you can take rather than a fixed tier. Favourites still pin above everything, and unrated items sort last but are never removed.

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

**Thirteen themes ship.** Three base ones: **Dark** (grey), **Light** (off white), **Neon** (near black with `#FFE900`, taken straight off `ui_logo_helldivers_yellow.svg` so the brand colour is the game's own rather than a guess). Then ten skins: Castellan's Creed, Automaton, Bile Titan, Entrenched Division, ODST, Hellpod Drop Bay, Malevelon Creek, Ministry of Truth, Super Destroyer and Viper Commandos. **Counted from `THEMES` in `src/lib/theme.js` on 25 September 2026**; this line said eleven for a while after the last two landed.

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

> [!success] Castellan's Creed no longer fades the tier ramp, and the ramp itself is settled
> The first study restyled the whole ladder so it read as one material. The v2 study relabels the ramp **invariant**, with the note "tier badges and faction hues are the same values in every theme", so the override is gone and every skin now shows the same badge.
>
> **The three way disagreement is closed as of 1.17.0.** Three ramps used to be in play: the app's original v1 set, the one the v2 warbond studies draw, and the one in the tier badge design document. The curator settled it by taking the badge study's palette, rotating it down one rank and replacing the brown with a grey. Both losing sets are gone from the code.

> [!danger] A floor and a ceiling that contradict cancel each other
> A floor says **at least this tier**, a ceiling says **at most this**, and when a floor sits above a ceiling the two cannot both hold. Until 1.18.0 the ceiling silently won, because its line ran second in `src/lib/score.js`.
>
> That produced a demonstrable absurdity on the curator's own scenario: the R-72 Censor at **86 points landing at B** while an M7S SMG at **64 points landed at S**. Same rule set, and the higher score three tiers lower.
>
> **Neither applies now and the points stand.** Both rules already had their say in the points, so neither has earned the right to overrule the other. `scoreItem` returns `contradiction: true` when it happens, and `npm run rules` sweeps every item and scenario pair for it.
>
> There are currently no ceilings in the rule set at all, so that sweep passes vacuously. It is a guard for the next one.

> [!warning] The weather rules price a risk, not a state
> A planet listing sandstorms has sandstorms **sometimes**. The curator's figure is roughly three minutes at a time, a quarter of a Blitz and under a tenth of a full operation, and nothing in the source data says how often.
>
> The visibility penalties are set as a risk you carry across a run rather than a state you are in, and the storms lost their tier caps entirely. Pricing an episodic hazard as a permanent one told you never to bring a marksman somewhere on account of something that is not happening most of the time.
>
> **Reduced visibility also cuts both ways.** Solo, a storm is partly a gift: it blinds them as much as you, and alone you are not trying to win the firefight. That is its own rule rather than a smaller penalty.
>
> **Extreme cold and intense heat are climate, not weather.** Do not soften those the same way.

> [!danger] Finish is not theme, and the two words are not interchangeable
> The app has a theme picker carrying eleven warbond skins. **Badge finish is a separate, narrower setting that touches only the tier badge.** Different file, different storage keys, different panel, and a theme change must never move a finish. That is tested: set a finish, cycle every theme, it survives.
>
> The design document is emphatic about this and names the prop `finish` for exactly that reason. Do not fold the two pickers together and do not name anything here `theme`.

> [!danger] The tier badge, and the things already tried and cut
> `src/TierBadgePlate.jsx`, ported from `Image Library/UI/Tier Badges/hd2-tier-badge-component.html`. **Read that document before touching the component.** It carries the geometry, the token values and the reasoning.
>
> **The rule that overrides the rest: rank is never carried by degrading legibility.** A D reads exactly as clearly as an S+. Rank is hue, and optionally sheen and glow intensity. Never size, never fade, never damage. Every earlier pass that dimmed the low tiers was rejected for this.
>
> **Built, evaluated and cut. Do not rebuild:** rivets, base bands, cap bands and double rims, because geometry inside the plate competes with the letter. The bevel edge, invisible at 44px. Scratches and wear, which crossed the letter band and implied low tiers are more damaged. The filled versus outline split at the A boundary, which encoded doctrine into cosmetics.
>
> **Grain is seeded at 7 on every badge**, deliberately. A per instance seed makes the grain differ between tiers, which reintroduces exactly the degradation the top rule forbids.
>
> **Delta markers, padlocks and stale flags are DOM siblings**, positioned over the badge, never drawn inside the SVG. The marker sits **top left**: that corner of the plate is square and the top right is the chamfer, so a round marker there reads as damage.
>
> **The row badge is smaller than the document ships at**, 32px on a phone and 36px from `sm` up against the document's 44. At full size it filled the row edge to edge, which left the delta marker nowhere to sit and got it clipped by the row's `overflow-hidden`. Rows stayed at 61px either way.
>
> **Performance was measured, not assumed.** 103 badges and 204 SVG filters on screen give a median scroll frame of 6.9ms. The document's fallback, one shared grain filter at the app root, is not needed.

> [!danger] Faction colours are not tokens, ever
> Bots red, bugs orange, squids purple are a locked decision and stay literal in every theme, warbond skins included.

**The tier ramp is a token set, with one rule.** Dark, Light and Neon share one ramp and never touch it, because the badge encodes the rating and an S+ has to read as the same S+ across them. A warbond skin may override it, but only **all six at once**. Overriding one tier and leaving the rest is what breaks the badge.

Castellan's Creed uses that exemption: only S+ is a solid chip, and S through D fade through gold, olive, teal, bone and muted so the ladder reads as one material rather than a rainbow.

Biome panels tint from the biome's own colour at low alpha rather than a fixed dark wash, which is what lets them read correctly in both themes.

**Dark is grey, not black.** The artifact sat at near black `#09090b`. The dark theme lifts it to `#121214`, which is what the build spec asks for. To go back, set `--base-950` to `9 9 11` and `--base-900` to `24 24 27` in `src/index.css`.

**A theme declares its own base.** Nothing forces a future theme to ship both a light and a dark variant. The Warhammer 40,000 one is inherently dark and should just be dark.

---

# **Art**

> [!danger] The repository is public, and the art is not in it. 2 October 2026
> **github.com/Stigsmith/D.I.L.A.S.**, public, `main` only, pushed on the curator's word on 2 October 2026. **`Image Library/` is gitignored and was taken out of the whole history** before the first push: it is extracted game art, Helldivers 2 icons and renders plus Halo and Warhammer material in the crossover skins. It stays on his machine, where `npm run images` still copies it into `src/assets`, so his builds and deploys carry the art exactly as before.
>
> **A clone from GitHub builds art free**: the image import says there is no library and carries on, every item reads by its name, and the favicon is a plain yellow tile with a D rather than the game's skull, drawn by `import-images.mjs` so `check-dist` still finds every file the page asks for. Proven on 2 October 2026 by cloning `main` and building it.
>
> **The old history, art and all, is the local branch `private-history-with-art`. Never push it**, nor the other old local branches (`accounts`, `cloudflare`, `data-7.1.1`, `drop-screen`, `party`), which predate the rewrite. **Push only `main`, and only when the curator asks**: his standing rule for every repository. Before a push, `git rev-list main | while read c; do git ls-tree -r --name-only $c; done | grep -c '^Image Library/'` must say 0.

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
| Item art | 235 of 247 | Electrical Conduit, and the eleven items added in 1.23.0 |
| Armour set renders | 110 of 110 | From the wiki by `npm run armor-art`, gitignored. A set with none reads by its initials |
| Warbond covers | 24 of 25 | 512px cover art. Ironclad Democracy has none, and its Collection tile shows the name alone |
| Generic | 28 | Skull, faction marks, logos, category and tier badges |

Three different art styles are in there and they are not interchangeable. Stratagems are flat in-game icons at about 4KB, already colour coded by call-in menu group, which is why they read so well at row size. Weapons are hero renders at about 93KB. Warbonds are cover art.

> [!danger] Nothing may depend on art existing
> Delete `src/assets` and every lookup returns null, every item still reads through its text fallback, and nothing throws. This is deliberate. The build spec is explicit that extracted game art is the most likely thing to have to come out, so the asset layer stays swappable. The generated directories are gitignored, so a fresh clone genuinely runs art free until `npm run images`.

Item ids come from the display name, so the file naming lines up on its own for every item that has art. The handful that do not are listed explicitly in `scripts/import-images.mjs` rather than fuzzy matched, so a wrong pairing is visible in review.

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

> [!info] The dev server takes the port it is given
> `vite.config.js` reads `PORT` and falls back to 5173, and `.claude/launch.json` sets `autoPort`, so two Claude sessions in this folder each get a dev server. Nothing here depends on the number. Added 5 October 2026, when a second session found 5173 taken.

```bash
npm run build
```

`npm run build` runs the validator first and stops if names do not line up. Run the check on its own with `npm run validate`.

```bash
npm run rules
```

```bash
npm run builds
```

The two rule health reports. `rules` measures every item rule against the pool it can fire on, and `builds` measures every loadout rule against the 39 curated builds **and** 300 random legal ones. Both flag anything firing on 60% or more, which is the shape the armour rules had. **Run them after adding a rule.** The armour bug was visible in one line of output and shipped anyway, because nothing was looking.

```bash
npm run drop
```

The drop screen's rules against the real builds, plus suggestions, drop history, share links and coverage. See The Drop Screen.

```bash
npm run map
```

The galaxy map's arithmetic against the shipped planet table. See The Galaxy Map.

```bash
npm run test:worker
```

The backend's tests, inside the Workers runtime against a real local database. See Accounts for the rest of the backend commands.

```bash
npm run wiki
```

Re-fetches the weapon stats and the planet table, and **reports what would change without writing anything**. Add `-- --write` to apply it and `-- --refresh` to go back to the network instead of the cache in `.wiki-cache`. It is deliberately not part of the build: a build that needs the internet is a build that breaks on a train.

```bash
npm run missions
```

Reads each mission's time limit from its wiki article into `minutes` in `missions.json`. Report by default, `-- --write` to apply, `-- --refresh` to go back to the network. A mission whose article states no limit keeps none.

```bash
npm run armor
```

Reads every armour set into `src/data/armor.json`, the same way. `npm run armor-art` fetches and cuts the renders.

```bash
npm run difficulty
```

Reads the table on the wiki's Difficulty page into `src/data/difficulty.json`, the same way: a report by default, `-- --write` to apply, `-- --refresh` to go back to the network instead of `.wiki-cache`. **It refuses a table that does not read cleanly**: a moved column, a row short of cells, medals that do not add up, or operation modifiers and samples no longer starting where the effects list says they do. The enemy columns are not read; each enemy's article already says the level it starts at.

> [!info] Node is on the PATH
> Verified 18 August 2026: a fresh PowerShell resolves `node` to `C:\Program Files\nodejs\node.exe` and `npm` works with no setup. This used to need prepending, because a shell opened before the install could not see it. That is no longer true.

> [!tip] How stigly actually deploys it
> File Explorer into `C:\Dev\dilas`, click the address bar, type `cmd`, Enter. That opens a terminal already in the folder. Then `npm run deploy`, which builds and puts it on Cloudflare in one go. He does not use a terminal habitually, so give the path and the clicks, not just the command.
>
> **Until dilas.me is deployed and announced, Netlify is still the address people use**, and `npm run build` then dragging `dist` onto Netlify still works exactly as before. See Hosting for why the two coexist.

> [!bug] PowerShell refuses to run npm
> `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.` PowerShell blocks the npm script wrapper by default. **Use `cmd` in the address bar instead of `powershell`**, where plain `npm run build` works. From an already open PowerShell, `npm.cmd run build` skips the wrapper and works too. Neither needs a system change. `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` is the permanent fix but is not required, so do not run it on his behalf.

---

# **The Tour**

> [!success] The Democracy Officer shows you round. 3 October 2026, the curator's ask
> W.A.R.P.'s shape with Enodia's light: seventeen steps across eight pages, **starting in Collection** (see Collection, "Setting it up"), each lighting one thing and saying it twice, **in-universe in large type, then plainly in small type under it.** The register is Helldivers 2's own item tooltips; **none of the words are the game's**, every line is written for this tool. `src/lib/tour.js` holds the steps, `src/Tour.jsx` draws them, `.tour-spot` in `src/index.css` is the light.
>
> - **`plain` is the fact and must stand alone.** Somebody reading only the small print should still know what every lit thing does. The jokes are paid for by that.
> - **It opens by itself once per browser**, then `hd2-tour-done` says "done", out of the export. Settings has **Replay the tour**. It walks from page to page and puts you back where you started.
> - **Anchors are `data-tour` attributes**, never classes, so styling work cannot rename one by accident. The first *visible* match is lit, because the party button is in the DOM once per width.
> - **An `optional` step whose anchor never turns up is skipped** the way you were going: Drop Bay has no slot before a front is chosen and sends you to the war room. Any other missing anchor (a menu entry on a phone, where the menu is a drawer) is said from the middle of the screen.
> - **Screenshots of it in the Browser pane lie.** The pane paints stale frames after a scroll (see the bug block in Hard Rules), so check the card's place with `getBoundingClientRect` or a hit test, not the picture.

---

# **The README**

> [!info] The public face, in W.A.R.P.'s house style. 2 October 2026
> `README.md` follows the curator's other project, `C:\Dev\W.A.R.P\README.md`: a centred name and full name, a two line pitch, shields badges, quick links, an in character quote, a section per feature with a screenshot, **what it keeps and what it sends** as a table, building from source, where the numbers come from, and the licence and disclaimer. **Every claim in it is checked against the code**, and the privacy table says what Support's "Your data stays yours" says. Change both together.
>
> **The screenshots in `docs/images/` are 1600 by 900, taken with headless Edge from its own profile**, never from a browser anybody uses. The recipe, since the tool's security policy refuses inline scripts: build, put a throwaway `__seed.html` plus `__seed.js` in `dist/` that writes the scenario, the drop and `hd2-tour-done` into `localStorage` (without the last, the tour opens over every shot), start `wrangler dev`, run one live war fetch, load the seed page once with `msedge --headless=new --user-data-dir=<a scratch folder> --dump-dom`, then `--screenshot` each route with `--window-size=1600,900 --virtual-time-budget=9000` (12000 for the maps, which glide). Convert with sharp to JPG at quality 84, and delete the seed files. Retake them when a screen they show changes.

---

# **Versioning And The Changelog**

`src/data/changelog.json` is the record, newest first. **One version is one deploy**, not one day: a version can gather several days of small changes, and its `date` is when it shipped. That is the whole reason it is versioned rather than dated, since work here arrives in bursts and trickles that do not line up with a calendar.

| Bump | When |
|---|---|
| **Patch**, 1.2.x | Fixes and small tweaks only. Nothing new to learn |
| **Minor**, 1.x.0 | A new surface, a new capability, a batch of skins. The normal bump |
| **Major**, x.0.0 | The tool becomes a different thing. Accounts landing would qualify |

> [!danger] Deploying is the curator's call, and he saves it for a major upgrade
> Said on 28 September 2026. **Never run `npm run deploy` unless he asks for it in that conversation.** 1.21.0 through 1.24.0 each went out the day they were built; that habit is over. Develop, check, commit and verify under `wrangler dev`, keep adding to the top changelog entry as work lands, and say when a body of work is ready to ship. Production migrations wait with the deploy.

> [!danger] Three places have to agree, and two of them are automatic
> Add the entry to `changelog.json` with a new `version`, then set the same string in `package.json`. The footer and the Changelog page both read `CHANGELOG[0].version`, so they cannot drift. **Nothing else hardcodes a version.**

> [!danger] Two roadmap files, and the markdown one moves first
> `dilas-roadmap.md` in the repo root is the **working document**: the reasoning, the dependency chain, the open questions, everything a session needs. `src/data/roadmap.json` is the **public summary** shown on the Roadmap page, one sentence per milestone.
>
> They will drift, and the drift is one directional. **Change the markdown first, then check whether the summary still reads true.** A milestone that moved status, or a new one worth a person knowing about, belongs in both. Anything that is reasoning rather than intent belongs only in the markdown, or the page stops being concise, which is the whole reason it exists.
>
> Keep every `say` to one sentence. The moment an entry needs two, it belongs in the working document instead.

> [!info] How an entry reads, since 3 October 2026. Enodia's shape, D.I.L.A.S.'s voice
> Each version is `title`, a one line `say` and **three to six short `changes`**: what is different on screen, one sentence each, never the reasoning (that is what this file is for). The `say` carries some Super Earth flavour, Ministry of Truth dry rather than jokey. The curator asked for it concise and with Helldivers humour, and the whole history was rewritten that way, 55,000 characters down to 9,000. The Changelog page folds: one line per release, the newest open, opening one closes the other.

> [!tip] Write the entry as the work lands, not at the end
> Adding a line to the top entry costs nothing. Reconstructing a week of small changes from memory is how a changelog quietly becomes fiction.

---

# **Hosting**

> [!success] Served from Cloudflare since 1.21.0, 25 September 2026
> **https://dilas.me** from the next deploy: bought on Cloudflare on 2 October 2026 and attached to the Worker as a custom domain in `wrangler.jsonc`, so the deploy creates its DNS record and certificate. The Worker's own address is **https://dilas.stigsmith.workers.dev**: the curator renamed the account's `workers.dev` subdomain from `stigly-official` to `stigsmith` on 4 October 2026, in the dashboard, and the old address stopped answering at once with no redirect. Enodia was unaffected, since it runs on enodia.me with `workers_dev` off. The old `dds` one was deleted with the old Worker on 3 October 2026. Both on the same Cloudflare account as Enodia. Stage 0 of `dilas-cloudflare-handover.md` moved `dist/` here as static assets, and **Stage 1 added a Worker on `/api/*` and a D1 database for accounts**, switched off in the UI. See Accounts. Everything the tool does for somebody using it still happens in the browser. Read that handover before Stage 1; it carries eighteen pitfalls Enodia paid for.

| File | What it does |
|---|---|
| `wrangler.jsonc` | The whole deploy config. Every key carries its reason |
| `public/_headers` | Cache rules and security headers. Vite copies it into `dist/`, Cloudflare parses it at deploy time and never serves it |
| `public/fonts/`, `src/fonts.css` | Oswald and JetBrains Mono, vendored. **Generated by `npm run fonts`, never hand edited** |

```bash
npm run deploy
```

Builds, then deploys. From `cmd` in the address bar of `C:\Dev\dilas`, the same as the build always was. **It refuses to upload a build that is not whole**, see The Galaxy Map, "A file sync app watched this folder". **This machine is already logged in to Cloudflare**, machine wide, from Enodia, so there is no login step.

> [!danger] A deploy that reports success is not evidence that it landed
> Enodia saw `wrangler deploy` print a new version id and "100%" three times in a row while old code kept running. **After every deploy, read something the new build changed off the live site.** The cheapest check: the `index-*.js` name in the live page must match the one in `dist/assets`, and the version in the footer must be the new one. If it did not land, `npx wrangler versions upload` then `npx wrangler versions deploy <id>@100% --yes`.

> [!danger] Local dev on the real host is port 8788, never 8787
> `npx wrangler dev` serves the built `dist/` exactly as Cloudflare will, headers included. It needs `npm run build` first. The port is set in `wrangler.jsonc` so it belongs to the project.
>
> **Enodia's wrangler dev uses 8787 on this same machine.** On 25 September 2026 this tool started on 8787 while Enodia was already running there, printed "Ready on 8787", and Enodia went on answering every request. Every header read back was Enodia's policy over an app that did not have this tool's files. Nothing errored. The tell was a policy containing `data:`, which this tool deliberately does not allow.
>
> Stopping a background `wrangler dev` on Windows can orphan its `workerd` and `esbuild` children. Check nothing from `C:\Dev\dilas` is still listening before starting another.

### The security headers

Netlify never sent any, for the whole life of the tool. Now every response carries:

| Header | Value, and why |
|---|---|
| **Content-Security-Policy** | Nothing from any other address. `img-src 'self'` with **no `data:`**, tighter than Enodia, because nothing in D.I.L.A.S. draws a data URI: `assetsInlineLimit` is 0 and theme art is extracted to real files. `style-src` allows `'unsafe-inline'` for React's style attributes, which carry every faction colour. `connect-src 'self'` is what lets Stage 1's `/api/*` arrive without editing the policy |
| **Strict-Transport-Security** | A year, `includeSubDomains`, **no `preload`**, which is a one way commitment: every subdomain of dilas.me would be HTTPS only for good. stigly's call |
| `X-Content-Type-Options`, `Referrer-Policy` | `nosniff`, `strict-origin-when-cross-origin` |
| **Cache-Control** | `/assets/*` and `/fonts/*` immutable for a year, because every file there has a content hash in its name. The page revalidates on every visit, so a deploy reaches people the next time they open the tool |

**Verified by reading, not by the config.** Under `wrangler dev` and again live: every header, every content type, eleven screens and all thirteen themes walked with a `securitypolicyviolation` listener, Export exercised, and zero requests to any other host.

> [!danger] A header set twice is joined with a comma, not overridden
> So `Cache-Control` lives only on patterns that cannot both match one file. Put one on `/*` and every image gets two conflicting values. The note is at the top of `_headers`.

> [!warning] If an image ever needs a data URI, change the policy on purpose
> It will not fail loudly. The browser drops the image and logs a violation nobody is reading. Add `data:` to `img-src` deliberately, in the same change.

### The fonts

`App.jsx` used to `@import` both faces from `fonts.googleapis.com`. The policy blocks that, both the stylesheet and the files from `fonts.gstatic.com`, and it was also handing every visitor's IP to Google. **This is exactly the bug Enodia shipped**, invisible there for the same reason: the old host never applied a policy.

`npm run fonts` fetches both faces once, **every subset Google offers**, with each `unicode-range` intact. The browser downloads only the slices a page renders: the tier list pulls two files of the eleven. 136 KB on disk. It is a one time job, not a build step, and the site depends on Google neither at build time nor at run time.

### Still true from before

| Fact | Consequence |
|---|---|
| Hash routing, `#/tiers/primary` | No path ever reaches the server. `not_found_handling: "single-page-application"` only decides what a mistyped path shows today, and becomes load bearing with short links in Stage 4 |
| Asset paths are absolute, `/assets/...` | Must be served from a domain root |
| State is `localStorage` | Per origin. Nothing follows you between addresses, and nothing syncs between two people |

> [!danger] Moving address empties everybody's collection, and with dilas.me it is one move
> Profiles, locks, favorites and builds live in `localStorage`, scoped to the exact address. **With the domain bought, everybody moves once**: from Netlify, or from `workers.dev` for the few who used it, straight to dilas.me. Export there, Import here.
>
> The order, every step stigly's call: deploy, so dilas.me answers; one last Netlify build carrying a notice with the new address and "Export here, Import there"; Netlify and workers.dev left up for a while rather than switched off the same day. `_headers` travels in `dist/`, and Netlify reads the same file format, so that last Netlify build gets the security headers too.

> [!success] The "no server" sentence was retired in 1.22.0, when Stage 1 landed
> Support said "There is no account and no server behind this tool" (`Pages.jsx`, "Your data stays yours"). It went false the day the Worker deployed, so it said **"Nothing you do here is sent anywhere, and there are no accounts yet"**. **That went false in turn with the live party in 1.25.0**, and Support now says what a party sends, to whom, and when it is deleted. **The "no accounts yet" half goes false the day accounts open**, and must change with the switch. `roadmap.json` still says the solo track runs "with no account, no server and no network call", which describes that track's features and stays true. Enodia shipped the same kind of sentence past its expiry: "Nothing is tracked about you" outlived the day stats existed.

> [!danger] Only `study_*` art is bundled
> `src/lib/assets.js` globs `../assets/themes/*/study_*`, not the whole folder. A theme folder also holds its palette study, a preview render and the loose reference art the skin was drawn from, none of which the app renders. Globbing everything shipped **22.7MB of dead weight, 60% of the built output**. If a skin needs a new file at runtime, name it `study_*` or it will not be bundled.

> [!warning] The art is extracted from shipped games
> Item art comes from Helldivers 2, and the crossover skins carry Games Workshop and Halo material. The asset layer is deliberately swappable and every lookup returns null with a text fallback, so the tool runs art free if any of it ever has to come out. Worth keeping the URL unlisted rather than indexed.

---

# **Accounts**

> [!success] Stage 1 built, 1.22.0, 25 September 2026. **Switched off**
> A Cloudflare Worker answers `/api/*` and nothing else, a D1 database named `dilas` holds the accounts, and better-auth runs email and password sign in. Ported from Enodia's backend in `C:\Dev\Enodia`, which built all of this first; `dilas-cloudflare-handover.md` is the plan and its eighteen pitfalls.
>
> **Nobody using the tool can see any of it.** `ACCOUNTS_LIVE` in `src/lib/account.js` is `false`, so the sidebar keeps "Account v2" locked and `#/account` falls back to the tier list, exactly as before.

| | |
|---|---|
| `worker/index.ts` | The routes: `/api/auth/*` to better-auth, `/api/capabilities`, `/api/me`, the two party routes and `/api/war`, plus the `scheduled` handler. Everything else is a JSON 404 |
| `worker/auth.ts` | Every better-auth option, each with the reason. Nearly verbatim from Enodia |
| `worker/email.ts` | The mail swap point. **Inert until Stage 2**: no domain, so no sender, so no reset |
| `worker/schema.ts` | **Generated** by `npm run db:schema`. Never edit |
| `worker/schema-app.ts` | Ours. The `api_rate_limit` table since the live party, `war_snapshot` since the live war, and `war_history` since the Star Map |
| `worker/party.ts`, `worker/limit.ts` | The live party and the limiter for our own routes. See The Live Party |
| `worker/war.ts` | The live war: the Cron Trigger's fetch, and what `GET /api/war` serves. See The Galaxy Map |
| `migrations/` | Generated by `npm run db:generate`. Applied locally by `npm run db:migrate` |
| `src/lib/account.js`, `src/Account.jsx` | The browser half and the screen |

> [!danger] The switch is a UI gate and only a UI gate
> `/api/auth/*` is deployed and reachable whatever `ACCOUNTS_LIVE` says: somebody reading the JavaScript can post to it by hand. What protects it is the rate limiting in `worker/auth.ts`, **never the switch**. If accounts ever have to be closed for real, the place is the Worker.
>
> **When to flip it is stigly's call, with one hard floor.** Not before Stage 2, because an account with no password reset is one you can be locked out of permanently. And arguably not before Stage 3 either: until sync exists an account does nothing, and the Account screen says so in as many words.

> [!danger] `npm run db:schema` runs the CLI at the installed better-auth version, never `@latest`
> Found on 25 September 2026, and it is **the handover's own pitfall 6 reached from the other direction.** The handover and Enodia's script both say `npx auth@latest`, because the old `@better-auth/cli` lagged behind and dropped the NOT NULL `issuer` column. By today `auth@latest` is **1.7.6** while the installed better-auth is **1.7.2**, and the CLI generates from its own bundled core, not the project's. 1.7.6 dropped `issuer`; 1.7.2 requires it and writes it on every sign up.
>
> `scripts/db-schema.mjs` reads the installed version and runs that CLI. The schema it produced is **byte identical to Enodia's**, which is proven in production. A schema missing `issuer` fails five tests in `auth.test.ts`, checked by simulating it.
>
> **Enodia's `db:schema` script has the same latent problem** and will break the same way the next time it is run.

> [!danger] `public/_headers` does not reach the API, so the Worker hardens its own answers
> `_headers` applies to static assets only. Until `harden()` in `worker/index.ts`, every `/api/*` response went out with no `nosniff` and no cache instruction, including `/api/me`, which carries a name and an email. Every Worker response now carries `x-content-type-options: nosniff` and `cache-control: no-store`, better-auth's own answers included. Measured by reading the response; tested; **Enodia's Worker has the same gap.**

### Commands

```bash
npm run test:worker
```

Sixty six tests, fifteen for accounts, twenty five for the live party and twenty six for the live war and its history, run **inside workerd against a real local D1**, never in node, where none of what matters is true. Each protection was seen failing before it was trusted: rate limiting left to the library default (two fail, and it reproduces Enodia's finding that better-auth does not limit on Workers by default), the address read from `x-forwarded-for` (two fail), the schema missing `issuer` (five fail), and the response hardening removed (one fails).

```bash
npm run typecheck
```

The Worker only. `tsconfig.worker.json` stands alone, because this project has no root tsconfig to extend.

| Script | Does |
|---|---|
| `db:schema` | better-auth's options into `worker/schema.ts`, version matched |
| `db:generate` | the schema into a numbered SQL file in `migrations/` |
| `db:migrate` | apply them to the **local** database |
| `types` | `worker-configuration.d.ts` from `wrangler.jsonc`. Re-run after editing the config |

**Production migrations run before the code that needs them:** `npx wrangler d1 migrations apply dilas --remote`, then `npm run deploy`.

### Secrets

`BETTER_AUTH_SECRET` signs every session cookie. Locally it is in `.dev.vars`, generated at random and gitignored. In production it is set with `npx wrangler secret put BETTER_AUTH_SECRET` and is a **different** random value. Rotating it signs everybody out, which is the right behaviour if it ever leaks.

> [!warning] With no `.dev.vars`, every `/api/*` answers 500
> That is the secret guard at the top of `worker/index.ts` doing its job: without it every cookie would be signed with `undefined`, which is an authentication bypass rather than an error. A fresh clone needs a `.dev.vars` before `wrangler dev` will do anything useful.

> [!info] `RESEND_API_KEY` and `MAIL_FROM` are typed optional in `worker/optional-env.d.ts`
> They are absent until Stage 2, so `npm run types` does not know them. Declared optional rather than faked into `.dev.vars` as empty strings, which would type them as always present. The generated file on this wrangler makes the global `Env` and `Cloudflare.Env` siblings, so the augmentation names both. Delete the file once Stage 2 configures them.

### Local testing, and two traps found doing it

> [!bug] Rebuilding while `wrangler dev` runs can silently stop it serving the site
> Vite empties `dist/` at the start of a build. On Windows that crashed wrangler's asset watcher with `EPERM`, it disabled itself with one warning line, and from then on every page load fell through to the Worker and answered `{"error":"no such route"}`. **Restart `wrangler dev` after every `npm run build`.** Production is unaffected; this is the local watcher only.

> [!tip] Driving the account screen locally means flipping the switch in a local build
> Set `ACCOUNTS_LIVE` to `true`, `npm run build`, restart `wrangler dev`, drive it, then set it back and rebuild. **Grep the built bundle afterwards** to prove the test build is gone. All of that was done on 25 September 2026: sign up, reload with the session intact, sign out, a wrong password getting the plain sentence as an alert, sign in, the session cookie invisible to page scripts, and no policy violations.

### What is deliberately not here yet

- **Password reset**, Stage 2. The domain it waited on exists since 2 October 2026; it still needs a mail sender (Resend, the handover's choice) and `MAIL_FROM` on dilas.me
- **The account doing anything.** The "What an account does" panel says "Nothing yet". **It must change the day Stage 3 sync lands**, or it becomes a sentence that outlived its truth

---

# **Deferred, Not Rejected**

> [!todo] Wanted, decided against for this pass only
> These are in the requirements document as real intentions. They were left out of the port to keep behaviour identical, not because they were turned down.

- **Weapon stats beyond the tables.** Magazine size, spare magazines, fire rate, recoil, reload time, projectile count and stagger are not in the source data. They would come from helldivers.wiki.gg.
- **Vehicles and mechs.** No EXO-45, EXO-49, FRV or GATER anywhere in the source tables. The stratagem list is incomplete without them.
- **A smart roll-the-dice generator in the builder.** Roll a build that is deliberately not just the top rated item in every slot, plus playstyle options to steer it. Wanted, and explicitly parked: it needs the coverage logic to be much better first. **This is not the auto-calibration that was declined.** That was a live picker that re-adjusted your other slots as you chose. This is a deliberate roll you ask for.
- **The 39 curated builds get binned and a new set built from scratch.** The curator's call, 22 August 2026, and it supersedes both earlier plans: not authored by hand one at a time, and not merely moved out of the default view into Exchange. They are legacy AI generations from before this project had stats or scoring, and the numbers say so: 35 of 39 use an S or S+ primary, 13 distinct primaries appear across all of them, the Grenade Pistol is in 16, and three A tier marksman rifles for bots appear zero times. The replacement is a separate tool that reads this project's data plus a logic document and writes `loadouts.json`, with variety as a hard constraint. **Phase 5 built most of what it needs**: `readBuild` is the validator and `check-builds.mjs` already generates and scores 300 legal builds. See `dilas-roadmap.md`.
- **A bug and feature request form on Support.** Needs somewhere for a submission to go, so it waits on the same shared storage that accounts need. The footer no longer claims no data leaves your browser, so this is unblocked on the copy side.

---

# **Open Threads**

- **Resolved in 1.23.0:** the 19 stale flags came off when u.gg's votes came to postdate the changes. The Anti-Tank Mines, flagged as the rating most likely to move, did not; neither did the Constitution, whose note said "Expect this D/D/D to move". Three of the four Castellan's Creed items are rated now.
- **The P/40-K Bolt Pistol is the one unrated item** and renders as `?` until u.gg lists it.
- **The P-33 Missile Pistol keeps a 6.3.1 rating** because u.gg dropped it from the secondary list while it stayed in the game. Restamp it the day it reappears.
- **Three calls in the 1.23.0 items are inferences, not sourced.** The LAS-12 Sai is recorded as Superstore from the icon u.gg shows beside it. The P-34 Breacher's damage type is `fire`, and it carries anti-armor from its AP 7 but no objective role, pending its demolition figure. The six unstamped u.gg lists are read as 7.1.0, for the reason in the patch stamp block above. Correct any of them the moment a source says otherwise.
- **The TD-110 Maelstrom has no wiki data**, so re-run `npm run wiki -- --refresh` after the wiki catches up. **The G-8 Immolation has no armor penetration or demolition of its own**, so its row shows no AP. The wiki's entry for it reads AP 0 with a fire status, which looks like the burn rather than the grenade, and was deliberately not copied into `stats.ap`. Fill it when a source states it.
- **Twelve items and one warbond have no art**: the eleven added in 1.23.0, Electrical Conduit, and the Ironclad Democracy cover. The curator adds art; see Art.
- **`helldivers-2_tables.md` is behind the data now.** It has none of the eleven 1.23.0 items and still carries the 6.3.1 ratings. The repo is correct; the source document is the one to update, and that is the curator's call.
- **True Grit is in no curated loadout.** It is S+ on all three fronts and gives +30% support weapon reload, which is large on the Autocannon, Recoilless and Grenade Launcher builds. Swapping it in is an obvious improvement, but the curated set is his, so it was left alone pending his call.
- Where credible sources disagree by a full tier, for example the SG-8 Punisher Plasma at S+/S/S+ on u.gg against B/B/B on GamesRadar, the UI currently shows only one of them. Averaging it away would lose the most useful signal in the data.
