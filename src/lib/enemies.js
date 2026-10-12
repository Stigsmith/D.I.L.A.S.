/* ================================================================== */
/* WHAT YOUR PENETRATION IS UP AGAINST                                */
/*                                                                    */
/* The tool held armor penetration for every weapon and nothing at    */
/* all to measure it against, so every judgement about it was a       */
/* threshold somebody picked. This is the other half: what each enemy */
/* is actually armored to, per body part, straight off the wiki.      */
/*                                                                    */
/* Pure, same shape as src/lib/score.js and src/lib/squad.js. No      */
/* React, no storage, runnable from a script.                         */
/* ================================================================== */

import ENEMIES from "../data/enemies.json";
import { SUBFACTIONS } from "./subfaction.js";

/* ------------------------------------------------------------------ */
/* The rule                                                            */
/*                                                                     */
/* From the wiki's Damage page, and it is three states rather than a   */
/* curve. This is the only place it is written down.                   */
/*                                                                     */
/*   penetration above the armor value   full damage, red hitmarker    */
/*   penetration equal to it             65%, white hitmarker          */
/*   penetration below it                nothing, the round ricochets  */
/*                                                                     */
/* The middle case is the one worth keeping separate. A weapon that    */
/* "gets through" at 65% is a real answer and a slow one, and folding  */
/* it into a yes would overstate what you are carrying.                */
/* ------------------------------------------------------------------ */

export const REDUCED_DAMAGE = 0.65;

export const outcomeFor = (ap, av) => (ap > av ? "full" : ap === av ? "reduced" : "none");

export const enemies = ENEMIES.enemies;
export const enemySource = {
  source: ENEMIES.source,
  licence: ENEMIES.licence,
  url: ENEMIES.licenceUrl,
  fetchedAt: ENEMIES.fetchedAt,
};

/* The gap this data has, carried next to the data rather than in a     */
/* comment nobody reads. Stated on the row too.                         */
export const EXPOSURE_GAP = ENEMIES.gap;

/* The variants only exist while a subfaction holds the planet. The      */
/* baseline is what is always there: no variant, and not one of the      */
/* enemies a subfaction brings by name (the Hive Lord, the Dragonroach). */
const CLAIMED = new Set(Object.values(SUBFACTIONS).flatMap((s) => s.adds));
export const baselineEnemies = enemies.filter((e) => !e.variant && !CLAIMED.has(e.name));

/* A front's enemies with these subfactions on the planet: the baseline,
   less what they replace, plus what they bring. A removal from a
   difficulty only applies once the level is known and reaches it.
   Invasion Fleet lays the full force back over any other subfaction, so
   with it present nothing is removed. Keys from another front are
   ignored. */
export function enemiesFor(faction, keys, level) {
  const here = (keys || []).map((k) => SUBFACTIONS[k]).filter((s) => s && s.front === faction);
  if (!here.length) return baselineEnemies.filter((e) => e.faction === faction);
  const restores = here.some((s) => s.restores);
  const removed = new Set();
  if (!restores) {
    for (const s of here) {
      for (const r of s.removes) {
        if (typeof r === "string") removed.add(r);
        else if (level && level >= r.from) removed.add(r.name);
      }
    }
  }
  const variants = new Set(here.map((s) => s.variant).filter(Boolean));
  const added = new Set(here.flatMap((s) => s.adds));
  return enemies.filter(
    (e) =>
      e.faction === faction &&
      (variants.has(e.variant) || added.has(e.name) || (!e.variant && !CLAIMED.has(e.name) && !removed.has(e.name)))
  );
}

/* The subfactions that change this front's list, sorted, for a cache key. */
const keyOf = (faction, keys) =>
  (keys || []).filter((k) => SUBFACTIONS[k] && SUBFACTIONS[k].front === faction).sort().join("+");

/* Biggest first, because when a list has to be cut short the Factory   */
/* Strider is the name worth keeping and the Trooper is not.            */
const SIZE_RANK = { superheavy: 5, massive: 4, large: 3, medium: 2, small: 1 };
const bySize = (a, b) => (SIZE_RANK[b.size] || 0) - (SIZE_RANK[a.size] || 0) || a.name.localeCompare(b.name);

/* ------------------------------------------------------------------ */
/* One enemy                                                           */
/* ------------------------------------------------------------------ */

/**
 * ap      one weapon's armor penetration
 * enemy   one row from enemies.json
 *
 * state is deliberately about whether anything bounces rather than
 * about hitting the body, because the body is not always the hard
 * part. An Overseer's main pool is AV 0 and its head is AV 3, so a
 * rule built on "can you hurt the torso" would call a peashooter a
 * clean answer to it.
 */
export function readEnemy(ap, enemy) {
  let full = 0;
  let reduced = 0;
  let none = 0;
  for (const p of enemy.parts) {
    const o = outcomeFor(ap, p.av);
    if (o === "full") full += 1;
    else if (o === "reduced") reduced += 1;
    else none += 1;
  }
  const state = none === enemy.parts.length ? "bounces" : none > 0 ? "weakpoint" : "anywhere";
  return { enemy, state, full, reduced, none, grazes: reduced > 0 };
}

