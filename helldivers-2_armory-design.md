# **HD2 Armory: Design Notes**

> Decisions, data conventions, and known gaps for `helldivers-2_armory.jsx`, the Helldivers 2 tier browser and loadout picker built in this project. Exists so a fresh chat can extend the tool without relitigating choices already settled with stigly.

---

## What the tool is

A single React artifact with four tabs.

| Tab | Purpose |
|---|---|
| **Tier lists** | Primary experience. Ten browsable categories with per-faction ratings, filters, search, per-item lock marking, and expandable row detail. |
| **Loadouts** | Curated builds filtered by faction, biome, mission type, and difficulty. Secondary. |
| **Warbonds** | Ownership config. Lock a whole warbond in one click. Feeds the lock state everywhere. |
| **Favorites** | Starred loadouts, persisted. |

State persists through `window.storage` under three keys: `hd2-loadout-favorites`, `hd2-locked-items`, and `hd2-locked-warbonds`.

---

## Locked decisions

> [!danger] Do not reverse these without asking
> Each of these came from direct stigly feedback during the build. A fresh instance "improving" them will undo work he already asked for.

**Biome filters are hard gates, not warnings.** Hot biomes remove heat-venting builds from the pool entirely. He pushed back specifically on the earlier version that merely warned: if the answer is "do not bring this," it should not be on the card.

**Cold biomes advantage heat weapons.** Heat-venting weapons vent slower in cold, so laser and plasma are genuinely better on ice than anywhere else. The first version modeled only the hot penalty and missed the cold bonus entirely. Three cold builds exist because of this correction: Cryo Beam, Frostline, Frost Lance.

**Difficulty is a hard band filter.** Each loadout declares `diff: ["low", "mid", "high", "extreme"]`. Builds outside the selected band do not appear at all. Earlier versions scored difficulty as a soft nudge, which made the selector feel decorative.

**Tier browsing is the primary tool, not the picker.** He prefers evaluating individual weapons himself over accepting curated loadouts, because he may dislike half the S tiers and enjoy some A tiers. Curated loadouts stay as a secondary reference, not the headline feature.

**Curated loadouts over generated ones.** He considered auto-calibration, pick a primary and have the rest adjust, and talked himself out of it. Do not rebuild it unless he asks. Fixed named builds are easier to evaluate at a glance.

**Faction theming runs through the whole UI.** Bots red `#EF4444`, bugs orange `#F97316`, squids purple `#A855F7`. Not just labels: badges, borders, chips, and card accents all shift.

**Patch caveats are a hover explanation, not a filter.** Settled at the 7.0.0 rebuild. He rejected a third chip row for filtering stale and unrated items, on the reasoning that none of this data is fully accurate anyway and one patch rarely buries an item. Flagged rows get a help icon that expands one line of explanation. Do not promote these back into filter chips.

**No assisted reload model.** 7.0.0 lets either player in a duo carry the ammo backpack for Recoilless, Spear and Airburst. A squad-size toggle was proposed and he declined it: he and his brother do not hand each other ammo packs. The amber backpack dot keeps meaning "this eats your own backpack slot" for all seven backpack-taking support weapons.

---

## Data conventions

### Tier row format

```
[name, bots, bugs, squids, kind, source, note, flag]
```

- **Tier scale**: `S+ > S > A > B > C > D`. There is no E or F. The source scale bottoms out at D, so do not invent lower tiers to make the spread look harsher.
- **Tiers are `null`** when no community rating exists. Those rows render a dashed `?` badge, sort below everything rated, and are hidden whenever a minimum tier above D is selected.
- **kind**: one of `heat`, `arc`, `fire`, `explosive`, `ballistic`, `gas`, `melee`, `utility`. Drives the damage type filter and the row icon.
- **`heat` and `arc` are the thermally affected kinds.** These are what the hot exclusion and the cold advantage key off.
- **flag**: `"stale"` means the rating predates a 7.0.0 change to that exact item, and the row must have an entry in `PATCH_NOTES`. `"new"` means the item is in the game with no community rating yet. Absent means the rating is current for its stamp.

> [!failure] `approx` is gone
> The old eighth field marked items where the source gave a summary rating instead of a per-faction one. The full tables give real per-faction ratings for all 224 rated items, so all 27 `approx` flags were dropped rather than carried forward. Do not reintroduce it. If a future source clumps again, prefer leaving the item out to publishing a guess.

### The name-matching invariant

> [!warning] Renaming an item silently breaks lock state
> Loadout item names must match tier list row names character for character. Lock state is matched by exact string. This is why loadouts say `A/MG-43 Machine Gun Sentry` and not `MG Sentry`, and `EAT-17 Expendable Anti-Tank` and not `EAT-17`.

If a name changes in the tier data, it must change in every loadout that references it, and in `STRAT_CATEGORY`.

`LEGACY_NAMES` migrates saved lock state through renames on load. Two entries live there from the 7.0.0 rebuild: `SG-225 Trident` to `LAS-13 Trident`, and `AR-23C Liberator Carbine` to `AR-23A Liberator Carbine`. Add to it rather than accepting silent loss whenever a name is corrected.

### Stratagem categories

`STRAT_CATEGORY` maps a stratagem name to `[category, usesBackpackSlot]`. Categories are `support`, `backpack`, `eagle`, `orbital`, `sentry`, `emplacement`, `mines`. The backpack boolean drives the amber corner dot, which flags the slot conflict that actually matters when choosing four stratagems.

### The lock model

Two independent sets, unioned at read time by `buildLockedSet`:

- `lockedItems`, toggled one at a time in the tier browser
- `lockedWarbonds`, toggled per warbond in the Warbonds tab

