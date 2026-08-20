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
import { traitsOf } from "./brief.js";

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

/* One tier is about 14 points, so two is the clamp. A brief may argue  */
/* hard about an item; it may not rewrite what the item is. Anything    */
/* that genuinely should override the base says so with a floor or a    */
/* ceiling instead, which is a claim a rule has to make explicitly.     */
const MAX_SWING = 28;

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/* Reaches into either the curated item or its fetched stats, so a rule */
/* can read stats.ap and wiki.handling.ergonomics in the same syntax.   */
function reach(item, wiki, path) {
  const parts = String(path).split(".");
  let cur = parts[0] === "wiki" ? wiki : item;
  for (const k of parts[0] === "wiki" ? parts.slice(1) : parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}

function numberTest(value, test) {
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
function matches(item, wiki, match) {
  if (!match) return true;

  for (const [key, want] of Object.entries(match)) {
    if (key === "ventsHeat") {
      if (ventsHeat(item) !== Boolean(want)) return false;
      continue;
    }
    /* Gear you carry and aim yourself. A sentry cannot pick a weakpoint, */
    /* which is the same reason the squad penetration check is limited to   */
    /* held weapons. Mirrors heldGear in loadouts.js.                       */
    if (key === "held") {
      const isHeld =
        item.slot === "primary" || item.slot === "secondary" ||
        (item.slot === "stratagem" && item.stratType === "support");
      if (isHeld !== Boolean(want)) return false;
      continue;
    }
    /* A named list, keyed by id because nothing in this project may     */
    /* reference an item by name. Used only where no sourced signal        */
    /* exists, and the rule carrying one says so in its own text.          */
    if (key === "idIn") {
      if (!asArray(want).includes(item.id)) return false;
      continue;
    }
    if (key === "hasWiki") {
      if (Boolean(wiki) !== Boolean(want)) return false;
      continue;
    }
    if (key === "tags") {
      const have = (wiki && wiki.tags) || [];
      if (!asArray(want).some((t) => have.includes(t))) return false;
      continue;
    }
    if (key === "notTags") {
      const have = (wiki && wiki.tags) || [];
      if (asArray(want).some((t) => have.includes(t))) return false;
      continue;
    }
    if (key === "roles") {
      if (!asArray(want).some((r) => item.roles.includes(r))) return false;
      continue;
    }
    if (key === "number") {
      for (const test of asArray(want)) {
        if (!numberTest(reach(item, wiki, test.path), test)) return false;
      }
      continue;
    }

    /* Everything else is a plain field on the item, compared as a set. */
    const value = reach(item, wiki, key);
    if (!asArray(want).includes(value)) return false;
  }
  return true;
}

/* A rule's `when` is about the brief rather than the item. */
function applies(brief, when) {
  if (!when) return true;
  for (const [key, want] of Object.entries(when)) {
    if (key === "hazard") {
      if (!asArray(want).some((h) => (brief.hazards || []).includes(h))) return false;
      continue;
    }
    if (key === "biome") {
      if (!asArray(want).includes(brief.biome)) return false;
      continue;
    }
    if (key === "faction") {
      if (!asArray(want).includes(brief.faction)) return false;
      continue;
    }
    /* Rules key on what a mission asks of you, not on its name. There   */
    /* are seventy missions and eight traits, and a rule about carrying    */
    /* something should not have to list every mission that involves it.   */
    if (key === "mission") {
      const have = traitsOf(brief.mission);
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
 * brief  { faction, biome, hazards[], mission }
 *
 * returns {
 *   base      the community tier, or null when nobody has rated it
 *   tier      the contextual tier, or null when there is no base to move
 *   delta     tiers moved, positive or negative, 0 when nothing fired
 *   reasons   [{ id, say, delta }] most influential first
 *   contextual whether the brief said enough for any rule to fire
 * }
 */
export function scoreItem(item, brief = {}) {
  const faction = brief.faction;
  const base = faction ? item.ratings[faction].tier : null;
  const wiki = statsFor(item.id);

  const reasons = [];
  let points = 0;
  let floor = null;
  let ceiling = null;

  for (const rule of RULES.rules) {
    if (!applies(brief, rule.when)) continue;
    if (!matches(item, wiki, rule.match)) continue;

    /* A rule may state its delta outright, or compute one from a number */
    /* the item carries. The heat rules use the second: the game already */
    /* publishes how much faster a given weapon vents in the cold, so    */
    /* the size of the bonus is read rather than invented.               */
    let delta = rule.delta ?? 0;
    if (rule.scaleBy) {
      const v = reach(item, wiki, rule.scaleBy.path);
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
    reasons.push({ id: rule.id, say: rule.say, delta });
  }

  reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  /* An unrated item has no base to move, but the reasons are still worth */
  /* saying: they are how a Castellan's Creed weapon nobody has voted on  */
  /* ever gets tried on the front it happens to suit.                     */
  if (!base) {
    return { base: null, tier: null, delta: 0, reasons, contextual: reasons.length > 0 };
  }

  const clamped = Math.max(-MAX_SWING, Math.min(MAX_SWING, points));
  let score = TIER_POINTS[base] + clamped;
  let tier = tierForScore(score);

  /* Floors and ceilings are the escape hatch from the clamp, and they   */
  /* are deliberately awkward to reach: a rule has to name the tier it   */
  /* is forcing rather than pile on points until it gets there.          */
  const rank = (t) => TIER_ORDER.indexOf(t);
  if (floor && rank(tier) > rank(floor)) tier = floor;
  if (ceiling && rank(tier) < rank(ceiling)) tier = ceiling;

  return {
    base,
    tier,
    score,
    delta: rank(base) - rank(tier),
    reasons,
    contextual: reasons.length > 0,
  };
}

/* True when the brief says enough for any rule to have something to     */
/* work with. A faction alone moves almost nothing, and a column full of */
/* unchanged badges is worse than an empty one that says what it wants.  */
export const briefIsSet = (brief = {}) =>
  Boolean(brief.faction && (brief.biome || (brief.hazards || []).length || brief.mission));
