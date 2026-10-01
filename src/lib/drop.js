/* ================================================================== */
/* THE DROP                                                           */
/*                                                                    */
/* What the drop screen needs that is not a picture: which builds a   */
/* slot may offer, which slots count as the squad, and how the        */
/* scenario is spoken to the squad checks. Pure, so a script can run  */
/* it, and so the live party can reuse every line of it unchanged.    */
/*                                                                    */
/* Two decisions shape it, both the curator's, 27 September 2026:     */
/*                                                                    */
/*  - An unconfirmed slot reads as still deciding and nothing else.   */
/*    The squad checks count confirmed loadouts only, so a half       */
/*    picked kit never sets off a false alarm.                        */
/*  - People join by a party code, not an account. Outside a party    */
/*    the squadmate slots are filled by hand; inside one, by the      */
/*    party, from what each person confirmed.                         */
/* ================================================================== */

import vocabulary from "../data/vocabulary.json";
import { deriveHeat, loadoutItemIds, cleanLoadout } from "./loadouts.js";
import { traitsOf } from "./scenario.js";
import { readBuild, byReading } from "./build.js";
import { usageOf } from "./history.js";

/* In game the cap is four, and so is the screen. */
export const SQUAD_CAP = 4;

/* ------------------------------------------------------------------ */
/* The scenario, spoken in the words the builds use                    */
/*                                                                     */
/* A build declares biomes from the old filter vocabulary: hot, cold,  */
/* foggy, urban, cave. The scenario speaks in planet hazards. This is  */
/* the one place the two meet, and it only ever reads hazards, which   */
/* is also what the scoring rules read, so the gate and the rating     */
/* cannot disagree about whether a planet is hot.                      */
/*                                                                     */
/* First match wins and heat is first, because heat is the one that    */
/* removes builds. Urban and cave have no hazard behind them, so the   */
/* scenario can never say either, and a build declaring only those     */
/* survives everywhere. That is the general purpose rule working, not  */
/* a gap being papered over.                                           */
/* ------------------------------------------------------------------ */

const GATE_FROM_HAZARD = [
  ["intense_heat", "hot"],
  ["extreme_cold", "cold"],
  ["thick_fog", "foggy"],
];

export function gateBiome(scenario = {}) {
  const hazards = scenario.hazards || [];
  const hit = GATE_FROM_HAZARD.find(([hazard]) => hazards.includes(hazard));
  return hit ? hit[1] : "any";
}

/* The band a build declares, from the level the scenario holds. Zero is
   not a difficulty, so it is no band, and no band gates nothing. */
export function bandFor(level) {
  const d = vocabulary.difficulties.find((x) => x.level === Number(level));
  return d ? d.band : "any";
}

/* What squad.js is handed. It still takes the old names so the grid it
   grew up under keeps working; traits is how a real mission name reaches
   it, since "Retrieve Valuable Data" is not a word the checks know. */
export function dropContext(scenario = {}) {
  return {
    faction: scenario.faction || "any",
    biome: gateBiome(scenario),
    mission: "any",
    traits: traitsOf(scenario.mission),
    difficulty: bandFor(scenario.difficulty),
    level: scenario.difficulty || 0,
  };
}

/* ------------------------------------------------------------------ */
/* What a slot may offer                                               */
/*                                                                     */
/* The same hard gates the grid has always applied, read off the       */
/* scenario rather than off a second set of filters:                   */
/*                                                                     */
/*  - the front, because a bugs build has no business on a bot drop     */
/*  - heat, because a hot planet removes a build that vents it. That   */
/*    is a locked decision: if the answer is do not bring this, it     */
/*    should not be offered                                            */
/*  - the difficulty band a build declares, the other locked gate      */
/*  - a declared biome that is not this one. A build declaring none is */
/*    general purpose and always survives                              */
/*                                                                     */
/* Gear you have not unlocked is hidden rather than gated, and only    */
/* for your own slot: the lock list is yours, and it says nothing       */
/* about what a squadmate owns.                                         */
/*                                                                     */
/* This returns the grid's order, favourites first, then yours, then   */
/* the presets. Ranking is suggestBuilds below and the picker's sort:  */
/* the curator decided on 1 October 2026 that Drop Bay suggests.       */
/* ------------------------------------------------------------------ */

