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

/* A task names its faction by the game's own number. Read off a real
   answer on 30 September 2026; 1 is Super Earth and is no front. */
const FRONT_OF_RACE = { 2: "bugs", 3: "bots", 4: "squids" };

/* The Major Order: its briefing without the game's formatting tags, when
   it ends, and each task as a share done and the front it is on, when it
   names one. An order that has already ended is no order. What a task type
   means is not published, so a task is a bar and nothing more. */
function cleanOrder(raw, now) {
  if (!raw || typeof raw !== "object") return null;
  const briefing = typeof raw.briefing === "string"
    ? raw.briefing.replace(/<\/?i(=\d+)?>/g, "").replace(/\s+/g, " ").trim().slice(0, 600)
    : "";
  const endsAt = typeof raw.expiresAt === "string" ? Date.parse(raw.expiresAt) : NaN;
  if (!briefing || !Number.isFinite(endsAt) || endsAt <= now) return null;
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .slice(0, 8)
    .map((t) => ({
      front: t && FRONT_OF_RACE[t.race] ? FRONT_OF_RACE[t.race] : null,
      done: t ? share(t.progress, t.goal) : null,
    }))
    .filter((t) => t.done !== null);
  return { briefing, endsAt, tasks };
}

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
  const fresh = age <= WAR_TOO_OLD_MS;
  return {
    fetchedAt,
    age,
    fresh,
    planets,
    fronts: [...planets.values()].filter((p) => p.campaign).length,
    /* Held to the same half hour as the map: an order read long ago may
       have ended, or been replaced, since. */
    order: fresh ? cleanOrder(raw.order, now) : null,
  };
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
/*                                                                     */
/* A name sits to the right of its planet, or to the left for a planet */
/* on the galaxy's right flank, so the rim's names run inward rather   */
/* than off the edge of the map. Sector names are centred on their     */
/* sector and go through the same placement, after every planet name. */
/* ------------------------------------------------------------------ */

export const LABEL_CHAR_PX = 5.8;
export const LABEL_HEIGHT_PX = 13;

/* Which side of its dot a planet's name goes on. */
export const labelSide = (p) => (p.x > CENTRE + RADIUS * 0.45 ? "left" : "right");

