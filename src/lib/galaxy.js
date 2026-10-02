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
/* - **Caves: avoid, any, or only.** The wiki puts the cave systems in  */
/*   the Hive World biome, which three planets have. Avoid hides them,  */
/*   only hides everything else. Both ways round, because sometimes     */
/*   the caves are what you came for: the curator, 30 September 2026.   */
/* - **Megacities: fewer, any, or more.** It pushes rather than hides:  */
/*   fewer puts a planet with a megacity after every planet without     */
/*   one, more puts it before. Hazards you would rather avoid push down */
/*   the same way, after it.                                            */
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

export const CAVE_CHOICES = ["avoid", "any", "only"];
export const MEGACITY_CHOICES = ["fewer", "any", "more"];

export function suggestFronts(war, { front = null, caves = "any", megacities = "any", avoidHazards = [] } = {}, limit = 3) {
  if (!war || !war.fresh) return null;
  const avoid = new Set(avoidHazards);
  const fits = [];
  let hidden = 0;
  for (const [name, w] of war.planets) {
    if (!w.campaign || (front && w.front !== front)) continue;
    const p = tableByName.get(name);
    if (!p) continue;
    if ((caves === "avoid" && hasCaves(p)) || (caves === "only" && !hasCaves(p))) {
      hidden += 1;
      continue;
    }
    fits.push({
      name,
      front: w.front,
      players: w.players,
      liberation: w.liberation,
      defence: w.defence,
      clashes: (p.hazards || []).filter((h) => avoid.has(h)),
      megacity: megacitiesOn(p),
    });
  }
  /* Which side of the line a megacity planet goes: after the rest for
     fewer, before them for more, and no line at all for any. */
  const cityRank = (f) => (megacities === "any" ? 0 : (f.megacity > 0) === (megacities === "fewer") ? 1 : 0);
  fits.sort((a, b) =>
    cityRank(a) - cityRank(b) ||
    a.clashes.length - b.clashes.length ||
    b.players - a.players ||
    a.name.localeCompare(b.name));
  return { picks: fits.slice(0, limit), fits: new Set(fits.map((f) => f.name)), count: fits.length, hiddenForCaves: hidden, caves, megacities };
}

/* ------------------------------------------------------------------ */
/* Who holds what, sector by sector                                    */
/*                                                                     */
/* Read from the live war and nothing else. The Tactical skin glows    */
/* each held planet in its front's colour and writes each front's name */
/* along the rim where its territory is; the chart colours the dots.   */
/* ------------------------------------------------------------------ */

const at = (r, a) => `${(CENTRE + r * Math.cos(a)).toFixed(1)} ${(CENTRE + r * Math.sin(a)).toFixed(1)}`;

/* ------------------------------------------------------------------ */
/* Sectors as blocks                                                   */
/*                                                                     */
/* The game marks a sector as blocks on a polar grid, not as a mask    */
/* round its planets: the curator's correction, 30 September 2026. The */
/* game's own shapes are not published, so these are built from the    */
/* planets. The disc is cut into rings, each ring into cells about as   */
/* wide as they are deep, and each cell goes to the sector of the       */
/* planet nearest its middle; runs of one sector merge into one wedge.  */
/* The stepped look is the game's, the exact borders are not, and      */
/* nothing claims they are. A click anywhere inside a block is a click  */
/* on that sector, so the shape you see is the shape you click.         */
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

/* Each sector's outline: only the edges it shares with another sector,
   Sol or the rim, never the lines between its own blocks. The game draws
   a sector as one shape with one edge, the curator's point on 30 September
   2026, and a sector drawn as its wedges showed the grid inside it. Every
   shared edge belongs to both sectors either side, so each draws it. */