/* ------------------------------------------------------------------ */
/* One front                                                           */
/*                                                                     */
/* Memoised on ap and faction. The tier list scores every visible row   */
/* on every render and there are only ever a couple of dozen distinct   */
/* penetration values, so this collapses to a handful of passes.        */
/* ------------------------------------------------------------------ */

const cache = new Map();
const round = (n) => Math.round(n * 100) / 100;

/**
 * Returns null when there is nothing to read: no penetration recorded
 * on the item, or no front chosen. Both are real states and neither is
 * a zero.
 */
export function frontReading(ap, faction, difficulty, subfactions) {
  if (typeof ap !== "number" || !faction) return null;

  /* A level of 0 is how the slider spells "not set", which means judge   */
  /* the whole front rather than none of it.                             */
  const level = typeof difficulty === "number" && difficulty > 0 ? difficulty : null;

  const key = `${faction}:${ap}:${level || "any"}:${keyOf(faction, subfactions)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  /* Two enemies leave the field blank on the wiki, both variants (the    */
  /* Rupture Charger and the Jet Brigade Devastator), so they count once  */
  /* their subfaction is on the planet. Treating an unknown as level 1 is */
  /* the safe direction: it keeps an enemy in the reckoning rather than   */
  /* quietly hiding one you might actually meet.                         */
  const list = enemiesFor(faction, subfactions, level).filter(
    (e) => !level || (e.minDifficulty || 1) <= level
  );
  if (!list.length) return null;

  const reads = list.map((e) => readEnemy(ap, e));
  const pick = (s) => reads.filter((r) => r.state === s).map((r) => r.enemy).sort(bySize);

  const anywhere = pick("anywhere");
  const weakpoint = pick("weakpoint");
  const bounces = pick("bounces");

  const out = {
    ap,
    faction,
    difficulty: level,
    total: list.length,
    /* The three counts are what the scoring rules read. Kept as counts  */
    /* rather than fractions because a rule saying "seven of them"       */
    /* is checkable against the file by hand.                            */
    anywhere: anywhere.length,
    weakpoint: weakpoint.length,
    bounces: bounces.length,
    /* Of the ones you can hurt anywhere, how many only at 65%. */
    grazing: reads.filter((r) => r.state === "anywhere" && r.grazes).length,
    /* The same three as a share of the front, because a rule threshold  */
    /* written as a count would mean different things on each one: there */
    /* are 22 Automaton enemies, 21 Terminid and 13 Illuminate, so a     */
    /* rule at "four or more" is strict on one front and loose on        */
    /* another. Counts stay above for reading, shares are what the rules */
    /* key on.                                                           */
    openShare: round(anywhere.length / list.length),
    weakpointShare: round(weakpoint.length / list.length),
    bounceShare: round(bounces.length / list.length),
    grazingShare: round(reads.filter((r) => r.state === "anywhere" && r.grazes).length / list.length),
    names: {
      anywhere: anywhere.map((e) => e.name),
      weakpoint: weakpoint.map((e) => e.name),
      bounces: bounces.map((e) => e.name),
      /* The ones you hurt only at 65%, named for the expanded row. */
      grazing: reads.filter((r) => r.state === "anywhere" && r.grazes).map((r) => r.enemy).sort(bySize).map((e) => e.name),
    },
  };
  cache.set(key, out);
  return out;
}

/* How many of a front's enemies you can actually meet at a given level. */
/* Its own export because the scenario panel wants the count before any  */
/* particular weapon is in hand.                                         */
export const enemiesUpTo = (faction, difficulty, subfactions) =>
  enemiesFor(faction, subfactions, difficulty).filter(
    (e) => !difficulty || (e.minDifficulty || 1) <= difficulty
  ).length;

/* How frightening a thing is, which is not the same as how large the
   wiki files it. A Bile Titan and a Factory Strider are both categorised
   medium by size and neither is a medium problem. The class field is the
   game's own word for it, so that leads, with size as the fallback for
   the three that carry no class at all. The Hive Lord is one of those
   and it is not a small animal.                                         */
const CLASS_RANK = { Miniboss: 6, Superheavy: 5, Heavy: 4, Special: 3, Medium: 2, Support: 1, Light: 1, Fodder: 0 };
const threatOf = (e) => Math.max(CLASS_RANK[e.class] ?? 0, SIZE_RANK[e.size] ?? 0);
const hardestPart = (e) => Math.max(...e.parts.map((p) => p.av));
const totalHealth = (e) => e.parts.reduce((n, p) => n + (p.health || 0), 0);

/* Class first, then the two numbers, then the name. The tiebreaks earn
   their place: three Illuminate enemies are all class Heavy and all size
   large, and taking them alphabetically named the Fleshmob as the worst
   thing on the front. It is AV 0 with 6,400 health. The Harvester
   standing next to it is AV 4 with 22,400. */
const byThreat = (a, b) =>
  threatOf(b) - threatOf(a) ||
  hardestPart(b) - hardestPart(a) ||
  totalHealth(b) - totalHealth(a) ||
  a.name.localeCompare(b.name);

/**
 * What starts turning up at this level, worst first.
 *
 * Deliberately what arrives rather than what is still being held back.
 * "A Hive Lord does not turn up until 7" is a fact about somewhere you
 * are not going. "Level 5 is where the Impaler starts turning up" is a
 * fact about where you are, which is the one worth reading.
 *
 * Six of the thirty level and front combinations add nothing new. Those
 * point at the next step up instead of naming the worst thing already
 * present, which reads better and sidesteps a ranking the data cannot
 * settle: the Illuminate Overship is the hardest thing on that front by
 * armor and health, and calling it the worst thing you will meet at
 * difficulty 5 is technically true and useless, because it is a ship in
 * the sky rather than something walking at you.
 */
export function arrivalsAt(faction, difficulty, subfactions) {
  if (!difficulty) return null;
  const pool = enemiesFor(faction, subfactions, difficulty);
  const atLevel = (l) => pool.filter((e) => (e.minDifficulty || 1) === l).sort(byThreat);

  const fresh = atLevel(difficulty);
  if (fresh.length) return { kind: "new", names: fresh.slice(0, 2).map((e) => e.name) };

  for (let l = difficulty + 1; l <= 10; l++) {
    const later = atLevel(l);
    if (later.length) return { kind: "next", level: l, names: [later[0].name] };
  }

  /* Nothing more is ever added, so say when the front finished rather   */
  /* than leaving the sentence hanging.                                  */
  const last = Math.max(...pool.map((e) => e.minDifficulty || 1));
  return { kind: "complete", level: last };
}

/** The arrivals line, written once so the wording and the data agree. */
export function arrivalsLine(faction, difficulty, subfactions) {
  const a = arrivalsAt(faction, difficulty, subfactions);
  if (!a) return "";
  if (a.kind === "next") return ` Nothing new at this level. Next new enemy: ${a.names[0]}, at difficulty ${a.level}.`;
  if (a.kind === "complete") return ` Nothing new at this level. Every enemy on this front appears by difficulty ${a.level}.`;
  if (a.names.length === 1) return ` New at this level: ${a.names[0]}.`;
  return ` New at this level: ${a.names[0]} and ${a.names[1]}.`;
}

/* ------------------------------------------------------------------ */
/* Saying it                                                           */
/*                                                                     */
/* Sentences live here for the same reason squad.js writes its own: the */
/* wording and the numbers have to move together, and a component that  */
/* rebuilds the phrasing from counts will drift from what the counts    */
/* mean.                                                                */
/* ------------------------------------------------------------------ */

const FRONT_PLURAL = { bots: "Automatons", bugs: "Terminids", squids: "Illuminate" };

/* Three names then a count. Naming eleven enemies is a list nobody      */
/* reads; naming none is a claim with nothing behind it.                */
function nameList(names, limit = 3) {
  if (!names.length) return "";
  if (names.length <= limit) {
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, limit).join(", ")} and ${names.length - limit} more`;
}

