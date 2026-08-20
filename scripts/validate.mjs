/* ================================================================== */
/* DATA VALIDATOR                                                     */
/*                                                                    */
/* Every stored reference in this project is an item id. Loadouts,    */
/* collection state, armor set lookups and the ownership file all     */
/* point at ids, and an id that matches nothing fails silently: the   */
/* slot just comes up empty and nothing complains. The display name   */
/* is an ordinary field now, so a rename is cheap, but only as long   */
/* as the ids really are unique and really do resolve.                */
/*                                                                    */
/* This runs as prebuild, so a break stops the build rather than      */
/* shipping. Run it on its own with: npm run validate                 */
/* ================================================================== */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const items = load("items.json");
const loadouts = load("loadouts.json");
const armorSets = load("armor-sets.json");
const { warbonds } = load("warbonds.json");
const ownership = load("ownership.json");
const ownershipTemplate = load("ownership.template.json");
const vocab = load("vocabulary.json");
const wikiStats = load("wiki-stats.json");

const problems = [];
const fail = (msg, list) => {
  problems.push(list && list.length ? `${msg}\n    ${list.join("\n    ")}` : msg);
};

const set = (a) => new Set(a);
const TIERS = set(vocab.tiers);
const SLOTS = set(vocab.slots);
const STRAT_TYPES = set(vocab.stratTypes);
const DAMAGE = set(vocab.damageTypes);
const FLAGS = set(vocab.flags);
const SOURCES = set(vocab.ratingSources);
const ACQUISITION = set(vocab.acquisitionTypes);
const TRAITS = set(vocab.armorTraits.map((t) => t.id));
const ROLES = set(vocab.roles);

/* ------------------------------------------------------------------ */
/* Ids                                                                 */
/* ------------------------------------------------------------------ */

const ids = new Set();
const dupeIds = [];
const badFormat = [];
for (const it of items) {
  if (ids.has(it.id)) dupeIds.push(it.id);
  ids.add(it.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.id)) badFormat.push(`${it.id}   (${it.name})`);
}
if (dupeIds.length) fail(`${dupeIds.length} duplicate item id(s). Ids are the primary key, so a duplicate makes every stored reference ambiguous:`, [...new Set(dupeIds)]);
if (badFormat.length) fail(`${badFormat.length} id(s) are not lowercase hyphenated slugs:`, badFormat);

const names = new Map();
const dupeNames = [];
for (const it of items) {
  if (names.has(it.name)) dupeNames.push(`${it.name}   (${names.get(it.name)} and ${it.id})`);
  names.set(it.name, it.id);
}
if (dupeNames.length) fail(`${dupeNames.length} duplicate display name(s). Not fatal now that ids are the key, but two rows reading the same is a data error:`, dupeNames);

/* An alias that collides with a live id would make a rename resolve   */
/* an old reference onto the wrong item.                               */
const aliasCollisions = [];
const aliasOwner = new Map();
for (const it of items) {
  for (const a of it.aliases) {
    const asId = a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (ids.has(asId)) aliasCollisions.push(`"${a}" on ${it.id} slugs to live id ${asId}`);
    if (names.has(a) && names.get(a) !== it.id) aliasCollisions.push(`"${a}" on ${it.id} is the live display name of ${names.get(a)}`);
    if (aliasOwner.has(a)) aliasCollisions.push(`"${a}" claimed by both ${aliasOwner.get(a)} and ${it.id}`);
    aliasOwner.set(a, it.id);
  }
}
if (aliasCollisions.length) fail(`${aliasCollisions.length} alias collision(s):`, aliasCollisions);

/* ------------------------------------------------------------------ */
/* Item fields                                                         */
/* ------------------------------------------------------------------ */

const byId = new Map(items.map((i) => [i.id, i]));
const warbondIds = set(warbonds.map((w) => w.id));