export const sectorOutlines = (() => {
  const TAU = 2 * Math.PI;
  const eps = 1e-9;
  /* Each ring's wedges as angles within one turn, in order. */
  const rings = TABLE.rings.map((ring) => {
    const out = [];
    for (const run of TABLE.runs.filter((r) => r.r0 === ring.r0)) {
      const a0 = run.a0 % TAU;
      const a1 = a0 + (run.a1 - run.a0);
      if (a1 > TAU + eps) out.push({ sector: run.sector, a0, a1: TAU }, { sector: run.sector, a0: 0, a1: a1 - TAU });
      else out.push({ sector: run.sector, a0, a1 });
    }
    return { ...ring, cells: out.sort((a, b) => a.a0 - b.a0) };
  });
  const sectorOf = (cells, a) => {
    const x = ((a % TAU) + TAU) % TAU;
    return (cells.find((c) => x >= c.a0 - eps && x < c.a1 - eps) || cells[cells.length - 1]).sector;
  };
  const paths = new Map();
  const add = (sector, d) => paths.set(sector, (paths.get(sector) || "") + d);
  const arc = (r, x, y) => {
    if (y - x >= TAU - eps) return arc(r, x, x + Math.PI) + arc(r, x + Math.PI, y);
    return `M${at(r, x)}A${r.toFixed(1)} ${r.toFixed(1)} 0 ${y - x > Math.PI ? 1 : 0} 1 ${at(r, y)}`;
  };

  rings.forEach((ring, i) => {
    /* The sides between wedges, where two sectors meet in this ring. */
    ring.cells.forEach((c) => {
      const before = sectorOf(ring.cells, c.a0 - 1e-6);
      if (before !== c.sector) {
        const d = `M${at(ring.r0, c.a0)}L${at(ring.r1, c.a0)}`;
        add(c.sector, d);
        add(before, d);
      }
    });
    /* The inner edge of the first ring meets Sol, the outer edge of the last
       meets the rim: both always edges. */
    if (i === 0) ring.cells.forEach((c) => add(c.sector, arc(ring.r0, c.a0, c.a1)));
    if (i === rings.length - 1) {
      ring.cells.forEach((c) => add(c.sector, arc(ring.r1, c.a0, c.a1)));
      return;
    }
    /* Between this ring and the next: an edge wherever the sector below
       differs from the sector above, merged into as few arcs as it takes. */
    const above = rings[i + 1];
    const cuts = [...new Set([...ring.cells.flatMap((c) => [c.a0, c.a1]), ...above.cells.flatMap((c) => [c.a0, c.a1])])]
      .sort((a, b) => a - b);
    let open = null;
    const close = () => {
      if (!open) return;
      const d = arc(ring.r1, open.x, open.y);
      add(open.below, d);
      add(open.upper, d);
      open = null;
    };
    for (let j = 0; j < cuts.length - 1; j++) {
      const x = cuts[j];
      const y = cuts[j + 1];
      if (y - x < eps) continue;
      const mid = (x + y) / 2;
      const below = sectorOf(ring.cells, mid);
      const upper = sectorOf(above.cells, mid);
      if (below === upper) {
        close();
        continue;
      }
      if (open && open.below === below && open.upper === upper && Math.abs(open.y - x) < eps) open.y = y;
      else {
        close();
        open = { x, y, below, upper };
      }
    }
    close();
  });
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
    const t = tally.get(p.sector) || { total: 0, by: {}, campaign: false, fighting: {} };
    t.total += 1;
    const w = war.planets.get(p.name);
    if (w && w.owner) t.by[w.owner] = (t.by[w.owner] || 0) + 1;
    if (w && w.campaign) {
      t.campaign = true;
      if (w.front) t.fighting[w.front] = (t.fighting[w.front] || 0) + 1 + w.players / 1e6;
    }
    tally.set(p.sector, t);
  }
  for (const [sector, t] of tally) {
    const [front, count] = Object.entries(t.by).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    /* Who the fighting in it is against: a sector nobody holds outright,
       such as one of Super Earth's under attack, still shows its war in
       that enemy's colour rather than as a blank. */
    const fighting = Object.entries(t.fighting).sort((a, b) => b[1] - a[1])[0];
    const against = fighting ? fighting[0] : null;
    if (front && count * 2 >= t.total) out.set(sector, { front, share: count / t.total, campaign: t.campaign, against: against || front });
    else if (t.campaign) out.set(sector, { front: null, share: 0, campaign: true, against });
  }
  return out;
}

/* Where each front's name goes on the rim: the middle of the planets in
   the sectors it holds, the way the game writes AUTOMATONS across its red. */
