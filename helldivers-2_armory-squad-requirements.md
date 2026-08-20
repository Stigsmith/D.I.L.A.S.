# **HD2 Armory: Squad Requirements**

> Feature requirements for planning a drop with a second player: named unlock profiles, a side by side build comparison, overlap checks that need no new data, a two tag role layer, and the coverage warnings that layer feeds. Replaces an earlier draft that specced hosted squad rooms and a six tag synergy dashboard. Depends on decisions in `helldivers-2_armory-design.md`, the web requirements document and `CLAUDE.md`; conflicts between this file and those must be surfaced, not silently resolved.

---

## What this replaces

An earlier version of this document specced a hosted squad room: join codes read aloud over voice comms, guest identities, a host who can kick, rooms expiring after 24 hours, live propagation to four members, and on top of that a role tag layer across every rated row feeding a coverage dashboard.

That design was competent for a public multiplayer tool. It was not a design for this one. The squad here is two brothers who already talk, so almost none of the room apparatus buys anything, and it is the only part of the feature that needs a backend.

> [!success] What survived the cut
> **Per member unlock profiles**, which `CLAUDE.md` has listed as a known gap with a concrete consequence since long before squad came up. **Checking two builds against each other**, which is the thing you actually do before a drop. And **the warning that you are about to have a bad time**, which was the point of the whole exercise and nearly got cut with the machinery around it.

> [!failure] The dashboard was the wrong shape for the right idea
> The earlier draft delivered the warning as a table: six tags, a count each, states of absent, thin, covered and redundant. That is a status panel, and it would have read "covered" almost every time. What is wanted is a sentence in the voice the curated blurbs already use, conditioned on where you are dropping. FR-5 is that. It needs two of the six tags, not all six.

> [!danger] Do not restore the cut scope without reading why
> The reasoning for every removal is recorded below under Deliberately not built. A fresh session that reads "squad" and rebuilds rooms, tags and a dashboard will spend a large amount of effort on a feature that was considered in full and declined on the evidence.

---

## Scope

Nothing in this document needs a backend, an account, a session store or real time sync. One requirement, FR-4, adds a field to the item data.

| Requirement | Needs | State |
|---|---|---|
| **FR-1** Named unlock profiles | Nothing. Local state only | **Not built.** The only thing left |
| **FR-2** Build comparison | FR-1 for the ownership check, otherwise nothing | **Built**, minus the per member profile assignment |
| **FR-3** Overlap checks | FR-2, plus fields that already exist | **Built**, minus the ownership check, which waits on FR-1 |
| **FR-4** Two role tags | A new field, and your judgment on roughly 60 rows | **Built.** 27 anti-armor, 22 objective, 185 rated rows untagged |
| **FR-5** Coverage warnings | FR-2 and FR-4 | **Built** |

> [!success] What is actually left
> FR-1, and the two things that hang off it: assigning a profile to a slot in the comparison, and the ownership warning that fires when a build holds gear that profile does not own. Everything else in this document is in the app.

> [!tip] FR-1 is the honest starting point
> It stands alone regardless of whether anything else here is built, it is pure engineering with no curation cost, and the Collection surface it extends was built most recently so the generalisation is clearest now.

> [!question] FR-4 and FR-5 could go first instead
> FR-5 is the feature you actually want and FR-4 is the only thing standing between you and it. If the warnings matter more than the profiles, do FR-4 then FR-5, and accept that the ownership check in FR-3 arrives later. Both orders are defensible.

---

## Where it lives

No new destination. The stripped feature fits surfaces that already exist.

- **Profiles** live in Collection, which already edits both ownership axes, with a selector above the two tabs. The tier browser gets the same selector.
- **Comparison** lives in Drop Bay, which `CLAUDE.md` already describes as the only place that browses every build at once. Comparing two of them is browsing two at once.

> [!question] Drop Bay mode or the Squad destination
> The sidebar carries a `Squad` entry marked v2, shown but not reachable. The comparison could live there instead of inside Drop Bay. Drop Bay costs no new information architecture and puts the comparison next to the builds it compares; the Squad destination is more discoverable and matches how you would describe the task out loud. Recommendation is Drop Bay, but this is a call about the shape of your tool. Settle it before build.

> [!question] Does the Squad sidebar entry stay
> If the comparison lands in Drop Bay, nothing in this document uses `Squad`. It can stay as a v2 promise for rooms, or come out. Leaving a permanently unreachable destination in the sidebar is only honest while rooms are still genuinely intended.

