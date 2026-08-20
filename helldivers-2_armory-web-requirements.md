# **HD2 Armory Web: Requirements**

> Build spec for the web app rebuild of the Helldivers 2 armory, moving from a single React artifact to a hosted multi-user tool. Written for a fresh Claude Code session picking this up after the port. Covers product framing, data model, information architecture, per-surface requirements, and release sequencing. The artifact's settled decisions are carried forward in the Inherited Decisions section; read that before changing behavior that looks arbitrary.

---

## Read this first

> [!danger] Two rules from the artifact are dead and must not be carried over
> **`window.storage` and the localStorage ban were sandbox constraints, not preferences.** The Claude.ai artifact runtime forbids browser storage, which is why the artifact used a custom shim. In a real web app, use `localStorage` or IndexedDB freely. Do not reimplement the shim.
> **Name-as-primary-key is being replaced.** The artifact keyed lock state, loadouts and three lookup maps by display string, and `LEGACY_NAMES` exists because that broke twice. See Data Model. Every stored reference uses a stable id from day one.

Everything else in `helldivers-2_armory-design.md` still applies unless contradicted here.

Source files that carry over as data authority:

| File | Role |
|---|---|
| `helldivers-2_tables.md` | Per item ratings, AP, DPS, demo force, capacity, armor sets, sources |
| `helldivers-2_tier-list.md` | Decision layer, co-op doctrine, per faction picks |
| `helldivers-2_armory-design.md` | Why the artifact works the way it does. Locked decisions |
| `helldivers-2_stigly_profile.md` | Who the curator is. Relevant to tone and default assumptions |
| `hd2-armory.jsx` | The artifact. Reference implementation for tier browsing, filters, biome gating |

---

## What this is

A Helldivers 2 planning tool with four jobs: browse item ratings, track what you actually own, build loadouts, and pick which loadout to drop with.

### Where it sits

The space is not empty. Democracy Hub already ships a builder with slot locking, warbond filters, auto-optimisation, weapon stats, enemy data and a damage simulator. Helldivers Hub does shareable loadout templates with community rating on its roadmap. There are at least two more standalone builders. **A loadout builder is table stakes and cannot be the differentiator.**

Two things are genuinely unserved:

**Honest provenance.** Competing tools present one person's scores as fact, with no visible staleness model. This project already tracks patch stamps per data table, flags items whose rating predates a balance change that touched them, records where credible sources disagree by a full tier, and marks unrated items as unrated rather than guessing. That discipline is the product, not an implementation detail. Every rating shown to a user carries where it came from and when.

**Squad composition.** Every existing tool builds one loadout for one player. The tier list doc has a whole section on splitting anti-tank and generalist across a duo, coordinating boosters, and cutting teamkill-prone stratagems when your partner cannot read them. Nobody builds the two to four player version. This is the v2 headline.

> [!info] Naming
> Product is **Armory**. Surfaces are **Tier Lists**, **Collection**, **Loadout Builder**, **Drop Bay**, **Exchange**. Navigation labels stay plain because they are search terms and people should not have to relearn them. The Helldivers voice goes in headers, empty states and flavour copy, not in nav.
> Avoid the word "marketplace". Nothing is sold, and that phrasing attached to someone else's IP invites attention nobody wants.

---

## Release scope

> [!success] v1 is the entire client with no backend
> Everything works signed out, stored locally. This is shippable on its own and already competitive.

| Release | Contains |
|---|---|
| **v1** | Sidebar IA, Tier Lists with full row expansion and weapon stats, Collection with two state ownership, Loadout Builder, Drop Bay, local persistence, export and import, two themes |
| **v2** | Accounts and cloud sync, co-op and squad composition, second player collection profiles |
| **v3** | Exchange (publish, browse, copy loadouts), community voting, recently changed feed |

Reasoning on the order: loadout sharing is useful at ten users, tier voting is worthless below a few hundred. Do not ship an empty tier list waiting for votes. Co-op moves ahead of Exchange because it is the differentiator and it needs no moderation surface.

