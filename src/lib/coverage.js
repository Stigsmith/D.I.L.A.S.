/* ================================================================== */
/* WHAT YOUR BUILDS COVER                                             */
/*                                                                    */
/* The Armoury's second tab. The curator's question, 1 October 2026:  */
/* do I have something for each occasion? Something to play solo on   */
/* Super Helldive, something for a frozen planet, something for a     */
/* Commando mission? What did I build for Terminids again?            */
/*                                                                    */
/* A fixed set of situations, read per front, each answered with your */
/* best build for it by the same reading every badge shows, through   */
/* the same hard gates the drop screen applies. A situation nothing   */
/* you own can answer is a gap, and it says why.                      */
/*                                                                    */
/* Pure, so a script can run it.                                      */
/* ================================================================== */

import { dropPool, rankByReading } from "./drop.js";
import { missions } from "./scenario.js";

/* Everything below is read at Suicide Mission with four of you unless a
   row says otherwise: hard enough that every rule has its say, common
   enough to be the evening most people actually play. */
const BASE = { difficulty: 7, squad: 4, hazards: [] };

export const SITUATIONS = [
  { id: "solo-top", label: "Solo on Super Helldive", scenario: { difficulty: 10, squad: 1 } },
  { id: "squad-top", label: "4 players on Super Helldive", scenario: { difficulty: 10, squad: 4 } },
  { id: "squad-hard", label: "4 players on Hard", scenario: { difficulty: 5, squad: 4 } },
  { id: "hot", label: "A hot planet", scenario: { hazards: ["intense_heat"] } },
  { id: "cold", label: "A frozen planet", scenario: { hazards: ["extreme_cold"] } },
  { id: "sand", label: "Sandstorms", scenario: { hazards: ["sandstorms"] } },
  { id: "ion", label: "Ion storms", scenario: { hazards: ["ion_storms"] } },
  { id: "nest", label: "Structure demolition", trait: "nest" },
  { id: "blitz", label: "Blitz", trait: "blitz" },
  { id: "wave", label: "Eradicate", trait: "wave" },
  { id: "defend", label: "Hold the line", trait: "defend" },
  { id: "evacuate", label: "Escort", trait: "evacuate" },
  { id: "carry", label: "Carrying an objective", trait: "carry" },
  { id: "hvt", label: "High value targets", trait: "hvt" },
  { id: "commando", label: "Commando", trait: "commando" },
];

/* A real mission on this front that asks for the trait, so the row is
   read the way the drop screen would read it. One that asks for nothing
   else is preferred, so the row is about the trait and not a mix. Null
   when the front never offers it. */
export function missionFor(faction, trait) {
  const here = missions.filter((m) => m.factions.includes(faction) && m.traits.includes(trait));
  const pure = here.find((m) => m.traits.length === 1);
  return (pure || here[0] || {}).name || null;
}

export function situationScenario(situation, faction, rulesOff, skill) {
  const mission = situation.trait ? missionFor(faction, situation.trait) : null;
  if (situation.trait && !mission) return null;
  return { ...BASE, ...(situation.scenario || {}), faction, mission, rulesOff, skill };
}

/* A situation counts as covered once your best build for it reads A or
   better: good enough to bring without apologising for it. B is thin. */
const COVERED = new Set(["S+", "S", "A"]);
export const standingOf = (best) =>
  !best ? "gap" : COVERED.has(best.reading.tier) ? "covered" : "thin";

/**
 * builds    yours, with heat derived (drop.js withHeat)
 * returns   { [front]: [{ situation, scenario, best, fit, cut, standing }] }
 *           best is { build, reading } or null; fit counts every build the
 *           situation lets through that you can field
 */
export function coverage(builds, { lockedSet = new Set(), rulesOff, skill, fronts = ["bots", "bugs", "squids"] } = {}) {
  const out = {};
  for (const faction of fronts) {
    out[faction] = SITUATIONS.map((situation) => {
      const scenario = situationScenario(situation, faction, rulesOff, skill);
      if (!scenario) return { situation, scenario: null, best: null, fit: 0, cut: null, standing: "absent" };
      const { shown, cut } = dropPool(builds, scenario, { lockedSet, showLocked: false });
      const ranked = rankByReading(shown, scenario).filter((r) => r.reading.score !== null);
      const best = ranked[0] || null;
      return { situation, scenario, best, fit: ranked.length, cut, standing: standingOf(best) };
    });
  }
  return out;
}
