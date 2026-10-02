# **D.I.L.A.S.: Data Spike**

> Run 20 August 2026, to answer four questions before the contextual scoring engine gets designed around guesses. Every finding below was measured against a live source, not recalled. The raw pulls are reproducible from the URLs in the last section.

---

## The question, and the answer

The overhaul brief asked for roughly fifteen new weapon properties. `CLAUDE.md` records seven weapon stats as **not in any source this project has**, and the plan written before this spike scrapped most of the rest as unknowable, replacing them with hand authored binary tags.

> [!success] That call was wrong, and this spike is what it was scheduled to find out
> Nearly all of it is available as real numbers, community maintained, and joinable to our data at **95%** with two normalisation rules. The hand authoring bill drops from roughly fifteen tag lists across 180 items to a short override map.

---

## Where it lives

`helldivers.wiki.gg` runs MediaWiki 1.43.6 with **Scribunto**, and the community keeps whole datasets in single `Module:` pages rather than scattered across article infoboxes. One request per dataset, no scraping, no HTML parsing.

| Module page | Size | Holds |
|---|---|---|
| `Module:Decodedata-Attacks/weapons data.json` | 216KB | 138 weapons, 179 damage profiles, projectiles, beams, arcs |
| `Module:Decodedata-Attacks/stratagems data.json` | 124KB | 90 stratagems plus their damage and explosions |
| `Module:Decodedata-Attacks/enemydata.json` | 61KB | 125 enemy attack profiles |
| `Module:Weapon Attach/data weapons.json` | 47KB | Per weapon attachment options |
| `Module:Decodedata-Weapons/data.json` | 25KB | Weapon catalogue |
| `Module:Data/Planets` | 25KB | 267 planets, name and sector only |

Planet biomes are **not** on the wiki. They come from `helldiverstrainingmanual.com/api/v1/planets`: 286 planets, each with a biome and its environmental hazards.

---

## What the weapon data actually carries

Every field the brief asked for, and several it did not.

| Brief asked for | Pre-spike call | Actually |
|---|---|---|
| Durable damage vs standard | hold, may not exist | **`dmg` and `dmg2` on every damage profile** |
| Ergonomics | scrap, invent a binary | **`ergonomics`, a real number.** Autocannon 17, Purifier 65 |
| Sway | scrap, invent a binary | **`sway`** |
| Drag coefficient and falloff | scrap, invent a binary | **`drag`, `velocity`, `mass`, `pen_slow` per projectile** |
| Flinch vs stagger vs pushback | collapse to one tag | **`stun` and `push` as separate numbers.** The split is real |
| Projectile hitbox size | scrap, invent a binary | **`caliber` and `pellets`** |
| Magazine and spare magazines | not in any source | **`cap`, `mags`, `magstart`, `capplus`, `supply`** |
| Fire rate | not in any source | **`rpm`**, plus `beam_fire_rate` |
| Recoil | not in any source | **`climb`, `drift`, `spread`, `spread_mods`, `recoil_mods`** |
| Armor penetration | one number in our data | **`ap1` to `ap4`**, four values per attack |
| Demolition force | 20 rows populated | **`demo` on every damage profile** |
| Upgrade trade-offs | aspirational | **A per weapon attachment table** |

Fields vary by weapon type, which is correct rather than patchy: an Autocannon has no spare magazine count because it feeds from rounds, not mags.

---

## The finding that changes app behaviour

Ten entries carry a `heatdata` block, and it contains the hot and cold modifiers **explicitly**.

```
LAS-16 SICKLE heatdata
  heat_loss_per_second        8
  heat_loss_per_second_cold  12     1.50x
  heat_loss_per_second_hot    6     0.75x
```

The multipliers are per weapon, not global: most sit at 1.50 cold and 0.75 hot, one sits at 1.20 and 0.86. So the cold advantage and the hot penalty this tool already models are real, and they can be computed per weapon instead of judged.

> [!danger] The hot biome hard gate is firing on weapons with no heat mechanic
> The app treats 26 items as thermally affected, from a `damageType` of `heat` or `arc`, and a hot biome **removes** any build carrying one. Checked against the source, only the LAS laser family and the Quasar have a heat mechanic at all.
>
> | | |
> |---|---|
> | Confirmed heat mechanic | Sickle, Double-Edge Sickle, Scythe, Trident, Talon, Dagger, Laser Cannon, Quasar Cannon, Rover |
> | **No heat mechanic, gated anyway** | Purifier, Scorcher, Punisher Plasma, Loyalist, Epoch, Accelerator Rifle, Hot-Shot, Blitzer, Arc Thrower, G-31 Arc, K-9 |
>
> Verified twice and independently: those eleven carry no `heatdata` block, and the plasma weapons separately report magazine counts, so they feed from mags rather than venting. The PLAS-101 Purifier is the weapon the tier doctrine calls the best primary in the game, and it is currently excluded from every hot planet on a mechanic it does not have.
>
> **Not changed yet.** This reverses a locked decision and belongs to the curator.

> [!info] The Rover's heat is on the drone, not the backpack
> `AX/LAS-5 ROVER` has no heat block; `AX/LAS-5 ROVERDR 0` does. Any join has to follow the drone entity or it will report the Rover as heat free, which is how this was nearly missed.

