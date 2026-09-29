/* ================================================================== */
/* THE GALAXY MAP, THE HALF THAT IS NOT A PICTURE                     */
/*                                                                    */
/* Where every planet sits, which supply lines join them, where each  */
/* sector's name goes, and the arithmetic of panning and zooming. No  */
/* React and no storage, so a script can check it the same way it     */
/* checks the scoring engine.                                         */
/*                                                                    */
/* The map is patch data first. Positions and supply lines ship in    */
/* planets.json, fetched once by scripts/fetch-wiki.mjs, so the map   */
/* draws, pans and fills the scenario with no network call at all.    */
/* Who holds what is live and arrives separately, if it arrives: it  */
/* decorates the map and never carries it. dds-roadmap.md, "The live */
/* starmap".                                                          */
/*                                                                    */
/* The layout is the game's, because finding a planet again where you */
/* clicked it a minute ago is instant and finding it in a list of 281 */
/* is not. The styling is not the game's: this is a chart to be read, */
/* so no scanlines, no glow, no holo table.                           */
/* ================================================================== */

import PLANETS from "../data/planets.json";

/* The view box is VIEW units square. Positions arrive roughly in -1 to 1
   with Super Earth at the origin; RADIUS maps that onto the box with a
   margin, so a planet at the rim still has room for its dot. */
export const VIEW = 1000;
export const CENTRE = VIEW / 2;
export const RADIUS = 470;

/* How far in you can go. At 8 the densest cluster has room for every
   name, and past it the map is mostly empty space. */
export const MAX_ZOOM = 8;
export const HOME = { k: 1, x: 0, y: 0 };

/* The data's y points up, the way the game draws it: Cyberstan, the
   Automaton home world, is up and to the left. A screen's y points down,
   so it is flipped here and nowhere else. */
export const project = ({ x, y }) => ({ x: CENTRE + x * RADIUS, y: CENTRE - y * RADIUS });

/* A planet is on the map when it has a position. Two placeholders in a
   sector called TBD sit exactly on Super Earth with no place of their
   own, and seven Void entries have no position at all; all of them stay
   choosable from the search list and are simply not drawn. */
export const isPlaced = (p) =>
  Boolean(p && p.position) && (p.type === "super_earth" || p.position.x !== 0 || p.position.y !== 0);

const all = PLANETS.planets;
const byUpper = new Map(all.map((p) => [p.name.toUpperCase(), p]));

export const placed = all
  .filter(isPlaced)
  .map((p) => ({ name: p.name, sector: p.sector, home: p.type === "super_earth", ...project(p.position) }));

export const unplaced = all.filter((p) => !isPlaced(p)).map((p) => p.name);

const placedByName = new Map(placed.map((p) => [p.name, p]));
export const placeOf = (name) => placedByName.get(name) || null;

/* Supply lines. Each planet lists its neighbours by the API's upper case
   name, and every line is listed from both ends, so they are resolved
   and deduplicated here. A line to a planet that is not on the map is
   dropped rather than drawn to nowhere. */
export const lanes = (() => {
  const seen = new Set();
  const out = [];
  for (const p of all) {
    const a = placedByName.get(p.name);
    if (!a) continue;
    for (const link of p.links || []) {
      const other = byUpper.get(link);
      const b = other ? placedByName.get(other.name) : null;
      if (!b || b === a) continue;
      const key = [a.name, b.name].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, a, b });
    }
  }
  return out;
})();

/* Each sector's name sits at the middle of its planets. A sector is how
   people talk about the map, so its name is what shows when you are
   zoomed out too far to read a planet's. */
export const sectors = (() => {
  const groups = new Map();
  for (const p of placed) {
    if (!p.sector || p.sector === "TBD" || p.home) continue;
    if (!groups.has(p.sector)) groups.set(p.sector, []);
    groups.get(p.sector).push(p);
  }
  return [...groups].map(([name, ps]) => ({
    name,
    count: ps.length,
    x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
    y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  }));
})();

/* How close each planet's nearest neighbour is. A name is drawn once
   there is room for it at the current zoom, planet by planet, so the
   sparse rim labels itself early and the crowded core waits until you
   are in close. */
export const roomFor = (() => {
  const room = new Map();
  for (const a of placed) {
    let best = Infinity;
    for (const b of placed) {
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && d < best) best = d;
    }
    room.set(a.name, best);
  }
  return room;
})();

/* Search by planet or by sector, over every planet including the ones
   with no place, because a planet you cannot see is still one you can
   drop on. Names starting with the query come first. */
export function searchPlanets(query, limit = 8) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const hits = all.filter((p) => p.name.toLowerCase().includes(q) || (p.sector || "").toLowerCase().includes(q));
  const rank = (p) => (p.name.toLowerCase().startsWith(q) ? 0 : p.name.toLowerCase().includes(q) ? 1 : 2);
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

/* Every match, for lighting them up on the map, not just the first few. */
export function matchSet(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  return new Set(
    all.filter((p) => p.name.toLowerCase().includes(q) || (p.sector || "").toLowerCase().includes(q)).map((p) => p.name)
  );
}

/* ------------------------------------------------------------------ */
/* Panning and zooming                                                 */
/*                                                                     */
/* A view is { k, x, y }: a point p on the map is drawn at p * k plus  */
/* (x, y), all in view box units. Kept pure so the clamps can be       */
/* checked without a browser.                                          */
/* ------------------------------------------------------------------ */

const clampNumber = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Fully out is the whole galaxy, centred, and nothing else. Zoomed in,
   the map may pan until an edge of the galaxy's box meets the edge of
   the frame and no further, so you cannot lose it off the side. */