---

## FR-1: Named unlock profiles

The ownership model grows from one active set to several named ones. Nothing about how a single profile works changes.

### Requirements

- **FR-1.1** A profile stores the two existing axes and nothing else: locked warbonds and locked items. No new per item state, no third axis.
- **FR-1.2** Existing state migrates into a profile named **Default** on first load. No user action, no data loss.
- **FR-1.3** Exactly one profile is active at a time, application wide. Every surface that reads lock state reads the active profile: tier rows, Collection, the builder picker, Drop Bay.
- **FR-1.4** The active profile is named in the header, alongside the existing starred and locked counts, and switching is one control rather than a trip into Settings.
- **FR-1.5** Create, rename and delete. There is always at least one profile, so the last one cannot be deleted.
- **FR-1.6** Creating a profile offers three starting points: **nothing owned**, **everything owned**, or **a copy of the active profile**.
- **FR-1.7** Export and import carry every profile, behind a `schemaVersion` bump. An older export holding flat `lockedItems` and `lockedWarbonds` arrays still imports, landing in the Default profile.
- **FR-1.8** `ownership.json` continues to seed first run only, into the Default profile. Its behaviour is unchanged, just scoped.

> [!warning] There is no single existing ownership set to migrate
> The current model is **two** independent sets in two `localStorage` keys, `hd2-locked-items` and `hd2-locked-warbonds`, unioned at read time, plus `ownership.json` as a one time per browser seed. The migration moves both keys and has to decide what the seed means once more than one profile exists. FR-1.8 answers that: the seed is a Default profile concern only.

> [!success] Starting from nothing owned is the point
> Your brother started in August 2026 and owns almost nothing. A profile that begins with everything locked, then gets the handful of things he has unlocked, is minutes of work. A profile that begins with everything unlocked is an evening of it.

> [!failure] Ownership unknown is not a state here
> The earlier draft needed a fourth state, distinct from owns nothing, for guest squad members whose ownership nobody had filled in. There are no guests, so it is not needed. The three existing values stand: `false` is locked, `true` is owned, absent is not locked.

---

## FR-2: Build comparison

Two builds next to each other, with the context they will be dropped into.

### Requirements

- **FR-2.1** A comparison holds **two to four** build slots. Two is the default and the case that matters; four is the in game cap.
- **FR-2.2** A slot takes one of the 39 curated builds, one of your own saved builds, or nothing.
- **FR-2.3** A slot can be assigned a profile from FR-1. This is what makes the ownership check possible and is the reason FR-1 comes first.
- **FR-2.4** Slots render side by side with rows aligned, so the same slot reads across: primary, secondary, grenade, armor, booster, then the four stratagems.
- **FR-2.5** Faction, biome, difficulty band and mission type are set once for the whole comparison, reusing the existing controls rather than new ones.
- **FR-2.6** Changing a build, a profile or the context reruns every check. Nothing placed is ever cleared.

> [!warning] The biome hard gate applies to choosing, not to what is already placed
> Hot biomes remove heat venting builds from the pool entirely. That is a locked decision and it holds here, but it governs the chooser you use to fill a slot. A build already sitting in a slot is never removed from view because the context changed, or you would set the biome and watch your comparison empty itself.

> [!info] Opening a curated build here does not fork it
> The 39 curated builds are yours and are never written to. Placing one in a comparison slot is a read. Forking only happens when you open one in the builder, which is existing behaviour and unchanged.

---

## FR-3: Overlap checks

Four checks. Every one reads a field that already exists.

### Requirements

- **FR-3.1** Checks are **advisory only**. They never remove a build from the chooser and never block a slot.
- **FR-3.2** Three severities: **red** for a real error, **amber** for a judgment call, **grey** for information.
- **FR-3.3** The full set:

| Check | Severity | Reads | Fires when |
|---|---|---|---|
| Gear the profile does not own | Red | the assigned profile's lock state | a slot has a profile and its build holds an item that profile has locked |
| Duplicate booster | Red | the `booster` slot | two slots carry the same booster |
| Teamkill overlap | Amber | a hand listed set of ids | two or more appear across a comparison of two or three |
| Nobody carries a backpack | Grey | `stratType` and `usesBackpackSlot` | every filled slot holds a backpack eating support weapon and no slot holds a backpack stratagem |

