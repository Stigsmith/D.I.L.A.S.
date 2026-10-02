# **D.D.S.: Roadmap**

> What is agreed but not built, what is blocked and on what, and the questions that must be answered rather than guessed when each session opens. Decisions that affect how the code works live in `CLAUDE.md`; this file is what comes next. The tool is now called Democracy Deployment System, D.D.S., a working title.

---

## The dependency chain

> [!danger] Accounts, Exchange and live squad are not three independent features
> They have an ordering dependency and building them out of order means building the same plumbing twice.

Everything below rests on one primitive: **data living somewhere that is not one browser, plus identity to say whose it is.** Today every lock, favorite, profile and build sits in `localStorage`, which is scoped to one browser on one machine. That is why a second player has to set the tool up again from scratch on their own device.

> [!success] Settled 25 September 2026: Cloudflare, and the plan is `dds-cloudflare-handover.md`
> Enodia, stigly's Hades II tool, built every stage of this chain first on the same Cloudflare account. The handover in the repo root is the port plan, stage by stage, with the pitfalls it cost. **Its decisions table is settled and is not reopened here**: Cloudflare Workers, its own D1, Resend for mail, its own domain.
>
> | Stage | | Status |
> |---|---|---|
> | 0 | Hosting on Cloudflare, security headers, fonts vendored | **Done, 1.21.0.** Live at `dds.stigly-official.workers.dev` |
> | 1 | Worker, D1 and accounts | **Built, 1.22.0, and switched off in the UI.** The backend is live; nobody can see it until `ACCOUNTS_LIVE` flips |
> | 2 | Mail and password reset | **Blocked on the domain.** Resend only sends from a domain you own. `dds.me` was taken. Accounts stay shut until this works |
> | 3 | Sync between devices | Needs the profiles question answered |
> | 4 | Publishing and short links | |
> | 5 | Exchange, friends, leaderboards | Needs "what is a run and what is a clear" answered. **Friends split off and wait on accounts opening**, which waits on the domain |
> | 6 | Live war state | **Built, 1.25.0, 30 September 2026, not yet deployed.** A Cron Trigger every five minutes, a snapshot in D1, the map coloured from it. See `CLAUDE.md`, The Galaxy Map |
> | 7 | Live squad | **Built, 1.25.0, 29 September 2026, not yet deployed.** A party by code, no account. See `CLAUDE.md`, The Live Party |
>
> **Netlify stays the address people use until the domain is bought**, because each move of address empties everybody's collection and `workers.dev` to the domain would be a second move. See `CLAUDE.md`, Hosting.

> [!success] Decided 27 September 2026: a party by code first, friends once accounts open
> The curator asked for accounts and friends "so that we can get the drop bay working". Three calls came out of it, all his:
>
> | Question | Answer |
> |---|---|
> | **How do people join a squad** | **A party code, no account.** One person opens a party and shares a short code; the others type it in. Accounts cannot open before Stage 2, Stage 2 needs the domain, and the domain is not bought, so a squad that needed accounts would stay offline until all three happened. A code needs only the Worker, which is live. **Friends layer on top later** as "invite from your list" instead of reading a code out, and nothing built for codes is thrown away |
> | **What an unconfirmed slot shows** | **"Still deciding", and nothing else.** The squad checks count confirmed loadouts only, so a half picked kit never sets off a false alarm. Closes the open question in "Party auto-fill on the compare slots" |
> | **The galaxy map** | **After the party works.** The drop screen uses the scenario screen that already exists for choosing a planet, so nothing is built twice; the map replaces that picker later. This reverses "Order, revised" below, which pulled the map into Phase 6a, for the reason that a working squad arrives sooner |
>
> **Verified before recommending it:** Durable Objects run on the Workers Free plan, SQLite backed only, with 100,000 requests and 13,000 GB-s a day, and incoming WebSocket messages billed at 20 to 1. The hibernation API keeps an idle party from costing duration. Read off `developers.cloudflare.com/durable-objects/platform/pricing` and `/limits` on 27 September 2026.
>
> **The catch, and it is the domain again.** The server exists only at the `workers.dev` address, never on Netlify, so a party works there and nowhere else. Using it means importing your collection there, then once more when the domain arrives. Buying the domain soon makes that one move.

**Recommended order:**

1. **Auth and shared storage.** The only genuinely new infrastructure. Cloudflare D1, decided 25 September 2026, and it needs no server of its own to run.
2. **Exchange.** Write a document, fetch it by id. This is a subset of what live squad needs, so it doubles as the share mechanism for the storage half.
3. **Live squad compare.** Needs subscribe and push, which publishing a loadout never does. Budget the realtime layer separately rather than expecting Exchange to hand it over.

> [!success] The warning engine is already built and does not block on any of this
> `src/lib/squad.js` runs nine checks over two to four builds and is a pure function over a list of loadouts. It does not care whether a slot was filled by hand or by a connected party member. When live squad lands, the engine is already there.

---

## Where v2 and v3 stand against the phased plan

> [!info] Written 20 August 2026, at the end of the overhaul session
> Two roadmaps now exist: the release labels in the sidebar, `v2` and `v3`, and the phases in the contextual scoring plan. They are not competing. They are **two tracks that only touch at the end.**

### The two tracks

| | What it is | Needs |
|---|---|---|
| **Phases 0 to 5** | Making the tool smarter about one player's decision | Nothing new. No server, no account, no network call at runtime |
| **v2 and v3** | Making the tool social | Auth and shared storage, in the order at the top of this file |

Everything shipped in 1.3.0 through 1.9.0 sits in the first track. **None of it moved the second track forward, and none of it was blocked by it.** That is why the overhaul could run to completion without touching the dependency chain.

### What changed about v2 and v3