export function clampView({ k, x, y }) {
  const kk = clampNumber(Number.isFinite(k) ? k : 1, 1, MAX_ZOOM);
  if (kk === 1) return { ...HOME };
  const lo = VIEW * (1 - kk);
  return { k: kk, x: clampNumber(x, lo, 0), y: clampNumber(y, lo, 0) };
}

/* Zoom by a factor while keeping the point under the cursor, or the
   middle of a pinch, exactly where it was. */
export function zoomAt(view, point, factor) {
  const k = clampNumber(view.k * factor, 1, MAX_ZOOM);
  const ratio = k / view.k;
  return clampView({ k, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio });
}

/* Put one map point in the middle of the frame at a given zoom. */
export function centreOn(point, k) {
  return clampView({ k, x: CENTRE - point.x * k, y: CENTRE - point.y * k });
}

/* The map point under a point of the frame. */
export const toMap = (view, point) => ({ x: (point.x - view.x) / view.k, y: (point.y - view.y) / view.k });

/* ------------------------------------------------------------------ */
/* The live war                                                        */
/*                                                                     */
/* What GET /api/war sends, cleaned against this browser's own table.  */
/* The server keeps no copy of the planet table and has no opinion     */
/* about planets, so a name that does not resolve here is dropped      */
/* rather than drawn, and every number is bounded before it is read.  */
/*                                                                     */
/* The API decorates, it never carries. A snapshot older than half an  */
/* hour is not drawn at all: a stale territory map is worse than an    */
/* uncoloured one, because it looks exactly like a current one.        */
/* ------------------------------------------------------------------ */

export const WAR_TOO_OLD_MS = 30 * 60 * 1000;

/* The upstream's names for who holds a planet, onto this tool's fronts.
   Super Earth holding a planet is no front at all. */
const FRONT_OF = { Automaton: "bots", Terminids: "bugs", Illuminate: "squids" };

const share = (part, whole) => {
  const p = Number(part);
  const w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return null;
  return Math.min(1, Math.max(0, p / w));
};

export function cleanWar(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.planets)) return null;
  const fetchedAt = Number.isFinite(raw.fetchedAt) ? raw.fetchedAt : null;
  if (fetchedAt === null) return null;

  const planets = new Map();
  for (const p of raw.planets) {
    if (!p || typeof p !== "object" || typeof p.name !== "string") continue;
    const own = byUpper.get(p.name.toUpperCase());
    if (!own) continue;
    const humans = p.owner === "Humans";
    const owner = FRONT_OF[p.owner] || null;
    if (!humans && !owner) continue;

    const e = p.event && typeof p.event === "object" ? p.event : null;
    const attacker = e ? FRONT_OF[e.faction] || null : null;
    const ends = e && typeof e.endTime === "string" ? Date.parse(e.endTime) : NaN;
    /* A defence's health is the attack's, and it falls as the defence
       succeeds, so progress is how much of it is gone. */
    const defence = attacker
      ? { front: attacker, progress: share(Number(e.maxHealth) - Number(e.health), Number(e.maxHealth)), endsAt: Number.isFinite(ends) ? ends : null }
      : null;

    /* The front is who you would be fighting there: the attacker in a
       defence, otherwise whoever holds it. */
    const front = defence ? defence.front : owner;
    const campaign = p.campaign === true;
    if (!front && !campaign) continue;

    planets.set(own.name, {
      owner,
      front,
      campaign,
      /* How much of an enemy world has been taken back. */
      liberation: owner && !defence ? share(Number(p.maxHealth) - Number(p.health), Number(p.maxHealth)) : null,
      defence,
      players: Number.isFinite(p.players) && p.players > 0 ? Math.round(p.players) : 0,
    });
  }

  const age = Math.max(0, now - fetchedAt);
  return { fetchedAt, age, fresh: age <= WAR_TOO_OLD_MS, planets, fronts: [...planets.values()].filter((p) => p.campaign).length };
}

/* The front to fill in when a planet is chosen: who you would be
   fighting there, from a snapshot fresh enough to trust, or null to
   leave the scenario's front alone. */
export const frontOf = (war, name) => {
  if (!war || !war.fresh) return null;
  const p = war.planets.get(name);
  return p ? p.front : null;
};

/* ------------------------------------------------------------------ */
/* Which names fit                                                     */
/*                                                                     */
/* Every label that wants to be drawn, in priority order, placed only  */
/* where it overlaps no label already placed. `must` labels are placed */
/* whatever they overlap: the chosen planet and what you searched for  */
/* are never hidden. Everything else waits until you zoom in far       */
/* enough for it to fit, which is the rule that was already true for   */
/* a planet's nearest neighbour, applied to the names themselves.      */
/*                                                                     */
/* Boxes are in screen pixels: `scale` is pixels per map unit at the   */
/* current zoom. The width is an estimate from the name's length,      */
/* which is close enough for a condensed face at one size.             */
/* ------------------------------------------------------------------ */

export const LABEL_CHAR_PX = 5.8;
export const LABEL_HEIGHT_PX = 13;

export function placeLabels(candidates, scale) {
  const order = [...candidates].sort((a, b) => a.priority - b.priority || (b.weight || 0) - (a.weight || 0));
  const boxes = [];
  const shown = new Set();
  for (const c of order) {
    const left = c.x * scale + (c.offset || 0);
    const box = {
      left,
      right: left + c.name.length * LABEL_CHAR_PX + 4,
      top: c.y * scale - LABEL_HEIGHT_PX / 2,
      bottom: c.y * scale + LABEL_HEIGHT_PX / 2,
    };
    const clash = boxes.some((b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top);
    if (clash && !c.must) continue;
    boxes.push(box);
    shown.add(c.name);
  }
  return shown;
}