export function withHeat(builds) {
  return builds.map((l) => ({ ...l, heat: deriveHeat(l) }));
}

/* Which hard gate, if any, turns a build away from this scenario. One
   function for the picker and the slots, so a build the picker refuses
   and a slot that says "the picker would refuse this" cannot disagree.
   The front is not one of them: a slot holding another front's build is
   still what that person is bringing, and says so separately. */
export function gateOf(l, scenario = {}) {
  const biome = gateBiome(scenario);
  const band = bandFor(scenario.difficulty);
  if (biome === "hot" && l.heat) return "heat";
  if (band !== "any" && !(l.diff || []).includes(band)) return "band";
  const built = l.biomes || [];
  if (biome !== "any" && built.length && !built.includes(biome)) return "biome";
  return null;
}

export function dropPool(builds, scenario = {}, { lockedSet = new Set(), favorites = [], showLocked = true, query = "" } = {}) {
  const q = query.trim().toLowerCase();
  const cut = { heat: 0, band: 0, biome: 0, locked: 0 };
  const shown = [];

  for (const l of builds) {
    if (l.faction !== scenario.faction) continue;
    const gate = gateOf(l, scenario);
    if (gate) { cut[gate] += 1; continue; }
    const needsLocked = loadoutItemIds(l).some((id) => lockedSet.has(id));
    if (needsLocked && !showLocked) { cut.locked += 1; continue; }
    if (q && !l.name.toLowerCase().includes(q)) continue;
    shown.push({ ...l, needsLocked });
  }

  const fav = new Set(favorites);
  const order = (l) => (fav.has(l.id) ? 0 : 2) + (l.preset ? 1 : 0);
  shown.sort((a, b) => order(a) - order(b));
  return { shown, cut, cold: gateBiome(scenario) === "cold" };
}

/* ------------------------------------------------------------------ */
/* Who counts                                                          */
/*                                                                     */
/* Stored as ids, never as copies, the same way the old comparison     */
/* was: a build edited in the builder is re-read rather than held      */
/* stale. A slot whose build has since been deleted reads as empty.    */
/*                                                                     */
/* Confirming stamps the build's updatedAt. Edit it afterwards and the  */
/* slot drops back to still deciding, because what you confirmed is    */
/* not what you are now holding. The live party will publish exactly  */
/* that confirmed version, so the two have to agree now.              */
/* ------------------------------------------------------------------ */

export const EMPTY_DROP = { mine: null, confirmed: null, mates: [null, null, null], logged: null };

/* Whatever localStorage handed back, made safe to read. */
export function cleanDrop(raw) {
  if (!raw || typeof raw !== "object") return EMPTY_DROP;
  const id = (v) => (typeof v === "string" && v ? v : null);
  const mates = Array.isArray(raw.mates) ? raw.mates : [];
  return {
    mine: id(raw.mine),
    /* The stamp confirmed against. Null is not confirmed; a build with no
       updatedAt, which is every preset, stamps as the empty string. */
    confirmed: typeof raw.confirmed === "string" ? raw.confirmed : null,
    mates: Array.from({ length: SQUAD_CAP - 1 }, (_, i) => id(mates[i])),
    /* The history entry the last Confirm wrote, so "Change my mind" soon
       after can take it back. */
    logged: raw.logged && id(raw.logged.id) && id(raw.logged.at) ? { id: raw.logged.id, at: raw.logged.at } : null,
  };
}

export const stampOf = (l) => (l && l.updatedAt) || "";

export function isConfirmed(drop, mine) {
  return Boolean(mine) && drop.confirmed !== null && drop.confirmed === stampOf(mine);
}

/**
 * drop     the stored slot ids
 * resolve  id to build, or undefined
 * returns  { mine, mates, counted }. counted is what the squad checks
 *          read: your build only once confirmed, and every squadmate a
 *          hand filled slot holds, since you are the one who put it there
 */
export function readDrop(drop, resolve) {
  const mine = drop.mine ? resolve(drop.mine) || null : null;
  const mates = drop.mates.map((id) => (id ? resolve(id) || null : null));
  const counted = [
    ...(isConfirmed(drop, mine) ? [mine] : []),
    ...mates.filter(Boolean),
  ];
  return { mine, mates, confirmed: isConfirmed(drop, mine), counted };
}