const badField = [];
const staleWithoutNote = [];
for (const it of items) {
  const at = (what, v) => badField.push(`${it.id}: ${what} is ${JSON.stringify(v)}`);

  if (!SLOTS.has(it.slot)) at("slot", it.slot);
  if (!DAMAGE.has(it.damageType)) at("damageType", it.damageType);
  if (it.flag !== null && !FLAGS.has(it.flag)) at("flag", it.flag);
  if (it.flag === "stale" && !it.patchNote) staleWithoutNote.push(`${it.id}   (${it.name})`);

  if (it.slot === "stratagem") {
    if (!STRAT_TYPES.has(it.stratType)) at("stratType", it.stratType);
  } else if (it.stratType !== null) {
    at("stratType on a non stratagem", it.stratType);
  }

  if (it.category !== null && it.slot !== "primary" && it.slot !== "secondary") {
    at("category on something that is not a primary or secondary", it.category);
  }
  if (it.category === null && (it.slot === "primary" || it.slot === "secondary")) {
    at("category", it.category);
  }

  for (const t of it.traits) {
    if (!TRAITS.has(t)) at("trait", t);
  }
  if (it.traits.length && it.slot !== "armor") at("traits on a non armor item", it.traits);
  if (!it.traits.length && it.slot === "armor") at("traits", it.traits);

  /* Roles are our editorial layer, written by scripts/tag-roles.mjs.    */
  /* The values are checked and duplicates are rejected, but an empty    */
  /* array is correct and common: most items do neither of these jobs.   */
  /* Deliberately no rule demanding every rated row carry one. That rule */
  /* is what forced boosters and armor passives into a taxonomy with no  */
  /* room for them.                                                      */
  if (!Array.isArray(it.roles)) {
    at("roles", it.roles);
  } else {
    for (const r of it.roles) {
      if (!ROLES.has(r)) at("role", r);
    }
    if (new Set(it.roles).size !== it.roles.length) at("duplicate role", it.roles);
  }

  if (!ACQUISITION.has(it.acquisition.type)) at("acquisition.type", it.acquisition.type);
  if (it.acquisition.type === "warbond") {
    if (!warbondIds.has(it.acquisition.warbond)) at("acquisition.warbond matches no warbond", it.acquisition.warbond);
  } else if (it.acquisition.warbond !== null) {
    at("acquisition.warbond set on a non warbond path", it.acquisition.warbond);
  }

  for (const f of ["bots", "bugs", "squids"]) {
    const r = it.ratings[f];
    if (!r) { at(`ratings.${f}`, r); continue; }
    if (r.tier !== null && !TIERS.has(r.tier)) at(`ratings.${f}.tier`, r.tier);
    if (r.tier === null && (r.source !== null || r.patch !== null)) {
      at(`ratings.${f} has provenance but no tier`, r);
    }
    if (r.tier !== null && !SOURCES.has(r.source)) at(`ratings.${f}.source`, r.source);
    if (r.tier !== null && !r.patch) at(`ratings.${f}.patch`, r.patch);
  }
}
if (badField.length) fail(`${badField.length} item field(s) outside the vocabulary:`, badField);
if (staleWithoutNote.length) fail(`${staleWithoutNote.length} item(s) flagged stale with no patch note. A stale flag has to say what changed:`, staleWithoutNote);

/* ------------------------------------------------------------------ */
/* Loadouts. Every slot has to resolve, and to the right kind of item.  */
/* ------------------------------------------------------------------ */

const badRef = [];
const wrongSlot = [];
const loadoutIds = new Set();
const dupeLoadouts = [];
for (const l of loadouts) {
  if (loadoutIds.has(l.id)) dupeLoadouts.push(l.id);
  loadoutIds.add(l.id);

  for (const [field, wanted] of Object.entries(vocab.slotForLoadoutSlot)) {
    const ref = l[field];
    if (!ref) { badRef.push(`${l.id}.${field} is empty`); continue; }
    const item = byId.get(ref);
    if (!item) badRef.push(`${l.id}.${field} references ${ref}, which matches no item`);
    else if (item.slot !== wanted) wrongSlot.push(`${l.id}.${field} references ${ref}, which is a ${item.slot}, not a ${wanted}`);
  }

  for (const ref of l.strats) {
    const item = byId.get(ref);
    if (!item) badRef.push(`${l.id}.strats references ${ref}, which matches no item`);
    else if (item.slot !== "stratagem") wrongSlot.push(`${l.id}.strats references ${ref}, which is a ${item.slot}, not a stratagem`);
  }
  if (l.strats.length !== 4) wrongSlot.push(`${l.id} carries ${l.strats.length} stratagems, not 4`);
}
if (dupeLoadouts.length) fail(`${dupeLoadouts.length} duplicate loadout id(s):`, [...new Set(dupeLoadouts)]);
if (badRef.length) fail(`${badRef.length} loadout reference(s) matching no item:`, badRef);
if (wrongSlot.length) fail(`${wrongSlot.length} loadout slot(s) holding the wrong kind of item:`, wrongSlot);

