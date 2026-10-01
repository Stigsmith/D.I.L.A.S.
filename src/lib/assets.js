/* ================================================================== */
/* ASSETS                                                             */
/*                                                                    */
/* Art resolves by id and is optional everywhere. The build spec is    */
/* explicit that extracted game art is the most likely thing to have   */
/* to come out, so this whole layer is swappable: delete src/assets    */
/* and every lookup returns null, every item still reads, nothing      */
/* throws. Do not make anything depend on art existing.                */
/*                                                                    */
/* Files are copied in and renamed to their id by                      */
/* scripts/import-images.mjs, so there is no mapping to maintain by    */
/* hand. "Image Library" in the repo root is the source of truth.         */
/* ================================================================== */

const load = (glob) => {
  const m = new Map();
  for (const [path, url] of Object.entries(glob)) {
    const file = path.slice(path.lastIndexOf("/") + 1);
    m.set(file.replace(/\.[^.]+$/, ""), url);
  }
  return m;
};

const ITEMS = load(
  import.meta.glob("../assets/items/*", { eager: true, query: "?url", import: "default" })
);
const WARBONDS = load(
  import.meta.glob("../assets/warbonds/*", { eager: true, query: "?url", import: "default" })
);
const UI = load(
  import.meta.glob("../assets/ui/*", { eager: true, query: "?url", import: "default" })
);
/* Planet renders from the wiki, by the planet name's slug. Fetched by
   npm run planet-art and gitignored, so a fresh clone has none and the
   map draws its own planets instead. */
const PLANETS = load(
  import.meta.glob("../assets/planets/*", { eager: true, query: "?url", import: "default" })
);
const planetSlug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* Warbond skin art, keyed by theme id then file name. Two levels deep,   */
/* so it is indexed by hand rather than through the shared loader.        */
/*                                                                        */
/* Three prefixes are globbed and nothing else, which is a shipping       */
/* decision rather than tidiness:                                         */
/*                                                                        */
/*   study_*    art the palette study embedded, already cut and coloured  */
/*   masthead*  the header image for that skin, with an optional          */
/*              masthead-sm.* cut for the phone row                       */
/*   emblem*    the mark that replaces the skull                          */
/*                                                                        */
/* A theme folder also holds the study itself, a preview render, and      */
/* whatever loose reference the skin was drawn from. None of that         */
/* renders. Globbing the whole folder bundled 22.7MB of it, which was     */
/* 60% of the built output and every byte of it dead. Name a new file     */
/* with one of these three prefixes or it will not reach the app.         */
const THEMES = (() => {
  /* emblem.* rather than emblem*, so the loose reference emblems a folder */
  /* may carry are not swept in alongside the canonical one.               */
  const glob = import.meta.glob("../assets/themes/*/{study_*,masthead.*,masthead-sm.*,emblem.*}", { eager: true, query: "?url", import: "default" });
  const m = new Map();
  for (const [path, url] of Object.entries(glob)) {
    const parts = path.split("/");
    const theme = parts[parts.length - 2];
    const name = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    if (!m.has(theme)) m.set(theme, new Map());
    m.get(theme).set(name, url);
  }
  return m;
})();

export const themeArt = (themeId, name) => {
  const bucket = THEMES.get(themeId);
  return (bucket && bucket.get(name)) || null;
};

/* What a skin actually shipped. A study names its own art, so when a new */
/* theme packet lands this is how you find out what came with it without  */
/* opening the HTML: run npm run images, then read this in the console.   */
export const themeArtNames = (themeId) => {
  const bucket = THEMES.get(themeId);
  return bucket ? [...bucket.keys()].sort() : [];
};

export const itemArt = (id) => ITEMS.get(id) || null;
export const warbondArt = (id) => WARBONDS.get(id) || null;
export const uiArt = (name) => UI.get(name) || null;
export const planetArt = (name) => (name ? PLANETS.get(planetSlug(name)) || null : null);

export const artCounts = { items: ITEMS.size, warbonds: WARBONDS.size, ui: UI.size, planets: PLANETS.size };

/* Named so a component does not have to know the file naming scheme. */
export const SKULL = uiArt("ui_icon_booster_skull");
export const FACTION_GLYPH = {
  bots: uiArt("faction_automaton"),
  bugs: uiArt("faction_terminid"),
  squids: uiArt("faction_illuminate"),
};
