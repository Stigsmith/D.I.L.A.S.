/* ================================================================== */
/* OWNERSHIP                                                          */
/* src/data/ownership.json records what you do own, on two axes. Lock  */
/* state is the inversion of it.                                       */
/*                                                                    */
/* Only an explicit false locks anything. An id that is absent, or set  */
/* to true, is not locked. Absent means not recorded rather than not    */
/* owned, which is why the shipped file is empty and everything starts  */
/* unlocked. Once the file is filled in, the two axes carry real        */
/* meaning: you buy a warbond with super credits, then each item in it  */
/* with medals.                                                         */
/*                                                                    */
/* It is a seed, not a source of truth. It fills lock state the first   */
/* time the app runs in a browser, and after that whatever you toggle   */
/* in the app wins. Import is how a filled file reaches a browser that  */
/* already has state.                                                   */
/* ================================================================== */

import ownership from "../data/ownership.json";
import { gateableWarbondIds, itemById } from "./items.js";
import { ARMOR_SETS } from "./armor.js";

/* The inversion, shared by the seed and by an imported file. */
export function lockedFromOwnership(doc) {
  const warbonds = (doc && doc.warbonds) || {};
  const items = (doc && doc.items) || {};
  return {
    lockedWarbonds: Object.keys(warbonds).filter((id) => warbonds[id] === false && gateableWarbondIds.has(id)),
    lockedItems: Object.keys(items).filter((id) => items[id] === false && itemById.has(id)),
  };
}

export const seedLockedWarbonds = () => lockedFromOwnership(ownership).lockedWarbonds;
export const seedLockedItems = () => lockedFromOwnership(ownership).lockedItems;

/* An ownership file carries id to boolean maps. A backup carries arrays */
/* under different key names, so the two shapes cannot be confused and   */
/* Import can accept either one.                                         */
export function isOwnershipDoc(doc) {
  if (!doc || typeof doc !== "object") return false;
  const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  return isMap(doc.warbonds) || isMap(doc.items);
}

/* ------------------------------------------------------------------ */
/* Lock state                                                          */
/* Two independent sets, unioned at read time. Clearing one never       */
/* destroys the other. An item locked because its warbond is locked     */
/* shows a dimmed padlock and its own toggle is disabled, so the only   */
/* way to unlock it is the warbond. That is deliberate: it stops the    */
/* two mechanisms fighting.                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/*                                                                     */
/* One set of locks models one player. A profile is that set with a     */
/* name on it, so a second player who owns almost nothing can be        */
/* planned for without pretending he owns your collection.              */
/*                                                                     */
/* A profile carries an id and a name, and the id never changes when    */
/* the name does. Same invariant as items, for the same reason: the     */
/* active profile is stored by id and a rename must not orphan it.      */
/* ------------------------------------------------------------------ */

export const DEFAULT_PROFILE_ID = "default";

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";

export function profileId(name, taken) {
  const base = slug(name);
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/* The three starting points. Nothing owned is the one that matters:     */
/* filling in the handful of things a new player has is minutes, and     */
/* clearing the hundred he does not is an evening.                       */
export function blankProfile(id, name, mode, active) {
  if (mode === "copy" && active) {
    return { id, name, lockedItems: [...active.lockedItems], lockedWarbonds: [...active.lockedWarbonds] };
  }
  if (mode === "empty") {
    return {
      id,
      name,
      lockedItems: [...itemById.keys()],
      lockedWarbonds: [...gateableWarbondIds],
    };
  }
  return { id, name, lockedItems: [], lockedWarbonds: [] };
}

/* Anything stored is checked on the way in. A profile carrying an id     */
/* that no longer resolves drops that entry rather than keeping a         */
/* reference to no item, which is the same rule the loaders already use.  */
export function cleanProfile(p, taken = []) {
  if (!p || typeof p !== "object") return null;
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Unnamed";
  const id = typeof p.id === "string" && p.id ? p.id : profileId(name, taken);
  const list = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && ok(x)))] : []);
  return {
    id,
    name,
    lockedItems: list(p.lockedItems, (x) => itemById.has(x)),
    lockedWarbonds: list(p.lockedWarbonds, (x) => gateableWarbondIds.has(x)),
    ...(p.setUp === true ? { setUp: true } : {}),
    /* Your level: the hardest difficulty four players at your level clear
       easily. It describes the player, so it lives with the profile and
       travels in the backup. A copied profile does not copy it. */
    ...(Number.isInteger(p.skill) && p.skill >= 1 && p.skill <= 10 ? { skill: p.skill } : {}),
  };
}

/* Whether this profile still says what a fresh browser says: nothing      */
/* locked, which reads as owning every warbond and every item, so every    */
/* suggestion and picker offers gear the player may not have. The curator's */
/* point of 3 October 2026, and the reason the tool now nudges toward       */
/* Collection first. `setUp` is the player saying "yes, really, all of it", */
/* and any lock at all is taken as a collection somebody has touched.       */
export function needsSetup(p) {
  return Boolean(p) && !p.setUp && p.lockedItems.length === 0 && p.lockedWarbonds.length === 0;
}

/* A stored document, or anything close enough to one, normalised into a  */
/* shape the app can trust: at least one profile, and an active id that   */
/* really resolves.                                                       */
export function cleanProfileDoc(doc) {
  const raw = doc && Array.isArray(doc.profiles) ? doc.profiles : [];
  const out = [];
  for (const p of raw) {
    const clean = cleanProfile(p, out.map((x) => x.id));
    if (clean && !out.some((x) => x.id === clean.id)) out.push(clean);
  }
  if (!out.length) out.push({ id: DEFAULT_PROFILE_ID, name: "Default", lockedItems: [], lockedWarbonds: [] });
  const active = out.some((p) => p.id === doc?.active) ? doc.active : out[0].id;
  return { active, profiles: out };
}

export function buildLockedSet(lockedItems, lockedWarbonds) {
  const locked = new Set(lockedItems);
  const warbonds = new Set(lockedWarbonds);
  if (warbonds.size) {
    for (const item of itemById.values()) {
      if (item.acquisition.type === "warbond" && warbonds.has(item.acquisition.warbond)) locked.add(item.id);
    }
    /* Armour sets from a warbond you do not own are locked with it. A set
       id is never an item id, which the validator checks, so the two
       share this set without colliding; a count of locked items has to
       ask for items. */
    for (const s of ARMOR_SETS) {
      if (s.acquisition.type === "warbond" && warbonds.has(s.acquisition.warbond)) locked.add(s.id);
    }
  }
  return locked;
}
