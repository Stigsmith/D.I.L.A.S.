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

import { galaxy, difficulty, readJson } from "./lib/app.mjs";

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
ok(mo.reward === null, "an order with no reward says nothing about one");
const paid = (reward) => galaxy.cleanWar({ ...withOrder, order: { ...withOrder.order, reward } }, NOW).order.reward;
ok(paid({ type: 1, amount: 40 }).kind === "medals" && paid({ type: 1, amount: 40 }).amount === 40,
  "a reward of type 1 reads as medals, the one inference the order makes");
ok(paid({ type: 7, amount: 40 }) === null && paid({ type: 1, amount: -3 }) === null && paid("40 medals") === null,
  "a reward of any other type, or no amount, is shown as nothing rather than guessed at");

/* The war's running totals */
const totals = { playerCount: 38398, terminidKills: 226645807204, automatonKills: 119725368690, illuminateKills: 76977223083,
  deaths: 9057442173, bulletsFired: 2026282813838, missionsWon: 1056414361, missionsLost: 102693485 };
const st = galaxy.cleanWar({ ...snapshot, stats: totals }, NOW).stats;
ok(st && st.players === 38398 && st.bots === 119725368690 && st.won === 1056414361, "the war's totals arrive under the war room's names");
ok(galaxy.cleanWar({ ...snapshot, stats: { playerCount: "lots", deaths: -1 } }, NOW).stats === null && galaxy.cleanWar(snapshot, NOW).stats === null,
  "totals that are missing or not counts are not shown at all");
ok(galaxy.cleanWar({ ...snapshot, stats: totals }, snapshot.fetchedAt + galaxy.WAR_TOO_OLD_MS + 1).stats === null,
  "totals read more than half an hour ago are not shown, the same as the map");

/* The drop planner */
/* `table` is the shipped planet table, read at the top of this file. */
ok(table.filter((p) => galaxy.hasCaves(p)).map((p) => p.name).sort().join(",") === "Omicron,Oshaune,Zagon Prime",
  "the planets with caves are the three Hive Worlds the wiki names");
ok(table.filter((p) => galaxy.megacitiesOn(p) > 0).length === 29, "29 planets have a megacity");
const planWar = galaxy.cleanWar({
  fetchedAt: NOW,
  planets: [
    { name: "OMICRON", owner: "Terminids", health: 900, maxHealth: 1000, players: 9000, campaign: true },
    { name: "FENRIR III", owner: "Terminids", health: 500, maxHealth: 1000, players: 5000, campaign: true },
    { name: "HELLMIRE", owner: "Terminids", health: 500, maxHealth: 1000, players: 300, campaign: true },
    { name: "HEETH", owner: "Terminids", health: 500, maxHealth: 1000, players: 100, campaign: true },
    { name: "MALEVELON CREEK", owner: "Automaton", health: 500, maxHealth: 1000, players: 99999, campaign: true },
    { name: "ESTANU", owner: "Terminids", health: 500, maxHealth: 1000, players: 99999, campaign: false },
  ],
}, NOW);
const busiest = galaxy.suggestFronts(planWar, { front: "bugs" });
ok(busiest.picks.map((p) => p.name).join(",") === "Omicron,Fenrir III,Hellmire",
  "with nothing to avoid, the busiest fronts on the chosen side come first, and a planet that is not a front is never suggested");
const noCaves = galaxy.suggestFronts(planWar, { front: "bugs", caves: "avoid" });
ok(!noCaves.fits.has("Omicron") && noCaves.hiddenForCaves === 1, "no caves hides the Hive World, and counts it");
ok(galaxy.megacitiesOn(table.find((p) => p.name === "Fenrir III")) > 0, "Fenrir III has a megacity, which the next check leans on");
const fewer = galaxy.suggestFronts(planWar, { front: "bugs", caves: "avoid", megacities: "fewer" });
ok(fewer.picks[fewer.picks.length - 1].name === "Fenrir III" && fewer.fits.has("Fenrir III"),
  "fewer megacities pushes a megacity planet after every planet without one, and still suggests it");
