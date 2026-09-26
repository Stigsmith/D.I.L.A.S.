/* ================================================================== */
/* APPLY THE 26 SEPTEMBER 2026 u.gg READ                              */
/*                                                                    */
/* A one shot, the same shape as add-vehicles.mjs. Brings the ratings */
/* from patch 6.3.1 to what u.gg shows for 7.0.2 to 7.1.1, and adds   */
/* the eleven items the game has that D.D.S. did not.                 */
/*                                                                    */
/*   node scripts/apply-ugg-7-1.mjs            report                  */
/*   node scripts/apply-ugg-7-1.mjs --write    apply                   */
/*                                                                    */
/* Every rating is read from scripts/data/ugg-2026-09-26.json, never  */
/* typed here. The new items are written out below, and each field    */
/* says where it came from.                                           */
/* ================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const WRITE = process.argv.includes("--write");

const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const save = (f, doc) => writeFileSync(join(DATA, f), JSON.stringify(doc, null, 2) + "\n");

const SNAP = JSON.parse(readFileSync(join(ROOT, "scripts/data/ugg-2026-09-26.json"), "utf8"));
const items = load("items.json");
const warbonds = load("warbonds.json");
const template = load("ownership.template.json");
const armorSets = load("armor-sets.json");

/* ------------------------------------------------------------------ */
/* The patch each list is stamped with                                 */
/*                                                                     */
/* Five lists print their own: primaries "Updated Manually for Patch   */
/* 7.1.1", and support weapons, backpacks, eagles and sentries "As of  */
/* SEPTEMBER 2026, Patch 7.0.2".                                        */
/*                                                                     */
/* Six print nothing. Each of them already holds something released     */
/* with patch 7.1.0 on 22 September 2026: the Ironclad Democracy       */
/* secondary, throwables, boosters and armor passive, the TD-110 tank, */
/* and on orbitals the Precision Strike's new 80 second cooldown. So    */
/* they were revised on or after 7.1.0, and 7.1.0 is the stamp that     */
/* claims no more than that.                                            */
/* ------------------------------------------------------------------ */

const STAMP = {
  "helldivers-2-primary-weapons-tier-list": "7.1.1",
  "support-weapon-stratagem-tier-list": "7.0.2",
  "helldivers-2-backpack-stratagem-tier-list": "7.0.2",
  "eagle-stratagem-tier-list": "7.0.2",
  "sentry-stratagem-tier-list": "7.0.2",
  "helldivers-2-secondary-weapons-tier-list": "7.1.0",
  "helldivers-2-throwables-tier-list": "7.1.0",
  "orbital-stratagem-tier-list": "7.1.0",
  "booster-tier-list": "7.1.0",
  "armor-passive-tier-list": "7.1.0",
  "helldivers-2-vehicle-tier-list": "7.1.0",
};

/* ------------------------------------------------------------------ */
/* The eleven new items                                                 */
/*                                                                     */
/* Sources, in order of preference:                                     */
/*   u.gg        the source column, DPS, weapon type and AP, as shown   */
/*               beside the vote                                        */
/*   wiki        Module:Decodedata-Attacks, the same data npm run wiki  */
/*               reads, where u.gg writes N/A                           */
/*   Arrowhead   the Ironclad Democracy announcement, 15 September      */
/*               2026, for what a booster or passive does               */
/*                                                                     */
/* Damage type is read off the wiki's attacks rather than the name:     */
/* the Sai carries a heat block, the Breacher's blast applies Fire and  */
/* Thermite as the G-123 does, the Immolation's only damage is its Fire */
/* status.                                                              */
/*                                                                     */
/* Notes are left empty. A note is opinion, and nobody here has played  */
/* any of these.                                                        */
/* ------------------------------------------------------------------ */

const IRONCLAD = { type: "warbond", warbond: "ironclad-democracy" };
const apClassFor = (ap) => (ap === null ? null : ap >= 5 ? "AT" : ap === 4 ? "Heavy" : null);

