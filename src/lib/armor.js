/* ================================================================== */
/* ARMOUR SETS                                                        */
/*                                                                    */
/* Every armour set in the game, from armor.json, which npm run armor */
/* fetches from the wiki. The curator asked for all of them, with     */
/* their art, on 4 October 2026.                                      */
/*                                                                    */
/* The passive is still the rated item. A set adds what the passive   */
/* cannot say: its weight, and the armour, speed and stamina that     */
/* weight brings. A build stores the set's id as armorSet and the     */
/* passive's id as armor, and the two must agree; cleanLoadout in     */
/* loadouts.js makes them.                                            */
/*                                                                    */
/* Pure, no React, so score.js, build.js and the scripts can read it. */
/* ================================================================== */

import ARMOR from "../data/armor.json";

export const ARMOR_SETS = ARMOR.sets;
const byId = new Map(ARMOR_SETS.map((s) => [s.id, s]));
/* An old name still resolves, the same way an item alias does. */
for (const s of ARMOR_SETS) for (const a of s.aliases || []) if (!byId.has(a)) byId.set(a, s);

export const getArmorSet = (id) => (id ? byId.get(id) || null : null);

/* The sets that carry one passive, lightest first. */
const WEIGHT_ORDER = { light: 0, medium: 1, heavy: 2 };
export const setsForPassive = (passive) =>
  ARMOR_SETS.filter((s) => s.passive === passive).sort(
    (a, b) => WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight] || a.name.localeCompare(b.name)
  );

/* Which weights a passive comes in. */
export const weightsForPassive = (passive) => [...new Set(setsForPassive(passive).map((s) => s.weight))];

export const WEIGHTS = ["light", "medium", "heavy"];
export const WEIGHT_LABEL = { light: "Light", medium: "Medium", heavy: "Heavy" };

/* The weight a build is wearing, or null when no set is chosen. A build
   made before sets existed records only the passive, and that is not a
   weight: it is no answer, and a rule asking about weight does not fire. */
export const weightOf = (loadout) => {
  const s = loadout ? getArmorSet(loadout.armorSet) : null;
  return s ? s.weight : null;
};
