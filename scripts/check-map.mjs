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

/* The live war, as the browser reads it */
const NOW = 10_000_000;
const snapshot = {
  fetchedAt: NOW - 4 * 60 * 1000,
  planets: [
    { name: "MALEVELON CREEK", owner: "Automaton", health: 250000, maxHealth: 1000000, players: 4210, campaign: true, event: null },
    { name: "HELLMIRE", owner: "Terminids", health: 900000, maxHealth: 1000000, players: 0, campaign: false, event: null },
    { name: "CALYPSO", owner: "Humans", health: 1000000, maxHealth: 1000000, players: 900, campaign: true,
      event: { faction: "Illuminate", health: 600000, maxHealth: 2000000, endTime: new Date(NOW + 3 * 3600000).toISOString() } },
    { name: "NOT A PLANET", owner: "Automaton", campaign: true },
    { name: "CYBERSTAN", owner: "Martians", campaign: true },
    { name: "SUPER EARTH", owner: "Humans", campaign: false, event: null },
  ],
};
const war = galaxy.cleanWar(snapshot, NOW);
ok(war && war.fresh && war.planets.size === 3, "the snapshot is read by name against this browser's table, and a planet it does not know is dropped");
ok(!war.planets.has("Cyberstan"), "an owner nobody has heard of is dropped rather than drawn");
ok(!war.planets.has("Super Earth"), "a quiet planet Super Earth holds is not a front");
const creekWar = war.planets.get("Malevelon Creek");
ok(creekWar && creekWar.front === "bots" && creekWar.campaign && Math.abs(creekWar.liberation - 0.75) < 1e-9,
  "an enemy world under a campaign reads its front and how much is liberated");
const calypso = war.planets.get("Calypso");
ok(calypso && calypso.owner === null && calypso.front === "squids" && Math.abs(calypso.defence.progress - 0.7) < 1e-9,
  "a defence reads the attacker as the front, and how much has been defended");
ok(war.fronts === 2, "two fronts open: the campaign and the defence, not the planet merely held");
ok(galaxy.frontOf(war, "Malevelon Creek") === "bots" && galaxy.frontOf(war, "Calypso") === "squids",
  "choosing a planet with fighting on it fills in who you would fight");
ok(galaxy.frontOf(war, "Gunvald") === null, "choosing a quiet planet leaves the front alone");

const old = galaxy.cleanWar(snapshot, snapshot.fetchedAt + galaxy.WAR_TOO_OLD_MS + 1);
ok(old && !old.fresh && galaxy.frontOf(old, "Malevelon Creek") === null,
  "past half an hour the snapshot is not trusted, and fills in nothing");
ok(galaxy.cleanWar({ planets: [] }) === null && galaxy.cleanWar("<html>") === null && galaxy.cleanWar(null) === null,
  "an answer with no age, or no answer at all, is no war");
const odd = galaxy.cleanWar({ fetchedAt: NOW, planets: [{ name: "MALEVELON CREEK", owner: "Automaton", health: "x", maxHealth: 0, campaign: true, players: -3 }] }, NOW);
ok(odd.planets.get("Malevelon Creek").liberation === null && odd.planets.get("Malevelon Creek").players === 0,
  "numbers that make no sense are dropped rather than shown");

/* Which names fit */
const clash = [
  { name: "Quiet", x: 100, y: 100, offset: 5, priority: 3 },
  { name: "Busy front", x: 101, y: 100, offset: 5, priority: 2, weight: 900 },
  { name: "Other front", x: 102, y: 101, offset: 5, priority: 2, weight: 10 },
  { name: "Far away", x: 400, y: 400, offset: 5, priority: 3 },
];
const fit = galaxy.placeLabels(clash, 1);
ok(fit.has("Busy front") && !fit.has("Other front") && !fit.has("Quiet") && fit.has("Far away"),
  "overlapping names: the busier front wins, the rest wait for a closer zoom, and a name with room is drawn");
const forced = galaxy.placeLabels([...clash, { name: "Chosen", x: 100, y: 100, offset: 5, priority: 0, must: true }], 1);
ok(forced.has("Chosen") && !forced.has("Busy front"), "the chosen planet is always named, and takes the spot first");
ok(galaxy.placeLabels(clash, 100).size === 4, "zoomed in far enough, every name fits");
const rightFlank = galaxy.placed.filter((p) => galaxy.labelSide(p) === "left");
ok(rightFlank.length > 0 && rightFlank.every((p) => p.x > CENTRE) &&
   galaxy.placed.every((p) => galaxy.labelSide(p) === "left" || p.x - CENTRE < RADIUS * 0.46),
  `names on the galaxy's right flank run inward (${rightFlank.length} planets), so none runs off the edge`);
const sideBySide = galaxy.placeLabels([
  { name: "Leftward", x: 100, y: 100, offset: 5, side: "left", priority: 2 },
  { name: "Rightward", x: 100, y: 100, offset: 5, side: "right", priority: 2 },
], 1);
ok(sideBySide.size === 2, "a name to the left of a planet and one to the right of it do not collide");
const sectorUnder = galaxy.placeLabels([
  { name: "Planet", x: 100, y: 100, offset: 5, side: "right", priority: 2 },
  { key: "sector:Planetary", name: "Planetary", x: 110, y: 100, side: "middle", priority: 4 },
], 1);
ok(sectorUnder.has("Planet") && !sectorUnder.has("sector:Planetary"), "a sector's name steps aside for a planet's");

/* The Major Order, as the browser reads it */
const withOrder = { ...snapshot, order: {
  title: "MAJOR ORDER",
  briefing: "<i=1>Kill</i> the requisite   enemies.",
  expiresAt: new Date(NOW + 30 * 3600000).toISOString(),
  tasks: [{ race: 2, goal: 25000000, progress: 12759594 }, { race: 3, goal: 5000000, progress: 2114700 }, { race: 1, goal: 1, progress: 1 }, { race: 9, goal: 0, progress: 5 }],
} };
const mo = galaxy.cleanWar(withOrder, NOW).order;
ok(mo && mo.briefing === "Kill the requisite enemies.", "the order's briefing loses the game's formatting tags");
ok(mo.tasks.length === 3 && mo.tasks[0].front === "bugs" && mo.tasks[1].front === "bots" && mo.tasks[2].front === null,
  "each task is on its front by the game's own number, Super Earth is no front, and a task with no goal is dropped");
ok(Math.abs(mo.tasks[0].done - 0.51038376) < 1e-6, "a task's bar is its progress over its goal");
const ended = galaxy.cleanWar({ ...withOrder, order: { ...withOrder.order, expiresAt: new Date(NOW - 1000).toISOString() } }, NOW);
ok(ended.order === null, "an order that has ended is no order");
ok(galaxy.cleanWar(withOrder, withOrder.fetchedAt + galaxy.WAR_TOO_OLD_MS + 1).order === null,
  "an order read more than half an hour ago is not shown, the same as the map");
