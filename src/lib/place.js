/* ================================================================== */
/* THE GROUND, THE CITY AND THE CLOCK                                 */
/*                                                                    */
/* Three facts about where you are dropping that a rule may ask, and  */
/* that the scenario does not hold directly. It holds a biome, a      */
/* planet and a mission name; these turn them into what the ground is */
/* like, whether there is a city, and how long the mission gives you. */
/*                                                                    */
/* Pure, no React, no storage, so score.js and the scripts can read   */
/* it. scenario.js holds the hook; this holds only lookups.           */
/* ================================================================== */

import PLANETS from "../data/planets.json";
import MISSIONS from "../data/missions.json";
import VOCAB from "../data/vocabulary.json";

/* What the ground of a biome is like: whether it is wet, snowy or dry
   underfoot, how steep it is, and how it drives. The curator's reading
   from play, declared as such in vocabulary.json, and null for a biome
   nobody has walked (Unknown, the black hole). A rule asking about
   terrain does not fire on null, the same contract an unset difficulty
   keeps. */
export const TERRAIN = VOCAB.terrain;
export const terrainOf = (biome) => (biome && TERRAIN.biomes[biome]) || null;

/* Whether a planet has a megacity. A guess at whether this drop is
   between buildings, and the curator's call (4 October 2026): the
   mission may well be outside the city, so the rules that read it carry
   about half the weight a sure fact would, and say it is a guess. Null
   with no planet chosen, so a rule asking does not fire. */
const planetByName = new Map(PLANETS.planets.map((p) => [p.name, p]));
export function hasMegacity(planet) {
  const p = planet ? planetByName.get(planet) : null;
  if (!p) return null;
  return Boolean(p.cities && p.cities.megacity > 0);
}

/* How many minutes the mission gives you, from its wiki article, read
   by npm run missions. Null when no mission is chosen or the article
   states none. */
const missionByName = new Map(MISSIONS.missions.map((m) => [m.name, m]));
export function minutesOf(mission) {
  const m = mission ? missionByName.get(mission) : null;
  return m && typeof m.minutes === "number" ? m.minutes : null;
}