const hellmireHazards = table.find((p) => p.name === "Hellmire").hazards.filter((h) => h !== "normal_temp");
const dodge = galaxy.suggestFronts(planWar, { front: "bugs", caves: "avoid", avoidHazards: hellmireHazards });
const onlyCaves = galaxy.suggestFronts(planWar, { front: "bugs", caves: "only" });
ok(onlyCaves.count === 1 && onlyCaves.fits.has("Omicron"), "caves only suggests the Hive World and nothing else");
const more = galaxy.suggestFronts(planWar, { front: "bugs", caves: "avoid", megacities: "more" });
ok(more.picks[0].name === "Fenrir III", "more megacities puts the planet with one first, ahead of busier fronts without");
ok(hellmireHazards.length > 0 && dodge.picks[dodge.picks.length - 1].name === "Hellmire",
  "a hazard you would rather avoid pushes its planet down rather than hiding it");
ok(galaxy.suggestFronts(null, {}) === null && galaxy.suggestFronts({ ...planWar, fresh: false }, {}) === null,
  "with no live war, or one too old to trust, there is nothing to suggest");
ok(galaxy.suggestFronts(planWar, {}).picks[0].name === "Malevelon Creek", "with no side chosen, every front is in the running");

/* Sectors as blocks */
const T = galaxy.TABLE;
let ringsWhole = true;
for (const ring of T.rings) {
  const spans = T.runs.filter((r) => r.r0 === ring.r0).reduce((n, r) => n + (r.a1 - r.a0), 0);
  if (Math.abs(spans - 2 * Math.PI) > 1e-9) ringsWhole = false;
}
ok(ringsWhole, `every ring of the table is covered exactly once all the way round (${T.rings.length} rings, ${T.runs.length} wedges)`);
const sectorNames = new Set(galaxy.sectors.map((s) => s.name));
ok(T.runs.every((r) => sectorNames.has(r.sector)), "every wedge belongs to a real sector");
const zoned = new Set(T.runs.map((r) => r.sector));
const zoneless = galaxy.sectors.filter((s) => !zoned.has(s.name)).map((s) => s.name);
ok(zoneless.length === 0, `every sector has ground on the table${zoneless.length ? ": missing " + zoneless.join(", ") : ""}`);
const zonable = galaxy.placed.filter((p) => !p.home && p.sector !== "TBD");
const inOwn = zonable.filter((p) => galaxy.zoneAt(p.x, p.y) === p.sector).length;
ok(inOwn / zonable.length >= 0.85, `planets sit inside their own sector's zone: ${inOwn} of ${zonable.length}`);
/* One outline per sector, with no lines inside it */
ok(galaxy.sectors.every((s) => (galaxy.sectorOutlines.get(s.name) || "").length > 0),
  "every sector has an outline");
const wedgeEdges = T.runs.length * 4;
const outlineEdges = [...galaxy.sectorOutlines.values()].reduce((n, d) => n + (d.match(/M/g) || []).length, 0);
ok(outlineEdges < wedgeEdges * 2, `the outlines draw ${outlineEdges} edges where the wedges would draw ${wedgeEdges * 2} counting both sides: the lines inside sectors are gone`);
const oneRingOwner = T.rings.find((ring) => new Set(T.runs.filter((r) => r.r0 === ring.r0).map((r) => r.sector)).size === 1);
ok(!oneRingOwner || !(galaxy.sectorOutlines.get(T.runs.find((r) => r.r0 === oneRingOwner.r0).sector) || "").includes("L"),
  "a sector holding a whole ring draws no side where its two halves meet");

/* Who holds what */
const holders = galaxy.sectorHolders(planWar);
ok(galaxy.sectorHolders(null).size === 0 && galaxy.sectorHolders({ ...planWar, fresh: false }).size === 0,
  "with no live war, or one too old to trust, no sector is coloured");
const creekSector = table.find((p) => p.name === "Malevelon Creek").sector;
ok(holders.get(creekSector) && holders.get(creekSector).campaign, "a sector with a front in it is marked as one");
const siege = galaxy.sectorHolders(galaxy.cleanWar({ fetchedAt: NOW, planets: [
  { name: "CALYPSO", owner: "Humans", campaign: true, players: 10,
    event: { faction: "Illuminate", health: 1, maxHealth: 2, endTime: new Date(NOW + 3600000).toISOString() } },
] }, NOW)).get(table.find((p) => p.name === "Calypso").sector);
ok(siege && siege.front === null && siege.against === "squids",
  "a sector Super Earth holds but is defending shows the attacker's colour, not a blank");
