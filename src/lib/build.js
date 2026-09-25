/* ================================================================== */
/* THE LOADOUT READING                                                */
/*                                                                    */
/* score.js judges one item. This judges the nine of them together,   */
/* which is a different question and sometimes the opposite answer.   */
/*                                                                    */
/* It exists because of a specific failure. Five armour rules shipped */
/* at the item level in 1.10.0 and came straight back out in 1.13.0:  */
/* 48 of 51 primaries on the bot front share one of two identical     */
/* armour readings, so the rules charged nearly every primary for     */
/* being a primary. The curator's argument for why is the one that    */
/* sets this file's whole shape:                                      */
/*                                                                    */
/*   even the item that IS good at armour is not straightforwardly    */
/*   better, because bringing an Eruptor on bugs forces a Stalwart    */
/*   to cover chaff                                                   */
/*                                                                    */
/* That trade is invisible one item at a time and obvious across a    */
/* build. Armour is a loadout property. So is chaff clear, so is      */
/* whether anything you own closes a hole, and so is the fact that    */
/* your back holds one thing.                                         */
/*                                                                    */
/* Three rules keep it honest, and they are score.js's three with     */
/* one substitution:                                                  */
/*                                                                    */
/*  - The parts are the base and they stay visible. A build's score   */
/*    starts as what its items are worth where you are dropping, and  */
/*    the loadout layer argues with that rather than replacing it.    */
/*    There is no community vote on a loadout, so the parts are the   */
/*    only outside opinion there is.                                  */
/*  - Every point of movement carries a sentence.                     */
/*  - Every rule must fire on something that varies between builds.   */
/*    npm run builds measures exactly that, and it is the check the   */
/*    armour rules would have failed.                                 */
/*                                                                    */
/* Pure, same shape as score.js, squad.js and enemies.js. No React,   */
/* no storage, runnable from a script.                                */
/* ================================================================== */

import RULES from "../data/build-rules.json";
import { statsFor } from "./items.js";
import { loadoutItems, isHeldWeapon, backpackUsers } from "./loadouts.js";
import { scoreItem, peril, applies, matches, numberTest, tierForScore, TIER_POINTS } from "./score.js";
import { frontReading } from "./enemies.js";

/* ------------------------------------------------------------------ */
/* The scale                                                           */
/*                                                                     */
/* Deliberately the item scale, unchanged. A build scoring 68 and an   */
/* item scoring 68 mean the same thing, which is what lets the two     */
/* numbers sit on one screen without a translation step, and what      */
/* lets a build inherit tierForScore rather than inventing a second    */
/* ladder nobody has learned.                                          */
/* ------------------------------------------------------------------ */

/* Same licence the scenario has to argue with a community vote: two    */
/* tiers, growing a little past the point where things are dire. The    */
/* loadout layer may say a kit is worse than its parts. It may not say  */
/* nine S+ items are a D.                                               */
const MAX_ADJUST = 28;
const adjustFor = (p) => (p === null ? MAX_ADJUST : MAX_ADJUST + Math.max(0, p - 22) * 0.5);

/* ------------------------------------------------------------------ */
/* What a build is, before any rule looks at it                        */
/* ------------------------------------------------------------------ */

/**
 * The facts a rule may ask about. Everything here is derived from the
 * items in the slots, so a rule never reaches into the loadout object
 * and no two rules can disagree about what "carries anti-tank" means.
 *
 * loadout   one build, curated or your own
 * scenario  { faction, biome, hazards[], mission, difficulty, squad }
 */
