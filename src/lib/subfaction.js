/* ================================================================== */
/* WHO HOLDS THE PLANET                                               */
/*                                                                    */
/* The war marks a planet with effect numbers, and a few of those     */
/* numbers mean an enemy subfaction: Predator Strain, the Jet         */
/* Brigade, Vote Snatchers. src/data/subfactions.json is the          */
/* curator's table of which number is which. This reads it.           */
/*                                                                    */
/* The subfaction is live data, so it is never stored and never sent  */
/* to a party: App.jsx lays it on the scenario beside rulesOff, from  */
/* this browser's own war. Pure, no React, so scripts load it too.    */
/* ================================================================== */

import TABLE from "../data/subfactions.json";

export const SUBFACTIONS = TABLE.subfactions;

const byEffect = new Map();
for (const [key, s] of Object.entries(SUBFACTIONS)) {
  for (const n of s.effects) byEffect.set(n, key);
}

/* The subfactions on a planet, from a fresh war, in table order. A stale
   war, no war, or no planet is nothing at all, which every rule asking
   treats the way it treats an unset difficulty. */
export function subfactionsOn(war, planet) {
  if (!planet || !war || !war.fresh || !war.marks) return [];
  const ids = war.marks.effects.get(planet) || [];
  const here = new Set(ids.map((n) => byEffect.get(n)).filter(Boolean));
  return Object.keys(SUBFACTIONS).filter((k) => here.has(k));
}

/* The subfactions that count for this scenario: only those on its own
   front. The editor and the tier picker swap the front for a build's
   own, and a bot build must not inherit the Predator Strain from the
   bug planet the scenario names. */
export function subfactionsIn(scenario) {
  const keys = (scenario && scenario.subfactions) || [];
  if (!keys.length) return keys;
  return keys.filter((k) => SUBFACTIONS[k] && SUBFACTIONS[k].front === scenario.faction);
}

export const subfactionName = (key) => (SUBFACTIONS[key] ? SUBFACTIONS[key].name : key);