| Item | Label | Status after the overhaul |
|---|---|---|
| **Auth and shared storage** | v2 | **Unchanged.** Still the only genuinely new infrastructure, still first in its own chain, still nothing else can land before it |
| **Exchange** | v3 | **Dependency unchanged, contents now defined.** It is today's Drop Bay grid, plus the 39 curated builds, plus other people's. And its practical prerequisite is met: **Phase 5 loadout scoring landed in 1.20.0**, so an Exchange full of strangers' builds now has a number to rank and filter on. `byReading` in `build.js` is that sort, exported and unused |
| **Squad** | v2 | **Split in two, and the local half was already built.** `squad.js` runs over a list of builds and does not care where they came from, so nothing about it waited on Phase 5. The live party half still needs the chain |
| **Profiles** | shipped | **Unchanged.** Still separate from accounts, still possibly redundant once accounts exist. See the section above |
| **Account page, login art** | v2 | **Unchanged.** Behind auth, as it always was |
| **Monetised theme packs** | was aspirational | **Dead.** Two independent blockers: extracted game art, and the wiki data being CC BY-NC-SA, which forbids commercial use outright |

### Where the tracks meet

**Phase 6.** Drop Bay becomes the pre-drop screen and the grid it is today becomes Exchange. That phase is the handover point:

- The Drop Bay half works **locally, for one player**, with no infrastructure. It can be built at any time.
- The Exchange half **cannot ship until v3**, because there is nowhere for other people's builds to live.
- So Phase 6 splits: build the drop screen when Phase 5 lands, and let Exchange inherit the grid whenever storage arrives. **Phase 5 landed on 22 August 2026, so the drop screen is unblocked and Exchange is not.**

### The order that now makes sense

1. ~~**Phase 2.5**, enemy armour~~. **Done, 1.10.0, 21 August 2026.** See below
2. **Phase 4**, the three judgement tags. Small, and it closes the gaps `context-rules.json` currently admits to
3. ~~**Phase 5**, loadout and squad scoring~~. **Done, 1.20.0, 22 August 2026.** See below
4. ~~**Phase 6a**, Drop Bay becomes the drop screen. Local, no infrastructure~~. **Done, 1.24.0, 27 September 2026**, without the map. See "What Drop Bay turns into"
5. ~~**Live party by code.**~~ **Built, 1.25.0, 29 September 2026**, waiting on a deploy. Moved ahead of accounts because it needs the Worker and no account
6. **v2**, accounts open once the domain and password reset exist, and friends come with them
7. **v3**, Exchange inherits the grid

### Phase 2.5 as built

> [!success] It was one pull, and it carried more than the spike expected
> The spike scoped this as armor values off roughly forty enemy pages. The anatomy tables carry **health and durable share per body part as well**, and the wiki's own API returns raw wikitext for 50 titles at a time, so the whole set is two requests rather than sixty.

| | |
|---|---|
| Enemies | **80**, 594 body parts |
| Baseline | 54, being 22 Automaton, 21 Terminid and 11 Illuminate |
| Held back as variants | 26, across seven galactic effects |
| Rules that read armour | **0.** Five shipped, all five came out. See below |
| Say which difficulty they start at | 78 of 80 |

> [!success] Vote Snatchers was missed on the first pass and corrected on 21 August
> The curator's own play experience flagged it: Crushers and Wretches on difficulty 8 in the Void, on a planet where "every horrible effect applies half the time". The wiki confirms it and it is the strongest case of the seven. The other six **add** enemies to a front; Vote Snatchers **replaces** them, swapping out Overseers, Harvesters, Watchers and Stingrays. Counting all of them together described an Illuminate front that never exists.

> [!success] Difficulty scoping landed with it, 1.11.0
> A Factory Strider is difficulty 4 and up. Counting one against a Challenging drop is warning about the wrong thing, and until now every reading was a Super Helldive statement no matter where you said you were going.
>
> `min_difficulty` was already sitting in the enemy infoboxes on pages the first pass had fetched and cached. It just was not read. Cross checked against the wiki's own Difficulty table on 52 enemies: **51 agree**, and the one that does not is the Stingray, whose infobox is blank while the table has it at 4. That value is now a one line override.
>
> The reachable roster: **33 of 54 at difficulty 3, 46 at 5, 50 at 7, all 54 at 10.**

**The rule is the game's own**, from the wiki's Damage page: above the armor value is full damage, exactly equal is 65%, below it is a ricochet for nothing. That middle case is why the squad threshold survives re-measurement. A Devastator is AV 3, so AP 3 only ties one and AP 4 is the first clean answer.

**The variants are fetched and flagged, not dropped.** Predator, Rupture and Spore Burst Strain, Jet Brigade, Incineration Corps and Cyborg Legion each carry their own wiki category, so the exclusion is a membership test rather than a list of name prefixes. They sit in `enemies.json` waiting for the live war state layer to say which effect is running, at which point switching them on is a filter and not another pull. **That is the first thing in this project built specifically for the live layer to turn on.**

> [!warning] One gap is admitted rather than modelled
> The source does not record which body parts are exposed from the start. A Charger's inner flesh is AV 1 and you only reach it once the leg armor is off. So a weak point means one exists, not that you can hit it on approach, and the row says so.

> [!failure] The five scoring rules came straight back out, 1.13.0
> The curator found it within minutes of the feature shipping: **51 of 52 primaries were being downgraded for not opening armour they were never meant to open.** He is right, and the measurement is worse than his estimate. On the Automaton front 42 of 51 primaries lost a tier, and 48 of those 51 share one of two **identical** armour readings. Only the Eruptor, the Double-Edge Sickle and the Torcher differ.
>
> **A rule that fires the same way on 94% of a population is describing the pool, not the item.** And it was double charging: a community tier already prices in what an item is for, so the Liberator's B on bots is a B given that it is a chaff gun.
>
> His second argument is the one that settles the direction. Even the item that **is** good at armour is not straightforwardly better: bring the Eruptor on bugs and you have to bring a Stalwart to cover chaff. Per item scoring cannot see that trade. **Armour is a loadout property**, and `src/lib/squad.js` already had it right, asking whether anyone in the squad carries AP 4 or better rather than judging each weapon alone.
>
> **What was kept.** All of it, as a fact. Every expanded row still says exactly what your penetration opens and bounces off, with the difficulty scoping that makes it true, and it says plainly that it does not move the rating. `src/lib/enemies.js` computes the whole thing and `score.js` keeps `armour` as a reach root. Only the five rules went.