Clearing one never destroys the other. An item locked because its warbond is locked shows a dimmed padlock and its per-item toggle is disabled, so the only way to unlock it is in the Warbonds tab. This is deliberate: it stops the two mechanisms from fighting.

### Armor sets

`ARMOR_SETS` maps each of the 30 passives to its light, medium, and heavy sets, 107 in total. It renders as inline expandable row detail on the Armor passives category, not as its own category. The point is answering "which weight can I get this passive in," so the weight grouping is the structure, not decoration. Sets whose armor, speed and stamina differ from the standard for their class carry those numbers inline.

---

## Data provenance

> [!info] Current source
> `helldivers-2_tables.md`, which is the authority for every rating, source, AP class, DPS, demo force, capacity, cooldown and armor set in the file. 228 rows across ten categories. Underneath it: u.gg tier lists at Patch 6.3.1 for everything except armor passives, which are stamped 7.0.0, plus helldivers.wiki.gg for armor sets and Arrowhead's 7.0.0 patch notes for balance changes.

> [!danger] Two patch stamps coexist in the data
> Game version is 7.0.0 "Devoid of Liberty", 12 August 2026. Only the armor passive table has been restamped to 7.0.0. Everything else is pre-patch community consensus applied to a post-patch game. 19 rows carry `flag: "stale"` because a confirmed 7.0.0 change touched that exact item. Re-check u.gg around early September 2026 and clear the flags that have been absorbed.

Coverage is now complete against the source. Every category matches the tables row for row: primaries 52, secondaries 24, support 33, throwables 21, eagles 7, orbitals 12, backpacks 13, sentries and mines 18, armor passives 30, boosters 18.

### What the 7.0.0 rebuild corrected

The previous data layer was built from the summary tier list rather than the per-item tables, which produced three classes of error:

- **17 wrong per-faction ratings**, almost all from prose clumping. The Liberator family, Adjudicator, Halt and Machete were written off as B or C across the board when most of them are A against bugs.
- **38 wrong sources.** Trident was Superstore, actually Siege Breakers. Double-Edge Sickle was Cutting Edge, actually Servants of Freedom. Nine of the eighteen booster sources were wrong.
- **2 wrong names.** `SG-225 Trident` is `LAS-13 Trident` and it is an energy weapon, not ballistic, which means it is now hot-gated and cold-advantaged. `AR-23C Liberator Carbine` is `AR-23A`; AR-23C is the Liberator Concussive, so the old file used one designation for two weapons.

29 items were missing entirely, including True Grit, the only armor passive besides Med-Kit rated S+ on all three fronts.

### Judgment calls in the rebuild

These were decided rather than read off the source, and are worth revisiting if better data appears:

- **Breaker Incendiary and Cookout are `fire`, not `ballistic`.** Both are shotguns that apply a fire effect. Same reasoning already applied to Stoker.
- **The Hot-Shot Lasgun is `heat`.** The tables call it Energy but give no mechanics. Every other energy primary in the game vents heat, so heat is the supported default. It is unrated anyway, so this only affects the damage type filter.
- **Meltagun and Meltamine are `fire`.** Melta weapons are thermal. Both unrated.
- **Kinetic Displacement Mitigation is `fire`.** Its +50% fire resist matches Acclimated, which makes it findable next to the other fire-resist passives, even though its headline effect is impact mitigation.
- **Righteous Revenants is grouped as Legendary.** The tables never label it. The arithmetic supports it: the previous count of 23 warbonds was stamped July 2026, Castellan's Creed released 12 August, and treating Righteous Revenants as the third Legendary gives exactly 1 standard, 20 premium, 3 legendary. It is the Killzone crossover, which fits the crossover pattern of the other two.

> [!failure] Corrected errors worth remembering
> An earlier reply claimed the game had "8+ warbonds." stigly caught it; the figure at the time was 23. That figure is now itself stale. **24 warbonds as of 12 August 2026: 1 standard, 20 premium, 3 legendary.** stigly also called the third Legendary correctly before the count was checked.

---

## Style constraints

- No em dashes anywhere, in code comments or UI copy.
- Tone in blurbs and notes: direct, opinionated, no hedging. Short sentences.
- Fonts: Oswald for headers and tier badges, JetBrains Mono for item names.
- No `localStorage` or `sessionStorage`. Use `window.storage` only.
- Tailwind core utility classes only.
- Empty states say what to do next, not just that nothing was found.

---

## Open threads

- The 19 stale flags should be reviewed once u.gg restamps to 7.0.0. Anti-Tank Mines is the most likely rating to move, since demo 30 to 40 crosses the threshold that closes holes from outside.
- The four Castellan's Creed weapons have no ratings. They render as `?` until u.gg has data.
- **True Grit is not in any curated loadout.** It is S+ on all three fronts and gives +30% support weapon reload, which is large on the Autocannon, Recoilless and Grenade Launcher builds. Swapping it into some of them is an obvious improvement but the curated set is stigly's, so it was left alone pending his call.
- Armor passives cannot be warbond-filtered. The source maps passives to armor set names, not to warbonds, so armor stays on per-item locking. If a passive-to-warbond mapping ever appears, wire it into `ITEM_SOURCE` and the Warbonds tab picks it up automatically.
- He mentioned possibly editing loadouts directly in the file. Keep the loadout objects readable rather than compressing them into arrays, even though the tier rows are arrays.
- A companion desktop app, Helldivers 2 Loadout HQ, already exists and does saved loadouts and export. This tool is deliberately not trying to match it feature for feature.
- **No second-player unlock profile.** Lock state models one player. His brother started in August 2026 and owns almost nothing, so any loadout the tool suggests for the brother will assume gear he does not have. A second named lock profile with a toggle between them would fix it. Not built, and not to be built unless he asks.