/* ------------------------------------------------------------------ */
/* Armor sets                                                          */
/* ------------------------------------------------------------------ */

const badArmorKey = [];
for (const id of Object.keys(armorSets)) {
  const item = byId.get(id);
  if (!item) badArmorKey.push(`${id} matches no item`);
  else if (item.slot !== "armor") badArmorKey.push(`${id} is a ${item.slot}, not an armor passive`);
}
const armorWithoutSets = items.filter((i) => i.slot === "armor" && !armorSets[i.id]).map((i) => i.id);
if (badArmorKey.length) fail(`armor-sets.json has ${badArmorKey.length} bad key(s):`, badArmorKey);
if (armorWithoutSets.length) fail(`${armorWithoutSets.length} armor passive(s) with no set listing:`, armorWithoutSets);

/* ------------------------------------------------------------------ */
/* Warbonds and ownership                                              */
/* ------------------------------------------------------------------ */

const badWarbond = [];
const seenWarbond = new Set();
for (const w of warbonds) {
  if (seenWarbond.has(w.id)) badWarbond.push(`duplicate warbond id ${w.id}`);
  seenWarbond.add(w.id);
  if (!vocab.warbondTiers.includes(w.tier)) badWarbond.push(`${w.id} has tier ${JSON.stringify(w.tier)}`);
}
if (badWarbond.length) fail(`warbonds.json has ${badWarbond.length} problem(s):`, badWarbond);

for (const [label, doc] of [["ownership.json", ownership], ["ownership.template.json", ownershipTemplate]]) {
  const wb = (doc && doc.warbonds) || {};
  const it = (doc && doc.items) || {};
  const badWb = Object.keys(wb).filter((id) => !warbondIds.has(id));
  const badIt = Object.keys(it).filter((id) => !ids.has(id));
  const badVal = [...Object.entries(wb), ...Object.entries(it)]
    .filter(([, v]) => typeof v !== "boolean")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  if (badWb.length) fail(`${label} names ${badWb.length} warbond id(s) that do not exist:`, badWb);
  if (badIt.length) fail(`${label} names ${badIt.length} item id(s) that do not exist:`, badIt);
  if (badVal.length) fail(`${label} has ${badVal.length} value(s) that are not true or false:`, badVal);
}

/* ------------------------------------------------------------------ */
/* Fetched stats                                                       */
/*                                                                     */
/* Generated by scripts/fetch-wiki.mjs and joined to items.json by id  */
/* on read, so a key that resolves to nothing is a silent hole in the  */
/* scoring engine rather than a visible break. Same reason every other */
/* reference in this project is checked.                               */
/* ------------------------------------------------------------------ */

const statEntries = Object.entries(wikiStats.stats || {});
const orphanStats = statEntries.filter(([id]) => !ids.has(id)).map(([id]) => id);
if (orphanStats.length) {
  fail(`wiki-stats.json names ${orphanStats.length} item id(s) that do not exist. Re-run node scripts/fetch-wiki.mjs:`, orphanStats);
}
if (!wikiStats.licence || !wikiStats.source) {
  fail("wiki-stats.json is missing its source or licence stamp. The data is CC BY-NC-SA and attribution is not optional.");
}

/* Heat drives the hot biome gate, so an empty heat set means the join  */
/* silently broke and every heat build just became eligible everywhere. */
const ventCount = statEntries.filter(([, v]) => v && v.heat).length;
if (statEntries.length && ventCount === 0) {
  fail("wiki-stats.json carries no heat data at all. The hot biome gate reads this, so the join has broken.");
}

/* ------------------------------------------------------------------ */

if (problems.length) {
  console.error("\n  Data is broken. The build is stopped.\n");
  for (const p of problems) console.error(`  ${p}\n`);
  console.error(`  ${problems.length} problem${problems.length === 1 ? "" : "s"}.\n`);
  process.exit(1);
}

const bySlot = {};
for (const it of items) bySlot[it.slot] = (bySlot[it.slot] || 0) + 1;
console.log(
  `  Data checks out. ${items.length} items (${Object.entries(bySlot).map(([k, v]) => `${v} ${k}`).join(", ")}), ` +
    `${loadouts.length} loadouts, ${warbonds.length} warbonds, ` +
    `${statEntries.length} with fetched stats, ${ventCount} that vent heat.`
);