export function frontArcs(holders) {
  const sums = new Map();
  for (const [sector, ps] of sectorMembers) {
    const h = holders.get(sector);
    if (!h || !h.front) continue;
    for (const p of ps) {
      const a = Math.atan2(p.y - CENTRE, p.x - CENTRE);
      const t = sums.get(h.front) || { x: 0, y: 0, n: 0 };
      t.x += Math.cos(a);
      t.y += Math.sin(a);
      t.n += 1;
      sums.set(h.front, t);
    }
  }
  return [...sums].map(([front, t]) => ({ front, angle: Math.atan2(t.y, t.x), planets: t.n }));
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

/* ------------------------------------------------------------------ */
/* Two levels, the game's way                                          */
/*                                                                     */
/* The curator, 30 September 2026: in game you click a sector and it   */
/* zooms straight in to planet level, you move around in there, and    */
/* zooming out far enough takes you back to the whole galaxy rather    */
/* than to some level in between. So the map has two views, not a      */
/* dial: the galaxy, and one sector.                                   */
/* ------------------------------------------------------------------ */

/* The planets each sector holds, without Super Earth or the placeholders. */
export const sectorMembers = (() => {
  const m = new Map();
  for (const p of placed) {
    if (p.home || !p.sector || p.sector === "TBD") continue;
    if (!m.has(p.sector)) m.set(p.sector, []);
    m.get(p.sector).push(p);
  }
  return m;
})();

/* How far from a planet a point still counts as its sector. Past this the
   click is on empty space, which in the galaxy is nobody's. */
export const SECTOR_REACH = 70;

export function sectorNear(point, reach = SECTOR_REACH) {
  let best = null;
  let bestD = reach * reach;
  for (const [sector, ps] of sectorMembers) {
    for (const p of ps) {
      const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = sector;
      }
    }
  }
  return best;
}

/* The view that frames a sector: its planets with room around them, at no
   less than SECTOR_MIN_ZOOM, so even a sprawling sector is a clear step in
   from the galaxy. */
export const SECTOR_PAD = 60;
export const SECTOR_MIN_ZOOM = 2.4;