const blankStats = { ap: null, apClass: null, dps: null, capacity: null, demoForce: null, cooldown: null, uses: null, usesUpgraded: null, medals: null };

const NEW = [
  { name: "AR-11 Arbitrator", slot: "primary", category: "Assault Rifle", damageType: "ballistic", acquisition: IRONCLAD, stats: { ap: 2, dps: 1400 } },
  { name: "GL-15 Evictor", slot: "primary", category: "Explosive", damageType: "explosive", acquisition: IRONCLAD, stats: { ap: 3, dps: 490 } },
  /* Superstore: u.gg's primaries list has no source column, and draws the
     Sai with the Super Credit icon it uses for the Double Freedom and the
     Sweeper, both Superstore items here. */
  { name: "LAS-12 Sai", slot: "primary", category: "Energy", damageType: "heat", acquisition: { type: "superstore", warbond: null }, stats: { ap: 3, dps: 1066 } },
  /* Special, the category the P-33 Missile Pistol and the Grenade Pistol
     carry. AP 7 is the blast, per u.gg and the wiki alike. */
  { name: "P-34 Breacher", slot: "secondary", category: "Special", damageType: "fire", acquisition: IRONCLAD, stats: { ap: 7 } },
  /* u.gg writes N/A for both, and the wiki's burst is AP 0 and demolition
     0 with the damage in its Fire status. Recorded as absent, the way the
     smoke grenades are, rather than as a zero that reads like a number. */
  { name: "G-8 Immolation", slot: "throwable", damageType: "fire", acquisition: IRONCLAD, stats: {} },
  /* Demolition 40 is the wiki's. u.gg leaves it N/A. It is the figure that
     closes a bug hole from outside, so it is worth having right. */
  { name: "G-60 Anti-Tank Seeker", slot: "throwable", damageType: "explosive", acquisition: IRONCLAD, stats: { ap: 5, demoForce: 40 } },
  { name: "Eagle Gas Airstrike", slot: "stratagem", stratType: "eagle", damageType: "gas", usesBackpackSlot: false, acquisition: { type: "campaign", warbond: null }, stats: { uses: 2, usesUpgraded: 3 } },
  /* Cooldown and source are u.gg's. It has no wiki data yet, so no AP and
     no demolition: an admitted gap rather than a guess from the TD-220. */
  { name: "TD-110 Maelstrom", slot: "stratagem", stratType: "vehicle", damageType: "explosive", usesBackpackSlot: false, acquisition: { type: "campaign", warbond: null }, stats: { cooldown: 780 } },
  { name: "Surplus EAT Allocation", slot: "booster", damageType: "utility", acquisition: IRONCLAD, stats: { medals: 55 }, effect: "Two free Expendable Anti-Tank call-ins per mission" },
  { name: "Integrated Extinguishers", slot: "booster", damageType: "utility", acquisition: IRONCLAD, stats: { medals: 65 }, effect: "Burning goes out faster" },
  /* Armor passives stay on the armor set path, never a warbond: the source
     maps passives to set names. CLAUDE.md, Collection. */
  { name: "Blunt-Force Mitigation", slot: "armor", damageType: "utility", acquisition: { type: "armorSet", warbond: null }, stats: {}, traits: ["survive"], effect: "Harder to knock down, 30% less damage from impacts and collisions, higher armor rating" },
];

const NEW_SETS = {
  /* From the warbond announcement: a light and a heavy set, both Ironclad
     Democracy. No medium. */
  "blunt-force-mitigation": { light: ["BFM-16 Tanker"], medium: [], heavy: ["BFM-220 Ironclad"] },
};

/* One rename. u.gg and the 7.1.0 patch notes both say Melta Mine; the
   source tables said Meltamine. The id stays, the old name becomes an
   alias, and anything saved under it still resolves. */
const RENAMES = { "g-40-k-meltamine": "G/40-K Melta Mine" };

