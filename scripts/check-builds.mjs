/* ================================================================== */
/* LOADOUT RULE HEALTH                                                */
/*                                                                    */
/* Reports, never writes, same discipline as check-rules.mjs.         */
/*                                                                    */
/*   npm run builds                                                   */
/*                                                                    */
/* Two questions per rule. Does it fire on something that varies      */
/* between builds, and how far does it move one when it does.         */
/*                                                                    */
/* It exists for the same reason check-rules.mjs does. The five       */
/* armour rules that shipped in 1.10.0 fired on 94% of primaries and  */
/* took a tier off 42 of 51, and the whole failure was visible in one */
/* line of output that nothing was printing. Loadout rules are the    */
/* same instrument pointed at a different altitude, so they get the   */
/* same check before anyone trusts them.                              */
/* ================================================================== */

import { build, loadouts, items, score, readJson, FACTIONS } from "./lib/app.mjs";

const RULES = readJson("src/data/build-rules.json").rules;
const PRESETS = loadouts.presets;
const RANK = { "S+": 6, S: 5, A: 4, B: 3, C: 2, D: 1 };

/* The scenarios a build is actually read in. Every curated build declares
   a front and only ever appears on it, so a build is measured against its
   own front rather than all three: reading a bugs build against bots is
   measuring a situation the tool never puts on screen.

   Difficulty and squad are swept because they are the two the reader
   changes most, and because a rule that moves nothing across all of them
   is a rule that has stopped depending on the drop. */
const SWEEP = [];
for (const difficulty of [0, 3, 5, 7, 10]) {
  for (const squad of [0, 1, 2, 4]) {
    SWEEP.push({ difficulty, squad });
  }
}

const scenariosFor = (loadout) =>
  SWEEP.map((s) => ({ faction: loadout.faction, hazards: [], biome: null, mission: null, ...s }));

/* ------------------------------------------------------------------ */
/* Per rule                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* The sample                                                          */
/*                                                                     */
/* The 39 curated builds are not a fair denominator and the curator     */
/* said so plainly on 22 August 2026: they are legacy AI generations    */
/* made before this project had stats or scoring behind it, and         */
/* dilas-roadmap.md already measured the damage. 35 of 39 use an S or S+  */
/* primary, 13 distinct primaries appear across all of them, and three  */
/* A tier marksman rifles for bots appear zero times.                   */
/*                                                                     */
/* So a rule measured only against them is measured against one narrow  */
/* corner of what a build can be. Random legal builds are the honest    */
/* denominator for "does this rule discriminate", because they span the */
/* pool the rule will actually meet once anyone builds their own.       */
/*                                                                     */
/* Both are reported. The curated set still matters as the thing on     */
/* screen today, and the gap between the two columns is itself worth    */
/* reading: a rule that fires far more often on the curated set than on */
/* a random one is describing his 39, not a build.                      */
/* ------------------------------------------------------------------ */

/* Seeded, so two runs of this report are comparable and a coefficient
   change is the only thing that can move a number. mulberry32. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL = items.items;
const pool = (slot) => ALL.filter((i) => i.slot === slot);
const POOLS = {
  primary: pool("primary"),
  secondary: pool("secondary"),
  throwable: pool("throwable"),
  armor: pool("armor"),
  booster: pool("booster"),
  stratagem: pool("stratagem"),
};

/* A build you could actually field: every slot filled, and no stratagem
   twice, because the game does not let you bring one twice and a sample
   full of double Autocannons measures nothing real. */
function randomBuild(faction, r, n) {
  const pick = (list) => list[Math.floor(r() * list.length)];
  const strats = [];
  while (strats.length < 4) {
    const s = pick(POOLS.stratagem);
    if (!strats.includes(s.id)) strats.push(s.id);
  }
  return {
    id: `random-${faction}-${n}`,
    name: `random ${n}`,
    faction,
    preset: false,
    mission: "standard",
    alt: [], diff: ["mid", "high"], biomes: [], fire: false,
    primary: pick(POOLS.primary).id,
    secondary: pick(POOLS.secondary).id,
    grenade: pick(POOLS.throwable).id,
    armor: pick(POOLS.armor).id,
    booster: pick(POOLS.booster).id,
    strats,
    blurb: "",
  };
}

const RANDOM = [];
{
  const r = rng(20260822);
  for (const faction of FACTIONS) {
    for (let n = 0; n < 100; n += 1) RANDOM.push(randomBuild(faction, r, n));
  }
}

/* A rule that only ever fires on something you are still writing reads as
   dead against a set of 39 finished builds, which is a hole in the
   measurement rather than a fault in the rule. So the sample carries one
   half written build alongside the curated ones: the same loadout with
   its stratagems and booster stripped out, which is what the builder
   holds while you are still choosing. */
