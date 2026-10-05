/* ================================================================== */
/* LOADOUTS                                                           */
/* The curated builds are presets. Editing one forks it into a build   */
/* of your own rather than overwriting his, which is why every stored  */
/* loadout carries forkedFrom.                                         */
/* ================================================================== */

import PRESETS from "../data/loadouts.json";
import { getItem, ventsHeat } from "./items.js";
import { getArmorSet } from "./armor.js";

export const presets = PRESETS;

export const SLOTS = [
  { key: "primary", label: "Primary", slot: "primary" },
  { key: "secondary", label: "Secondary", slot: "secondary" },
  { key: "grenade", label: "Grenade", slot: "throwable" },
  { key: "armor", label: "Armor", slot: "armor" },
  { key: "booster", label: "Booster", slot: "booster" },
];

export const STRAT_SLOTS = 4;

export const loadoutItemIds = (l) =>
  [l.primary, l.secondary, l.grenade, l.armor, l.booster, ...(l.strats || [])].filter(Boolean);

export const loadoutItems = (l) => loadoutItemIds(l).map(getItem).filter(Boolean);

/* Everything in a build that can be locked: its items, and the armour set
   it wears, which locks with its warbond. */
export const loadoutLockIds = (l) => [...loadoutItemIds(l), l.armorSet].filter(Boolean);

/* Gear you aim yourself. A sentry cannot pick a weak point and an        */
/* orbital does not care where the armor is thin, which is why every      */
/* penetration question in this project is limited to this set.           */
/*                                                                        */
/* It lived in three places at once: here inside heldGear, in squad.js    */
/* for the bot penetration check, and inside score.js as the `held` match */
/* key, whose comment read "mirrors heldGear in loadouts.js". Three        */
/* copies of one definition is two chances to drift.                      */
export const isHeldWeapon = (item) =>
  item.slot === "primary" ||
  item.slot === "secondary" ||
  (item.slot === "stratagem" && item.stratType === "support");

/* Gear you actually hold and manage heat on. A call down does not vent   */
/* in your hands, so orbitals, eagles, sentries, emplacements and mines   */
/* are not part of this.                                                  */
/*                                                                        */
/* Wider than isHeldWeapon by exactly one thing, a backpack, and the      */
/* difference is deliberate. A pack rides on your person so it vents      */
/* with you; it is not something you aim, so it answers no armor          */
/* question.                                                              */
/*                                                                        */
/* This used to claim the rule reproduced every hand authored heat flag,  */
/* 39 of 39. It does not, and the claim was worthless anyway: the flags   */
/* and the rule were both made from damageType, so they agreed because    */
/* they shared one wrong premise. Measured against the source it is 35 of */
/* 39. See deriveHeat below, which has said so since 1.4.0.               */
export function heldGear(l) {
  const out = [getItem(l.primary), getItem(l.secondary)];
  for (const id of l.strats || []) {
    const it = getItem(id);
    if (it && (it.stratType === "support" || it.stratType === "backpack")) out.push(it);
  }
  return out.filter(Boolean);
}

/* Drives the hot biome hard gate, so it has to be right rather than     */
/* roughly right.                                                        */
/*                                                                       */
/* It was neither. The rule was "damageType is heat or arc", and the     */
/* note here used to claim it reproduced all 39 hand authored flags. It  */
/* did, because the hand authored flags were made the same way: two      */
/* things agreeing on one wrong premise is not a check. Against the      */
/* source it now agrees on 35 of 39, and the four it disagrees with are  */
/* three Purifier builds and one Blitzer, none of which can overheat.    */
export const deriveHeat = (l) => heldGear(l).some(ventsHeat);

export const heatSources = (l) => heldGear(l).filter(ventsHeat);

/* A guess, not a derivation. Three different rules were tested against   */
/* the curated builds and the best managed 37 of 39, because whether a    */
/* kit counts as fire based is a judgement rather than a property. A      */
/* thermite grenade is anti-tank; an incendiary grenade plus fire resist  */
/* armor is a commitment. So this seeds the toggle and the curator wins.  */
export const deriveFire = (l) => {
  const fires = loadoutItems(l).filter((it) => it.damageType === "fire");
  const weapon = heldGear(l).some((it) => it.damageType === "fire");
  return weapon || fires.length >= 2;
};

/* At most one thing may occupy your back. The nine support weapons that  */
/* eat the slot conflict with any backpack stratagem, and with each other. */
export function backpackUsers(l) {
  return (l.strats || [])
    .map(getItem)
    .filter((it) => it && (it.stratType === "backpack" || it.usesBackpackSlot === true));
}

export const hasBackpackConflict = (l) => backpackUsers(l).length > 1;

/* ------------------------------------------------------------------ */

const newId = () => `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function emptyLoadout(faction = "bugs") {
  return {
    id: newId(),
    name: "New loadout",
    preset: false,
    forkedFrom: null,
    faction,
    mission: "standard",
    alt: [],
    diff: ["mid", "high"],
    biomes: [],
    fire: false,
    primary: null,
    secondary: null,
    grenade: null,
    armor: null,
    /* The armour set, which carries the passive above and a weight. Null
       on every build made before sets existed, and on the presets. */
    armorSet: null,
    booster: null,
    strats: [null, null, null, null],
    blurb: "",
    updatedAt: new Date().toISOString(),
  };
}

/* Forking keeps the curated build intact and hands you a copy. The name  */
/* says where it came from so a Drop Bay full of them stays readable.     */
export function forkPreset(preset) {
  return {
    ...preset,
    id: newId(),
    name: `${preset.name} (yours)`,
    preset: false,
    forkedFrom: preset.id,
    strats: [...preset.strats],
    alt: [...preset.alt],
    diff: [...preset.diff],
    biomes: [...preset.biomes],
    updatedAt: new Date().toISOString(),
  };
}

export function duplicateLoadout(l) {
  return {
    ...l,
    id: newId(),
    name: `${l.name} copy`,
    preset: false,
    strats: [...l.strats],
    alt: [...(l.alt || [])],
    diff: [...(l.diff || [])],
    biomes: [...(l.biomes || [])],
    updatedAt: new Date().toISOString(),
  };
}

/* Anything stored that no longer resolves is dropped rather than kept as */
/* a reference to nothing. Same discipline as the collection state.       */
export function cleanLoadout(l) {
  if (!l || typeof l !== "object" || typeof l.id !== "string") return null;
  const slotOk = (id, want) => {
    const it = getItem(id);
    return it && it.slot === want ? id : null;
  };
  /* The set and the passive must agree. A set with no passive beside it
     brings its own; a set whose passive is not the one recorded is
     dropped, since the passive is the rated item and the one a person
     chose. An old name resolves to the set's id today. */
  let armor = slotOk(l.armor, "armor");
  let set = typeof l.armorSet === "string" ? getArmorSet(l.armorSet) : null;
  if (set && !armor) armor = set.passive;
  if (set && set.passive !== armor) set = null;
  return {
    ...emptyLoadout(l.faction),
    ...l,
    preset: false,
    primary: slotOk(l.primary, "primary"),
    secondary: slotOk(l.secondary, "secondary"),
    grenade: slotOk(l.grenade, "throwable"),
    armor,
    armorSet: set ? set.id : null,
    booster: slotOk(l.booster, "booster"),
    strats: Array.from({ length: STRAT_SLOTS }, (_, i) => slotOk((l.strats || [])[i], "stratagem")),
  };
}