/* u.gg spells two items differently from the game. Matched by hand, so a
   wrong pairing would be visible here rather than hidden in a fuzzy match. */
const UGG_SPELLING = {
  "G-89 Smokecreen": "g-89-smokescreen",
  "SH-20 Ballistic Shield Backpack": "sh-20-ballistic-shield",
};

/* Stats u.gg supplies that the item was missing. Only fills a null, never
   overwrites a number already there: the DPS rounding differences on the
   Eruptor, the Punisher Plasma and the Hyena are u.gg quoting to two
   decimals, not a change. */
const FILL = {
  "g-40-k-meltamine": { ap: 7, apClass: "AT", demoForce: 10 },
  "r-40-k-hot-shot-marksman-rifle": { dps: 962 },
};

/* ------------------------------------------------------------------ */

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

const log = [];
const say = (s) => log.push(s);

/* The warbond, and its row in the ownership template. */
if (!warbonds.warbonds.some((w) => w.id === "ironclad-democracy")) {
  const at = warbonds.warbonds.findIndex((w) => w.tier === "legendary");
  warbonds.warbonds.splice(at, 0, { id: "ironclad-democracy", name: "Ironclad Democracy", tier: "premium" });
  say("warbond    + Ironclad Democracy, premium");
}
if (!("ironclad-democracy" in template.warbonds)) template.warbonds["ironclad-democracy"] = false;

/* The new items. */
for (const n of NEW) {
  const id = slug(n.name);
  if (items.some((i) => i.id === id)) continue;
  const stats = { ...blankStats, ...n.stats };
  stats.apClass = apClassFor(stats.ap);
  items.push({
    id,
    name: n.name,
    aliases: [],
    slot: n.slot,
    stratType: n.stratType ?? null,
    category: n.category ?? null,
    damageType: n.damageType,
    usesBackpackSlot: n.usesBackpackSlot ?? null,
    acquisition: n.acquisition,
    stats,
    ratings: { bots: { tier: null, source: null, patch: null }, bugs: { tier: null, source: null, patch: null }, squids: { tier: null, source: null, patch: null } },
    roles: [],
    tags: [],
    traits: n.traits ?? [],
    flag: null,
    patchNote: null,
    effect: n.effect ?? null,
    note: null,
  });
  say(`item       + ${n.name}`);
}
for (const [key, sets] of Object.entries(NEW_SETS)) if (!armorSets[key]) armorSets[key] = sets;

for (const [id, name] of Object.entries(RENAMES)) {
  const it = items.find((i) => i.id === id);
  if (it && it.name !== name) {
    if (!it.aliases.includes(it.name)) it.aliases.push(it.name);
    say(`rename     ${it.name} -> ${name}`);
    it.name = name;
  }
}

for (const [id, patch] of Object.entries(FILL)) {
  const it = items.find((i) => i.id === id);
  for (const [k, v] of Object.entries(patch)) {
    if (it.stats[k] === null) { it.stats[k] = v; say(`stat       ${it.name} ${k} ${v}`); }
  }
}

/* The ratings. */
const index = new Map();
for (const it of items) for (const n of [it.name, ...it.aliases]) index.set(norm(n), it);

const F = ["bots", "bugs", "squids"];
const TIERS = new Set(["S+", "S", "A", "B", "C", "D"]);
let restamped = 0;
const moved = [];
const firstRating = [];
const unmatched = [];
const read = new Set();