const DRAFTS = PRESETS.slice(0, 3).map((l) => ({
  ...l,
  id: l.id + "-draft",
  name: l.name + " (mid build)",
  strats: [null, null, null, null],
  booster: null,
}));
const SAMPLE = [...PRESETS, ...DRAFTS];

const rows = [];
for (const rule of RULES) {
  let fired = 0;
  let eligible = 0;
  let moved = 0;
  const builds = new Set();
  const randomHits = new Set();

  for (const loadout of [...SAMPLE, ...RANDOM]) {
    const isRandom = loadout.id.startsWith("random-");
    for (const scenario of scenariosFor(loadout)) {
      /* A rule gated on a biome or a mission trait needs one, or it reads
         as dead when it is only unasked. Same correction check-rules.mjs
         makes for difficulty and squad. */
      const when = rule.when || {};
      const s = {
        ...scenario,
        biome: (when.biome || [])[0] ?? scenario.biome,
        mission: when.mission ? missionWith(when.mission) : scenario.mission,
      };
      if (!isRandom) eligible += 1;
      const r = build.readBuild(loadout, s);
      const hit = r.notes.some((n) => n.id === rule.id);
      if (isRandom) { if (hit) randomHits.add(loadout.id); continue; }
      if (hit) {
        fired += 1;
        builds.add(loadout.id);
        if (r.tier && r.partsTier && RANK[r.tier] !== RANK[r.partsTier]) moved += 1;
      }
    }
  }

  rows.push({
    id: rule.id,
    fired,
    eligible,
    moved,
    builds: builds.size,
    pct: eligible ? Math.round((fired / eligible) * 100) : 0,
    spread: Math.round((builds.size / SAMPLE.length) * 100),
    wild: Math.round((randomHits.size / RANDOM.length) * 100),
  });
}

/* A mission carrying the trait a rule wants, so the sample is a mission
   that exists rather than a name invented to satisfy the matcher. */
function missionWith(traits) {
  const missions = readJson("src/data/missions.json").missions;
  const hit = missions.find((m) => m.traits.some((t) => traits.includes(t)));
  return hit ? hit.name : null;
}

rows.sort((a, b) => b.wild - a.wild || b.spread - a.spread);

console.log("\n  Loadout rule health. Every rule measured on the 39 curated builds plus 3 half written ones,");
console.log("  each on its own front, across five difficulties and four squad sizes.\n");
console.log("  random  curated  fired/pool   moved a tier   rule");
for (const r of rows) {
  const note =
    r.fired === 0 && r.wild === 0
      ? "   NEVER FIRES, check its match clause"
      : r.wild >= 60
        ? "   fires on most of any build, is it saying anything"
        : "";
  console.log(
    `   ${String(r.wild).padStart(3)}%    ${String(r.spread).padStart(4)}%  ${String(r.fired).padStart(5)}/${String(r.eligible).padEnd(5)} ${String(r.moved).padStart(9)}       ${r.id}${note}`
  );
}

/* ------------------------------------------------------------------ */
/* What the whole engine does to the set                               */
/*                                                                     */
/* The number the armour bug needed and nobody printed: how much of the */
/* population moves. A layer that re-ranks nearly everything is not     */
/* ranking, it is shifting the whole list sideways.                     */
/* ------------------------------------------------------------------ */

console.log("\n  What the loadout layer does to the 39, against what their parts alone say.\n");

for (const label of ["nothing set", "four at 7", "solo at 10"]) {
  const s =
    label === "nothing set" ? { difficulty: 0, squad: 0 }
      : label === "four at 7" ? { difficulty: 7, squad: 4 }
        : { difficulty: 10, squad: 1 };

  let movedUp = 0;
  let movedDown = 0;
  let same = 0;
  let worst = null;
  const tiers = {};

  for (const loadout of PRESETS) {
    const r = build.readBuild(loadout, { faction: loadout.faction, hazards: [], ...s });
    if (r.tier === null) continue;
    tiers[r.tier] = (tiers[r.tier] || 0) + 1;
    const d = RANK[r.tier] - RANK[r.partsTier];
    if (d > 0) movedUp += 1;
    else if (d < 0) movedDown += 1;
    else same += 1;
    if (!worst || r.adjust < worst.adjust) worst = { name: loadout.name, adjust: r.adjust, tier: r.tier, partsTier: r.partsTier };
  }

  const total = movedUp + movedDown + same;
  const pct = (n) => `${Math.round((n / total) * 100)}%`;
  const ladder = ["S+", "S", "A", "B", "C", "D"].filter((t) => tiers[t]).map((t) => `${t} ${tiers[t]}`).join("  ");
  console.log(`  ${label.padEnd(13)} moved ${String(movedUp + movedDown).padStart(2)} of ${total} (${pct(movedUp + movedDown)}), ${movedDown} down and ${movedUp} up`);
  console.log(`  ${"".padEnd(13)} ladder  ${ladder}`);
  if (worst) console.log(`  ${"".padEnd(13)} hardest hit  ${worst.name}, ${Math.round(worst.adjust)} points, ${worst.partsTier} to ${worst.tier}`);
  console.log("");
}

