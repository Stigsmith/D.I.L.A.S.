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

import { drop, loadouts, squad, build, history, share, coverage } from "./lib/app.mjs";
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

/* ------------------------------------------------------------------ */
/* Suggesting, 1 October 2026                                          */
/* ------------------------------------------------------------------ */
const botScenario = { faction: "bots", difficulty: 7, squad: 4, hazards: ["intense_heat"] };
const picks = drop.suggestBuilds(all, botScenario, { limit: 3 });
const allowed = new Set(drop.dropPool(all, botScenario).shown.map((l) => l.id));
ok(picks.length === 3 && picks.every((p) => allowed.has(p.build.id)), "suggestions come only from builds the scenario allows: none vents heat on a hot planet");
const scores = drop.dropPool(all, botScenario).shown.map((l) => build.readBuild(l, botScenario).score).sort((a, b) => b - a);
ok(picks.map((p) => p.reading.score).join() === scores.slice(0, 3).join(), "and they are the three best readings, in order");
const lockAll = new Set(picks[0].build.strats.filter(Boolean));
ok(!drop.suggestBuilds(all, botScenario, { lockedSet: lockAll, limit: 40 }).some((p) => p.build.id === picks[0].build.id),
  "a build needing gear you have not unlocked is never suggested");
const ranked = drop.rankByReading(drop.dropPool(all, botScenario).shown, botScenario, [picks[2].build.id]);
ok(ranked[0].build.id === picks[2].build.id && ranked[1].build.id === picks[0].build.id, "the picker ranks favourites first, then by reading");
const commando = { faction: "bots", mission: "Commando: Extract Intel", difficulty: 7, squad: 4 };
const why = drop.suggestBuilds(all, commando, { limit: 40 }).map((p) => drop.whyFor(p.reading)).filter(Boolean);
ok(why.length > 0 && why.every((w) => typeof w.text === "string" && w.text.length > 10), "a suggestion says why in a rule's own words");

/* ------------------------------------------------------------------ */
/* What you dropped with                                               */
/* ------------------------------------------------------------------ */
const entry = history.entryFor(sample, { faction: "bots", planet: "Merga IV", mission: "Commando: Extract Intel", difficulty: 7, squad: 2 }, "2026-10-01T20:00:00.000Z");
ok(entry.items.length > 0 && entry.items.includes(sample.primary) && entry.planet === "Merga IV", "an entry keeps what the build held, not only its id");
const later = history.entryFor(sample, { faction: "bots" }, "2026-10-02T20:00:00.000Z");
const cleaned = history.cleanHistory([later, "junk", { id: "x" }, entry]);
ok(cleaned.length === 2 && cleaned[0].id === entry.id, "junk is dropped and the rest sorted oldest first");
ok(history.mergeHistory([entry], [entry, later]).length === 2, "merging two histories keeps every drop once");
const use = history.usageOf(cleaned, sample.id);
ok(use.count === 2 && use.last === later.at, "how often and how lately a build was dropped with");
ok(history.itemsDroppedWith(cleaned, "bugs").size === 0 && history.itemsDroppedWith(cleaned, "bots").has(sample.primary), "what you have carried is counted per front");
const many = Array.from({ length: history.HISTORY_CAP + 5 }, (_, i) => history.entryFor(sample, {}, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()));
ok(history.cleanHistory(many).length === history.HISTORY_CAP, `the history keeps the newest ${history.HISTORY_CAP}`);
ok(drop.cleanDrop({ logged: { id: entry.id, at: entry.at } }).logged.id === entry.id && drop.cleanDrop({ logged: 5 }).logged === null,
  "the drop remembers the entry its last Confirm wrote, and nothing else");

/* ------------------------------------------------------------------ */
/* A build in a link                                                   */
/* ------------------------------------------------------------------ */
const code = share.shareCode({ ...sample, name: "Füsilier ✦ build", blurb: "Bring the Quasar." });
ok(/^[A-Za-z0-9_-]+$/.test(code) && code.length < 1200, `a link code is plain URL characters (${code.length} of them)`);
const opened = share.readShareCode(code);
ok(opened && opened.primary === sample.primary && opened.strats.join() === sample.strats.join() && opened.faction === sample.faction,
  "a shared build opens with every slot intact");
ok(opened.name === "Füsilier ✦ build" && opened.blurb === "Bring the Quasar.", "names and notes survive any characters");
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
ok(share.readShareCode(enc({ v: 1, n: "x", f: "evil" })) === null, "a link naming a front that does not exist opens nothing");
const hostile = share.readShareCode(enc({ v: 1, n: "x", f: "bots", p: "orbital-laser", t: ["<img>", "orbital-laser"], d: ["high", "nonsense"], m: ["hot", "lava"] }));
ok(hostile && hostile.primary === null && hostile.strats[0] === null && hostile.strats[1] === "orbital-laser" && hostile.diff.join() === "high" && hostile.biomes.join() === "hot",
  "a hostile link keeps only items in their right slots and values the tool knows");
ok(share.readShareCode("") === null && share.readShareCode("!!!") === null && share.readShareCode("x".repeat(5000)) === null && share.readShareCode("abcd") === null,
  "a mangled link opens nothing and throws nothing");

/* ------------------------------------------------------------------ */
/* What your builds cover                                              */
/* ------------------------------------------------------------------ */
const cov = coverage.coverage(all);
const row = (front, id) => cov[front].find((r) => r.situation.id === id);
ok(row("bots", "commando").scenario && row("bots", "commando").scenario.mission.startsWith("Commando"), "Commando is read on the Automaton front, with a real Commando mission");
ok(row("bugs", "commando").standing === "absent" && row("squids", "commando").standing === "absent", "and is absent where the game never offers it");
ok(["bots", "bugs", "squids"].every((f) => !row(f, "hot").best || !row(f, "hot").best.build.heat), "a hot planet's best build never vents heat");
const solo = row("bots", "solo-top");
const soloBest = drop.rankByReading(drop.dropPool(all, solo.scenario).shown, solo.scenario).filter((r) => r.reading.score !== null)[0];
ok(solo.best && solo.best.build.id === soloBest.build.id, "a row's best is the top reading for that situation");
const none = coverage.coverage([], {});
ok(none.bots.every((r) => r.standing === "gap" || r.standing === "absent"), "with no builds every situation is a gap, and says so");
const counts = ["bots", "bugs", "squids"].map((f) => `${f} ${cov[f].filter((r) => r.standing === "covered").length}/${cov[f].filter((r) => r.standing !== "absent").length}`);
console.log(`  the presets cover: ${counts.join(", ")}`);