export function buildFacts(loadout, scenario = {}) {
  const items = loadoutItems(loadout);
  const held = items.filter(isHeldWeapon);

  /* Penetration is limited to what you aim, and that is not a detail.
     A sentry cannot pick a weak point and an orbital does not care
     where the plate is thin, so a build whose only AP 6 is a Railcannon
     has not answered the question "can you hurt the thing walking at
     you right now". What the Railcannon does answer is the anti-armor
     role below, which counts everything. Two questions, both asked. */
  const heldAp = held.length ? Math.max(...held.map((i) => i.stats.ap ?? 0)) : 0;
  const anyAp = items.length ? Math.max(...items.map((i) => i.stats.ap ?? 0)) : 0;

  const roleCount = (role) => items.filter((i) => i.roles.includes(role)).length;

  return {
    items,
    held,
    heldAp,
    anyAp,
    /* What the best thing you aim actually opens on this front at this
       level. Null with no front chosen or nothing held, both of which
       are real absences rather than zeroes, and a rule reaching through
       a null finds undefined and does not fire. */
    reach: frontReading(heldAp, scenario.faction, scenario.difficulty),
    roles: {
      antiArmor: roleCount("anti-armor"),
      chaff: roleCount("chaff"),
      objective: roleCount("objective"),
    },
    /* Demo 40 closes a hole from outside, demo 30 needs the throw to go
       in. squad.js already prices that difference and this is the same
       reading over one build. */
    holeClosers: items.filter((i) => i.roles.includes("objective") && (i.stats.demoForce ?? 0) >= 40).length,
    backpacks: backpackUsers(loadout).length,
    /* How many of the nine are filled. A half built loadout should not
       read as a considered one, and the builder saves drafts. */
    filled: items.length,
  };
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/*                                                                     */
/* A build clause, not an item clause. The item matcher is score.js's   */
/* and it is imported rather than reimplemented, so `count` below can   */
/* ask any question a context rule can ask and the two vocabularies     */
/* cannot drift apart.                                                  */
/* ------------------------------------------------------------------ */

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

const ROLE_KEY = { "anti-armor": "antiArmor", chaff: "chaff", objective: "objective" };

/* Reads a number off the facts, the armour reading or the scenario, in  */
/* one syntax: facts.heldAp, reach.openShare, scenario.peril.            */
function look(ctx, path) {
  const parts = String(path).split(".");
  const root = { facts: ctx.facts, reach: ctx.facts.reach, scenario: ctx.scenario }[parts[0]];
  let cur = root;
  for (const k of parts.slice(1)) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}

function buildMatches(ctx, match) {
  if (!match) return true;
  const { facts } = ctx;

  for (const [key, want] of Object.entries(match)) {
    /* At least one item in the build carries one of these roles. */
    if (key === "covers") {
      if (!asArray(want).some((r) => facts.roles[ROLE_KEY[r]] > 0)) return false;
      continue;
    }
    /* Nothing in the build carries any of them. This is the one that     */
    /* earns its keep: chaff and objective are each present in 36 of the  */
    /* 39 curated builds, so asking whether a build HAS them fires on     */
    /* 92% and says nothing. Asking whether it lacks them fires on 8%,    */
    /* and those three builds have a real hole.                           */
    if (key === "notCovers") {
      if (asArray(want).some((r) => facts.roles[ROLE_KEY[r]] > 0)) return false;
      continue;
    }
    /* How many items match an ordinary context-rule clause. `of` is the  */
    /* item matcher from score.js, so this reads any field a tier rule    */
    /* can read: { "of": { "roles": ["chaff"] }, "lte": 1 }.              */
    if (key === "count") {
      for (const test of asArray(want)) {
        const n = facts.items.filter((item) => matches(itemCtx(ctx, item), test.of)).length;
        if (!numberTest(n, test)) return false;
      }
      continue;
    }
    if (key === "number") {
      for (const test of asArray(want)) {
        if (!numberTest(look(ctx, test.path), test)) return false;
      }
      continue;
    }
    /* Whether anything in the build matches one item clause at all.      */
    if (key === "has") {
      if (!facts.items.some((item) => matches(itemCtx(ctx, item), want))) return false;
      continue;
    }
    if (key === "notHas") {
      if (facts.items.some((item) => matches(itemCtx(ctx, item), want))) return false;
      continue;
    }
    throw new Error(`build rule uses an unknown match key: ${key}`);
  }
  return true;
}

/* score.js's matcher wants an item context. Building one per item per   */
/* rule is a few hundred objects for a grid of forty builds, which is    */
/* nothing, and it is the price of having exactly one item matcher.      */
function itemCtx(ctx, item) {
  return {
    item,
    wiki: ctx.wikiFor(item),
    armour: frontReading(item.stats.ap, ctx.scenario.faction, ctx.scenario.difficulty),
    scenario: ctx.scenario,
  };
}

/* ------------------------------------------------------------------ */
/* Reading a build                                                     */
/* ------------------------------------------------------------------ */

/**
 * loadout   one build
 * scenario  { faction, biome, hazards[], mission, difficulty, squad }
 *
 * returns {
 *   parts       [{ item, ...scoreItem }] every slot, scored where you are dropping
 *   partsScore  the mean of the rated ones, or null when nothing is rated
 *   adjust      what the loadout layer added or took off, already clamped
 *   score       partsScore + adjust
 *   tier        that score on the item ladder, or null with nothing rated
 *   partsTier   what the parts alone would have read, so the two are comparable
 *   notes       [{ id, severity, say, delta }] most severe first
 *   facts       what the rules looked at, for the health check and the UI
 *   unrated     how many slots carry no community rating
 *   contextual  whether anything at all had something to say
 * }
 */
export function readBuild(loadout, scenario = {}) {
  const facts = buildFacts(loadout, scenario);
  const withPeril = { ...scenario, peril: peril(scenario) };
  const ctx = { facts, scenario: withPeril, wikiFor: (item) => statsFor(item.id) };

  /* The parts. Every slot gets the full contextual reading it would get
     on a tier row, so a build's number and the rows behind it can never
     tell you different things about the same weapon. */
  const parts = facts.items.map((item) => ({ item, ...scoreItem(item, scenario) }));
  const rated = parts.filter((p) => typeof p.score === "number");

  /* Unrated slots are excluded rather than counted as zero, the same
     call judgedTier makes on the tier list. A Castellan's Creed weapon
     nobody has voted on must not drag a build down for the crime of
     being new: that is how a new warbond item never gets tried. */
  const partsScore = rated.length ? rated.reduce((n, p) => n + p.score, 0) / rated.length : null;

  const notes = [];
  let points = 0;

  for (const rule of RULES.rules) {
    if (!applies(scenario, rule.when)) continue;
    if (!buildMatches(ctx, rule.match)) continue;

    let delta = rule.delta ?? 0;
    if (rule.scaleBy) {
      const v = look(ctx, rule.scaleBy.path);
      if (typeof v !== "number") continue;
      delta = Math.round((v - (rule.scaleBy.from ?? 0)) * rule.scaleBy.times);
      if (rule.scaleBy.clamp) delta = Math.max(-rule.scaleBy.clamp, Math.min(rule.scaleBy.clamp, delta));
    }
    if (!delta && !rule.severity) continue;

    points += delta;

    /* Same contract as a context rule: a rule that can invert carries a
       second sentence, and inverted means the delta came out opposite to
       the rule's own direction rather than simply negative. */
    const direction = rule.scaleBy ? rule.scaleBy.times : rule.delta;
    const inverted = rule.sayInverted && direction && delta * direction < 0;

    notes.push({
      id: rule.id,
      severity: rule.severity || null,
      say: inverted ? rule.sayInverted : rule.say,
      delta,
    });
  }

  const SEVERITY_ORDER = { red: 0, amber: 1, grey: 2 };
  notes.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
      Math.abs(b.delta) - Math.abs(a.delta)
  );

  const limit = adjustFor(withPeril.peril);
  const adjust = Math.max(-limit, Math.min(limit, points));

  /* Nothing rated is not a zero, it is no answer, and the UI has to be
     able to tell those apart. A build of eight vehicles is unscoreable,
     not terrible. */
  if (partsScore === null) {
    return {
      parts, partsScore: null, adjust, score: null, tier: null, partsTier: null,
      notes, facts, unrated: parts.length, contextual: notes.length > 0,
    };
  }

  const score = partsScore + adjust;
  return {
    parts,
    partsScore,
    adjust,
    score,
    tier: tierForScore(score),
    /* What the parts alone said, kept so the difference is legible the
       same way the two tier columns are. A build whose kit is worth an A
       and whose combination reads B is the interesting case, and hiding
       the A makes the B unarguable. */
    partsTier: tierForScore(partsScore),
    notes,
    facts,
    unrated: parts.length - rated.length,
    contextual: notes.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Saying it                                                           */
/* ------------------------------------------------------------------ */

/* A build with nothing flagged says nothing, the same discipline the    */
/* squad panel keeps. An empty list is the normal state and never a      */
/* claim that the kit is complete.                                       */
export const gapsIn = (reading) => reading.notes.filter((n) => n.severity === "red" || n.severity === "amber");

/* Ranking a grid. The score is the answer where there is one; a build   */
/* nobody has rated a single slot of sorts last rather than first, the   */
/* same place an unrated item sorts on a tier list.                      */
export const byReading = (a, b) => (b.score ?? -1) - (a.score ?? -1);

/* What the number is made of, in one line, for a tooltip or a caption.  */
/* Written here rather than in a component for the reason squad.js and   */
/* enemies.js both give: the wording and the arithmetic have to move     */
/* together.                                                             */
export function explainScore(reading) {
  if (reading.score === null) return "No slot in this build carries a community rating, so there is nothing to score.";
  const parts = `The gear averages ${Math.round(reading.partsScore)} where you are dropping`;
  if (!reading.adjust) return `${parts}, and nothing about the combination changes that.`;
  const dir = reading.adjust > 0 ? "adds" : "takes off";
  const said = `${parts}, and how it fits together ${dir} ${Math.abs(Math.round(reading.adjust))}`;
  /* Points that do not cross a band are still points, and a reader looking
     at two identical badges under a green number deserves to be told which
     of the two things happened. */
  return reading.tier === reading.partsTier ? `${said}, which is not enough to move the badge.` : `${said}.`;
}
