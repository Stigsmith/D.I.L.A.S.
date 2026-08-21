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

/* The variants only exist while a galactic effect is running on the    */
/* planet, and the tool has no way to know whether one is. So the       */
/* baseline is what is always there, and the rest waits for live war    */
/* state. They are in the file, flagged, not thrown away.               */
export const baselineEnemies = enemies.filter((e) => !e.variant);

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
export function frontReading(ap, faction, difficulty) {
  if (typeof ap !== "number" || !faction) return null;

  /* A level of 0 is how the slider spells "not set", which means judge   */
  /* the whole front rather than none of it.                             */
  const level = typeof difficulty === "number" && difficulty > 0 ? difficulty : null;

  const key = `${faction}:${ap}:${level || "any"}`;
  const hit = cache.get(key);
  if (hit) return hit;

  /* Two enemies leave the field blank on the wiki and both are variants, */
  /* so nothing in a baseline is currently affected. Treating an unknown  */
  /* as level 1 is the safe direction anyway: it keeps an enemy in the    */
  /* reckoning rather than quietly hiding one you might actually meet.    */
  const list = baselineEnemies.filter(
    (e) => e.faction === faction && (!level || (e.minDifficulty || 1) <= level)
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
    },
  };
  cache.set(key, out);
  return out;
}

/* How many of a front's enemies you can actually meet at a given level. */
/* Its own export because the scenario panel wants the count before any  */
/* particular weapon is in hand.                                         */
export const enemiesUpTo = (faction, difficulty) =>
  baselineEnemies.filter(
    (e) => e.faction === faction && (!difficulty || (e.minDifficulty || 1) <= difficulty)
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
export function arrivalsAt(faction, difficulty) {
  if (!difficulty) return null;
  const pool = baselineEnemies.filter((e) => e.faction === faction);
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
export function arrivalsLine(faction, difficulty) {
  const a = arrivalsAt(faction, difficulty);
  if (!a) return "";
  if (a.kind === "next") return ` Nothing new here. The next step up is ${a.level}, where the ${a.names[0]} arrives.`;
  if (a.kind === "complete") return ` Nothing new here, and nothing left to come: this front has shown you everything by ${a.level}.`;
  if (a.names.length === 1) return ` Level ${difficulty} is where the ${a.names[0]} starts turning up.`;
  return ` Level ${difficulty} is where the ${a.names[0]} and the ${a.names[1]} start turning up.`;
}

/* ------------------------------------------------------------------ */
/* Saying it                                                           */
/*                                                                     */
/* Sentences live here for the same reason squad.js writes its own: the */
/* wording and the numbers have to move together, and a component that  */
/* rebuilds the phrasing from counts will drift from what the counts    */
/* mean.                                                                */
/* ------------------------------------------------------------------ */

const FRONT = { bots: "Automaton", bugs: "Terminid", squids: "Illuminate" };

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
 * The expanded row's armour block. Returns null when there is nothing
 * worth saying, so the caller can leave the section out rather than
 * render an empty one.
 */
export function describeArmour(ap, faction, difficulty) {
  const r = frontReading(ap, faction, difficulty);
  if (!r) return null;

  const front = FRONT[faction] || faction;
  const lines = [];

  if (r.anywhere === r.total) {
    lines.push({
      tone: "good",
      say: `AP ${ap} gets through all ${r.total} ${front} enemies wherever you hit them. Nothing on this front turns it away, so you never have to go looking for a weak point.`,
    });
  } else if (r.anywhere === 0) {
    lines.push({
      tone: "bad",
      say: `AP ${ap} does not open a single ${front} enemy from every angle. Every one of the ${r.total} has armor somewhere that stops this.`,
    });
  } else {
    lines.push({
      tone: "neutral",
      say: `AP ${ap} gets through ${r.anywhere} of the ${r.total} ${front} enemies wherever you hit them.`,
    });
  }

  if (r.grazing) {
    lines.push({
      tone: "neutral",
      say: `${r.grazing} of those only just. Where your penetration matches the armor exactly you do 65% rather than full damage, which is a hit and a slow one.`,
    });
  }

  if (r.weakpoint) {
    lines.push({
      tone: "neutral",
      say: `${r.weakpoint} need a weak point: ${nameList(r.names.weakpoint)}. Armor somewhere on them turns this away, so hitting the right spot is the whole job.`,
    });
  }

  if (r.bounces) {
    lines.push({
      tone: "bad",
      say: `${r.bounces === 1 ? "One bounces this off completely" : `${r.bounces} bounce this off completely`}: ${nameList(r.names.bounces)}. There is no angle on ${r.bounces === 1 ? "it" : "them"} that this hurts.`,
    });
  }

  /* Naming the difficulty in the heading matters more than it looks. The */
  /* same weapon reads very differently at 3 and at 10, and a sentence    */
  /* that does not say which one it counted is a sentence you cannot      */
  /* check. With no level set it says so rather than implying the top.    */
  const scope = r.difficulty ? ` at difficulty ${r.difficulty}` : "";
  return {
    reading: r,
    title: `What AP ${ap} opens on the ${front} front${scope}`,
    lines,
  };
}