/* ------------------------------------------------------------------ */
/* On the wire                                                         */
/*                                                                     */
/* What goes to the party when you confirm, and what a squadmate's      */
/* build is turned back into when it arrives. The server has no opinion */
/* about what a build is, so this is the only check it ever gets:       */
/* every slot is resolved against this browser's own item table, and    */
/* anything that is not the right kind of item is dropped, exactly as   */
/* a build read back from storage would be.                             */
/*                                                                     */
/* Only the fields a slot draws. The blurb and the notes stay home:     */
/* nobody in the squad needs them to read the drop, and a free text     */
/* field is the one thing on a shared screen worth not sending.         */
/* ------------------------------------------------------------------ */

const WIRE_FIELDS = ["id", "name", "faction", "preset", "primary", "secondary", "grenade", "armor", "booster", "strats", "diff", "biomes", "updatedAt"];

export function packBuild(l) {
  if (!l) return null;
  const out = {};
  for (const k of WIRE_FIELDS) if (l[k] !== undefined) out[k] = l[k];
  return out;
}

/* A squadmate's build, made safe to draw, or null when nothing usable
   arrived. The name is capped because it is the one string drawn large. */
export function unpackBuild(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const clean = cleanLoadout({ ...raw, id: typeof raw.id === "string" ? raw.id : "shared" });
  if (!clean) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 60) : "Unnamed build";
  return {
    ...clean,
    name,
    preset: raw.preset === true,
    diff: Array.isArray(raw.diff) ? raw.diff.filter((d) => typeof d === "string") : [],
    biomes: Array.isArray(raw.biomes) ? raw.biomes.filter((b) => typeof b === "string") : [],
  };
}

/* ------------------------------------------------------------------ */
/* Suggesting                                                          */
/*                                                                     */
/* The curator's call, 1 October 2026: Drop Bay is the front door, and  */
/* it suggests from your builds. Ranked by the reading, the same number */
/* a build's badge shows everywhere, so a suggestion and the badge      */
/* beside it can never disagree. Only builds the scenario allows and    */
/* that need nothing you have not unlocked: a suggestion you cannot     */
/* bring is not a suggestion.                                          */
/*                                                                     */
/* Nothing is hidden by it. The picker still lists everything that      */
/* fits, ranked the same way.                                           */
/* ------------------------------------------------------------------ */

export function rankByReading(builds, scenario = {}, favorites = []) {
  const fav = new Set(favorites);
  return builds
    .map((build) => ({ build, reading: readBuild(build, scenario) }))
    .sort((a, b) => (fav.has(a.build.id) ? 0 : 1) - (fav.has(b.build.id) ? 0 : 1) || byReading(a.reading, b.reading));
}

export function suggestBuilds(builds, scenario = {}, { lockedSet = new Set(), history = [], limit = 3 } = {}) {
  const { shown } = dropPool(builds, scenario, { lockedSet, showLocked: false });
  return shown
    .map((build) => ({ build, reading: readBuild(build, scenario), usage: usageOf(history, build.id) }))
    .filter((x) => x.reading.score !== null)
    .sort((a, b) => byReading(a.reading, b.reading))
    .slice(0, limit);
}

/* Why a build suits this drop, in one line: the piece of it the scenario
   lifts the most, in that rule's own words. Failing that, the most
   serious hole in it, so a suggestion never hides its weak spot. Null
   when the scenario has nothing to say about it either way. */
export function whyFor(reading) {
  if (!reading) return null;
  const lifted = reading.parts
    .filter((p) => p.delta > 0 && p.reasons && p.reasons.some((r) => r.delta > 0))
    .sort((a, b) => b.delta - a.delta);
  if (lifted.length) {
    const p = lifted[0];
    const r = p.reasons.find((x) => x.delta > 0);
    return { tone: "up", item: p.item.name, text: r.say };
  }
  const gap = reading.notes.find((n) => n.severity === "red" || n.severity === "amber");
  if (gap) return { tone: "gap", item: null, text: gap.say };
  return null;
}
