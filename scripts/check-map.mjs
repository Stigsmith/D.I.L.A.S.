/* ================================================================== */
/* THE GALAXY MAP'S ARITHMETIC, CHECKED                               */
/*                                                                    */
/*   npm run map                                                      */
/*                                                                    */
/* Runs src/lib/galaxy.js against the shipped planet table. It guards */
/* what makes the map worth having: that it is the right way up, so   */
/* a planet is where the game put it, that nothing is drawn off the   */
/* edge or twice, that search finds what the list used to, and that   */
/* zooming keeps the point you zoomed on still. Exits non zero on a   */
/* fail.                                                              */
/* ================================================================== */

import { galaxy, readJson } from "./lib/app.mjs";

const { VIEW, CENTRE, RADIUS, MAX_ZOOM, HOME } = galaxy;
const table = readJson("src/data/planets.json").planets;
const ok = (cond, msg) => { console.log((cond ? "  ok    " : "  FAIL  ") + msg); if (!cond) process.exitCode = 1; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/* What is on the map */
const noPosition = table.filter((p) => !p.position).map((p) => p.name);
const placeholders = table.filter((p) => p.position && p.type !== "super_earth" && p.position.x === 0 && p.position.y === 0);
ok(galaxy.placed.length + galaxy.unplaced.length === table.length,
  `every planet is either drawn or listed as unplaced (${galaxy.placed.length} + ${galaxy.unplaced.length} = ${table.length})`);
ok(noPosition.every((n) => galaxy.unplaced.includes(n)), `the ${noPosition.length} with no position are not drawn`);
ok(placeholders.length > 0 && placeholders.every((p) => galaxy.unplaced.includes(p.name)),
  `the ${placeholders.length} placeholders parked on Super Earth are not drawn on top of it`);
const home = galaxy.placeOf("Super Earth");
ok(home && home.home && near(home.x, CENTRE) && near(home.y, CENTRE), "Super Earth is drawn, in the middle");

/* The right way up. The data's y points up and a screen's points down.
   Cyberstan, the Automaton home world, is up and to the left in game. */
const cyberstan = galaxy.placeOf("Cyberstan");
ok(cyberstan && cyberstan.x < CENTRE && cyberstan.y < CENTRE, "Cyberstan is up and to the left, where the game has it");
const creek = galaxy.placeOf("Malevelon Creek");
ok(creek && creek.x < CENTRE - RADIUS * 0.7, "Malevelon Creek is out on the left edge");

ok(galaxy.placed.every((p) => Math.hypot(p.x - CENTRE, p.y - CENTRE) <= RADIUS), "every planet sits inside the disc");
ok(galaxy.placed.every((p) => p.x >= 0 && p.x <= VIEW && p.y >= 0 && p.y <= VIEW), "every planet sits inside the view box");

/* Supply lines */
const keys = galaxy.lanes.map((l) => l.key);
ok(new Set(keys).size === keys.length, `each of the ${keys.length} supply lines is drawn once, not once from each end`);
ok(galaxy.lanes.every((l) => l.a !== l.b && galaxy.placeOf(l.a.name) && galaxy.placeOf(l.b.name)),
  "every supply line joins two different planets that are both on the map");
const listed = new Set();
for (const p of table) for (const l of p.links || []) {
  const other = table.find((q) => q.name.toUpperCase() === l);
  if (other && galaxy.placeOf(p.name) && galaxy.placeOf(other.name)) listed.add([p.name, other.name].sort().join("|"));
}
ok(listed.size === keys.length && [...listed].every((k) => keys.includes(k)), "no supply line in the table is missing from the map");

/* Sectors */
ok(galaxy.sectors.length > 40 && galaxy.sectors.every((s) => s.name && s.name !== "TBD" && s.count > 0),
  `${galaxy.sectors.length} sectors named, none of them the TBD placeholder`);

/* Room for a name */
ok(galaxy.placed.every((p) => galaxy.roomFor.get(p.name) > 0 && Number.isFinite(galaxy.roomFor.get(p.name))),
  "every planet has a nearest neighbour at a real distance, so every name appears at some zoom");

/* Search */
ok(galaxy.searchPlanets("creek")[0]?.name === "Malevelon Creek", "searching creek finds Malevelon Creek first");
const severin = galaxy.searchPlanets("severin", 50);
ok(severin.length > 1 && severin.every((p) => p.sector === "Severin" || p.name.toLowerCase().includes("severin")),
  `searching a sector finds its planets (${severin.length})`);
ok(galaxy.searchPlanets("   ").length === 0 && galaxy.matchSet("") === null, "an empty search finds nothing and lights nothing");
ok(galaxy.searchPlanets("void", 50).some((p) => galaxy.unplaced.includes(p.name)), "search still reaches the planets with no place on the map");
const starts = galaxy.searchPlanets("ma", 20);
ok(starts.findIndex((p) => !p.name.toLowerCase().startsWith("ma")) === -1 ||
   starts.slice(0, starts.findIndex((p) => !p.name.toLowerCase().startsWith("ma"))).every((p) => p.name.toLowerCase().startsWith("ma")),
  "names that start with the search come before names that merely contain it");

/* Panning and zooming */
ok(JSON.stringify(galaxy.clampView({ k: 0.5, x: 120, y: -40 })) === JSON.stringify(HOME), "fully out is the whole galaxy, centred");
ok(galaxy.clampView({ k: 99, x: 0, y: 0 }).k === MAX_ZOOM, `zoom stops at ${MAX_ZOOM}`);
const flung = galaxy.clampView({ k: 3, x: 5000, y: -9000 });
ok(flung.x === 0 && flung.y === VIEW * (1 - 3), "panning stops at the galaxy's edge rather than losing it off the side");

const view = { k: 2, x: -300, y: -250 };
const cursor = { x: 420, y: 610 };
const before = galaxy.toMap(view, cursor);
const after = galaxy.toMap(galaxy.zoomAt(view, cursor, 1.5), cursor);
ok(near(before.x, after.x, 1e-9) && near(before.y, after.y, 1e-9), "zooming keeps the point under the cursor exactly where it was");

const centred = galaxy.centreOn(creek, 4);
const middle = galaxy.toMap(centred, { x: CENTRE, y: CENTRE });
ok(Math.hypot(middle.x - creek.x, middle.y - creek.y) < RADIUS * 0.2,
  "flying to a planet puts it at or near the middle, as far as the edge allows");
const inner = galaxy.placeOf("Meridia") || galaxy.placed.find((p) => !p.home && Math.hypot(p.x - CENTRE, p.y - CENTRE) < RADIUS * 0.3);
const exact = galaxy.toMap(galaxy.centreOn(inner, 3), { x: CENTRE, y: CENTRE });
ok(near(exact.x, inner.x, 1e-9) && near(exact.y, inner.y, 1e-9), `flying to ${inner.name}, well inside the edge, centres it exactly`);
