/* ================================================================== */
/* ITEM INDEX                                                         */
/* items.json is one flat list. Everything the UI looks up by id, by   */
/* slot or by old display name is derived here once, so no component   */
/* builds its own lookup and no two lookups can disagree.              */
/* ================================================================== */

import ITEMS from "../data/items.json";
import WARBONDS from "../data/warbonds.json";
import VOCABULARY from "../data/vocabulary.json";
import WIKI from "../data/wiki-stats.json";
import GAME from "../data/game-stats.json";

export const items = ITEMS;
export const vocabulary = VOCABULARY;
export const warbonds = WARBONDS.warbonds;
export const acquisitionLabels = WARBONDS.acquisitionLabels;

export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
export const getItem = (id) => itemById.get(id) || null;
export const itemName = (id) => {
  const it = itemById.get(id);
  return it ? it.name : id;
};

/* State saved before ids existed was keyed by display name. Current     */
/* names and historical aliases both resolve, so nothing saved is lost   */
/* to the migration or to a later rename. An id passes straight through, */
/* which makes the migration safe to run on every load.                  */
const idByLabel = new Map();
for (const it of ITEMS) {
  idByLabel.set(it.name, it.id);
  for (const alias of it.aliases) idByLabel.set(alias, it.id);
}
export const idForLabel = (label) => (itemById.has(label) ? label : idByLabel.get(label) || null);

/* Same idea for warbonds, which were also saved by display name. */
const warbondIdByName = new Map(WARBONDS.warbonds.map((w) => [w.name, w.id]));
export const warbondIdForLabel = (label) =>
  warbondIdByName.has(label) ? warbondIdByName.get(label) : label;

/* The six browsable lists. The five stratagem call-in menus are one     */
/* list, because you pick a stratagem by faction and tier, not by which  */
/* menu it sits under.                                                   */
export const CATEGORIES = [
  { id: "primary", label: "Primaries", slot: "primary" },
  { id: "secondary", label: "Secondaries", slot: "secondary" },
  { id: "throwable", label: "Throwables", slot: "throwable" },
  { id: "strat", label: "Stratagems", slot: "stratagem" },
  { id: "armor", label: "Armour passives", slot: "armor" },
  { id: "booster", label: "Boosters", slot: "booster" },
].map((c) => ({ ...c, items: ITEMS.filter((i) => i.slot === c.slot) }));

export const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

/* ------------------------------------------------------------------ */
/* Warbonds                                                            */
/* ------------------------------------------------------------------ */

export const warbondById = new Map(warbonds.map((w) => [w.id, w]));
export const gateableWarbondIds = new Set(warbonds.map((w) => w.id));
export const warbondName = (id) => {
  const w = warbondById.get(id);
  return w ? w.name : id;
};

/* How many tracked items each warbond carries. Cosmetics, capes, player */
/* cards and vehicle patterns are not tracked, so this is not the total  */
/* warbond contents.                                                     */
export const itemCountByWarbond = (() => {
  const m = {};
  for (const it of ITEMS) {
    if (it.acquisition.type === "warbond") m[it.acquisition.warbond] = (m[it.acquisition.warbond] || 0) + 1;
  }
  return m;
})();

export const itemCountByAcquisition = (() => {
  const m = {};
  for (const it of ITEMS) m[it.acquisition.type] = (m[it.acquisition.type] || 0) + 1;
  return m;
})();

/* Which tracked items each warbond carries, as ids. This is what the per */
/* warbond bulk unlock and bulk lock in Collection operate on, and it is  */
/* built here rather than in the component so the count shown on a        */
/* warbond and the set its buttons act on can never drift apart.          */
export const itemIdsByWarbond = (() => {
  const m = new Map();
  for (const it of ITEMS) {
    if (it.acquisition.type !== "warbond") continue;
    const list = m.get(it.acquisition.warbond);
    if (list) list.push(it.id);
    else m.set(it.acquisition.warbond, [it.id]);
  }
  return m;
})();

/* Singular slot names. CATEGORIES carries the plural list headings,      */
/* which read wrong as a badge on one row.                                */
export const SLOT_LABEL = {
  primary: "Primary",
  secondary: "Secondary",
  throwable: "Throwable",
  stratagem: "Stratagem",
  armor: "Armour",
  booster: "Booster",
};

/* ------------------------------------------------------------------ */
/* Fetched stats                                                       */
/*                                                                     */
/* Everything the source tables never carried: magazine size, fire     */
/* rate, ergonomics, sway, recoil, projectile drag, durable damage,    */
/* stagger, pushback and heat. Generated by scripts/fetch-wiki.mjs     */
/* from helldivers.wiki.gg, CC BY-NC-SA 4.0.                           */
/*                                                                     */
/* It is a separate file on purpose. items.json is curated and a       */
/* re-fetch must never be able to overwrite a hand made call, so the   */
/* two are joined here on read, by id.                                 */
/* ------------------------------------------------------------------ */