- **FR-3.4** The teamkill list is five ids, stored as ids: `a-arc-3-tesla-tower`, `a-m-12-mortar-sentry`, `a-g-16-gatling-sentry`, `md-i4-incendiary-mines`, `orbital-380mm-he-barrage`.
- **FR-3.5** Counting backpack eating support weapons requires `stratType === "support"` **and** `usesBackpackSlot === true`. The boolean alone is true on 22 items, because all 13 backpack stratagems carry it too.
- **FR-3.6** `40-K Meltagun` has `usesBackpackSlot: null` and must read as not recorded, never as false.

> [!danger] Do not apply the biome hard gate precedent to these
> Biome filters are hard gates by explicit decision: if the answer is do not bring this, it should not be on the card. Overlap checks are the opposite case. Two players knowingly running mortar sentries are making a choice about how they play, not an error. Warn and move on.

> [!success] The ownership check is the one that earns its place
> It is the only check here that would fire regularly, it fires on exactly the situation that motivated the whole feature, and it exists purely because FR-1 does. Everything else in FR-3 is a cheap bonus riding on the same screen.

> [!info] The mortar sentries that are not on the teamkill list
> `A/M-23 EMS Mortar Sentry` and `A/GM-17 Gas Mortar Sentry` are deliberately absent. They suppress rather than kill, so they do not belong next to the ones that put shells through your squad.

> [!failure] No assisted reload modelling
> 7.0.0 lets either player carry the ammo backpack for Recoilless, Spear and Airburst. A squad size toggle covering this was proposed and declined, on the grounds that you and your brother do not hand each other ammo packs. That decision stands, and it is why FR-3.3's backpack check is grey information rather than a warning about a conflict that would not happen anyway.

---

## FR-4: Two role tags

The data FR-5 needs, and nothing more. Two tags, not six.

### Requirements

- **FR-4.1** The taxonomy is **`anti-armor`** and **`objective`**. Nothing else.
- **FR-4.2** Tags are a new array field on the item, `roles`. Not a reuse of `damageType`, which drives the biome gates and the row icons; overloading it would break the hot exclusion and the cold advantage.
- **FR-4.3** `anti-armor` derives from `stats.apClass` being `AT` or `Heavy`, **gated on lethality** by excluding `damageType` of `utility` and `gas`. The derived set is then reviewed by hand, not shipped raw.
- **FR-4.4** `objective` is hand assigned. `stats.demoForce` assists on throwables and reaches nothing else.
- **FR-4.5** An item carrying no roles is **normal and expected**. There is no validator rule requiring every rated row to carry a tag.
- **FR-4.6** The validator checks that every role value is in `vocabulary.json` and that any hand written list resolves **by id**.
- **FR-4.7** The tier browser gains a role filter. This is where the tags pay off outside the comparison, and it is why FR-4 is worth having even if FR-5 slips.

### What the derivation actually costs

Measured against `items.json`, not estimated.

| Band | Rows | Work |
|---|---|---|
| `apClass` is `AT` or `Heavy` | 57 | The candidate pool |
| Dropped by the lethality gate | 7 | Confirm the gate, no per row judgment |
| `AT` class, AP 5 and above | ~25 | Accept, quick confirm |
| `Heavy` class, AP 4 | 25 | **The real judgment.** This band is where it is decided |
| `objective`, hand listed | ~30 | Assisted by 12 throwables at demo 30 or more |

Roughly **60 decisions**, half of them a review of a derived list rather than a blank row. The earlier draft budgeted this as its own session across 206 rows. At this scope it is not that.

> [!warning] The AP 4 Heavy band is the whole argument
> It holds both `AC-8 Autocannon`, `APW-1 Anti-Materiel Rifle` and `LAS-98 Laser Cannon`, which genuinely open armor, and `G-16 Impact`, `A/ARC-3 Tesla Tower` and `A/FLAM-40 Flame Sentry`, which do not. No rule separates them. That band is where your judgment is actually needed, and it is 25 rows, not 206.

> [!warning] These tags are ours, not a sourced vote
> Every per faction rating in this tool is a u.gg aggregate with a patch stamp, and the UI states provenance on every expanded row. Role tags are our opinion sitting in the same file. The UI must label them as an editorial layer wherever provenance is shown, the same way patch staleness is treated. Two tags on sixty items is a much smaller editorial surface than six on two hundred, but it is not zero.

> [!failure] The earlier draft's AP rule cannot be used as written
> It auto tagged at AP 5 and above with no lethality gate, which catches `G-23 Stun` at AP 6 AT and `A/M-23 EMS Mortar Sentry` at AP 6 AT whose own note reads "non-lethal". FR-4.3's gate exists specifically to drop those seven rows. See Findings worth keeping for the full list.

