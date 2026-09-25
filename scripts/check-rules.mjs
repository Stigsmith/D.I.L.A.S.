/* ================================================================== */
/* RULE HEALTH                                                        */
/*                                                                    */
/* Reports, never writes, same discipline as tag-roles.mjs.           */
/*                                                                    */
/*   npm run rules                                                    */
/*                                                                    */
/* One question per rule: does it discriminate, or does it fire on    */
/* nearly everything it could fire on.                                */
/*                                                                    */
/* This exists because of a real bug rather than as a precaution. The */
/* five armour rules shipped in 1.10.0 fired on 94% of primaries and  */
/* took a tier off 42 of the 51 on the Automaton front, because 48 of */
/* those 51 have an identical armour reading. A rule that fires the   */
/* same way on almost everyone is not telling you anything about any  */
/* of them, and worse, it was charging an assault rifle for being an  */
/* assault rifle, which the community tier had already priced in.     */
/*                                                                    */
/* So: a scenario rule has to fire on something that varies with the  */
/* scenario. This is the cheap way to notice when one does not.       */
/* ================================================================== */

import { score, items, readJson, read, FACTIONS } from "./lib/app.mjs";

const MISSIONS = readJson("src/data/missions.json");
const ITEMS = items.items;
const RULES = readJson("src/data/context-rules.json").rules;
const RANK = { "S+": 6, S: 5, A: 4, B: 3, C: 2, D: 1 };

/* A rule's own `when` is used to build the scenario it would fire in, so */
/* a sandstorm rule is measured on a sandstorm planet rather than on an   */
/* empty scenario where it could never fire at all.                      */
function scenariosFor(rule) {
  const when = rule.when || {};
  const factions = when.faction || FACTIONS;
  const hazards = when.hazard || [];
  const biome = (when.biome || [])[0] || null;
  /* Mission rules key on traits. Pick a real mission carrying the first  */
  /* trait the rule wants, so the sample is a mission that exists.        */
  let mission = null;
  if (when.mission) {
    const want = when.mission;
    const hit = MISSIONS.missions.find((m) => m.traits.some((t) => want.includes(t)));
    mission = hit ? hit.name : null;
  }
  /* A rule that asks about difficulty or squad size cannot fire against  */
  /* an unset one, by design: guessing that somebody is solo because they */
  /* have not said is how a list confidently ranks for a game nobody is   */
  /* playing. So the sample scenario has to satisfy whatever the rule     */
  /* asks, or the check reports it as dead when it is only unasked.       */
  const satisfy = (test, fallback) => {
    if (!test) return fallback;
    if (test.eq !== undefined) return test.eq;
    if (test.gte !== undefined) return test.gte;
    if (test.gt !== undefined) return test.gt + 1;
    if (test.lte !== undefined) return test.lte;
    if (test.lt !== undefined) return test.lt - 1;
    return fallback;
  };
  let difficulty = satisfy(when.difficulty, 0);
  let squad = satisfy(when.squad, 0);

  /* A rule gating on peril needs a difficulty and a squad size that reach
     the figure it asks for. Solve for the gentlest pair that satisfies it:
     the largest squad that can get there, so the sample is the easiest
     situation the rule fires in rather than an extreme that flatters it.

     It calls score.peril rather than restating the arithmetic. The first
     version restated it, and kept saying 4 * (difficulty - squad - 1) for
     two versions after the real formula changed, so every peril rule was
     being measured in a scenario the engine no longer produces. */
  if (when.peril) {
    const want = satisfy(when.peril, 0);
    let found = null;
    for (let sq = 4; sq >= 1 && !found; sq -= 1) {
      for (let d = 1; d <= 10; d += 1) {
        const p = score.peril({ difficulty: d, squad: sq });
        const ok =
          (when.peril.gte === undefined || p >= when.peril.gte) &&
          (when.peril.gt === undefined || p > when.peril.gt) &&
          (when.peril.lte === undefined || p <= when.peril.lte) &&
          (when.peril.lt === undefined || p < when.peril.lt) &&
          (when.peril.eq === undefined || p === when.peril.eq);
        if (ok) { found = { d, sq }; break; }
      }
    }
    if (found) { difficulty = found.d; squad = found.sq; }
    else { difficulty = want > 0 ? 10 : 1; squad = want > 0 ? 1 : 4; }
  }

  /* A rule that scales off the scenario rather than off the item needs a
     scenario carrying those numbers, or it reads null and never fires.
     Solo on Impossible is peril 22, the anchor the coefficients are set
     against, so it is the fair place to measure one. */
  if (rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.") && (!difficulty || !squad)) {
    difficulty = 7;
    squad = 1;
  }

  return factions.map((faction) => ({ faction, hazards, biome, mission, difficulty, squad }));
}