> [!tip] `npm run rules` exists because of this
> A health check over every scoring rule: the pool it can fire on, how much of that pool it hits, and how often it moves a tier. Anything firing on 60% or more gets flagged, which is the shape the armour rules had. All 31 remaining rules pass, the loudest being ion storms at 41% and that one is correct.
>
> **Run it after adding a rule.** The armour bug was visible in one line of output and shipped anyway because nothing was looking.

### Phase 5 as built

> [!success] Loadout scoring shipped, 1.20.0, 22 August 2026
> `src/lib/build.js`, 9 rules in `src/data/build-rules.json`, `npm run builds`. The full write up is in `CLAUDE.md` under The Loadout Reading; this is what it means for the plan.

| | |
|---|---|
| Rules | **9**, all discriminating against 300 random builds, loudest at 39% |
| Written, measured and cut before shipping | **2** |
| Rules that read armour | **1**, and it is the one this phase existed to get right |
| Surfaces | The Drop Bay card and the Builder, live on every edit |
| Squad half | **Was already built.** `squad.js` never depended on this |

**Armour came back and it works this time.** The 1.13.0 post mortem said it would return as a loadout property and it has. The measurement that settles it: held penetration splits the 39 curated builds **36 / 41 / 23** three ways, where the per item version had 48 of 51 primaries sharing one of two identical readings. Same data, different altitude, opposite result.

> [!danger] The 39 curated builds are no longer the denominator, and that was the curator's call
> Asked whether the layer should be softened because it mostly marks the curated set down, his answer on 22 August 2026 was that **the curated sets are legacy AI generations, and using DDS tiering and warnings would likely net better builds**. So they are not ground truth and nothing is calibrated against them.
>
> `npm run builds` now measures every rule against **300 random legal builds** as well, 100 per front, seeded. That change immediately paid for itself: two rules that looked healthy against the curated 39 were describing the pool against a random sample, and both were cut before they shipped rather than after somebody noticed in the app.

> [!warning] Three things Phase 5 did not do, and none of them were meant to be
> - **The wider warning set.** Still a separate non code design session, still the section below. The nine existing squad checks are unchanged.
> - **Ranking Drop Bay.** The score exists and `byReading` is exported, but Drop Bay is still a plain grid by explicit earlier decision. Turning it into a ranked list is a product call nobody has made.
> - **Reading one build and the squad together.** `readBuild` judges a loadout and `squad.js` judges the combination, and neither knows the other ran. A build thin on armour is not thin if the other three brought Recoilless rifles. **There is nowhere both readings appear together until the drop screen exists**, which makes this a Phase 6a job rather than an omission here.

> [!tip] The generator got closer without anyone building it
> This file already said it: a coverage engine over one loadout is a build validator, and a validator plus a search over the item pool is a generator. `readBuild` is that validator, and `check-builds.mjs` already generates 300 random legal builds and scores every one of them. **The roll the dice generator is now a sort over code that exists** rather than a thing to write from scratch.

**The starmap is part of step 4, not a later phase.** It is the drop screen's entry point: you click the planet where you clicked it in the game and the scenario fills itself. It draws from shipped data and needs no network call. The live colouring layer is optional, needs no account, and can arrive whenever. See the section below.

> [!tip] The useful property to protect
> Nothing in phases 0 to 6a needs a network call at runtime. The planet table, the weapon stats and the mission list are all fetched once by a script and shipped as JSON. Keeping that true for as long as possible is what lets the whole first track ship without ever standing up a server.

### One loose end from this session

Drop Bay still filters on the five original internal mission ids while the scenario now carries seventy real mission names. Neither is broken and they do not read each other, but they should become one thing when Drop Bay is rebuilt in Phase 6a.

---

## Surfaces and flows, and why that is not a choice

> [!success] Settled 21 August 2026. This is the answer to the question that keeps coming back
> The recurring worry is a fork: does the tool have **separate screens** you visit, or **one Drop Bay flow** with everything folded into it. Map, tier list, builder, exchange, squad. It reads like a choice and it is not.
>
> **Every component stands alone and embeds. The scenario is the wire between them.**

The tool already does this in two places and neither was hard:

- The tier row is a surface **and** the picker inside the builder. `CLAUDE.md`: *"The picker in the builder reuses the same row but selects instead of expanding."*
- The front is one control that lives in two places and means one thing. *"Choosing a war in one place is choosing it in the other."*

So the answer to "should the tier list have a difficulty slider, or should difficulty come from the drop flow" is **both, and it is the same control.** Set it on the tier list while everyone is offline and you are pre building. Set it by clicking a planet thirty seconds before you drop. One value, one object, every surface reading it.

| Component | On its own | Embedded in the drop flow |
|---|---|---|
| **Tier list** | Browse and compare, no drop planned | The picker when you tap a slot |
| **Builder** | Author builds while friends are offline | Adjust a loadout in place, save as new |
| **Map** | Its own surface, with history behind it | The front door, one click fills the scenario |
| **Exchange** | Browse everyone's builds | Load a squadmate's build into your slot |
| **Social** | Friends and LFG | A panel, without leaving the flow |

> [!tip] The test to apply to anything new
> Build the component so it works alone, then compose it. A thing that only exists inside Drop Bay cannot be pre used, and a thing that cannot be embedded forces you out of the flow at the worst moment. Anything failing either half is not finished.