export function placeLabels(candidates, scale) {
  const order = [...candidates].sort((a, b) => a.priority - b.priority || (b.weight || 0) - (a.weight || 0));
  const boxes = [];
  const shown = new Set();
  for (const c of order) {
    const width = c.name.length * (c.charPx || LABEL_CHAR_PX) + 4;
    const height = c.height || LABEL_HEIGHT_PX;
    const x = c.x * scale;
    const y = c.y * scale;
    const box = c.side === "below"
      ? { left: x - width / 2, right: x + width / 2, top: y + (c.offset || 0), bottom: y + (c.offset || 0) + height }
      : (() => {
          const left = c.side === "middle" ? x - width / 2 : c.side === "left" ? x - (c.offset || 0) - width : x + (c.offset || 0);
          return { left, right: left + width, top: y - height / 2, bottom: y + height / 2 };
        })();
    const clash = boxes.some((b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top);
    if (clash && !c.must) continue;
    boxes.push(box);
    shown.add(c.key || c.name);
  }
  return shown;
}

/* ------------------------------------------------------------------ */
/* The drop planner                                                    */
/*                                                                     */
/* "Where would you like to play?" Against which front, what kind of   */
/* mission, what kind of planet, and the answer is a planet to go to,  */
/* marked on the map. The curator's idea, 30 September 2026, and his   */
/* three calls shape it:                                               */
/*                                                                     */
/* - **Only fronts you can drop on are suggested**, from a live war    */
/*   fresh enough to trust. With no war there is nothing to suggest.   */
/* - **No caves hides the Hive Worlds.** The wiki puts the cave        */
/*   systems in that biome, which three planets have.                  */
/* - **Fewer megacities pushes them down, it does not hide them.** A    */
/*   planet with a megacity comes after every planet without one.      */
/*   Hazards you would rather avoid push down the same way, after it.  */
/* - **Busiest first** among what is left: where the war actually is,  */
/*   and where a game is easiest to find.                              */
/*                                                                     */
/* A mission kind does not narrow the planets. The data says which     */
/* fronts offer which missions, not which planets do, and every front  */
/* offers every kind but one. It narrows the mission list instead.     */
/* ------------------------------------------------------------------ */

export const CAVE_BIOMES = new Set(["bug_hiveworld"]);
export const hasCaves = (p) => Boolean(p && CAVE_BIOMES.has(p.biome));
export const megacitiesOn = (p) => (p && p.cities && p.cities.megacity) || 0;

const tableByName = new Map(all.map((p) => [p.name, p]));

export function suggestFronts(war, { front = null, avoidCaves = false, fewerMegacities = false, avoidHazards = [] } = {}, limit = 3) {
  if (!war || !war.fresh) return null;
  const avoid = new Set(avoidHazards);
  const fits = [];
  let caves = 0;
  for (const [name, w] of war.planets) {
    if (!w.campaign || (front && w.front !== front)) continue;
    const p = tableByName.get(name);
    if (!p) continue;
    if (avoidCaves && hasCaves(p)) {
      caves += 1;
      continue;
    }
    fits.push({
      name,
      front: w.front,
      players: w.players,
      liberation: w.liberation,
      defence: w.defence,
      clashes: (p.hazards || []).filter((h) => avoid.has(h)),
      megacity: fewerMegacities ? megacitiesOn(p) : 0,
    });
  }
  fits.sort((a, b) =>
    Number(a.megacity > 0) - Number(b.megacity > 0) ||
    a.clashes.length - b.clashes.length ||
    b.players - a.players ||
    a.name.localeCompare(b.name));
  return { picks: fits.slice(0, limit), fits: new Set(fits.map((f) => f.name)), count: fits.length, hiddenForCaves: caves };
}

/* ------------------------------------------------------------------ */
/* The war table: the game's own look, as a second skin                */
/*                                                                     */
/* The curator asked for a skin that looks like the game's Galactic    */
/* War screen, 30 September 2026: sectors as stepped zones on a polar  */
/* grid, filled and hatched in the colour of whoever holds them.       */
/*                                                                     */
/* **The game's sector shapes are not published**, so they are built    */
/* here from the planets. The disc is cut into rings, each ring into   */
/* cells about as wide as they are deep, and each cell goes to the     */
/* sector of the planet nearest its middle. Runs of cells from one     */
/* sector merge into one wedge. That gives the game's stepped polar    */
/* look with borders drawn from where the planets actually are; they   */
/* will not match the game's own line for line, and nothing claims     */
/* they do. The middle disc is Sol, which is Super Earth alone.        */
/* ------------------------------------------------------------------ */

export const TABLE = (() => {
  const SOL = 44;
  const OUTER = RADIUS + 22;
  const RINGS = 12;
  const depth = (OUTER - SOL) / RINGS;
  const seeds = placed.filter((p) => !p.home && p.sector && p.sector !== "TBD");
  const nearest = (x, y) => {
    let best = null;
    let bestD = Infinity;
    for (const p of seeds) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best.sector;
  };

  const runs = [];
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const r0 = SOL + i * depth;
    const r1 = r0 + depth;
    const mid = (r0 + r1) / 2;
    const n = Math.max(8, Math.round((2 * Math.PI * mid) / (depth * 1.25)));
    rings.push({ r0, r1, cells: n });
    const cells = Array.from({ length: n }, (_, j) => {
      const a = ((j + 0.5) / n) * 2 * Math.PI;
      return nearest(CENTRE + mid * Math.cos(a), CENTRE + mid * Math.sin(a));
    });
    const step = (2 * Math.PI) / n;
    /* A ring held by one sector all the way round is two halves, since a
       single arc cannot start and end at the same point. */
    const start = cells.findIndex((s, j) => s !== cells[(j - 1 + n) % n]);
    if (start === -1) {
      runs.push({ sector: cells[0], r0, r1, a0: 0, a1: Math.PI }, { sector: cells[0], r0, r1, a0: Math.PI, a1: 2 * Math.PI });
      continue;
    }
    for (let j = start, done = 0; done < n;) {
      const s = cells[j % n];
      let len = 0;
      while (done + len < n && cells[(j + len) % n] === s) len += 1;
      runs.push({ sector: s, r0, r1, a0: j * step, a1: (j + len) * step });
      j += len;
      done += len;
    }
  }
  return { sol: SOL, outer: OUTER, rings, runs };
})();