for (const list of SNAP.lists) {
  const patch = STAMP[list.list];
  if (!patch) throw new Error(`no stamp decided for ${list.list}`);
  for (const [name, ...votes] of list.rows) {
    const it = UGG_SPELLING[name] ? items.find((i) => i.id === UGG_SPELLING[name]) : index.get(norm(name));
    if (!it) { unmatched.push(`${name} (${list.list})`); continue; }
    read.add(it.id);
    const hadAny = F.some((f) => it.ratings[f].tier);
    F.forEach((f, k) => {
      const tier = TIERS.has(votes[k]) ? votes[k] : null;
      const before = it.ratings[f].tier;
      it.ratings[f] = tier ? { tier, source: "ugg", patch } : { tier: null, source: null, patch: null };
      if (before && tier && before !== tier) moved.push(`${it.name.padEnd(32)} ${f.padEnd(6)} ${before} -> ${tier}`);
    });
    restamped += 1;
    if (!hadAny && F.some((f) => it.ratings[f].tier)) {
      firstRating.push(`${it.name.padEnd(32)} ${F.map((f) => it.ratings[f].tier || "-").join("/")}`);
      if (it.flag === "new") it.flag = null;
    }
  }
}

/* The 19 stale flags. Every one was a vote from 6.3.1 that predated a
   7.0.0 change to that item. Each u.gg list is now stamped past 7.0.0, so
   the vote has had the chance to absorb the change. It kept every one of
   those tiers, which is its answer, and the caveat no longer applies. The
   note goes with the flag, because a note with no flag is text nothing
   shows. */
let cleared = 0;
for (const it of items) {
  if (it.flag === "stale") {
    if (read.has(it.id)) { it.flag = null; it.patchNote = null; cleared += 1; }
    else say(`STILL STALE ${it.name}: not on any u.gg list, so nothing has restamped it`);
  }
}

const notRead = items.filter((i) => !read.has(i.id));

console.log(`\n  u.gg read of ${SNAP.readOn}\n`);
log.forEach((l) => console.log("  " + l));
console.log(`\n  restamped      ${restamped} items`);
console.log(`  tiers moved    ${moved.length}`);
moved.forEach((m) => console.log("    " + m));
console.log(`  rated for the first time   ${firstRating.length}`);
firstRating.forEach((m) => console.log("    " + m));
console.log(`  stale flags cleared        ${cleared}`);
console.log(`  u.gg rows matching nothing ${unmatched.length}`);
unmatched.forEach((m) => console.log("    " + m));
console.log(`  items u.gg does not list   ${notRead.length}`);
notRead.forEach((i) => console.log(`    ${i.name.padEnd(32)} keeps ${F.map((f) => i.ratings[f].tier ? `${i.ratings[f].tier}@${i.ratings[f].patch}` : "-").join(" ")}`));
console.log(`  items now      ${items.length}, rated ${items.filter((i) => F.some((f) => i.ratings[f].tier)).length}, warbonds ${warbonds.warbonds.length}`);

if (unmatched.length) {
  console.log("\n  Refusing to write while a u.gg row matches nothing.\n");
  process.exit(1);
}

/* warbonds.json and armor-sets.json are hand formatted, one warbond per
   line and one short array per weight class. Rewriting them through
   JSON.stringify would churn every line for two additions, so the new
   entries go in as text, in the file's own style, and the result is
   parsed back to prove it is still valid. */
function insertText(file, anchor, text) {
  const path = join(DATA, file);
  const raw = readFileSync(path, "utf8");
  if (raw.includes(text.trim())) return;
  const at = raw.indexOf(anchor);
  if (at < 0) throw new Error(`${file}: anchor not found`);
  const next = raw.slice(0, at) + text + raw.slice(at);
  JSON.parse(next);
  writeFileSync(path, next);
}

if (WRITE) {
  save("items.json", items);
  save("ownership.template.json", template);
  insertText(
    "warbonds.json",
    '    { "id": "halo-odst"',
    '    { "id": "ironclad-democracy", "name": "Ironclad Democracy", "tier": "premium" },\n'
  );
  insertText(
    "armor-sets.json",
    "\n}",
    ',\n  "blunt-force-mitigation": {\n    "light": ["BFM-16 Tanker"],\n    "medium": [],\n    "heavy": ["BFM-220 Ironclad"]\n  }'
  );
  console.log("\n  Written.\n");
} else {
  console.log("\n  Report only. Add --write to apply.\n");
}