### Three things this framing adds

Raised by the curator on 21 August 2026, none of them previously written down.

1. **The map as its own surface**, not only Drop Bay's front door. **Built as the Star Map, 2 October 2026**, with the tool's own hourly history; see `CLAUDE.md`, The Galaxy Map. Same component, but reachable directly, with **historical data** behind it: what this planet has been, who has held it, what has run here. The drop flow wants the map to be fast and one click; a standalone map can afford depth the flow would not want in the way.
2. **A social surface.** Friends list and **LFG**, reachable on its own and as a panel inside the drop flow. **Since 1 October 2026 it lives behind the party menu in the header's top right**, the curator's placement, rather than under a sidebar entry; the locked Squad entry was removed that day. It sat under the sidebar entry currently labelled Squad. Behind the auth and shared storage step like everything social, but the surface itself should be designed as a component from the start so it can appear in both places.
3. **Saving a squadmate's build straight from the squad screen.** You see what someone is running, you keep it. Distinct from Exchange, which is browsing a library: this is grabbing the thing in front of you. Needs the same shared storage, and it wants Exchange's write path rather than a second one.

---

## Drop Bay becomes the drop screen, and the grid becomes Exchange

> [!info] Decided 20 August 2026. This supersedes the party auto-fill section above, which described bolting party state onto the grid Drop Bay has now
> Drop Bay is currently a browser: a grid of every build, with the squad panel sitting on top of it. Those are two different jobs and only one of them belongs on the screen you look at in the thirty seconds before you drop.

**The split:**

| Surface | Job |
|---|---|
| **Drop Bay** | The moment before the drop. Who is bringing what, where you are going, what is going to hurt |
| **Exchange** | Browsing builds. Roughly what Drop Bay looks like today, plus other people's |

### What Drop Bay turns into

A staging screen with two stages, because picking a loadout and reading the squad are different activities and doing both in one view is what makes the current screen busy.

**Stage one, the main screen.** Everything about the drop, nothing about choosing:

- The scenario across the top: planet, biome and hazards, faction, mission, difficulty
- One slot per squad member, each showing that member's confirmed gear
- Squad level warnings and coverage, which is what `src/lib/squad.js` already produces
- Mission information and tips for the team, keyed to the selected mission
- A sense of what other people are taking on this planet or this mission

**Stage two, choosing.** Tapping your own slot opens a picker over the screen, the same pattern the builder already uses. You choose, you **confirm**, and the loadout is **locked into your slot** on the main screen.

> [!tip] The confirm step is the point, not ceremony
> A slot that silently reflects whatever you last touched cannot tell the difference between "still deciding" and "this is what I am dropping with". The squad warnings are only worth reading once the answer is the second one. Confirm is what makes a slot mean something to the other three people looking at it.

> [!success] Built, 1.24.0, 27 September 2026. Local, and without the map
> `src/DropScreen.jsx` is Drop Bay's first tab and the grid is its second, **Builds**, until Exchange takes it. What landed against the list above:
>
> | Planned | As built |
> |---|---|
> | The scenario across the top | The scenario bar the tier list already carries, plus a **brief**: what the mission asks for and what each planet hazard does, both from tables the tool already ships |
> | One slot per member, confirmed gear | Four slots. Yours is chosen, then **confirmed**; confirming stamps the build, and editing it afterwards drops you back to still deciding. The other three are **filled by hand** until the party fills them. **Hand filling went on 2 October 2026**, the curator's call: nobody rebuilds three other people's loadouts in the thirty seconds before a drop. Outside a party Drop Bay is you alone |
> | Squad warnings and coverage | `squad.js`, unchanged, over **confirmed loadouts and hand filled slots only** |
> | Mission information and tips | The mission's own lines. No invented tips |
> | What other people are taking here | **Not built.** It needs data from other people, so it waits on Exchange |
>
> **The picker keeps both hard gates.** A hot planet removes builds that vent heat and a difficulty band removes builds declaring another, read off the scenario rather than off a second set of filters, and it says in one line how many each gate took out. A slot already holding a build the scenario would now refuse **keeps it and says why**, because it is still what somebody chose.
>
> **The grid lost its comparison.** The sticky squad panel over the grid is gone; a squad member's slot is the comparison now, which is what "What this changes about the earlier sections" said would happen. The grid's own biome, mission and difficulty filters are untouched and still local, because the grid is on its way to becoming Exchange and those filters describe builds rather than a drop.

### What Exchange turns into

Today's Drop Bay, kept: the grid, the cards, the filters, the favourites. `LoadoutCard` and the filter controls move rather than being rebuilt.

**The 39 curated builds move here.** They are legacy generations made before this project had stats or scoring behind it, and the measured evidence agrees: 35 of 39 use an S or S+ primary, 13 distinct primaries appear across all of them, and three A tier marksman rifles for bots appear zero times. They are a starting point to browse, not a default view worth putting in front of a new player.

> [!warning] They cannot actually move until Exchange exists, and Exchange needs shared storage
> Exchange sits behind auth and a shared store in the dependency chain at the top of this file. Until then the presets have nowhere to go, so the interim question is only how prominent they are in Drop Bay, not whether they are there.

### What this changes about the earlier sections

- **Party auto-fill** stops being a feature bolted onto compare slots. A squad member's slot on the drop screen *is* the compare slot, so the auto-fill question becomes the natural behaviour of the screen rather than an addition to it. The open question about what an unpicked slot shows is answered by the confirm step: an unconfirmed slot reads as still deciding.
- **The curated builds** were scoped as "author better ones", then as "get them out of the default view". **Both are dead as of 22 August 2026: they get binned and a new set is built from scratch.** So Exchange inherits the grid and whatever the new set turns out to be, and the question of where to put 39 builds nobody wants in front of a new player stops needing an answer.
- **The squad panel** stops being a sticky bar above a grid and becomes the screen. That is a better home for it than the one it has.