---

## Data model

### Stable ids

Every item gets a slug id that never changes. Display name is an ordinary field.

```json
{
  "id": "plas-101-purifier",
  "name": "PLAS-101 Purifier",
  "aliases": ["SG-225 Trident"]
}
```

> [!danger] Nothing stored ever references an item by display name
> Loadouts, collection state, votes, published builds and URLs all use `id`. Arrowhead renames items between patches. In a single user artifact a rename costs a migration entry. In a multi user app with published loadouts it orphans other people's data.

Maintain an `aliases` array per item and a build time check that no alias collides with a live id. The artifact's `LEGACY_NAMES` map seeds this: `SG-225 Trident` to `LAS-13 Trident`, `AR-23C Liberator Carbine` to `AR-23A Liberator Carbine`.

### Item schema

```json
{
  "id": "ac-8-autocannon",
  "name": "AC-8 Autocannon",
  "slot": "stratagem",
  "stratType": "support",
  "category": null,
  "damageType": "explosive",
  "usesBackpackSlot": true,
  "acquisition": { "type": "requisition", "cost": 7000 },
  "stats": { "ap": 4, "apLabel": "Heavy", "dps": null },
  "ratings": { ... },
  "flags": [],
  "patchNote": null
}
```

- `slot`: `primary`, `secondary`, `throwable`, `stratagem`, `armor`, `booster`
- `stratType`: `support`, `backpack`, `eagle`, `orbital`, `sentry`, `emplacement`, `mines`. Null for non stratagems
- `category`: weapon category, primaries and secondaries only. Primaries use the seven in game subcategories (Assault Rifle, Marksman, SMG, Shotgun, Explosive, Energy, Special). Secondaries use the game's three (Pistol, Melee, Special)
- `damageType`: `heat`, `arc`, `fire`, `explosive`, `ballistic`, `gas`, `melee`, `utility`. `heat` and `arc` are the thermally affected ones the biome gating keys off
- `usesBackpackSlot`: true on the nine support weapons that eat it. Null where the source data does not say yet, which is currently only the 40-K Meltagun. Never guess false

### Ratings and provenance

```json
"ratings": {
  "bots":   { "tier": "S+", "source": "ugg", "patch": "6.3.1", "votes": null },
  "bugs":   { "tier": "S+", "source": "ugg", "patch": "6.3.1", "votes": null },
  "squids": { "tier": null, "source": null,  "patch": null,    "votes": null }
}
```

- Tier scale is `S+ > S > A > B > C > D`. **No E, no F.** Do not invent lower tiers to make a spread look harsher
- `source`: `ugg`, `curator`, `community`, or null. Community overrides the others once v3 voting has enough volume
- `tier: null` means no rating exists. This is a first class state, not missing data

> [!warning] Unrated items survive every tier floor
> A minimum tier filter must never remove an unrated item. They stay in the result set at any floor, sorted last, below everything rated. This was a deliberate reversal in the artifact: filtering to S made new warbond items vanish, and being seen is the only way they ever get tried.
> The rule is that the floor judges whatever value is being ranked. With a faction filter active, that is that faction's tier; null there means the row passes. With no faction filter, it is best of three; the row passes only if all three are null.

Flags carry rating caveats: `stale` means a confirmed patch change touched that exact item after the rating was cast, and requires a `patchNote`. `new` means it is in the game with no rating yet. Flags are hover and expand explanations, never filter chips. That was settled and should not be relitigated.

### Ownership is two states, not one

> [!danger] Owning a warbond is not unlocking its items
> You pay super credits for the warbond, then medals per item. The artifact conflated these into one lock. Model them separately.

```json
"collection": {
  "warbonds": { "polar-patriots": true, "castellans-creed": false },
  "items":    { "plas-101-purifier": true, "g-13-incendiary-impact": false }
}
```