ok(galaxy.frontArcs(new Map([[creekSector, { front: "bots", share: 1, campaign: true }]]))[0].front === "bots",
  "a front's name goes where its territory is");

/* Two levels: the galaxy and one sector */
const everySectorFrames = [...galaxy.sectorMembers.keys()].every((s) => {
  const v = galaxy.sectorView(s);
  const tl = galaxy.toMap(v, { x: 0, y: 0 });
  const br = galaxy.toMap(v, { x: VIEW, y: VIEW });
  return v.k >= galaxy.SECTOR_MIN_ZOOM && v.k <= MAX_ZOOM &&
    galaxy.sectorMembers.get(s).every((p) => p.x >= tl.x && p.x <= br.x && p.y >= tl.y && p.y <= br.y);
});
ok(everySectorFrames, `clicking any of the ${galaxy.sectorMembers.size} sectors frames all of its planets, zoomed in at least ${galaxy.SECTOR_MIN_ZOOM} times`);
const onCreek = galaxy.sectorNear(creek);
ok(onCreek === table.find((p) => p.name === "Malevelon Creek").sector, "a click on a planet opens that planet's sector");
ok(galaxy.sectorNear({ x: 2, y: 2 }) === null, "a click on empty space far from any planet opens nothing");
const k0 = galaxy.sectorView(onCreek).k;
ok(!galaxy.leavesSector(k0 * 0.75, k0) && galaxy.leavesSector(k0 * 0.55, k0),
  "zooming out a little stays in the sector, zooming out a lot goes back to the galaxy");
const from = HOME;
const to = galaxy.sectorView(onCreek);
const start = galaxy.glide(from, to, 0);
const end = galaxy.glide(from, to, 1);
ok(near(start.k, from.k) && near(start.x, from.x) && near(start.y, from.y) && near(end.k, to.k) && near(end.x, to.x) && near(end.y, to.y),
  "the glide starts exactly where the map is and ends exactly on the sector");
const halfway = galaxy.glide(from, to, 0.5);
ok(halfway.k > from.k && halfway.k < to.k, "halfway through the glide the zoom is between the two");
let easing = { ...from };
for (let i = 0; i < 60; i++) easing = galaxy.towards(easing, to, 0.2);
ok(Math.abs(easing.k - to.k) < 1e-3 && Math.abs(easing.x - to.x) < 0.5, "the wheel's easing settles exactly where the wheel was taking it");
ok(galaxy.zoneAt(creek.x, creek.y) === onCreek && galaxy.zoneAt(CENTRE, CENTRE) === null,
  "a click inside a sector's blocks is a click on that sector, and Sol in the middle is nobody's");

console.log("\nFull screen and the tilt");
const stages = [[1600, 900], [1280, 720], [900, 1400], [390, 800]];
let roundTrip = 0;
let inside = true;
let leansBack = true;
for (const [w, h] of stages) {
  const fit = galaxy.stageFit(w, h, { tilt: true, margin: 28 });
  for (const p of [...galaxy.placed.slice(0, 60), { x: CENTRE, y: 30 }, { x: CENTRE, y: VIEW - 30 }, { x: 30, y: CENTRE }]) {
    const s = galaxy.onStage(fit, p.x, p.y);
    const back = galaxy.offStage(fit, s.x, s.y);
    roundTrip = Math.max(roundTrip, Math.hypot(back.x - p.x, back.y - p.y));
  }
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI;
    const s = galaxy.onStage(fit, CENTRE + RADIUS * Math.cos(t), CENTRE + RADIUS * Math.sin(t));
    if (s.x < 27 || s.x > w - 27 || s.y < 27 || s.y > h - 27) inside = false;
  }
  /* The same span of map is narrower at the far edge than the near one. */
  const far = galaxy.onStage(fit, CENTRE + 200, 150).x - galaxy.onStage(fit, CENTRE - 200, 150).x;
  const nearSpan = galaxy.onStage(fit, CENTRE + 200, 850).x - galaxy.onStage(fit, CENTRE - 200, 850).x;
  if (!(far < nearSpan)) leansBack = false;
}
ok(roundTrip < 1e-6, `a click converts back to exactly the point drawn under it, through the tilt (worst ${roundTrip.toExponential(1)})`);
ok(inside, "the tilted disc fits inside the screen with its margin, on wide, tall and phone screens");
ok(leansBack, "the tilt lays the map back: the far edge is narrower than the near one");
const flatFit = galaxy.stageFit(540, 540, { fill: true });
const flatPt = galaxy.offStage(flatFit, 135, 405);
ok(galaxy.stageTransform(flatFit) === undefined && near(flatFit.S, 540) && near(flatPt.x, 250) && near(flatPt.y, 750),
  "the map on the page is untouched: flat, filling its square, a click read exactly as before");
