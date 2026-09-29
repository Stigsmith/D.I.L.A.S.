/* ================================================================== */
/* PERSISTENCE                                                        */
/* localStorage, not the window.storage shim the artifact used. The   */
/* shim existed because the Claude.ai artifact sandbox forbids browser */
/* storage. Nothing here runs in that sandbox. The four key names are  */
/* unchanged, so state written by an earlier build is still read.      */
/* ================================================================== */

export const KEYS = {
  favorites: "hd2-loadout-favorites",
  favoriteItems: "hd2-favorite-items",
  lockedItems: "hd2-locked-items",
  lockedWarbonds: "hd2-locked-warbonds",
  /* Loadouts you built. The curated ones live in the repo and are never  */
  /* written here, so this holds only your own work.                      */
  loadouts: "hd2-loadouts",
  /* Named ownership profiles. Holds an object rather than an array, so   */
  /* it is read and written through readDoc and writeDoc. The two older   */
  /* lock keys above are migrated into this one on first load and then    */
  /* left alone rather than deleted, which keeps a hand written recovery  */
  /* path open if a migration ever goes wrong.                            */
  profiles: "hd2-profiles",
};

/* null means the key was never written, which is not the same as an   */
/* empty array. The ownership seed applies only to a key that reads    */
/* null, so clearing every lock by hand is not undone on next load.    */
export function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function writeList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* private mode or quota. State lasts the session and no longer. */
  }
}

/* Same contract as readList, for the keys that hold an object. null      */
/* still means never written, which is what the profile migration keys    */
/* off to decide whether it has run yet.                                  */
export function readDoc(key) {
  try {
    const raw = localStorage.getItem(key) ?? inherit(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function writeDoc(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* private mode or quota. State lasts the session and no longer. */
  }
}

/* Display preferences, kept apart from collection data because they are  */
/* about this browser rather than about what you own, and so have no      */
/* business travelling inside an export.                                  */
export const SETTINGS = {
  filterView: "hd2-filter-view",
  /* Which front you are dropping on. A display preference rather than    */
  /* collection data, so it stays out of the export like the theme does.  */
  scenario: "hd2-scenario-faction",
  /* The tier list filter bag, per category. Survives navigation and a   */
  /* reload. Same reasoning as the two above: this browser, not you.     */
  tierFilters: "hd2-tier-filters",
  /* Planet, biome and hazards. Where you are dropping, not what you own. */
  scenarioEnv: "hd2-scenario-env",
  /* Which rating column the tier list sorts by. Global rather than per
     category, because you do not change your mind about whose opinion
     you are ranking by between primaries and boosters. */
  tierSort: "hd2-tier-sort",
  /* How the tier badge is finished, and its three surface toggles.
     Deliberately not part of the theme key: picking a warbond skin must
     not move somebody's badge finish. See src/lib/badge.js. */
  badgeFinish: "hd2-badge-finish",
  badgeSurface: "hd2-badge-surface",
  /* Who is bringing what on the drop screen: your slot, whether you have
     confirmed it, and the squadmate slots filled by hand. Ids only, never
     copies, so an edited build is re-read. What you are dropping with
     tonight, not what you own, so it stays out of the export. */
  drop: "hd2-drop",
  /* The party you are in: its code, the token that makes you you in it,
     and the name you go by. The token is the one secret the tool keeps in
     storage, and it only ever says which seat in one short-lived party is
     yours. Out of the export: it belongs to this browser. */
  party: "hd2-party",
};

/* Both scenario keys were spelled hd2-brief-* until 21 August 2026. A    */
/* browser that has been here before still holds those, and a rename      */
/* with no path back would silently forget which front and planet you     */
/* were on. Read once from the old name when the new one is empty, then   */
/* write the new one.                                                     */
/*                                                                        */
/* The old keys are left in place rather than deleted, which is the same  */
/* call the profiles migration made: nothing writes them again, and a     */
/* hand written recovery path stays open.                                 */
const RENAMED = {
  "hd2-scenario-faction": "hd2-brief-faction",
  "hd2-scenario-env": "hd2-brief-env",
};

function inherit(key) {
  const was = RENAMED[key];
  if (!was) return null;
  try {
    const old = localStorage.getItem(was);
    if (old === null) return null;
    localStorage.setItem(key, old);
    return old;
  } catch (e) {
    return null;
  }
}

export function readSetting(key, allowed, fallback) {
  try {
    const raw = localStorage.getItem(key) ?? inherit(key);
    return allowed.includes(raw) ? raw : fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* private mode. The choice lasts the session. */
  }
}