/* ------------------------------------------------------------------ */
/* Pairings                                                            */
/*                                                                     */
/* Item rules in context-rules.json that read the rest of the build:   */
/* True Grit beside a Recoilless, a Cremator beside fire resistance.   */
/* A random build carries any one passive about once in thirty, so a   */
/* plain sweep would see almost none of them. Instead each item the    */
/* rule is about is placed into 60 random builds, 20 per front, and    */
/* the question is how often the pairing fires once you carry it.      */
/* Near 0% is a pairing nobody will meet; near 100% is a rule that     */
/* fires whatever else you bring, which is not a pairing at all.       */
/* ------------------------------------------------------------------ */

const PAIRING_KEYS = ["alongside", "notAlongside"];
const PAIRINGS = readJson("src/data/context-rules.json").rules.filter((r) =>
  PAIRING_KEYS.some((k) => JSON.stringify(r.match || {}).includes(`"${k}"`))
);
const SLOT_KEY = { primary: "primary", secondary: "secondary", throwable: "grenade", armor: "armor", booster: "booster" };

/* The gentlest scenario the rule's own gate allows. */
function pairingScenario(rule, faction) {
  const when = rule.when || {};
  const s = { faction, hazards: when.hazard || [], biome: null, mission: when.mission ? missionWith(when.mission) : null, difficulty: 0, squad: 0 };
  if (when.peril || when.squad || when.difficulty) {
    for (let sq = 4; sq >= 1; sq -= 1) {
      if (when.squad && !score.numberTest(sq, when.squad)) continue;
      const d = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((d) => {
        if (when.difficulty && !score.numberTest(d, when.difficulty)) return false;
        return !when.peril || score.numberTest(score.peril({ difficulty: d, squad: sq }), when.peril);
      });
      if (d) { s.difficulty = d; s.squad = sq; break; }
    }
  }
  return s;
}

function place(loadout, item) {
  if (item.slot !== "stratagem") return { ...loadout, [SLOT_KEY[item.slot]]: item.id };
  const strats = loadout.strats.filter((id) => id !== item.id).slice(0, 3);
  return { ...loadout, strats: [item.id, ...strats] };
}

console.log("\n  Pairings. Each item a pairing is about, placed in 60 random builds, 20 per front.\n");
console.log("  fires  items  rule");
const pairRows = [];
{
  const r = rng(20261004);
  const hosts = FACTIONS.flatMap((faction) => Array.from({ length: 20 }, (_, n) => randomBuild(faction, r, n)));
  for (const rule of PAIRINGS) {
    const subject = Object.fromEntries(Object.entries(rule.match).filter(([k]) => !PAIRING_KEYS.includes(k)));
    const subjects = ALL.filter((it) =>
      score.matches({ item: it, wiki: items.statsFor(it.id), armour: null, scenario: {} }, subject)
    );
    let tries = 0;
    let fired = 0;
    for (const it of subjects) {
      for (const host of hosts) {
        if (!it.ratings[host.faction].tier) continue;
        tries += 1;
        const reading = build.readBuild(place(host, it), pairingScenario(rule, host.faction));
        const part = reading.parts.find((p) => p.item.id === it.id);
        if (part && part.reasons.some((x) => x.id === rule.id)) fired += 1;
      }
    }
    const pct = tries ? Math.round((fired / tries) * 100) : 0;
    pairRows.push({ id: rule.id, pct, subjects: subjects.length });
    const note = !fired ? "   NEVER FIRES, check its match clause" : pct >= 95 ? "   fires whatever else you bring, is it a pairing" : "";
    console.log(`   ${String(pct).padStart(3)}%  ${String(subjects.length).padStart(5)}  ${rule.id}${note}`);
  }
}
console.log("");

const loud = rows.filter((r) => r.wild >= 60);
const dead = rows.filter((r) => r.fired === 0 && r.wild === 0);
if (dead.length) console.log(`  ${dead.length} rule(s) never fire at all.`);
if (loud.length) {
  console.log(`  ${loud.length} rule(s) fire on 60% or more of 300 random builds. That is the shape the armour rules had.`);
  console.log("  A rule that fires on nearly every build is describing the pool, not the build.");
}
if (!dead.length && !loud.length) {
  console.log(`  ${rows.length} rules, all discriminating. Nothing is describing the whole set.`);
}
console.log("");