export function sectorView(sector) {
  const ps = sectorMembers.get(sector);
  if (!ps || !ps.length) return { ...HOME };
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const k = Math.min(MAX_ZOOM, Math.max(SECTOR_MIN_ZOOM, Math.min(VIEW / (w + 2 * SECTOR_PAD), VIEW / (h + 2 * SECTOR_PAD))));
  return centreOn({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, k);
}

/* Inside a sector you may zoom out a little. Past this share of the
   sector's own zoom the map goes back to the whole galaxy instead. */
export const LEAVE_AT = 0.6;
export const leavesSector = (k, sectorK) => k < sectorK * LEAVE_AT;

/* One frame of the glide between two views. The zoom moves geometrically
   and the middle of the frame in a straight line, which is what makes a
   zoom feel even rather than lurching at one end. */
export function glide(from, to, t) {
  return towards(from, to, t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
}

/* A share of the way from one view to another, with no easing of its own.
   The wheel calls this every frame with a small share, which is what makes
   a spin of the wheel one smooth zoom rather than a notch at a time. */
export function towards(from, to, share) {
  const k = from.k * (to.k / from.k) ** share;
  const a = toMap(from, { x: CENTRE, y: CENTRE });
  const b = toMap(to, { x: CENTRE, y: CENTRE });
  const cx = a.x + (b.x - a.x) * share;
  const cy = a.y + (b.y - a.y) * share;
  return { k, x: CENTRE - cx * k, y: CENTRE - cy * k };
}


/* ------------------------------------------------------------------ */
/* The stage, and the tilt                                            */
/*                                                                    */
/* Full screen lays the map back like a table, the curator's ask of  */
/* 1 October 2026: the top recedes, the bottom comes towards you. The */
/* tilt is a CSS perspective on the map's SVG, and these two          */
/* functions are the same projection written out, so a click lands    */
/* on the planet drawn under it. The SVG's own screen matrix cannot   */
/* say this: it flattens a perspective to a plain 2D matrix.          */
/*                                                                    */
/* The projection about the SVG's centre, in pixels, for a point u, v */
/* from that centre, with the plane rotated by a about the x axis and */
/* seen from d away:                                                  */
/*                                                                    */
/*   w = 1 - v sin(a) / d      x = u / w      y = v cos(a) / w        */
/*                                                                    */
/* which is what transform: perspective(d) rotateX(a) draws.          */
/* ------------------------------------------------------------------ */

/* As steep as the game's own table, the curator's correction of 2
   October 2026: 22 degrees read as barely tilted once he saw it beside
   the game. Steepness costs nothing now that planets and names stand
   upright on the ground rather than lying in it. The eye sits at DEPTH
   times the map's width, close enough for the far side to recede. */
export const TILT = (40 * Math.PI) / 180;
export const DEPTH = 1.8;

/* The disc and its rim, as a share of the view box from the centre. */
const RIM = Math.min(0.5, (RADIUS + 30) / VIEW);

/**
 * Where the map sits on a stage of w by h pixels, and how it is tilted.
 * `fill` is the inline map, which fills its square box exactly. Otherwise
 * the disc is fitted inside the stage with `margin` pixels to spare and
 * centred, tilted or flat. The shape of a tilted disc does not depend on
 * its size, because the eye moves back as the map grows, so it is measured
 * once at size 1 and scaled.
 */
/**
 * `insets` keeps the map clear of panels laid over the stage, pixels from
 * each side: the map is fitted and centred in what is left, and the
 * drawing still runs on underneath them, the way the game lays its panels
 * over the war table rather than beside it.
 */
export function stageFit(w, h, { tilt = false, fill = false, margin = 0, insets = null } = {}) {
  if (!(w > 0 && h > 0)) return { S: 0, left: 0, top: 0, a: 0, d: 1 };
  if (fill) return { S: w, left: 0, top: 0, a: 0, d: DEPTH * w };
  const a = tilt ? TILT : 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 180; i += 1) {
    const t = (i / 180) * 2 * Math.PI;
    const u = RIM * Math.cos(t);
    const v = RIM * Math.sin(t);
    const ww = 1 - (v * Math.sin(a)) / DEPTH;
    const x = 0.5 + u / ww;
    const y = 0.5 + (v * Math.cos(a)) / ww;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const ins = { left: 0, right: 0, top: 0, bottom: 0, ...(insets || {}) };
  const freeW = Math.max(1, w - ins.left - ins.right);
  const freeH = Math.max(1, h - ins.top - ins.bottom);
  const S = Math.max(0, Math.min((freeW - 2 * margin) / (x1 - x0), (freeH - 2 * margin) / (y1 - y0)));
  return {
    S,
    left: ins.left + (freeW - (x0 + x1) * S) / 2,
    top: ins.top + (freeH - (y0 + y1) * S) / 2,
    a,
    d: DEPTH * S,
  };
}

/* The CSS that draws a fit, so the picture and the arithmetic share one
   source. Nothing at all for a flat map. */
export function stageTransform(fit) {
  return fit.a ? `perspective(${fit.d.toFixed(1)}px) rotateX(${fit.a.toFixed(5)}rad)` : undefined;
}

/* A point in the view box to pixels on the stage. */
export function onStage(fit, fx, fy) {
  const c = fit.S / 2;
  const u = (fx / VIEW) * fit.S - c;
  const v = (fy / VIEW) * fit.S - c;
  const w = 1 - (v * Math.sin(fit.a)) / fit.d;
  return { x: fit.left + c + u / w, y: fit.top + c + (v * Math.cos(fit.a)) / w };
}

/* Pixels on the stage back to the view box: the same projection solved
   the other way. */
export function offStage(fit, x, y) {
  if (!(fit.S > 0)) return { x: CENTRE, y: CENTRE };
  const c = fit.S / 2;
  const U = x - fit.left - c;
  const V = y - fit.top - c;
  const v = V / (Math.cos(fit.a) + (V * Math.sin(fit.a)) / fit.d);
  const u = U * (1 - (v * Math.sin(fit.a)) / fit.d);
  return { x: ((u + c) / fit.S) * VIEW, y: ((v + c) / fit.S) * VIEW };
}

/* How far past the view box's own square the drawing must reach, in view
   box units on every side, for a fitted map to cover the whole stage.
   Inside a sector the map fills the screen rather than ending at the edge
   of its square, which tilted reads as a trapezoid floating in the middle.
   Widening the drawing about the same centre with the same eye distance
   leaves every point exactly where it was, so nothing else changes. */
export function stageCover(fit, w, h) {
  if (!(fit.S > 0)) return 0;
  let over = 0;
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]]) {
    const p = offStage(fit, x, y);
    over = Math.max(over, -p.x, p.x - VIEW, -p.y, p.y - VIEW);
  }
  return Math.ceil(Math.max(0, over) + 12);
}

/* How much bigger the tilt draws a point than the flat map would: under 1
   toward the back, over 1 toward the front. What a planet standing upright
   on the tilted ground is scaled by, so it keeps its depth without being
   squashed into the plane. Exactly 1 on a flat map. */
export function stageDepth(fit, fx, fy) {
  if (!fit.a || !(fit.S > 0)) return 1;
  const v = (fy / VIEW) * fit.S - fit.S / 2;
  return 1 / (1 - (v * Math.sin(fit.a)) / fit.d);
}