const at = (r, a) => `${(CENTRE + r * Math.cos(a)).toFixed(1)} ${(CENTRE + r * Math.sin(a)).toFixed(1)}`;

/* One wedge of a ring, as an SVG path. */
export const wedgePath = ({ r0, r1, a0, a1 }) => {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${at(r1, a0)}A${r1.toFixed(1)} ${r1.toFixed(1)} 0 ${large} 1 ${at(r1, a1)}` +
    `L${at(r0, a1)}A${r0.toFixed(1)} ${r0.toFixed(1)} 0 ${large} 0 ${at(r0, a0)}Z`;
};

/* Every sector's zone as one path, built once. */
export const sectorZones = (() => {
  const paths = new Map();
  for (const run of TABLE.runs) paths.set(run.sector, (paths.get(run.sector) || "") + wedgePath(run));
  return paths;
})();

/* Which wedge a point on the map falls in, for the checks. */
export function zoneAt(x, y) {
  const r = Math.hypot(x - CENTRE, y - CENTRE);
  let a = Math.atan2(y - CENTRE, x - CENTRE);
  if (a < 0) a += 2 * Math.PI;
  for (const run of TABLE.runs) {
    if (r < run.r0 || r >= run.r1) continue;
    for (const aa of [a, a + 2 * Math.PI]) if (aa >= run.a0 && aa < run.a1) return run.sector;
  }
  return null;
}

/* Who holds each sector, from the live war: the front holding the most of
   its planets, when that is at least half of them. A sector with a front
   you can drop on is marked as one. Nothing live, nothing held: the table
   draws every sector dark, the same rule the chart keeps. */
export function sectorHolders(war) {
  const out = new Map();
  if (!war || !war.fresh) return out;
  const tally = new Map();
  for (const p of placed) {
    if (p.home || !p.sector || p.sector === "TBD") continue;
    const t = tally.get(p.sector) || { total: 0, by: {}, campaign: false };
    t.total += 1;
    const w = war.planets.get(p.name);
    if (w && w.owner) t.by[w.owner] = (t.by[w.owner] || 0) + 1;
    if (w && w.campaign) t.campaign = true;
    tally.set(p.sector, t);
  }
  for (const [sector, t] of tally) {
    const [front, count] = Object.entries(t.by).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    if (front && count * 2 >= t.total) out.set(sector, { front, share: count / t.total, campaign: t.campaign });
    else if (t.campaign) out.set(sector, { front: null, share: 0, campaign: true });
  }
  return out;
}

/* Where each front's name goes on the rim: the middle of its territory,
   weighted by area, the way the game writes AUTOMATONS across its red. */
export function frontArcs(holders) {
  const sums = new Map();
  for (const run of TABLE.runs) {
    const h = holders.get(run.sector);
    if (!h || !h.front) continue;
    const area = (run.a1 - run.a0) * (run.r1 ** 2 - run.r0 ** 2);
    const mid = (run.a0 + run.a1) / 2;
    const s = sums.get(h.front) || { x: 0, y: 0, area: 0 };
    s.x += Math.cos(mid) * area;
    s.y += Math.sin(mid) * area;
    s.area += area;
    sums.set(h.front, s);
  }
  return [...sums].map(([front, s]) => ({ front, angle: Math.atan2(s.y, s.x), area: s.area }));
}

/* An arc to write a front's name along, reading left to right whichever
   side of the disc it is on. */
export function arcPath(angle, radius, span = 0.55) {
  const bottom = Math.sin(angle) > 0;
  const a0 = angle - span / 2;
  const a1 = angle + span / 2;
  return bottom
    ? `M${at(radius, a1)}A${radius} ${radius} 0 0 0 ${at(radius, a0)}`
    : `M${at(radius, a0)}A${radius} ${radius} 0 0 1 ${at(radius, a1)}`;
}