---

## Drop Bay is the front door, and the tier list leaves the menu

> [!success] Decided and built, 1 October 2026. The curator's call
> The tool now follows the game's two places. **The Armoury** is where builds are made and kept: the game's armoury plus what the game lacks, a build saved, named and kept with its stratagems, so you never redo it or try to remember it. **Drop Bay** is the drop screen, the page the tool opens on. The tier list leaves the menu and lives on **as the picker inside every build**, already ranked for where you are dropping, and whole at `#/tiers` for anyone who prefers it. This reverses his own first locked decision, "tier browsing is the primary tool", and he made the reversal knowingly.

**The value proposition, in his words**, is what every piece here answers to: repeatability (build once, reuse forever, never memorise seventy builds), seeing what you actually have for each occasion, being reminded of combinations you forgot, and a rating that knows a community S is not an S in every situation.

| Built | |
|---|---|
| **Suggestions** | Three of your builds for this drop, ranked by the reading, each saying why. The ranking decision this file and CLAUDE.md had left open is made |
| **The editor over the drop** | Adjust a build without leaving Drop Bay; saving puts it in your slot. With no builds yet, your slot opens the editor straight onto the ranked primary list |
| **How many of you** | Seats on the drop screen for a day, then **one setting beside difficulty in the war room**, 2 October 2026, with the hand filled squadmates gone. Kept because solo and four of you rate gear differently; in a party the party counts |
| **Drop history** | Every Confirm recorded, exported, taken back by a change of mind within fifteen minutes |
| **Coverage** | The Armoury answers "do I have something for each occasion", fifteen situations per front |
| **The Rules page** | Every rule, what it moves here, and a switch to turn it off. His idea: an overview, and a way to see what each rule does to the list |
| **Share links** | A build in the link itself. No server, so it works on every address |
| **Commando missions** | Automaton only, a ninth mission trait, eight rules from the wiki's mechanics and his reading of them |

### What comes next on this track

- **History into nudges: the first two are built.** A fourth suggestion marked "for a change", and gear that is good here that you have never brought against this front, both silent below five drops on a front. Still to come: how your drops spread across fronts and missions, and a nudge in the Armoury for builds that have gathered dust.
- **More scenario rules, from the curator's play.** Commando is the pattern: he describes a situation, the mechanics get sourced, the judgement is recorded as his. The Rules page is where he checks what each one did.
- **Things the game refuses.** A reinforcement booster on a Commando mission reads B, because two tiers is the most a scenario may move anything. A ceiling would make it D, and a ceiling is a change of principle, so it waits for him.
- **Switched off rules and the export.** Left out of the export for now. If he wants his tuned rule set to survive the address moves, it goes in.
- **Shared builds on Exchange.** A share link is the no-server half of Exchange: the same build, passed by hand. Exchange is the browsable half and still waits on the server.

---

## The live starmap, and when a runtime API call is justified

> [!success] Revised 20 August 2026. The map is the entry to the drop screen, not a feature bolted beside it
> The curator's framing, and it is better than the one this section held first: **you open Drop Bay onto the galaxy map, click the planet in the same place you clicked it in the game less than a minute ago, and the whole scenario fills itself.** Faction, biome, hazards, and eventually the live effects. One click instead of four dropdowns.
>
> The reasoning is spatial recall. Finding a planet again in the same shape of map is instant. Finding it in an alphabetical list of 281 is not, and it is a worse experience than the one the game already gave you.

### Two different things get called "keeping it up to date"

Deciding this once, in writing, is what stops the tool acquiring a network dependency by accident.

| | What it is | How it should be fetched |
|---|---|---|
| **Patch data** | Weapon stats, biomes, hazards, missions, tiers, **and planet map positions** | **Build time, never runtime.** A runtime call buys the same data and adds latency, an outage risk and CORS |
| **Live war state** | Who currently holds a planet, liberation, active campaigns, the Major Order, and active planet effects such as Gloom, the Predator and Incineration strains, and the Hulk, Devastator and Factory Strider surges | **Runtime, or not at all.** It changes hour to hour and cannot be a shipped table |

> [!success] Map positions are patch data, which is what makes the whole idea work
> **Shipped on 20 August 2026.** `api.helldivers2.dev/api/v1/planets` returns all 281 planets, matching our table exactly, with a normalised `position` of x and y in roughly -1 to 1, Super Earth at the origin, plus `waypoints`, which are the supply lines between them. It wants `X-Super-Client` and `X-Super-Contact` headers and refuses the request without them.
>
> A planet does not move, so this is patch data. `npm run wiki` fetches it at build time and discards the live half of the response. **274 of 281 planets now carry coordinates and 339 supply lines are recorded**, all shipped, no runtime call.
>
> That means **the map is static first**. It draws, pans, and fills the scenario with no network call at all. The live API only ever colours in who currently holds what.

### The rule to build it under

> [!danger] The API decorates, it never carries
> The **shipped table is the source of truth for identity and layout**: planet names, sectors, biomes, permanent hazards, and where each planet sits on the map.
>
> The API adds ownership, active campaigns and current effects on top. If it is unreachable you lose the colouring, not the map, not the picker, and not your scenario. No spinner on the critical path.
>
> **Never ship ownership.** It rotates, and a stale territory map is worse than an uncoloured one.

### What live state adds once it is there

- Only offering planets with an **active campaign**, since those are the only ones you can actually drop on
- Faction filled exactly from who holds the planet, rather than guessed from the territory
- **Active planet effects feeding the scoring engine**, which is the real prize: 156 are published, including the enemy surges and strains that genuinely change what you should bring
- The Major Order as context

### The look: a data visualisation, not a recreation

The Companion site recreates the in-game holo table and lands in the uncanny valley. This tool should not compete on that.