const rows = [];
for (const rule of RULES) {
  let fired = 0;
  let eligible = 0;
  let moved = 0;
  for (const scenario of scenariosFor(rule)) {
    for (const item of ITEMS.filter((i) => i.ratings[scenario.faction].tier)) {
      eligible += 1;
      const r = score.scoreItem(item, scenario);
      if (r.reasons.some((x) => x.id === rule.id)) {
        fired += 1;
        if (RANK[r.base] !== RANK[r.tier]) moved += 1;
      }
    }
  }
  rows.push({
    id: rule.id,
    fired,
    eligible,
    moved,
    pct: eligible ? Math.round((fired / eligible) * 100) : 0,
    unreachable: fired === 0,
  });
}

/* A floor says "at least this tier" and a ceiling says "at most this".
   When a floor sits above a ceiling the two cannot both hold, and until
   1.18.0 the ceiling silently won because its line ran second. Both are
   dropped now, and this sweep names the items where it happens: a
   contradiction means the rule set disagrees with itself. */
const clashes = [];
for (const faction of FACTIONS) {
  for (const hazards of [[], ['sandstorms'], ['blizzards'], ['thick_fog'], ['ion_storms'], ['tremors']]) {
    for (const squad of [0, 1, 4]) {
      for (const difficulty of [0, 8]) {
        for (const item of ITEMS.filter((i) => i.ratings[faction].tier)) {
          const r = score.scoreItem(item, { faction, hazards, squad, difficulty });
          if (r.contradiction) clashes.push(item.name + '  ' + faction + (hazards.length ? ' ' + hazards[0] : '') + (squad ? ' squad ' + squad : ''));
        }
      }
    }
  }
}

rows.sort((a, b) => b.pct - a.pct);

console.log("\n  Rule health. Every rule measured inside a scenario where it could fire.\n");
console.log("  share  fired/pool   moved a tier   rule");
for (const r of rows) {
  const note = r.unreachable
    ? "   NEVER FIRES, check its match clause"
    : r.pct >= 60
      ? "   fires on most of the pool, is it saying anything"
      : "";
  console.log(
    `  ${String(r.pct).padStart(4)}%  ${String(r.fired).padStart(5)}/${String(r.eligible).padEnd(5)} ${String(r.moved).padStart(9)}       ${r.id}${note}`
  );
}

const loud = rows.filter((r) => r.pct >= 60);
const dead = rows.filter((r) => r.unreachable);
console.log("");
if (dead.length) console.log(`  ${dead.length} rule(s) never fire at all.`);
if (loud.length) {
  console.log(`  ${loud.length} rule(s) fire on 60% or more of their pool. That is the shape the armour rules had.`);
  console.log(`  A rule that fires on nearly everyone is describing the pool, not the item.`);
}
if (clashes.length) {
  const uniq = [...new Set(clashes)];
  console.log();
  for (const x of uniq.slice(0, 8)) console.log('    ' + x);
  if (uniq.length > 8) console.log('    and ' + (uniq.length - 8) + ' more');
} else {
  console.log('  No floor and ceiling contradictions.');
}
if (!dead.length && !loud.length) {
  console.log(`  ${rows.length} rules, all discriminating. Nothing is describing its own pool.`);
}
console.log("");
