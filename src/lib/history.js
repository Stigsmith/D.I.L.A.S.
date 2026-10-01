/* ================================================================== */
/* WHAT YOU DROPPED WITH                                              */
/*                                                                    */
/* Every confirmed drop, kept in this browser: which build, where,    */
/* and when. Started on 1 October 2026, before anything reads it      */
/* much, so that by the time "you have never dropped with a Railgun   */
/* against bots" is built there is a history for it to read. The      */
/* curator's idea; the order is deliberate.                           */
/*                                                                    */
/* An entry copies the build's items at the moment you confirmed, not */
/* just its id. A build is edited and deleted over time, and what you */
/* actually carried that night is the fact worth keeping.             */
/*                                                                    */
/* Pure, so a script can run it. The collection state holds the list  */
/* and the export carries it, because two address moves are coming    */
/* and a history that stays behind is a history lost.                 */
/* ================================================================== */

import { loadoutItemIds } from "./loadouts.js";

/* Enough for years of evenings, small enough that nobody notices it in an
   export. The oldest go first. */
export const HISTORY_CAP = 1000;

/* A confirm taken back this soon was somebody changing their mind, not a
   drop, so "Change my mind" inside this window removes the entry again. */
export const TAKE_BACK_MS = 15 * 60 * 1000;

const newEntryId = () => `drop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * One drop. `at` is an ISO date; the rest is what the scenario said and
 * what the build held. A preset is logged like your own build, with its
 * own id, because you dropped with it all the same.
 */
export function entryFor(build, scenario = {}, at = new Date().toISOString()) {
  return {
    id: newEntryId(),
    at,
    build: build.id,
    name: build.name,
    preset: Boolean(build.preset),
    faction: build.faction || scenario.faction || null,
    planet: scenario.planet || null,
    mission: scenario.mission || null,
    difficulty: scenario.difficulty || 0,
    squad: scenario.squad || 0,
    items: loadoutItemIds(build),
  };
}

const str = (v) => (typeof v === "string" && v ? v : null);
const num = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

/* Whatever storage or an imported file handed back, made safe to read.
   Anything that is not an entry is dropped rather than repaired. */
export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const id = str(e.id);
    const at = str(e.at);
    const build = str(e.build);
    if (!id || !at || !build || Number.isNaN(Date.parse(at))) continue;
    out.push({
      id,
      at,
      build,
      name: str(e.name) || "Unnamed build",
      preset: e.preset === true,
      faction: str(e.faction),
      planet: str(e.planet),
      mission: str(e.mission),
      difficulty: num(e.difficulty, 10),
      squad: num(e.squad, 4),
      items: Array.isArray(e.items) ? e.items.filter((x) => typeof x === "string") : [],
    });
  }
  out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return out.slice(-HISTORY_CAP);
}

/* Two histories joined, as an import does: nothing twice, oldest first. */
export function mergeHistory(a, b) {
  const seen = new Map();
  for (const e of [...cleanHistory(a), ...cleanHistory(b)]) seen.set(e.id, e);
  return cleanHistory([...seen.values()]);
}

/* How often, and how lately, you have dropped with one build. */
export function usageOf(history, buildId) {
  let count = 0;
  let last = null;
  for (const e of history) {
    if (e.build !== buildId) continue;
    count += 1;
    if (!last || e.at > last) last = e.at;
  }
  return { count, last };
}

/* Every item you have dropped with on a front, for "you have never
   brought this against them". */
export function itemsDroppedWith(history, faction) {
  const out = new Set();
  for (const e of history) {
    if (faction && e.faction !== faction) continue;
    for (const id of e.items) out.add(id);
  }
  return out;
}