const wideFlat = galaxy.stageFit(1600, 900, { margin: 28 });
const wideTilt = galaxy.stageFit(1600, 900, { tilt: true, margin: 28 });
ok(wideTilt.S > wideFlat.S, "on a wide screen the tilted map is drawn bigger than the flat one, since leaning back shortens it");
let covers = true;
for (const [w, h] of stages) {
  const fit = galaxy.stageFit(w, h, { tilt: true, margin: 28 });
  const pad = galaxy.stageCover(fit, w, h);
  for (let i = 0; i <= 10; i++) {
    for (const [x, y] of [[(w * i) / 10, 0], [(w * i) / 10, h], [0, (h * i) / 10], [w, (h * i) / 10]]) {
      const p = galaxy.offStage(fit, x, y);
      if (p.x < -pad || p.x > VIEW + pad || p.y < -pad || p.y > VIEW + pad) covers = false;
    }
  }
}
ok(covers, "in full screen the drawing reaches every edge of the screen, so a sector fills it rather than floating in the middle");
{
  const fit = galaxy.stageFit(1600, 900, { tilt: true, margin: 28 });
  const flat = galaxy.stageFit(1600, 900, { margin: 28 });
  ok(galaxy.stageDepth(flat, 500, 100) === 1 && galaxy.stageDepth(fit, 500, 100) < 1 && galaxy.stageDepth(fit, 500, 900) > 1 && Math.abs(galaxy.stageDepth(fit, 500, 500) - 1) < 1e-9,
    "planets stand upright on the tilt: smaller toward the back, larger toward the front, true size in the middle and on a flat map");
}
{
  const fit = galaxy.stageFit(1400, 800, { tilt: true, margin: 20, insets: { left: 360, bottom: 80 } });
  let inside = true;
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI;
    const s = galaxy.onStage(fit, CENTRE + RADIUS * Math.cos(t), CENTRE + RADIUS * Math.sin(t));
    if (s.x < 360 + 19 || s.x > 1400 - 19 || s.y < 19 || s.y > 800 - 80 - 19) inside = false;
  }
  const back = galaxy.offStage(fit, ...Object.values(galaxy.onStage(fit, 321, 654)));
  ok(inside && Math.hypot(back.x - 321, back.y - 654) < 1e-9, "beside a panel the map fits the space that is left, and a click still lands exactly");
}

/* The war room's difficulty bar, read off the wiki's Difficulty table */
{
  const vocab = readJson("src/data/vocabulary.json").difficulties;
  const levels = readJson("src/data/difficulty.json").levels;
  ok(levels.length === vocab.length && levels.every((l, i) => l.level === vocab[i].level),
    "the Difficulty table has a row for every level the tool names, in order");
  ok(levels.every((l) => l.medals.perMission.reduce((a, b) => a + b, 0) === l.medals.total && l.medals.perMission.length === l.missions),
    "each level's medals add up, one figure per mission in the operation");
  ok(difficulty.levelParts(0) === null && difficulty.levelParts(11) === null, "a level that is not said has no line");
  const mods = vocab.map((d) => difficulty.levelFacts(d.level).modifiers);
  ok(mods.join("") === "0000111222", "operation modifiers start at 5 and a second is added at 8, as the wiki says");
  const samples = vocab.map((d) => difficulty.levelFacts(d.level).samples.length);
  ok(samples.join("") === "1112233333", "rare samples from 4 and super samples from 6");
  ok(difficulty.levelParts(7).join(" · ") ===
    "3 missions an operation, 24 medals · 2 to 7 outposts, up to 2 heavy · common, rare and super samples · one operation modifier · +150% requisition and experience",
    "Suicide Mission reads as the wiki's row for it");
  ok(difficulty.levelParts(10)[1].includes("giant") && difficulty.levelParts(1)[1] === "no outposts",
    "outposts read from none at Trivial to a giant now and then at Super Helldive");
}
