/* ================================================================== */
/* THE CONTEXTUAL SCORE                                               */
/*                                                                    */
/* What this tool thinks of an item where you are actually dropping,   */
/* as against what the crowd thinks of it in the abstract.            */
/*                                                                    */
/* Three rules keep it honest:                                        */
/*                                                                    */
/*  - It is a delta on a sourced rating, never a replacement. The     */
/*    u.gg tier is the base and it stays visible next to this one, so  */
/*    every disagreement is legible rather than laundered.            */
/*  - Every point of movement carries a sentence. A number that       */
/*    cannot say why it moved is a number nobody should trust.        */
/*  - With no context set it returns the base untouched. The engine   */
/*    has to earn its difference, and silence is the correct output   */
/*    when nothing has been said about where you are going.           */
/*                                                                    */
/* Pure, and deliberately so: same shape as src/lib/squad.js, no      */
/* React, no storage, testable from a script.                         */
/* ================================================================== */

import RULES from "../data/context-rules.json";
import { statsFor, ventsHeat, TIER_ORDER } from "./items.js";
import { isHeldWeapon } from "./loadouts.js";
import { traitsOf } from "./scenario.js";
import { frontReading } from "./enemies.js";

/* ------------------------------------------------------------------ */
/* The scale                                                           */
/*                                                                     */
/* A six point tier ladder is too coarse to accumulate modifiers on:   */
/* every rule would either snap the badge a whole tier or do nothing.  */
/* These anchors put roughly 14 points between tiers, so several small */
/* nudges can combine into one move and a single small nudge does not  */
/* move anything at all, which is the correct behaviour for both.      */
/* ------------------------------------------------------------------ */

export const TIER_POINTS = { "S+": 95, S: 82, A: 68, B: 52, C: 36, D: 20 };

/* Bands are the floor of each tier, read downward. */
const BANDS = [
  ["S+", 89],
  ["S", 75],
  ["A", 60],
  ["B", 44],
  ["C", 28],
  ["D", 0],
];

export const tierForScore = (n) => (BANDS.find(([, floor]) => n >= floor) || ["D"])[0];

/* One tier is about 14 points, so two is the clamp. A scenario may argue  */
/* hard about an item; it may not rewrite what the item is. Anything    */
/* that genuinely should override the base says so with a floor or a    */
/* ceiling instead, which is a claim a rule has to make explicitly.     */
const MAX_SWING = 28;

/* Two tiers is the standing licence a scenario has to argue with a vote. */
/* Past the point where things are genuinely dire it earns a little more, */
/* because a community average taken across every difficulty and every    */
/* squad size is at its least applicable exactly there.                   */
/*                                                                        */
/* At peril 40, solo on Super Helldive, this reaches 37, which is the     */
/* margin a B rank weapon needs to touch S+. That is deliberate: it is    */
/* the case the curator asked for, and it arrives through points rather   */
/* than through a floor, so a better weapon in the same tag still ends up */
/* above a worse one. A floor flattens them together.                     */
const swingFor = (peril) => (peril === null ? MAX_SWING : MAX_SWING + Math.max(0, peril - 22) * 0.5);

/* ------------------------------------------------------------------ */
/* Peril                                                               */
/*                                                                     */
/* How much trouble you are actually in, as one number, from the two   */
/* scenario answers that decide it.                                    */
/*                                                                     */
/*   peril = 6 * (difficulty - 5) + SQUAD_PRESSURE[squad]              */
/*                                                                     */
/* **It is not points and nothing adds it to a score.** Rules gate on  */
/* it, and may one day scale off it. Its magnitude changes no rating   */
/* on its own, only which side of a threshold a situation falls.       */
/*                                                                     */
/* The two zero points are the curator's, from play rather than from   */
/* arithmetic: a four stack is comfortable through 5, and solo is      */
/* comfortable through 3. Solo at 2 is daycare and difficulty 1 exists */
/* to onboard somebody for a mission or two. It runs from -24, four    */
/* players on Trivial, to +42 alone on Super Helldive, which he rates  */
/* as suicide and thinks is still generous.                            */
/*                                                                     */
/* **It replaces a cliff.** The three rules that read squad used to    */
/* gate on difficulty >= 7 and squad <= 1, which made solo at 6 and a  */
/* four stack at 10 both read as nothing, and solo at 7 identical to   */
/* solo at 10. Peril puts solo at 7, a duo at 8 and a trio at 9 on the */
/* same 20, which is what they are: the same amount of trouble reached */
/* by different routes.                                                 */
/*                                                                     */
/* **The negative half is deliberate and it is not symmetry for its    */
/* own sake.** Four players on Challenging is over prepared, and a     */
/* rule may want to say that carrying a silenced weapon there is       */
/* effort spent on a problem you do not have.                          */
/*                                                                     */
/* Null when either answer is missing, and a rule reading it then does */
/* not fire. Zero means not said for both fields, and assuming somebody */
/* is solo because they have not told you is how a list confidently    */
/* ranks for a game nobody is playing. */
export function peril(scenario = {}) {
  const d = scenario.difficulty;
  const sq = scenario.squad;
  if (!d || !sq) return null;
  return 6 * (d - 5) + SQUAD_PRESSURE[sq - 1];
}