/**
 * The expanded row's armour block: up to four labelled facts, the
 * writing guide's shape (dilas-writing.md). Returns null when there is
 * nothing worth saying, so the caller can leave the section out.
 *
 * Full damage is the enemies you hurt everywhere at full damage, which
 * leaves out the ones you only tie: those are Reduced. The four lines
 * add up to the front's total.
 */
export function describeArmour(ap, faction, difficulty, subfactions) {
  const r = frontReading(ap, faction, difficulty, subfactions);
  if (!r) return null;

  const front = FRONT_PLURAL[faction] || faction;
  /* The subfactions that changed the list, named in the heading. */
  const forces = (subfactions || [])
    .filter((k) => SUBFACTIONS[k] && SUBFACTIONS[k].front === faction)
    .map((k) => SUBFACTIONS[k].name)
    .join(", ");
  const full = r.anywhere - r.grazing;
  const facts = [];

  facts.push({
    key: "full",
    label: "Full damage",
    tip: "Your AP is above their armour everywhere.",
    tone: full === r.total ? "good" : full === 0 ? "bad" : "neutral",
    say: full === r.total ? `All ${r.total} enemies` : full === 0 ? `None of the ${r.total}` : `${full} of ${r.total} enemies`,
  });
  if (r.grazing) {
    facts.push({ key: "reduced", label: "Reduced damage", tip: "65% damage: your AP equals their armour.",
      tone: "neutral", say: nameList(r.names.grazing) });
  }
  if (r.weakpoint) {
    facts.push({ key: "weak", label: "Weak points only", tip: "Heavy armour on part of the body. Hit the weak points.",
      tone: "neutral", say: nameList(r.names.weakpoint) });
  }
  if (r.bounces) {
    facts.push({ key: "none", label: "No damage", tip: "Their armour is above your AP everywhere.",
      tone: "bad", say: nameList(r.names.bounces) });
  }

  /* The level goes in the heading: the same weapon reads very
     differently at 3 and at 10. */
  return {
    reading: r,
    title: `Armour · ${front}${forces ? ` · ${forces}` : ""}${r.difficulty ? ` · difficulty ${r.difficulty}` : ""}`,
    facts,
  };
}
