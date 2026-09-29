/* ================================================================== */
/* THE DROP SCREEN'S RULES, CHECKED                                   */
/*                                                                    */
/*   npm run drop                                                     */
/*                                                                    */
/* Runs src/lib/drop.js against the real builds. It guards the three  */
/* things the drop screen promises and the live party will inherit:   */
/* the two locked hard gates, what counts as the squad, and that       */
/* editing a confirmed build un-confirms it. Exits non zero on a fail. */
/* ================================================================== */

import { drop, loadouts, squad } from "./lib/app.mjs";
const all = drop.withHeat(loadouts.presets.map((p) => ({ ...p, preset: true })));
const ok = (cond, msg) => { console.log((cond ? "  ok    " : "  FAIL  ") + msg); if (!cond) process.exitCode = 1; };

/* gates */
ok(drop.gateBiome({ hazards: ["intense_heat", "thick_fog"] }) === "hot", "heat wins over fog");
ok(drop.gateBiome({ hazards: ["extreme_cold"] }) === "cold", "cold from hazard");
ok(drop.gateBiome({}) === "any", "no hazards reads as any");
ok(drop.bandFor(0) === "any" && drop.bandFor(7) === "high" && drop.bandFor(10) === "extreme", "bands from levels");

for (const f of ["bots", "bugs", "squids"]) {
  const plain = drop.dropPool(all, { faction: f });
  const hot = drop.dropPool(all, { faction: f, hazards: ["intense_heat"] });
  const heatBuilds = plain.shown.filter((l) => l.heat).length;
  ok(hot.cut.heat === heatBuilds && hot.shown.every((l) => !l.heat), `${f}: hot removes all ${heatBuilds} heat builds`);
  ok(plain.shown.every((l) => l.faction === f), `${f}: only this front`);
  const d7 = drop.dropPool(all, { faction: f, difficulty: 7 });
  ok(d7.shown.every((l) => l.diff.includes("high")), `${f}: difficulty 7 keeps only builds declaring 7-9 (${d7.shown.length} of ${plain.shown.length})`);
}

/* locks only hide when asked */
const lockedSet = new Set([all[0].primary]);
const f0 = all[0].faction;
const shownAll = drop.dropPool(all, { faction: f0 }, { lockedSet, showLocked: true });
const hidden = drop.dropPool(all, { faction: f0 }, { lockedSet, showLocked: false });
ok(hidden.cut.locked > 0 && shownAll.shown.length === hidden.shown.length + hidden.cut.locked, `locked builds hidden and counted (${hidden.cut.locked})`);

/* favourites first, presets after yours */
const mine = { ...all[1], id: "own-x", preset: false };
const pool = drop.dropPool([...all, mine], { faction: mine.faction }, { favorites: [all.find((l) => l.faction === mine.faction).id] });
ok(pool.shown[0].preset && pool.shown[1].id === "own-x", "favourite first, then yours, then presets");

/* confirmation */
const byId = new Map([...all, mine].map((l) => [l.id, l]));
const resolve = (id) => byId.get(id);
let d = drop.cleanDrop({ mine: "own-x", confirmed: null, mates: [all[2].id, "gone", null, "extra"] });
ok(d.mates.length === 3, "mates capped at three");
let r = drop.readDrop(d, resolve);
ok(!r.confirmed && r.counted.length === 1 && r.mates[1] === null, "unconfirmed mine not counted, deleted mate reads empty");
d = { ...d, confirmed: drop.stampOf(mine) };
r = drop.readDrop(d, resolve);
ok(r.confirmed && r.counted.length === 2, "confirmed mine counts");
byId.set("own-x", { ...mine, updatedAt: "2099-01-01T00:00:00.000Z" });
r = drop.readDrop(d, resolve);
ok(!r.confirmed && r.counted.length === 1, "editing after confirm drops back to still deciding");
const presetDrop = { mine: all[3].id, confirmed: drop.stampOf(all[3]), mates: [null, null, null] };
ok(drop.readDrop(presetDrop, resolve).confirmed, "a preset (no updatedAt) confirms");
ok(drop.cleanDrop("junk").mine === null && drop.cleanDrop(null).mates.length === 3, "junk storage reads as empty");

/* traits reach the nest check */
const noObjective = all.filter((l) => l.faction === "bugs").slice(0, 2).map((l) => ({ ...l, strats: [null, null, null, null], grenade: null, primary: null, secondary: null }));
const ctx = drop.dropContext({ faction: "bugs", mission: "Destroy Command Bunkers" , difficulty: 9 });
const names = squad.squadWarnings(noObjective, ctx).map((w) => w.id);
ok(names.includes("objective-absent-nest"), "a real demolition mission name reaches the nest check through its traits");

/* on the wire: what a squadmate's build becomes when it arrives */
const sample = all.find((l) => l.faction === "bots");
const packed = drop.packBuild({ ...sample, blurb: "private notes" });
ok(!("blurb" in packed), "the blurb stays home");
const back = drop.unpackBuild(JSON.parse(JSON.stringify(packed)));
ok(back && back.primary === sample.primary && back.strats.join() === sample.strats.join() && back.name === sample.name, "a packed build comes back whole");
const tampered = drop.unpackBuild({ ...packed, primary: "orbital-precision-strike", armor: "not-an-item", strats: ["r-63-diligence", null] });
ok(tampered.primary === null && tampered.armor === null && tampered.strats.every((s) => s === null), "an item in the wrong slot, or no item at all, is dropped");
ok(drop.unpackBuild(null) === null && drop.unpackBuild([1, 2]) === null && drop.unpackBuild("x") === null, "junk from the wire reads as nothing");
ok(drop.unpackBuild({ ...packed, name: "x".repeat(500) }).name.length <= 60, "a shared name is capped");