export const wikiStats = WIKI.stats;
export const wikiSource = { source: WIKI.source, licence: WIKI.licence, url: WIKI.licenceUrl, fetchedAt: WIKI.fetchedAt };

/* ------------------------------------------------------------------ */
/* The game's own numbers, laid over the wiki's                         */
/*                                                                     */
/* game-stats.json is generated by scripts/fetch-game.mjs from the     */
/* game's settings tables as filediver ships them, for the weapons     */
/* scripts/data/game-ids.json names. Same field names as the wiki, so  */
/* the merge is per field: the game's figure wins, the wiki fills what */
/* the game does not say (reload time, heat, call-in data, and every   */
/* item the game file does not cover).                                 */
/*                                                                     */
/* GAME_EXCEPTIONS keeps the wiki's figure where the game measures     */
/* something else. A key is a section ("primary") or "section.field".  */
/* ------------------------------------------------------------------ */

export const gameSource = { source: GAME.source, url: GAME.sourceUrl, snapshotDate: GAME.snapshotDate };

const GAME_EXCEPTIONS = {
  /* The game's default attack is the charged shot, 200. The wiki's 100
     is the plain one, which is what the tier list has always shown. */
  "plas-101-purifier": ["primary"],
  /* 700 is the beam's tick rate, not shots a minute. */
  "las-13-trident": ["handling.rpm"],
};

function merged(id) {
  const w = WIKI.stats[id];
  const g = GAME.stats[id];
  if (!g) return w || null;
  const skip = new Set(GAME_EXCEPTIONS[id] || []);
  const out = { ...(w || {}) };
  for (const [k, v] of Object.entries(g)) {
    if (skip.has(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const section = { ...(out[k] || {}) };
      for (const [f, fv] of Object.entries(v)) if (!skip.has(`${k}.${f}`)) section[f] = fv;
      out[k] = section;
    } else out[k] = v;
  }
  return out;
}

const STATS = new Map();
for (const id of new Set([...Object.keys(WIKI.stats), ...Object.keys(GAME.stats)])) STATS.set(id, merged(id));

export const statsFor = (id) => STATS.get(id) || null;

/* Where an item's numbers came from, for the expanded row. */
export const statsSourceFor = (id) => (GAME.stats[id] ? "game" : WIKI.stats[id] ? "wiki" : null);

/* Does this actually build heat you have to vent.                      */
/*                                                                      */
/* This used to be "damageType is heat or arc", which was wrong and     */
/* load bearing: it drives the hot biome gate. The source says only the */
/* LAS laser family and the Quasar have a heat mechanic. Every plasma   */
/* weapon feeds from magazines, and the Purifier, the best primary in   */
/* the game, was being excluded from hot planets over a mechanic it     */
/* does not have.                                                       */
/*                                                                      */
/* Three states, not two. An item the fetch covers gives a real yes or  */
/* no. An item it does not cover, which is the call-ins and the melee   */
/* weapons, falls back to the old guess rather than silently reading as */
/* no.                                                                  */
export function ventsHeat(item) {
  const s = statsFor(item.id);
  if (s) return Boolean(s.heat);
  return VOCABULARY.thermalDamageTypes.includes(item.damageType);
}

export const heatProfile = (item) => {
  const s = statsFor(item.id);
  return s && s.heat ? s.heat : null;
};

/* ------------------------------------------------------------------ */
/* Ratings                                                             */
/* ------------------------------------------------------------------ */

export const TIER_RANK = { "S+": 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
export const TIER_ORDER = vocabulary.tiers;

export const tierFor = (item, faction) => item.ratings[faction].tier;
export const rank = (tier) => (tier ? TIER_RANK[tier] : 0);

/* The value a tier floor is allowed to judge. Null means there is no    */
/* rating to judge, so the floor cannot exclude it. Unrated items        */
/* survive every floor and sort last. That is the only way a new         */
/* warbond weapon ever gets seen and tried.                              */
export function judgedTier(item, faction) {
  if (faction) return item.ratings[faction].tier;
  const rated = ["bots", "bugs", "squids"].map((f) => item.ratings[f].tier).filter(Boolean);
  if (!rated.length) return null;
  return rated.reduce((a, b) => (TIER_RANK[a] >= TIER_RANK[b] ? a : b));
}

export function averageRank(item) {
  const r = item.ratings;
  return (rank(r.bots.tier) + rank(r.bugs.tier) + rank(r.squids.tier)) / 3;
}

/* ------------------------------------------------------------------ */
/* Stratagem helpers                                                   */
/* ------------------------------------------------------------------ */

/* The amber dot means this eats your own backpack slot. Pointless on a  */
/* backpack, where that is the entire item.                              */
export const eatsBackpack = (item) =>
  item.slot === "stratagem" && item.stratType !== "backpack" && item.usesBackpackSlot === true;