- Faction territory tinted with the **locked faction hexes**, the same values every badge and card already uses
- Sectors as labelled groups, since a sector is how people talk about the map
- Supply lines as plain edges
- **No scanlines, no CRT curvature, no holographic glow.** The ambient layer already carries per theme atmosphere and it sits behind the content, where a texture belongs

The game's interface is designed to look like military hardware. A planning tool is designed to be read. The map should match the game's **layout**, because that is what makes the click instant, and not its **styling**, because that is what makes it unreadable.

> [!success] Reversed at the curator's request, 30 September 2026: a second skin that looks like the game
> He asked for "a separate skin for the galaxy map resembling the actual one, with the zones and the effects", with screenshots of the game's Galactic War screen. So the chart above stays, and **a Galactic War table sits beside it as a switch**: polar sector zones hatched in the holder's colour, the rim with the fronts' names, spheres, reticles and liberation bars. Built in 1.25.0; `CLAUDE.md`, The Galaxy Map, has the detail.
>
> **Replaced the same day, at his request.** A half copy of the game's screen was neither the game nor clearly the tool, so the table went and a **Tactical** look took its place: blocks glowing in the holder's colour, a radar sweep, and the game's own planet renders inside a sector, with the game's two level navigation, galaxy then sector. The chart stays as the other look. `CLAUDE.md`, The Galaxy Map, has the detail.
>
> **Two gaps, both still true.** The game's sector shapes are not published, so the zones are built from where the planets are. And the effects he mentioned, the Gloom's yellow cloud above all, need the same live planet effects nothing reliable publishes yet: see "Planet effects have no steady source yet" below. The day that source exists, the Tactical look is where they get drawn.

### Order, revised

The map moves **out of Phase 7 and into Phase 6a**, alongside the drop screen, because it is that screen's entry point rather than a later addition. Building a planet dropdown, then a drop screen, then replacing the dropdown with a map is doing the work twice.

> [!warning] Moved again, 27 September 2026: after the live party
> The curator's call. No planet dropdown was built for the drop screen: it uses the scenario screen that already existed, so the double work this paragraph warns about does not happen. The map replaces that picker once the party works.

> [!success] Built, 1.25.0, 29 and 30 September 2026, with the live layer, not yet deployed
> The map replaced the planet list on the scenario screen, and Drop Bay opened onto it while nothing said where you were dropping. **Since 2 October 2026 the scenario screen is the war room**, the map across everything right of the menu with the planner, the Major Order and difficulty laid over it, and the only place the map appears; Drop Bay sends you there. `CLAUDE.md`, The Galaxy Map, "The war room". The live layer came in the same version: who holds each planet in the faction hexes, the fronts ringed and named, and **choosing a planet with fighting on it sets the front**. See `CLAUDE.md`, The Galaxy Map.
>
> | "What live state adds" | As built |
> |---|---|
> | Only offering planets with an active campaign | **Emphasised, not enforced.** Fronts are larger, ringed, named and first in search; every planet stays choosable, for pre building while nobody is online. One filter away if the curator wants the rest hidden |
> | Faction filled from who holds the planet | **Done.** The attacker in a defence, otherwise the owner. A quiet planet leaves the front alone |
> | Active planet effects feeding the scoring engine | **Not yet.** The real prize, and the next step: the variant enemies in `enemies.json` are waiting for it |
> | The Major Order as context | **Done.** Over the war room's map: briefing, time left, a bar per task in its front's colour, and what it pays, read as medals from one real answer. The war's running totals sit under it since 2 October 2026 |

> [!success] Decided 30 September 2026: a drop planner beside the map
> The curator's idea: "where would you like to play? Against what faction, what mission archetype, what kind of planet, no caves, less megacities, go do this planet and it marks the map." Built in 1.25.0. His three calls:
>
> | Question | Answer |
> |---|---|
> | **What happens to the three faction banners** | **They become the planner's first question.** Choosing a front first had become the long way round once the map could set it, but a front with no planet still has to be choosable, and it is the only way when the live war is not here |
> | **Fewer megacities: hide or push down** | **Push down.** A megacity planet comes after every planet without one. No caves, by contrast, hides the Hive Worlds, as he put it |
> | **Which fit is "go here"** | **Busiest first.** The Major Order and closeness to liberation were the alternatives |
>
> A mission kind narrows the mission list rather than the planets, because the data knows which fronts offer which missions and not which planets do. **If per planet mission lists ever turn up in a source, that is the next thing the planner should read.**

> [!warning] Planet effects have no steady source yet. Measured 30 September 2026
> `api.helldivers2.dev`'s tidy endpoints, v1 and v2, carry no active planet effects, and its OpenAPI spec has no field for them. Only the raw pass-through to the game, `/raw/api/WarSeason/801/Status`, holds `planetActiveEffects`, and it answered **503 after 35 seconds**, and timed out twice at 30, while the tidy endpoints answered in under a tenth of a second. Note also the war number, 801, fixed in the path.
>
> **Retried 2 October 2026, and it answered at once**: 48 KB, with `planetActiveEffects` holding 120 entries, each a planet index and a `galacticEffectId`. One good day is not a steady source, and nothing was built on it; it is the first sign the hard half below may be gettable.
>
> **The definitions are the easy half**: `effects/planetEffects.json` in `helldivers-2/json`, 34 KB of names and descriptions keyed by effect id, patch data to ship like the planet table. **Which are active where is the hard half.** Before building: retry the raw status on a better day, look at DiveHarder again (the data spike could not resolve its host), and check whether the tidy API has grown a field. Then the scoring half is the curator's call with measurements in front of him, because it re-ranks lists.
> | The map as its own surface, with history | **Built, 2 October 2026: the Star Map**, in the menu. The fronts, a planet's intel, Drop here, and a history the tool keeps itself, hourly for thirty days from the day the server first runs, since nobody publishes one. "What has run here", the missions played on a planet, has no source and is not built |