---

## Joining it to our 228 items

Two normalisation rules, no fuzzy matching:

1. Compare on uppercase alphanumerics only.
2. Strip a leading model designation, since the wiki says `SUPPLY PACK` where we say `B-1 Supply Pack`.

| Slot | Matched |
|---|---|
| Primaries | 51 of 52, 98% |
| Secondaries | 17 of 24, 71% |
| Throwables | 21 of 21, 100% |
| Stratagems | 82 of 83, 99% |
| **Total** | **171 of 180, 95%** |

The nine misses are six melee weapons, which have no data page, and three naming variances that go in a small override map exactly like the one `scripts/import-images.mjs` already keeps:

| Ours | Wiki |
|---|---|
| CB-9 Explosive Crossbow | CB-9 EXPLODING CROSSBOW |
| M6C-SOCOM | M6C/SOCOM PISTOL |
| SH-20 Ballistic Shield | BALLISTIC SHIELD BACKPACK |

With the overrides that is **175 of 180**, and the only genuine gap is melee.

---

## Planets, biomes and hazards

286 planets, each carrying a biome slug and its environmental hazards.

**24 biomes**, against the six the app models today: highlands, jungle, crimsonmoor, winter, mesa, icemoss, canyon, swamp, toxic, desolate, moon, rainforest, desert, ethereal, tundra, shattered, morass, magma, lush, autumn, superearth, blackhole, undergrowth, icemoss-special.

**14 environmental hazards**, with planet counts:

| Hazard | Planets | Hazard | Planets |
|---|---|---|---|
| Extreme Cold | 52 | Volcanic Activity | 22 |
| Rainstorms | 47 | Blizzards | 21 |
| Thick Fog | 40 | Nocturnal Extreme Cold | 18 |
| Ion Storms | 34 | Sandstorms | 18 |
| Intense Heat | 31 | Acid Storms | 15 |
| Durial Intense Heat | 30 | Fire Tornadoes | 15 |
| Tremors | 28 | Meteor Storms | 14 |

This is the whole planet picker, and it needs no network at runtime: fetch once, ship as JSON.

> [!success] One brief claim is now settled
> The overhaul brief said rain and blizzards instantly cool heat weapons, making them overpowered. The source describes Rainstorms as **"Torrential rainstorms reduce visibility"**, with no thermal effect. The cold and hot modifiers are a property of the planet, carried in `heatdata`, not of the weather. **Do not encode the weather cooling rule.**

---

## How stale is the training manual, and the source that replaced it

> [!failure] The first answer to this was wrong, and the test was the reason
> On 20 August the training manual's planet list was compared against the wiki's own module, 264 of 269 names matched, and it was declared current. **Both sources were behind.** Checking two stale things against each other and finding they agree proves only that they agree. The same mistake the old heat derivation made, twice in one week.

The curator supplied the right lead: the **helldivers-2 community organisation** on GitHub, whose `json` repository is a maintained static dataset. Measured against it, the training manual is missing 12 planets, including **Void Source Planet**, which is the target of the live Major Order.

### What replaced it

`github.com/helldivers-2/json`, **MIT licensed**, committed to on 13, 14 and 16 August 2026 including "newly added planets" and "new planets and effects".

| | Training manual | Community dataset |
|---|---|---|
| Planets | 269 | **281** |
| Biomes | 24 opaque slugs | **32, named and described** |
| Hazard kinds | 14, names only | **14, each with the mechanic stated** |
| Hazard assignments | 385 | **440** |
| Licence | unstated | **MIT**, no non-commercial or ShareAlike terms |

### The hazard descriptions are scoring rules, not flavour

This is what the swap actually bought:

| Hazard | What the source says |
|---|---|
| **Extreme Cold** | reduce rate of fire and **delay heat buildup** in weapons |
| **Intense Heat** | increase stamina drain and **speed up heat buildup** in weapons |
| **Ion Storms** | **intermittently disable Stratagems** |
| **Sandstorms** | reduce mobility and **greatly** reduce visibility |
| **Blizzards** | reduce mobility and **moderately** reduce visibility |
| **Thick Fog** | **lightly** reduce visibility |
| **Tremors** | stun players and enemies alike |
| **Acid Storms** | temporarily **reduce armor effectiveness** |
| **Rainstorms** | reduce visibility |

The cold and hot rules this tool already models are now sourced rather than judged, with a detail neither the brief nor the old source had: cold also **cuts rate of fire**, so it is a trade rather than a free win. The three visibility hazards are graded, which is exactly what a scoring rule needs. And Rainstorms is confirmed a second time as visibility only, with nothing thermal.

> [!warning] Two hazard fields, and the useful one is the second
> `environmentals` names the headline condition. `weather_effects` is everything the planet throws at you, and it is where the temperature lives. Klen Dahth II reads as `sandstorms` in the first and `intense_heat, extreme_cold, sandstorms` in the second: scorching by day, freezing at night. Taking only the headline loses half the heat rule, and that is what the first pass did.

### DiveHarder, and why it is not in this

