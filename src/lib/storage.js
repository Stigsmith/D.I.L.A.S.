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
    const raw = localStorage.getItem(key);
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
  brief: "hd2-brief-faction",
  /* The tier list filter bag, per category. Survives navigation and a   */
  /* reload. Same reasoning as the two above: this browser, not you.     */
  tierFilters: "hd2-tier-filters",
  /* Planet, biome and hazards. Where you are dropping, not what you own. */
  briefEnv: "hd2-brief-env",
};

export function readSetting(key, allowed, fallback) {
  try {
    const raw = localStorage.getItem(key);
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
