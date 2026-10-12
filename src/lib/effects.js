/* ================================================================== */
/* THE WAR'S EFFECTS, NAMED                                           */
/*                                                                    */
/* The game marks planets with effect numbers and never says what     */
/* they are called. src/data/war-effects.json is the curator's table  */
/* of the ones read off the game's own map. Pure, no React, so        */
/* npm run effects and npm run map read it too.                       */
/* ================================================================== */

import TABLE from "../data/war-effects.json";

export const EFFECTS = TABLE.effects;
export const DRAWS = TABLE.draws;

/* What a planet's effect numbers mean: the named ones, deduplicated by
   name (two numbers can carry the same line), how many are unnamed, how
   the map draws it, and whether anyone still drops there. */
export function effectsOn(ids) {
  const named = [];
  const seen = new Set();
  let unnamed = 0;
  let draw = null;
  let colour = null;
  let gone = false;
  for (const id of ids || []) {
    const e = EFFECTS[String(id)];
    if (!e) {
      unnamed += 1;
      continue;
    }
    if (e.draw === "blackhole" || e.draw === "fractured") draw = e.draw;
    if (e.draw === "cloud" && !colour) colour = e.colour || null;
    if (e.gone) gone = true;
    if (!e.name) continue;
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    named.push({ id, name: e.name, say: e.say || null });
  }
  return { named, unnamed, draw, cloud: colour, gone };
}

/* A planet's effects from a fresh war, or nothing. */
export const planetEffects = (war, name) =>
  effectsOn(war && war.fresh && war.marks ? war.marks.effects.get(name) : null);