`api.diveharder.com` is a FastAPI proxy in front of the Arrowhead API, actively maintained, and it is what the Companion site runs on. It serves **live war state**: ownership, liberation, major orders, active planet effects.

Two reasons it is not used here. It needs a **runtime network call**, which this tool has never made and which the static table above does not. And its host does not resolve from this environment at all, so it could not be verified even as a spike.

Its sibling `effects/planetEffects.json` is worth knowing about: 156 galactic effects including Gloom, the Predator and Incineration strains, and Hulk, Devastator and Factory Strider surges. Those genuinely change what you should bring, but which planet carries which changes weekly, so they belong with the live starmap rather than with a shipped table.

> [!question] Still not found anywhere
> The per mission operational modifiers the brief described, Complex Stratagem Plotting and Atmospheric Interference, are in none of these sources. They are tied to difficulty rather than to a planet. If they are to be modelled, they will have to be hand written.

---

## Missions

The real list, with real names, and it is genuinely faction specific. 159 entries under `Category:Missions`, sub-categorised into Main, Primary, Optional and Tactical Objectives.

| Front | Examples |
|---|---|
| Terminid | Purge Hatcheries, Nuke Nursery, Chart Terminid Tunnels, Eradicate Terminid Swarm, Blitz: Destroy Bio-Processors |
| Automaton | Sabotage Air Base, Sabotage Supply Bases, Destroy Command Bunkers, Halt Cyborg Production, Compromise Automaton Defenses |
| Illuminate | Blitz: Destroy Illuminate Warp Ships, Destroy Harvesters, Take Down Overship, Infiltrate Illuminate Lair, Democratize the Void |
| Any | Retrieve Valuable Data, Recover SSSD, Retrieve Essential Personnel, Emergency Evacuation, Launch ICBM, Conduct Geological Survey, Spread Democracy |

**Retrieve Valuable Data** and **Recover SSSD** are the carry missions, and **Commando: Secure Black Box** is the one raised in conversation. None of those names tells a new player they will be carrying something one handed, which is exactly the line the tool supplies underneath.

---

## Licence, and what it forbids

> [!danger] CC BY-NC-SA 4.0
> The wiki reports `https://creativecommons.org/licenses/by-nc-sa/4.0`. Three consequences, and the second is not negotiable.
>
> - **Attribution.** The Helldivers Wiki has to be credited wherever this data is shown. Support and About already carry a provenance section; this joins it.
> - **Non-Commercial.** Selling anything built on this data is out. That is now the second independent reason the themed-pack monetisation idea cannot happen, alongside the extracted Helldivers 2, Games Workshop and Halo art.
> - **ShareAlike.** Data files derived from it have to carry the same licence. Fine for a free community tool, and worth knowing before anything is published.

---

## What this changes about the plan

- **The tag layer shrinks hard.** Roughly fifteen hand authored tag lists across 180 items becomes: fetch, join, and hand author only what genuinely is a judgement. `quiet`, `disposable` and the vertical versus angled call-in split still have no source and stay ours.
- **The scoring engine gets better inputs.** Rules can read `ergonomics`, `dmg2` against `dmg`, `stun`, `push`, `drag` and `demo` rather than a binary that approximates them.
- ~~**The armor penetration rule needs one more pull.**~~ **Pulled, 21 August 2026, and it was cheaper and richer than this line predicted.** The anatomy tables carry **health and durable share per body part** as well as the armor value, and the wiki API returns raw wikitext for 50 titles per request, so the whole set was two requests rather than forty page fetches. 80 enemies, 594 body parts, shipped as `src/data/enemies.json`.
  - **The rule to apply them is published too**, on the wiki's Damage page, and it is three states rather than a curve: above the armor value is full damage, exactly equal is 65%, below it the round bounces for nothing.
  - **`ap1` needed no interpretation after all.** Sampled across eight weapons, the curated `stats.ap` already in `items.json` equals `ap1` every time, so the app kept the number it had. What `ap2` to `ap4` mean is still unknown and is still not needed.
  - **The enemy pages nest templates**, which is worth knowing before writing another parser against them: a health value carries a `Difficulty` call with its own braces and its own pipes. A parser that matches to the first closing pair truncates the row, and one that splits on every pipe corrupts what is left. Both cost the Terminid Warrior entirely on the first run.
- **The patch cycle answer holds and improves.** Re-run the fetch, diff, review. Because the numbers now come from a maintained source rather than our own hand lists, a patch is a diff to read instead of a re-derivation.

---

## Sources

| What | Where |
|---|---|
| Weapon, stratagem and enemy data | `helldivers.wiki.gg/index.php?title=<Module page>&action=raw` |
| Module page listing | `helldivers.wiki.gg/api.php?action=query&list=allpages&apnamespace=828&aplimit=500` |
| Mission list | `helldivers.wiki.gg/api.php?action=query&list=categorymembers&cmtitle=Category:Missions&cmlimit=200` |
| Licence | `helldivers.wiki.gg/api.php?action=query&meta=siteinfo&siprop=rightsinfo` |
| Planets, biomes and hazards | `helldiverstrainingmanual.com/api/v1/planets` |