Availability is derived: a warbond item is available only when the warbond is owned **and** the item is unlocked. Items on other acquisition paths ignore the warbond axis entirely.

Behavior rules:

- Marking a warbond as owned **must not** mass unlock its items. They keep whatever per item state they had, and unseen items default to locked
- Provide an explicit "unlock all in this warbond" action, since one click warbond operations were a liked property of the artifact
- Marking a warbond as not owned dims and disables its items' per item toggles. The only way back is the warbond toggle. This deliberate one way door stops the two mechanisms fighting and should be preserved
- Locked warbond items use a distinct amber padlock, visually separate from a per item lock

Acquisition types: `warbond` (medals), `requisition` (slips), `superstore` (super credits), `campaign` (reward), `starter`.

> [!question] Armor and warbonds
> The source data maps armor passives to set names, not to warbonds, so armor could not be warbond filtered in the artifact. If a passive to warbond mapping is built during the port, wire it in and Collection picks it up automatically. Otherwise armor stays on per item unlock only.

---

## Data pipeline

Tier data is a checked in JSON file, not inline in components and not fetched at runtime in v1.

```
/data
  items.json         generated
  warbonds.json      generated
  armor-sets.json    generated
  patch-notes.json   hand maintained
/scripts
  crawl.ts           fetches and normalises source data
  validate.ts        schema, id uniqueness, alias collisions, orphan references
```

`crawl.ts` produces a diff against the committed JSON rather than overwriting it silently, so a source change is reviewed before it ships. `validate.ts` runs in CI and fails the build on: duplicate ids, an alias colliding with a live id, a loadout referencing an unknown id, an invented tier outside the scale, or a `stale` flag with no patch note. This replaces the artifact's runtime integrity banner, which was a workaround for having no build step.

> [!warning] The u.gg dependency is the main structural risk
> Shipping someone else's aggregated community votes as your app's data is fine for a personal tool and questionable for a public one. It is also a hard dependency on their refresh cadence, which is currently the reason most ratings in this project are one patch behind the game.
> Mitigation is provenance plus eventual independence. Ship v1 with objective data that can be sourced legitimately (stats, AP, capacity, demo force, armor set numbers, warbond contents, all factual and mostly from the wiki), plus clearly labelled ratings with their origin visible. v3 voting is what eventually makes the ratings the tool's own.

---

## Information architecture

Two levels. A persistent left sidebar for destinations, a top tab bar scoped to whichever destination is open.

```
Sidebar
  Browse
    Tier Lists          /tiers/:slot
    Collection          /collection
  Loadouts
    Loadout Builder     /builder/:loadoutId?
    Drop Bay            /bay
    Exchange            /exchange          (v3)
  Squad                 /squad             (v2)
  ---
  Account               /account           (v2)
  Settings              /settings
  Support               /support
```

Top tabs are the sub navigation within a destination. Tier Lists gets Primaries, Secondaries, Throwables, Stratagems, Armor Passives, Boosters. Collection gets Warbonds and Items. Builder and Drop Bay need none.

> [!failure] Voting is not a destination
> You vote on an item while looking at that item, so voting is a control inside the expanded tier row next to the current rating and the vote count. A dedicated voting page is a page nobody visits twice.
> If a destination is wanted for engagement, build **Recently Changed**: a feed of items whose community tier moved this week. That is a reason to come back. A voting form is not.

---

## Surfaces

### Tier Lists

Carries over from the artifact largely intact. Changes:

- **Full row click expands.** The whole row is the target, not just a chevron. Opening one row collapses the previously open one, which the artifact's single value `openRow` state already does. Lock, favourite and vote controls inside the row need `stopPropagation`
- **Every item expands, not just armor.** Armor shows its passive to set lookup grouped by weight class. Weapons show stats. Stratagems show cooldown, uses per rearm and backpack conflict
- **Stats data is a gap.** The tables carry DPS, AP, demo force, capacity and cooldown. They do not carry magazine size, spare magazines, fire rate, recoil, reload time, projectile count or stagger. Source these from helldivers.wiki.gg during the port
- Faction ratings stay as real columns with a sticky header and faction colouring, per the artifact rebuild
- Filters stay per tab and category specific: damage type on primaries, secondaries, throwables and stratagems only; weapon category on primaries and secondaries as an exclusion model; stratagem type as an inclusion model; armor trait buckets as an inclusion model
- Favourites and locks are independent axes and both apply to all six categories

### Collection

The ownership surface, promoted out of a tab because ownership is now two axes.

- **Warbonds tab**: every warbond grouped by tier (standard, premium, legendary), owned toggle, item count, per warbond bulk unlock and bulk lock
- **Items tab**: flat searchable list of every item with its acquisition path and current availability, filterable by slot, warbond and availability
- Warbond ownership is never assumed or hardcoded anywhere in the app. This is the canonical home for it

### Loadout Builder

Deep customisation of one loadout at a time.

- Slots: primary, secondary, grenade, armor, booster, and four stratagem slots
- **Tapping a slot opens a picker overlay** filtered to that slot, reusing the tier row component so ratings, flags and provenance are visible at the point of choosing
- The overlay defaults to hiding unavailable items with a toggle to show them dimmed. Favourites pin to the top
- **Backpack conflict validation.** At most one occupant of the backpack slot across the support weapon and backpack stratagem choices. Warn, do not block, since the assisted reload rework means a squadmate can carry the pack. The amber dot convention marks the nine support weapons that eat it, and never marks a backpack stratagem, where it would state the obvious
- Loadouts carry metadata used by filters everywhere else: faction, biomes, mission types, difficulty band, and whether the build is heat dependent
- Ships with the artifact's curated builds as editable starting points, clearly marked as presets so a user knows they can fork them
- Saving, duplicating and deleting all live here

### Drop Bay

Read optimised overview for the moment before you drop. Deliberately not the builder.

- Grid of saved loadout cards, several visible at once for comparison
- Filters: faction, biome, mission type, difficulty
- Actions per card: favourite, open in builder, delete
- **Biome and difficulty filters are hard gates, not soft scoring.** A build excluded by the brief does not appear. This was explicit feedback on an earlier version that merely warned: if the answer is do not bring this, it should not be on the card
- **Hot biomes exclude heat venting builds. Cold biomes advantage them.** Heat weapons vent slower in cold, so laser and plasma are genuinely better on ice. An earlier version modelled only the hot penalty and missed the cold bonus

### Exchange (v3)

- Publish a saved loadout, browse published ones, vote, copy into your own collection and fork it
- Same card primitive as Drop Bay, deliberately distinct chrome so nobody is confused about whether they are looking at their own builds or someone else's
- Same filter vocabulary as Drop Bay, since the mental model is identical
- Copying is the primary action. No curation queue, no ownership claims. There are only so many combinations

### Squad (v2)

The differentiator. Composition checking across two to four players.

- Assign a saved loadout per squad slot
- **Second player collection profiles.** A named alternate ownership profile so the tool stops suggesting gear a newer player does not have. The artifact deliberately shipped without this and it is the top item on its open threads
- Coverage checks against the co-op doctrine already written up in the tier list doc: anti-tank present, sustained chaff clear present, no duplicated booster, backpack slots not all consumed, and a warning on the known teamkill offenders (Tesla Tower, Mortar Sentry, Gatling Sentry, Incendiary Mines, 380mm barrage) which get more dangerous with fewer bodies on the map, not more
- Mixed skill mode: when a squad member is flagged as new, drop the difficulty assumption and prefer forgiving gear, high ammo, no charge up, no self damage

### Account, Settings, Support

> [!warning] Do not write your own auth
> Use Supabase, Clerk or equivalent. The reason is not account theft, it is that password reset needs email delivery, and you become the support desk for every flow a provider gives you free. Supabase is the strongest fit since its Postgres and row level security also cover Exchange and voting storage.