The live layer stays optional and can arrive whenever. It needs no account, so it is independent of v2.

> [!success] The training manual is out of this project entirely
> It was the last thing still depending on a source already caught being twelve planets behind. `api.helldivers2.dev` is the same organisation as the JSON dataset, returns exactly our 281, and carries supply lines the training manual never had. The join is by name rather than by index, because two sources agreeing on an order is not something to bet a map on.
>
> **Seven planets have no coordinates**, all of them Void content whose names carry a suffix the API does not use: Hydrobius (Void), Senge 23 (Void), and the five UVP entries. Edge cases in live Major Order content, worth a look when the map is built.

> [!info] The second source closed an open question
> The spike recorded that biome and hazard accuracy per planet was unverified, because nothing else carried biome data to check against. The API does. **Biomes agree on 274 of 276** planets present in both. The two that differ, Sangis and Alderidge Cove, hold each other's biome, which reads as a swap in one source rather than a systematic problem.
>
> Hazards agreed on **none** of them, and that turned out to be the useful finding: the two sources carry different fields and neither is a superset. `weather_effects` holds the temperature, `environmentals` holds the headline condition, and Widow's Harbor is extreme cold in one and meteor storms in the other. They are unioned now, which took hazard assignments from 440 to 544. `normal_temperature` was also being counted as a hazard and is not one.

---

## Accounts before profiles

> [!failure] Profiles solved a smaller problem than assumed
> They were built because the squad requirements treated per member ownership as a hard prerequisite. In practice the second player spent five minutes setting up on his own device and the problem evaporated. A Helldivers collection only ever grows, so a second profile on one machine has no job to do.

**The real need is cross device persistence:** log in elsewhere and your collection is there. That is an accounts feature, not a profiles feature.

> [!question] Does the profile concept get absorbed into accounts
> Recommendation is **no, keep them separate.** A profile is *what one player owns*. An account is *who you are*. One account holding several profiles is the only case that ever justified profiles, planning for someone who is not connected. Making the profile dropdown the account switcher would confuse two different things and delete that case. Profiles can stay unused, or come out of Collection later if they clutter it.

---

## Party auto-fill on the compare slots

Drop Bay's squad compare takes two to four builds and warns on the combination. It is entirely manual and static: picking a build for slot two does not mean anyone is running it, and if a real squadmate changes their loadout the comparison has no way to know.

**The ask:** once party or account state exists, one compare slot auto-fills with whatever the party member currently has selected. Manual selection stays for every slot when not in a party, and for slots beyond the connected member.

> [!success] Fallback behaviour, decided 27 September 2026
> The question was: if you are in a party and the other player has not picked yet, does their slot show empty, a placeholder, or fall back to manual selection? **The curator's answer: "Still deciding", and nothing else.** The squad checks count confirmed loadouts only. Built that way into the local drop screen in 1.24.0, so the party inherits it.

---

## Warning logic, a wider set

The nine checks that exist cover anti-armor, chaff, medium armor penetration, objective, cave terrain, teamkill overlap, duplicate boosters and backpack contention. **More scenarios are wanted, and more varied ones.**

Planned as a **separate non-code session**, because it is a design problem rather than an implementation one. Bring to it:

- What else actually kills a run, beyond the gaps already covered
- Whether range band, engagement distance and ammo economy become tagged axes or stay human judgment
- Whether difficulty should scale thresholds rather than just gate them on or off

> [!tip] The same logic is what makes a build generator possible
> A coverage engine run over one loadout instead of four is a build validator. A validator plus a search over the item pool is a generator. The warning work and the generator work are the same work done twice if they are not planned together.

---

## The curated builds get binned and rebuilt from scratch

> [!bug] The 39 curated builds are tier maximised and it shows
> Measured, not guessed.

| | |
|---|---|
| Primaries using an S or S+ | **35 of 39** |
| Distinct primaries across all 39 | **13 of 52** |
| Distinct secondaries | **6 of 24** |
| Grenade Pistol appearances | 16 of 39 |
| Eruptor appearances | 11 of 39 |
| Bugs: primaries rated A or better, and used | 31 available, **8 used** |
| Bots marksman rifles rated A, and used | 3 available, **0 used** |

The last row is the whole problem in one line. An A tier marksman rifle against bots is a better fit for how some people play than the S+ Coyote, and the current set never offers the trade.

> [!danger] The intent has moved twice, and the current answer is to bin them
> **22 August 2026, the curator: "i think we will bin all the curated ones at some point and make a curated list from scratch."** That supersedes both earlier positions. The 39 are legacy AI generations made before this project had stats or scoring behind it, and they are not being fixed, promoted, demoted or moved. They are being replaced.
>
> The two dead positions, recorded so neither gets picked back up:
>
> | Dropped | Was |
> |---|---|
> | 14 August | "Author 39 better ones by hand" |
> | 20 August | "Leave them and get them out of the default view into Exchange" |
>
> **What this changes about Exchange.** The curated set moving there was the 20 August answer to a set nobody wanted in front of a new player. If they are binned instead, Exchange inherits the grid and whatever the new set turns out to be, and the migration question disappears rather than being solved.

**The plan:** a separate tool or Claude project that reads this project's data plus a logic document and writes `loadouts.json`. Not an in-app feature.

> [!success] Phase 5 built most of the tooling this needs, on 22 August 2026
> This section has always said the generator and the warning engine are the same work done twice if they are not planned together. They were, and here is what already exists:
>
> - **`readBuild` is the validator.** It scores any loadout against a scenario and names every hole, so a candidate build can be judged without a person reading it.
> - **`check-builds.mjs` already generates legal builds and scores them**, 300 of them, seeded and reproducible: every slot filled, no stratagem twice. That loop plus a keep-the-best pass is the generator.
> - **`npm run builds` is the acceptance test for a new set.** Its two columns are random builds against the curated ones, and a good new set should look **less** like a random sample than these 39 do, not more.
>
> What is still missing is the steering: playstyle options, and the variety constraint below expressed as something the search optimises rather than something a person checks afterwards.

