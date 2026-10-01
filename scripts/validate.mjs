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
const enemies = load("enemies.json");
const contextRules = load("context-rules.json");
const buildRules = load("build-rules.json");
const missions = load("missions.json");

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
/* Ours, plus the sourced facts the fetch does not reach yet. Each one     */
/* declares its own provenance in vocabulary.json, so a judgement and a    */
/* published fact never sit in the rules looking equally weighed.          */
const ITEM_TAGS = set(vocab.itemTags.map((t) => t.id));
/* The three fronts, which items.json keys its ratings by and           */
/* enemies.json keys its rows by. The same three or the two files       */
/* cannot be joined.                                                     */
const FACTIONS = set(["bots", "bugs", "squids"]);

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
/*                                                                     */
/* Onto the WRONG item: an alias that slugs to its own item's id is    */
/* the ordinary case of a rename that changed spacing or capitals, and */
/* it resolves exactly where it should. The display name check below   */
/* always exempted the item's own entry and this one did not, until    */
/* "G/40-K Meltamine" became "G/40-K Melta Mine" on 26 September 2026. */
const aliasCollisions = [];
const aliasOwner = new Map();
for (const it of items) {
  for (const a of it.aliases) {
    const asId = a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (ids.has(asId) && asId !== it.id) aliasCollisions.push(`"${a}" on ${it.id} slugs to live id ${asId}`);
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

  /* A tag a rule spells wrong fails the same silent way an unresolvable   */
  /* id does: the rule simply never fires and the column looks fine.       */
  if (!Array.isArray(it.tags)) {
    at("tags", it.tags);
  } else {
    for (const t of it.tags) {
      if (!ITEM_TAGS.has(t)) at("tag", t);
    }
    if (new Set(it.tags).size !== it.tags.length) at("duplicate tag", it.tags);
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
/* Context rules                                                       */
/*                                                                     */
/* The scoring engine reads these. A rule naming a tag nothing carries, */
/* or an id matching no item, does not throw: it quietly never fires    */
/* and the second rating column goes on looking like it worked. That is */
/* the same failure as an unresolvable loadout slot and it earns the    */
/* same check. Nothing here referenced an id at all after 1.19.0, but   */
/* the escape hatch is still in the matcher, so the guard stays.        */
/* ------------------------------------------------------------------ */

const GAME_TAGS = new Set();
for (const s of Object.values(wikiStats.stats || {})) {
  for (const t of (s && s.tags) || []) GAME_TAGS.add(t);
}

/* Walks a rule for the named keys wherever they sit, so a matcher that  */
/* gains a nested shape later is still checked without editing this.     */
const collect = (node, out, keys) => {
  if (Array.isArray(node)) { node.forEach((n) => collect(n, out, keys)); return; }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (keys.includes(k)) for (const x of Array.isArray(v) ? v : [v]) out.push(x);
    else collect(v, out, keys);
  }
};

/* Every scenario key applies() knows how to test. */
const WHEN_KEYS = set(["faction", "hazard", "biome", "mission", "difficulty", "squad", "peril"]);

/* Both rule files. context-rules.json judges one item and build-rules.json
   judges nine of them together, and the two share this much: an id, a
   sentence, resolvable references, and a when clause the engine reads. The
   differences go in the caller. */
function checkRules(rules, ruleProblems) {
const seenRule = new Set();
for (const rule of rules) {
  if (!rule.id) { ruleProblems.push("a rule with no id"); continue; }
  if (seenRule.has(rule.id)) ruleProblems.push(`duplicate rule id ${rule.id}`);
  seenRule.add(rule.id);
  /* A score that cannot explain itself is a score nobody should trust. */
  if (!rule.say) ruleProblems.push(`${rule.id} carries no say`);
  /* The Rules page lists every rule by name, and dozens of ids are not
     something a person can scan. A new rule names itself or stops here. */
  if (typeof rule.name !== "string" || !rule.name.trim()) ruleProblems.push(`${rule.id} carries no name for the Rules page`);
  else if (rule.name.length > 90) ruleProblems.push(`${rule.id} has a name longer than 90 characters, which the Rules page cannot fit`);
  /* A rule scaling off the scenario crosses zero and runs both ways. Its
     say was written for one direction, so without a sayInverted the tool
     explains a penalty using the sentence meant for a bonus. */
  if (rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.") && !rule.sayInverted) {
    ruleProblems.push(`${rule.id} scales off the scenario so it can invert, but carries no sayInverted`);
  }

  const refIds = []; collect(rule, refIds, ["idIn", "notIdIn"]);
  for (const id of refIds) {
    if (!byId.has(id)) ruleProblems.push(`${rule.id} names item id ${id}, which matches no item`);
  }

  const refTags = []; collect(rule, refTags, ["tags", "notTags"]);
  for (const t of refTags) {
    if (!ITEM_TAGS.has(t)) ruleProblems.push(`${rule.id} matches tag "${t}", which vocabulary.json does not declare`);
    else if (!items.some((i) => i.tags.includes(t))) ruleProblems.push(`${rule.id} matches tag "${t}", which no item carries, so it can never fire`);
  }

  const refGame = []; collect(rule, refGame, ["gameTags", "notGameTags"]);
  for (const t of refGame) {
    if (!GAME_TAGS.has(t)) ruleProblems.push(`${rule.id} matches game tag "${t}", which nothing in wiki-stats.json carries`);
  }

  /* A when key the engine does not know is not an error anywhere: the
     clause is simply skipped and the rule fires wider than its author
     meant. Same silent shape as everything else checked here. */
  for (const k of Object.keys(rule.when || {})) {
    if (!WHEN_KEYS.has(k)) ruleProblems.push(`${rule.id} gates on "${k}", which the engine does not read`);
  }

  /* A mission trait nothing declares, or an armor trait nothing carries,
     makes a rule that can never fire, and nothing would ever say so. */
  for (const t of [].concat((rule.when && rule.when.mission) || [])) {
    if (!missions.traits[t]) ruleProblems.push(`${rule.id} gates on mission trait "${t}", which missions.json does not declare`);
  }
  const refTraits = []; collect(rule.match || {}, refTraits, ["traits"]);
  for (const t of refTraits) {
    if (!TRAITS.has(t)) ruleProblems.push(`${rule.id} matches trait "${t}", which vocabulary.json does not declare`);
  }

  const refRoles = []; collect(rule, refRoles, ["roles"]);
  for (const r of refRoles) {
    if (!ROLES.has(r)) ruleProblems.push(`${rule.id} matches role "${r}", which is not in the vocabulary`);
  }
}
}

const ruleProblems = [];
checkRules(contextRules.rules, ruleProblems);
if (ruleProblems.length) fail(`${ruleProblems.length} problem(s) in context-rules.json:`, ruleProblems);

/* ------------------------------------------------------------------ */
/* Loadout rules                                                       */
/*                                                                     */
/* A build clause is not an item clause and the engine throws on a key  */
/* it does not know, which is the right behaviour at runtime and a      */
/* terrible way to find out. So the keys are checked here, where the    */
/* build already stops.                                                 */
/* ------------------------------------------------------------------ */

const MATCH_KEYS = set(["covers", "notCovers", "count", "number", "has", "notHas"]);
/* Everything look() in build.js can reach. A path it cannot read is not  */
/* an error at runtime: numberTest sees undefined, returns false, and the */
/* rule silently never fires. That is the failure this catches.          */
const PATH_ROOTS = set(["facts", "reach", "scenario"]);
const FACTS_FIELDS = set(["heldAp", "anyAp", "holeClosers", "backpacks", "filled"]);
const REACH_FIELDS = set(["ap", "total", "anywhere", "weakpoint", "bounces", "grazing",
  "openShare", "weakpointShare", "bounceShare", "grazingShare", "difficulty"]);
const SCENARIO_FIELDS = set(["peril", "difficulty", "squad"]);
const SEVERITIES = set(["red", "amber", "grey"]);

const buildProblems = [];
checkRules(buildRules.rules, buildProblems);
for (const rule of buildRules.rules) {
  for (const k of Object.keys(rule.match || {})) {
    if (!MATCH_KEYS.has(k)) buildProblems.push(`${rule.id} matches on "${k}", which build.js does not read`);
  }
  const refCovers = []; collect(rule.match || {}, refCovers, ["covers", "notCovers"]);
  for (const r of refCovers) {
    if (!ROLES.has(r)) buildProblems.push(`${rule.id} covers role "${r}", which is not in the vocabulary`);
  }
  if (rule.severity && !SEVERITIES.has(rule.severity)) {
    buildProblems.push(`${rule.id} has severity ${JSON.stringify(rule.severity)}, which is not red, amber or grey`);
  }
  /* A rule with neither a delta nor a severity moves nothing and says
     nothing, so the engine skips it and the sentence never renders. */
  if (!rule.delta && !rule.scaleBy && !rule.severity) {
    buildProblems.push(`${rule.id} has no delta, no scaleBy and no severity, so it can never be seen`);
  }
  const paths = []; collect(rule, paths, ["path"]);
  for (const path of paths) {
    const [root, field] = String(path).split(".");
    if (!PATH_ROOTS.has(root)) { buildProblems.push(`${rule.id} reads "${path}", and ${root} is not a root build.js knows`); continue; }
    const known = root === "facts" ? FACTS_FIELDS : root === "reach" ? REACH_FIELDS : SCENARIO_FIELDS;
    if (!known.has(field)) buildProblems.push(`${rule.id} reads "${path}", which build.js cannot produce, so it never fires`);
  }
  /* Same contract the context rules have. A rule that scales off the
     scenario crosses zero and needs a sentence for each direction. */
  if (rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.") && !rule.sayInverted) {
    buildProblems.push(`${rule.id} scales off the scenario so it can invert, but carries no sayInverted`);
  }
}
if (buildProblems.length) fail(`${buildProblems.length} problem(s) in build-rules.json:`, buildProblems);

/* Every declared tag has to record where it came from, because the whole */
/* point of the layer is that a judgement and a sourced fact are telling  */
/* apart at a glance.                                                     */
const TAG_SOURCES = set(["curator", "wiki"]);
const badTag = [];
for (const t of vocab.itemTags) {
  if (!t.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) badTag.push(`tag id ${JSON.stringify(t.id)} is not a slug`);
  if (!t.label) badTag.push(`${t.id} has no label`);
  if (!TAG_SOURCES.has(t.source)) badTag.push(`${t.id} has source ${JSON.stringify(t.source)}, which is not curator or wiki`);
  if (!t.note) badTag.push(`${t.id} has no note saying why it exists`);
}
if (badTag.length) fail(`vocabulary.json itemTags has ${badTag.length} problem(s):`, badTag);

/* ------------------------------------------------------------------ */
/* Enemy armour                                                        */
/*                                                                     */
/* What every armor penetration figure in the tool is measured         */
/* against. A break here does not throw: the scoring rules read        */
/* through it, find nothing, and quietly stop firing, so the second    */
/* rating column would go back to ignoring armor with no sign that     */
/* anything was wrong.                                                 */
/* ------------------------------------------------------------------ */

const SIZES = set(["small", "medium", "large", "massive", "superheavy"]);
const badEnemy = [];

for (const e of enemies.enemies) {
  const where = e.name || "(unnamed)";
  if (!FACTIONS.has(e.faction)) badEnemy.push(`${where}: faction ${e.faction}`);
  if (e.size !== null && !SIZES.has(e.size)) badEnemy.push(`${where}: size ${e.size}`);
  /* Null is allowed: two wiki infoboxes leave it blank and the reading   */
  /* treats an unknown as level 1, which keeps an enemy in rather than    */
  /* hiding one. A number outside the game's ten levels is a parse error. */
  if (e.minDifficulty !== null && !(Number.isInteger(e.minDifficulty) && e.minDifficulty >= 1 && e.minDifficulty <= 10)) {
    badEnemy.push(`${where}: min difficulty ${e.minDifficulty} is outside the game's ten levels`);
  }
  if (!Array.isArray(e.parts) || !e.parts.length) {
    badEnemy.push(`${where}: no body parts, so nothing can be measured against it`);
    continue;
  }
  for (const p of e.parts) {
    if (!p.name) badEnemy.push(`${where}: a part with no name`);
    /* AV 10 is real, the Hive Lord's crown and an Overship's hull. */
    if (!Number.isInteger(p.av) || p.av < 0 || p.av > 12) {
      badEnemy.push(`${where} / ${p.name}: armor value ${p.av} is outside 0 to 12`);
    }
  }
}
if (badEnemy.length) {
  fail(`${badEnemy.length} problem(s) in enemies.json. Re-run node scripts/fetch-wiki.mjs:`, badEnemy);
}
if (!enemies.licence || !enemies.source) {
  fail("enemies.json is missing its source or licence stamp. The data is CC BY-NC-SA and attribution is not optional.");
}

/* Every front needs enemies or the rules that read it stop firing on   */
/* that front alone, which is the failure that hides best.              */
for (const f of FACTIONS) {
  const n = enemies.enemies.filter((e) => e.faction === f && !e.variant).length;
  if (n < 5) fail(`enemies.json carries only ${n} baseline enemies for ${f}. The armour rules read this and would go quiet on that front.`);
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
    `${statEntries.length} with fetched stats, ${ventCount} that vent heat, ` +
    `${enemies.enemies.filter((e) => !e.variant).length} enemies to measure penetration against.`
);