---

## FR-5: Coverage warnings

The headline. A gap plus the context you are dropping into, said in one or two sentences.

### Requirements

- **FR-5.1** Warnings render at the **top of the comparison**, above the builds.
- **FR-5.2** A warning is a **sentence**, not a status row. No per tag counts on screen, no coverage states, no overall composition score.
- **FR-5.3** The voice matches the curated blurbs, which already read like this: *"No anti-tank, because nothing at this tier needs it."* Short sentences, direct, no hedging.
- **FR-5.4** Every warning is **conditioned on context**: faction, difficulty band, biome and mission type. An unconditioned "you have no anti-tank" is almost always false and always boring.
- **FR-5.5** Advisory only. Nothing is removed, nothing is blocked.
- **FR-5.6** **Silence is the normal state.** A comparison with no real gap says nothing rather than reporting that everything is fine.
- **FR-5.7** Below the `high` difficulty band the warnings stay quiet. All tier data in this project assumes 7 and above, and below roughly 5 none of this matters.

### The warnings

| Fires when | Severity | Reads roughly |
|---|---|---|
| No `anti-armor`, bugs, `high` or `extreme` | Red | Nothing between you opens armor. Chargers come in pairs up here, and a Bile Titan will walk straight through this. |
| No `anti-armor`, bots, `high` or `extreme` | Red | Nothing between you opens armor. Hulks up here arrive with a Factory Strider behind them. |
| One `anti-armor` in a duo, bugs or bots, `extreme` | Amber | One anti-tank between the two of you. If he goes down holding it, you are throwing grenades at a Charger. |
| No `objective`, mission is `nest` | Red | Nothing here closes a hole or a fabricator without spending a stratagem. That is the entire mission. |
| Thin `objective`, biome is `cave` | Amber | Thin on hole closers, and it is a cave map. Most of what you have needs an inside throw and caves do not give you the angle. |
| No `anti-armor`, squids | Grey | Squids. The tier data warns off most dedicated anti-tank on this front anyway. |

> [!success] The cave warning is the one that proves the design
> It is only true because of the biome, it is only sayable because `demoForce` records that 40 closes a hole from outside while 30 needs an inside throw, and your own data already states it: `MD-17 Anti-Tank Mines` carries the note "demo 40 as of 7.0.0, closes holes from outside". A static threshold of "at least one objective" could never produce that sentence.

> [!danger] Do not turn this back into a dashboard
> The pull toward a table of counts is strong because it is easier to build and easier to test. It also produces a panel that says "covered" almost every time, which is the thing that got the earlier design cut. If a warning has nothing worth saying, it says nothing.

> [!question] Does FR-5 also run on a single build
> The examples that prompted this are squad framed, so the comparison is the home. The same checks on one loadout in the builder are nearly free, and "you have no anti-tank and you are going to bugs at 8" is just as true solo. Cheap to add, and it doubles how often the tags earn their keep. Undecided.

---

## Deliberately not built

Every item here was specced in full in the earlier draft and cut on the evidence. Each carries what would have to change for it to come back.

### Squad rooms

Join codes, join links, guest identities, live propagation, host kick, squad context set by a host, 24 hour expiry, accounts.

Cut because it is the only part of the feature needing a backend, a session store and real time sync, and it serves a two person squad who are already talking to each other. A six character code with `0`, `O`, `1`, `I`, `L` and `S` excluded so it survives being read aloud is careful engineering for a problem you do not have.

**What would bring it back:** wanting to plan with people outside the house.

> [!danger] Do not approximate a room locally
> The earlier draft was right about this and the warning is worth keeping. A `localStorage` or URL fragment version of a squad room produces something that appears to work solo and fails the moment a second person joins. FR-2 avoids this by having no room at all: no code, no link, no member list, no sync, no pretence.

### The other four role tags

`chaff`, `sustain`, `mobility` and `control`, which FR-4 leaves out of the six tag taxonomy the earlier draft proposed.

Cut because a tag is only useful when its absence is possible. Almost every primary in the game clears chaff, so a squad with no chaff clear is close to unreachable and the warning would never fire. Nobody has ever wanted to be told they are thin on mobility. These four cost roughly 140 rows of judgment between them and feed no warning worth reading.

**What would bring `chaff` back:** finding a real drop where you both built for heavies and drowned. That is the only one of the four with a plausible failure mode behind it.