- **The whole tool works signed out.** Sign in only to sync or publish. Zero friction is the current build's best property and losing it would be a downgrade
- Account: change email, change password, delete account, sign out. No 2FA
- **Export and import is a v1 persistence guarantee, not a settings nicety.** One JSON file containing collection state, loadouts and favourites, with a `schemaVersion` field. This is the account transfer story until accounts exist, and the backup story after
- Settings: theme, export, import, reset local data

---

## Theming

Design tokens as CSS custom properties from day one. Every colour, radius and font goes through a token so a theme is a token set rather than a rewrite.

- Ship two themes in v1: a dark and a light. **Dark is grey, not black. Light is off white, not pure white**
- **A theme declares its own base.** Do not force every theme to have a light and dark variant. Warbond themes added later can be dark only where that is what they are
- The Warhammer 40,000 crossover theme is a wanted early addition and is inherently dark
- Fonts carry over: Oswald for headers and tier badges, JetBrains Mono for item names

---

## Assets

> [!danger] Extracted game assets are the most likely takedown trigger
> Icon and weapon art extracted from the game is one thing on a personal tool and another on a public site. Other community tools do it and mostly survive, but keep the asset layer swappable behind a resolver so pulling it does not break the app. Every item renders with a text fallback when its icon is missing.

---

## Inherited decisions

> [!danger] These came from direct curator feedback. Do not reverse without asking
> A fresh session "improving" them undoes work already asked for.

- **Tier browsing is the primary tool, not the picker.** He prefers evaluating individual items over accepting curated loadouts, because he may dislike half the S tiers and enjoy some A tiers
- **Difficulty is a hard band filter**, not a soft nudge. Builds outside the selected band do not appear at all
- **Curated loadouts are fixed and named, not generated.** Auto calibration was considered and declined
- **Faction theming runs through the whole UI.** Bots red `#EF4444`, bugs orange `#F97316`, squids purple `#A855F7`. Badges, borders, chips and card accents all shift, not just labels
- **Stratagem colour groups follow the in game menu.** Blue for support and backpacks, red for Eagle and orbital, green for sentries, emplacements and mines, with a per subtype icon inside each colour
- **Tesla Tower is an emplacement, not a sentry.** Arrowhead's Rapid Launch System module note lists it with the emplacements
- **No damage type icon on `ballistic` and `utility` rows.** Those are the nothing special defaults, so a glyph there is decoration. The kinds that keep an icon are the ones that change behavior
- **Empty states say what to do next**, not just that nothing was found
- **No em dashes anywhere**, including code comments and UI copy. No ASCII substitutes either
- **Blurbs and notes stay direct and opinionated.** Short sentences, no hedging. An admitted gap beats a hedged guess

---

## Known bugs to fix during the port

> [!bug] Dead reference in the loadout card
> `LoadoutCard` reads `loadout.fire`, but the field is `heat`. The fire tornado warning has never rendered once. One word fix, left alone in the artifact because the loadouts tab was out of scope for that pass.

---

## Open questions

> [!question] Decide before or during the build
> **Warbond default on first run.** Does a new user start with everything owned, nothing owned, or only the free Mobilize warbond? Nothing owned is the honest default but makes the first session feel empty.
> **Rating conflicts.** The tier list doc records real cross source disagreement, for example the SG-8 Punisher Plasma at S+/S/S+ on u.gg against B/B/B on GamesRadar. Does the UI surface disagreement, and if so how? Averaging it away loses the most useful signal in the data.
> **Vote eligibility.** Does voting require an account, a minimum play time claim, or nothing? Unauthenticated voting is unusable within a week of launch.
> **Vehicles and mechs are absent from the source data entirely.** No EXO-45, EXO-49, FRV or GATER anywhere in the tables. They need adding if the stratagem list is to be complete.