/* How much more of the war lands on you per person, by squad size.       */
/*                                                                        */
/* Sourced rather than invented. helldivers.wiki.gg publishes patrol      */
/* spawn intervals, and the player count multipliers on them: a second    */
/* player takes the interval to 0.8333 of solo and a third to 0.75, so    */
/* more players means more patrols overall but far fewer per gun. Danger  */
/* per player works out at solo 1.0, duo 0.60, trio 0.44, four 0.375.     */
/*                                                                        */
/* The shape is the useful part and it is not linear: the drop from solo  */
/* to a duo is most of the relief, and a fourth player adds little the    */
/* third did not already. Rounded to whole points against a difficulty    */
/* step worth 6, which puts solo at 7 and a duo at 8 on the same figure.  */
const SQUAD_PRESSURE = [10, 4, 1, 0];

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/* Reaches into the curated item, its fetched stats, or what this item's */
/* penetration does to the front you picked, so a rule can read stats.ap, */
/* wiki.handling.ergonomics and armour.bounceShare in the same syntax.    */
/* Anything not named here is a field on the item itself.                 */
const ROOTS = ["wiki", "armour", "scenario"];

export function reach(ctx, path) {
  const parts = String(path).split(".");
  const rooted = ROOTS.includes(parts[0]);
  let cur = rooted ? ctx[parts[0]] : ctx.item;
  for (const k of rooted ? parts.slice(1) : parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function numberTest(value, test) {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (test.gte !== undefined && !(value >= test.gte)) return false;
  if (test.gt !== undefined && !(value > test.gt)) return false;
  if (test.lte !== undefined && !(value <= test.lte)) return false;
  if (test.lt !== undefined && !(value < test.lt)) return false;
  if (test.eq !== undefined && value !== test.eq) return false;
  return true;
}

/* A rule fires when every clause in `match` holds. Clauses are ANDed;  */
/* the values inside one clause are ORed, which is what makes           */
/* "category: [Marksman, Special]" read the way it looks.               */
export function matches(ctx, match) {
  if (!match) return true;
  const { item, wiki } = ctx;

  for (const [key, want] of Object.entries(match)) {
    if (key === "ventsHeat") {
      if (ventsHeat(item) !== Boolean(want)) return false;
      continue;
    }
    /* Gear you carry and aim yourself. A sentry cannot pick a weakpoint, */
    /* which is the same reason the squad penetration check is limited to   */
    /* held weapons. One definition, in loadouts.js, read by all three.     */
    if (key === "held") {
      if (isHeldWeapon(item) !== Boolean(want)) return false;
      continue;
    }
    /* A named list, keyed by id because nothing in this project may     */
    /* reference an item by name. Used only where no sourced signal        */
    /* exists, and the rule carrying one says so in its own text.          */
    if (key === "idIn") {
      if (!asArray(want).includes(item.id)) return false;
      continue;
    }
    if (key === "notIdIn") {
      if (asArray(want).includes(item.id)) return false;
      continue;
    }
    if (key === "hasWiki") {
      if (Boolean(wiki) !== Boolean(want)) return false;
      continue;
    }
    /* The game's own tags, fetched from the weapon modules. They arrive  */
    /* in screaming caps and keep it, and the key says gameTags so a rule  */
    /* never has to guess whether it is reading the game's word or ours.   */
    if (key === "gameTags") {
      const have = (wiki && wiki.tags) || [];
      if (!asArray(want).some((t) => have.includes(t))) return false;
      continue;
    }
    if (key === "notGameTags") {
      const have = (wiki && wiki.tags) || [];
      if (asArray(want).some((t) => have.includes(t))) return false;
      continue;
    }
    /* Ours, curated on the item and declared in vocabulary.json, where    */
    /* every tag records whether it is a judgement or a sourced fact the   */
    /* fetch does not reach yet. This is what replaced the literal id      */
    /* lists six rules used to carry: the concept lives on the items now   */
    /* rather than being spelled out again in every rule that wants it.    */
    if (key === "tags") {
      if (!asArray(want).some((t) => item.tags.includes(t))) return false;
      continue;
    }
    if (key === "notTags") {
      if (asArray(want).some((t) => item.tags.includes(t))) return false;
      continue;
    }
    if (key === "roles") {
      if (!asArray(want).some((r) => item.roles.includes(r))) return false;
      continue;
    }
    if (key === "number") {
      for (const test of asArray(want)) {
        if (!numberTest(reach(ctx, test.path), test)) return false;
      }
      continue;
    }

    /* Everything else is a plain field on the item, compared as a set. */
    const value = reach(ctx, key);
    if (!asArray(want).includes(value)) return false;
  }
  return true;
}

/* A rule's `when` is about the scenario rather than the item.
 *
 * difficulty and squad take the same number tests as an item stat does,
 * so a rule reads { "difficulty": { "gte": 7 }, "squad": { "lte": 1 } }.
 * Both are zero when nothing has been said, and a rule asking about
 * either does not fire on an unset value: guessing that somebody is solo
 * because they have not told you is how a list ends up confidently
 * ranking for a game nobody is playing. */
export function applies(scenario, when) {
  if (!when) return true;
  for (const [key, want] of Object.entries(when)) {
    if (key === "difficulty" || key === "squad") {
      const v = scenario[key];
      if (!v) return false;
      if (!numberTest(v, want)) return false;
      continue;
    }
    /* One number standing in for difficulty and squad together. A rule
       asking for it does not fire until both have been answered, the
       same contract those two fields have on their own. */
    if (key === "peril") {
      const v = peril(scenario);
      if (v === null) return false;
      if (!numberTest(v, want)) return false;
      continue;
    }
    if (key === "hazard") {
      if (!asArray(want).some((h) => (scenario.hazards || []).includes(h))) return false;
      continue;
    }
    if (key === "biome") {
      if (!asArray(want).includes(scenario.biome)) return false;
      continue;
    }
    if (key === "faction") {
      if (!asArray(want).includes(scenario.faction)) return false;
      continue;
    }
    /* Rules key on what a mission asks of you, not on its name. There   */
    /* are seventy missions and eight traits, and a rule about carrying    */
    /* something should not have to list every mission that involves it.   */
    if (key === "mission") {
      const have = traitsOf(scenario.mission);
      if (!asArray(want).some((t) => have.includes(t))) return false;
      continue;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * item   one row from items.json
 * scenario  { faction, biome, hazards[], mission }
 *
 * returns {
 *   base      the community tier, or null when nobody has rated it
 *   tier      the contextual tier, or null when there is no base to move
 *   delta     tiers moved, positive or negative, 0 when nothing fired
 *   reasons   [{ id, say, delta }] most influential first
 *   contextual whether the scenario said enough for any rule to fire
 * }
 */
export function scoreItem(item, scenario = {}) {
  const faction = scenario.faction;
  const base = faction ? item.ratings[faction].tier : null;
  const wiki = statsFor(item.id);
  /* What this item's penetration is up against on the chosen front.     */
  /* Null when the item records no penetration, which is every armor     */
  /* passive and every booster, and null with no front chosen. Both are  */
  /* real absences: a rule reading through them finds undefined and does */
  /* not fire, which is the correct outcome for each.                    */
  /*                                                                     */
  /* No rule currently reads it, and that is deliberate rather than an   */
  /* oversight. Five did, from 1.10.0 to 1.13.0, and they were the wrong */
  /* altitude: 48 of 51 primaries on the bot front share one of two      */
  /* identical armour readings, so the rules charged nearly every        */
  /* primary for being a primary, which a community tier has already     */
  /* priced in. The plumbing stays because it is correct and because     */
  /* loadout scoring will want it. Read whyThereAreNoArmourRules in      */
  /* context-rules.json before adding one back.                          */
  const armour = frontReading(item.stats.ap, faction, scenario.difficulty);
  const ctx = { item, wiki, armour, scenario: { ...scenario, peril: peril(scenario) } };

  const reasons = [];
  let points = 0;
  let floor = null;
  let ceiling = null;

  for (const rule of RULES.rules) {
    if (!applies(scenario, rule.when)) continue;
    if (!matches(ctx, rule.match)) continue;

    /* A rule may state its delta outright, or compute one from a number */
    /* the item carries. The heat rules use the second: the game already */
    /* publishes how much faster a given weapon vents in the cold, so    */
    /* the size of the bonus is read rather than invented.               */
    let delta = rule.delta ?? 0;
    if (rule.scaleBy) {
      const v = reach(ctx, rule.scaleBy.path);
      if (typeof v !== "number") continue;
      delta = Math.round((v - (rule.scaleBy.from ?? 0)) * rule.scaleBy.times);
      if (rule.scaleBy.clamp) {
        delta = Math.max(-rule.scaleBy.clamp, Math.min(rule.scaleBy.clamp, delta));
      }
    }
    if (!delta && !rule.floor && !rule.ceiling) continue;

    points += delta;
    if (rule.floor) floor = floor === null ? rule.floor : floor;
    if (rule.ceiling) ceiling = ceiling === null ? rule.ceiling : ceiling;
    /* A rule that scales off the scenario runs both ways, and the two
       directions do not say the same thing. Rewarding a silenced weapon
       when you are outnumbered and marking one down when you are not are
       different claims, so a rule that can invert carries sayInverted and
       it is used whenever the rule came out negative. Without it the tool
       explains a penalty with the sentence it wrote for a bonus. */
    /* Inverted means the delta came out opposite to the direction the
       rule was written in, not simply that it is negative. The loud rule
       has a negative coefficient, so below zero peril it hands out a
       bonus, and that is its inverted case even though the number is
       positive. Comparing the two signs is what catches both rules. */
    const direction = rule.scaleBy ? rule.scaleBy.times : rule.delta;
    const inverted = rule.sayInverted && direction && delta * direction < 0;
    const say = inverted ? rule.sayInverted : rule.say;
    reasons.push({ id: rule.id, say, delta });
  }

  reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  /* An unrated item has no base to move, but the reasons are still worth */
  /* saying: they are how a Castellan's Creed weapon nobody has voted on  */
  /* ever gets tried on the front it happens to suit.                     */
  if (!base) {
    return { base: null, tier: null, delta: 0, reasons, contextual: reasons.length > 0 };
  }

  const swing = swingFor(ctx.scenario.peril);
  const clamped = Math.max(-swing, Math.min(swing, points));
  let score = TIER_POINTS[base] + clamped;
  let tier = tierForScore(score);

  /* Floors and ceilings are the escape hatch from the clamp, and they   */
  /* are deliberately awkward to reach: a rule has to name the tier it   */
  /* is forcing rather than pile on points until it gets there.          */
  const rank = (t) => TIER_ORDER.indexOf(t);

  /* A floor is "at least this", a ceiling is "at most this", and when a
     floor sits above a ceiling the two cannot both hold. Until 1.18.0
     the ceiling silently won, because its line ran second. That produced
     the Censor at 86 points landing three tiers below an SMG at 64.

     When they contradict, neither applies and the points stand. Two
     rules making opposite absolute claims means neither has earned an
     override, and the points already carry both their deltas. The
     collision is reported rather than swallowed: npm run rules flags
     any pair that can fire together. */
  const contradiction = floor && ceiling && rank(floor) < rank(ceiling);
  if (!contradiction) {
    if (floor && rank(tier) > rank(floor)) tier = floor;
    if (ceiling && rank(tier) < rank(ceiling)) tier = ceiling;
  }

  return {
    base,
    tier,
    score,
    delta: rank(base) - rank(tier),
    /* True when two rules made opposite absolute claims and both were
       dropped. Worth surfacing rather than hiding: it means the rule set
       disagrees with itself about this item. */
    contradiction: Boolean(contradiction),
    reasons,
    contextual: reasons.length > 0,
  };
}

/* True when the scenario says enough for any rule to have something to  */
/* work with, which in practice means a front has been chosen. No tier   */
/* row renders before that anyway, so this is a guard now rather than a  */
/* gate.                                                                 */
/*                                                                       */
/* It used to demand an environment on top, reasoning that a faction     */
/* alone moves almost nothing. That was measured on 21 August 2026 and   */
/* it is not true. On bugs a front alone already puts 37 rated items at  */
/* a different tier, and 74 carry a reason. A front with difficulty and  */
/* squad set moves 93 on bots. Every one of them was hidden, which meant */
/* the whole of what 1.16.0 added was unreachable unless you also picked */
/* a planet, and scenario.js says most sessions never do.                */
/*                                                                       */
/* A column that agrees is not a column with nothing in it. Agreeing     */
/* with the crowd is a real answer, the same one the full squad case     */
/* already gives: at four we have nothing to add, and saying so is the   */
/* correct output rather than a failure.                                 */
export const scenarioIsSet = (scenario = {}) => Boolean(scenario.faction);