### The coverage dashboard

The table of per tag counts, thresholds scaling with squad size, and the four states of absent, thin, covered and redundant.

Cut, but the warnings it was meant to deliver were not. See FR-5. The table is the wrong container: sixteen gear choices in a duo against a threshold of one means it reads "covered" almost every time, and a panel that is right and silent beats a panel that is right and ignored.

The states themselves survive as thresholds inside FR-5, they are just never rendered as a grid. Difficulty also survives, as FR-5.7's gate rather than as a reason to abandon the feature.

### Role claiming

Claiming Anti-Armor or Chaff Clear before picks are made, which then surfaces matching items first in that member's picker.

Cut because filtering a picker by a declared role is pick a primary and have the rest adjust, wearing a different hat. Auto calibration was considered and declined, and `CLAUDE.md` records that tier browsing is the primary tool because you may dislike half the S tiers and enjoy some A tiers.

### An overall composition score

The earlier draft left this undecided and its instinct was right. A single number is satisfying and invites optimising for a figure we invented.

---

## Findings worth keeping

Verified against `src/data/items.json` while reviewing the earlier draft. FR-4 is built directly on the first three, so these are load bearing rather than archival.

### The AP derivation in the earlier draft does not work

It proposed auto tagging `anti-armor` at AP 5 and above. That catches 32 rated rows, six of which are utility or gas:

| Item | Recorded as | Actually |
|---|---|---|
| `G-23 Stun` | AP 6, AT | A stun grenade. `demoForce: 0`, damage type `utility` |
| `A/M-23 EMS Mortar Sentry` | AP 6, AT | Its own note reads "non-lethal" |
| `G-4 Gas` | AP 6, AT | Panics enemies |
| `MD-8 Gas Mines` | AP 6, AT | Gas |
| `A/GM-17 Gas Mortar Sentry` | AP 6, AT | Gas |
| `TX-41 Sterilizer` | AP 5, AT | The only handheld gas gun |

AP in this data records what armor a projectile interacts with, not whether it kills. Two of the draft's own `control` examples auto tag as `anti-armor` under its own rule.

### The demo derivation reaches one slot

`demoForce` is populated on 20 rows, every one a throwable, and only `TED-63 Dynamite` and `G-48 Giga Grenade` carry 40. The draft's own `objective` examples, Grenade Pistol, Eruptor and Grenade Launcher, carry no demo figure at all. `MD-17 Anti-Tank Mines` records "demo 40 as of 7.0.0, closes holes from outside" in free text in its `note` rather than in the field.

`G-123 Thermite` carries `demoForce: 30`, which means the draft contradicted itself on its own worked example: it stated Thermite is `anti-armor` only, and separately that demo 30 tags `objective`.

### Anything hand listed must be keyed by id

The draft specced both its manual override list and its validator check by item name, against the hard rule that nothing stored anywhere references an item by name. Its own taxonomy table proves the point: it lists "Stun Grenade", which is not an item in this data. The item is `G-23 Stun`, and under the draft's own validator rule that entry would have failed the build.

### Stale identifiers

The draft described the reference artifact rather than the application. `kind` is `damageType`. `STRAT_CATEGORY` exists only in `hd2-armory.jsx`, which is kept as a reference implementation and is neither built nor imported; the live equivalents are `usesBackpackSlot` on the item and `stratType`.

### Keep the show unavailable toggle

The draft asked that a member never see gear they cannot select. The shipped picker hides unavailable gear by default **with a toggle to show it**, which is better: seeing what your brother is one warbond away from is the useful case, and it is already built.

---

## Open threads

- **Where the comparison lives.** Drop Bay mode or the Squad destination. See the question above.
- **Whether the `Squad` sidebar entry stays** once nothing in this document uses it.
- **Whether a profile can be attached to a saved build permanently**, or only inside a comparison. Permanent attachment is friendlier and makes the build carry who it is for; it also puts profile ids inside saved loadout objects, which the validator would then have to resolve.
- **Whether the comparison is saved or transient.** Transient is simpler and matches the pre drop moment it serves. Saving it makes it a fifth kind of object in a tool that already has builds, favorites, locks and profiles.
- **Whether FR-5 also runs on a single build** in the builder. See the question under FR-5.
- **Where the `Heavy` band lands.** FR-4's 25 row review is the only real curation cost in this document, and it decides whether the Flamethrower and the Senator count as opening armor. Worth doing in one sitting with the game in front of you rather than from the tables.