> [!warning] The rules cite the 39 by number, and those citations expire with them
> Several `measured` fields in `build-rules.json` are anchored on the curated set: 17 of 39 carry no anti-armor, 3 of 39 carry no chaff, held penetration splits 36 / 41 / 23. **Re-run `npm run builds` and rewrite those citations when the set is replaced.** The random column is unaffected and is the one the coefficients were actually set against, so no rule should need retuning, but a citation that names a set which no longer exists is worse than no citation.

> [!danger] This is not the auto-calibration that was declined
> That was a live picker that re-adjusted your other slots as you chose, and it stays declined. Authoring better curated builds offline and shipping them as data is curation with better tooling.

**Variety has to be a hard constraint, not a hope.** Something like: no item appears in more than N builds, and every item rated A or better on a front appears at least once in that front's set. That one rule alone would have forced the Amendment and the Counter Sniper into the bots set.

---

## Vehicles and mechs: done, 20 August 2026

> [!success] All eight are in, shipped in 1.5.0
> Both blockers this section named are gone. The wiki fetch supplied the source data, and the art was renamed to the prefix convention so the importer attaches it automatically.

| | |
|---|---|
| FRVs | M-102 Gunner, M-103 Supply, M-104 Incinerator |
| Exosuits | EXO-45 Patriot, EXO-49 Emancipator, EXO-51 Lumberer, EXO-55 Breakthrough |
| Tank | TD-220 Bastion MK XVI |

New `stratType` of `vehicle`, in the blue call-in group where the game puts it. One type rather than a mech type and a vehicle type: eight rows split into two filter buckets is worse, not better.

**All eight are unrated**, which is the honest state rather than a gap. No community list covers them, so they carry a dashed badge, sort last, and survive every tier floor, the same treatment the Castellan's Creed weapons get. Armor penetration, demolition force, cooldown and hull values are real and come from the game data.

They also stopped being dead weight in the bundle. The eight images were being filed as unrecognised UI art and shipped anyway; named properly, they attach to their items.

> [!success] Acquisition paths confirmed, and two were wrong
> The curator supplied u.gg's vehicle page the same day. **EXO-51 Lumberer and EXO-55 Breakthrough come from the Exo Experts warbond**, not requisition, so both are warbond gateable. The **M-103 Supply and M-104 Incinerator FRVs are campaign rewards**. The other four are Patriotic Administration Center, which is the requisition path. All eight are rated, stamped 7.0.0.

---

## Smaller items

- **A roll the dice generator in the builder.** A deliberate roll you ask for, that picks something decent without simply taking the top rated item in every slot, plus playstyle options to steer it. Parked until the coverage logic is good enough to make it worth rolling.
- **A bug and feature request form on Support.** Blocked on shared storage, since a submission needs somewhere to go. The footer no longer claims that no data leaves your browser, so the copy no longer contradicts it.
- **Patch notes on About.** Raised as a possibility. The tool changelog now exists and is separate from the game's patch notes; decide whether the game's notes belong in the tool at all.

---

## The rest of the Difficulty page

> [!success] Pulled 2 October 2026, when the war room gave it somewhere to go
> `npm run difficulty` reads the page's table into `src/data/difficulty.json`, and the war room's difficulty bar says one line of it per level: missions in an operation and their medals, outposts and the biggest kind, samples, operation modifiers, and the reward bonus. **It refuses a table that does not read cleanly**, and cross checks four facts the effects list states outright against the table's notes.
>
> **Not read, on purpose:** the enemy columns, which list names in unlabelled paragraphs that skip a front with nothing new, so which front a name belongs to is a guess there and a fact in `enemies.json`; and the structures and objective names, which nothing reads yet. Map size is kept and not shown.

`helldivers.wiki.gg/wiki/Difficulty` carries more than the enemy list: **missions per operation, medal rewards, objective counts, outpost counts and their light, medium, heavy and giant composition, map size, operation modifiers, sample types, and a reward multiplier from 0% to 300%.**

It was left out at first on purpose: **nothing read it.** Outposts and samples describe a mission you are about to run, and until the war room there was no surface with somewhere to put them.

Two pieces of it are worth remembering when that happens. **Operation modifiers start at difficulty 5 and a second one is added at 8**, and the data spike recorded modifiers as being in none of its sources. This page is the source. And **the enemy footnote markers on that table are not explained in what was pasted**, so whatever 1, 2 and 3 mean is still unknown; marker 1 broadly tracks the variant strains but is wider than our exclusion list, so do not assume they are the same thing.

---

## Open questions carried forward

- ~~**Fallback when a party member has not picked.**~~ **Settled 27 September 2026:** the slot reads "Still deciding" and nothing else, and the squad checks ignore it until it is confirmed.
- ~~**Does a party need accounts, or only a code.**~~ **Settled 27 September 2026:** only a code. Friends come later, with accounts.
- ~~**Who sets the scenario in a party.**~~ **Settled 28 September 2026:** the person who opened it, the way the host picks the mission in game, with everyone else's screen following.
- **Do profiles survive accounts.** See above.
- ~~**Does the tier ramp move.**~~ **Settled 21 August 2026, 1.17.0.** Three candidate ramps were in play and the curator picked a fourth: the badge study's palette rotated down one rank, with the brown replaced by a grey. Red at the top cooling to grey at D, so the ladder reads as falling off toward unrated. Both losing sets are out of the code.
- **The accent disagreement.** Several studies paint their signature colour on the lock and the stale chip. `CLAUDE.md` says the accent is never the brand colour, and that rule won. Worth settling if the skins are redrawn.
