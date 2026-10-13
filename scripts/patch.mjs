/* ================================================================== */
/* WHEN THE GAME PATCHES                                              */
/*                                                                    */
/*   npm run patch                      report what a patch changed   */
/*   npm run patch -- --refresh         ask the sources again first   */
/*   npm run patch -- --refresh --write and apply it                  */
/*                                                                    */
/* One command for the day Arrowhead ships a patch or a warbond. It   */
/* runs every data fetch in order, each in its own report mode, then  */
/* asks the questions no single fetch asks: gear and missions the     */
/* wiki has and the tool does not, a biome or hazard no rule reads,   */
/* planets with no render, a new war season, how old the ratings      */
/* are. With --write it applies every fetch, measures how many tier   */
/* rows moved, and builds.                                            */
/*                                                                    */
/* It copies no logic. Every fetch and check is the existing script,  */
/* run as its own process, and the tiers are measured by the app's    */
/* own score.js through scripts/lib/app.mjs.                          */
/*                                                                    */
/* It never writes a rating, a tag, a note or a mission trait. What   */
/* needs the curator is listed at the end under Needs you.            */
/*                                                                    */
/* The whole report is also saved to .patch-report.txt.               */
/* ================================================================== */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slug } from "./lib/slug.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");
const FRONTS = ["bots", "bugs", "squids"];

/* ------------------------------------------------------------------ */
/* Measuring mode: the patch runs itself as a child to read the tiers, */
/* so the numbers come from the data files as they are on disk now,    */
/* not as they were when this process loaded them.                     */
/* ------------------------------------------------------------------ */

if (args.includes("--measure")) {
  const { items, score } = await import("./lib/app.mjs");
  const tiers = {};
  for (const it of items.items) {
    tiers[it.id] = { slot: it.slot, name: it.name };
    for (const faction of FRONTS) {
      if (!it.ratings || !it.ratings[faction]) continue;
      /* Suicide Mission, four of you: the reading the Coverage tab uses. */
      const r = score.scoreItem(it, { faction, difficulty: 7, squad: 4 });
      tiers[it.id][faction] = r.tier;
    }
  }
  const rr = items.statsFor("gr-8-recoilless-rifle") || {};
  process.stdout.write(JSON.stringify({ tiers, recoilless: rr.primary || null }));
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Plumbing                                                            */
/* ------------------------------------------------------------------ */

const lines = [];
const say = (s = "") => {
  console.log(s);
  lines.push(s);
};
const quiet = (s = "") => lines.push(s);
const head = (s) => say(`\n${"=".repeat(70)}\n  ${s}\n${"=".repeat(70)}`);
const indent = (out) => out.replace(/\s+$/, "").split("\n").map((l) => "  " + l).join("\n");

function run(script, extra = []) {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", script), ...extra], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

/* A fetch: always its report, then, with --write, the write from the  */
/* cache the report just filled. The report is what gets read; most    */
/* fetches print no diff when they write.                              */
const failed = [];
function fetchStep(title, script, opts = {}) {
  head(title);
  const report = run(script, [...(opts.args || []), ...(REFRESH ? ["--refresh"] : [])]);
  say(indent(report.out));
  if (report.code !== 0) {
    say(`\n  !! ${script} stopped with an error. Its data is left as it was.`);
    failed.push(title);
    return false;
  }
  if (WRITE && !opts.reportOnly) {
    const w = run(script, [...(opts.args || []), "--write"]);
    say(indent(w.out.split("\n").slice(-4).join("\n")));
    if (w.code !== 0) {
      say(`\n  !! ${script} --write stopped with an error.`);
      failed.push(title);
      return false;
    }
  }
  return true;
}

function measure() {
  const r = run("patch.mjs", ["--measure"]);
  if (r.code !== 0) throw new Error(`measuring the tiers failed:\n${r.out}`);
  return JSON.parse(r.out);
}

const readData = (f) => readFileSync(join(DATA, f), "utf8");
const json = (f) => JSON.parse(readData(f));
const needs = [];

/* ------------------------------------------------------------------ */
/* Before                                                              */
/* ------------------------------------------------------------------ */

say(`\n  D.I.L.A.S. patch check, ${new Date().toISOString().slice(0, 10)}`);
say(`  ${WRITE ? "WRITING: every fetch is applied." : "Report only. Nothing in src/data is changed."}`);
say(`  ${REFRESH ? "Asking every source again." : "Reading the cached pulls. Add --refresh to ask the sources again."}`);

const before = WRITE ? measure() : null;
const keep = Object.fromEntries(["wiki-stats.json", "planets.json", "enemies.json"].map((f) => [f, readData(f)]));

/* ------------------------------------------------------------------ */
/* The fetches, in the order CLAUDE.md gives                           */
/* ------------------------------------------------------------------ */

head("Roles (tag-roles)");
{
  if (WRITE) run("tag-roles.mjs", ["--write"]);
  const r = run("tag-roles.mjs");
  const zero = /\b0 rows would change/.test(r.out);
  say(zero ? "  Roles agree with the items. 0 rows would change." : indent(r.out));
  if (!zero) {
    failed.push("Roles");
    if (!WRITE) needs.push("Roles are out of date. The --write run applies them.");
  }
}

fetchStep("Wiki: weapon stats, planets, enemies (npm run wiki)", "fetch-wiki.mjs");

/* The trap: the wiki write restamps all three files even when only the */
/* date moved. Put the old file back, in place.                         */
if (WRITE) {
  for (const [f, old] of Object.entries(keep)) {
    const now = readData(f);
    if (now === old) continue;
    const strip = (t) => { const d = JSON.parse(t); delete d.fetchedAt; return JSON.stringify(d); };
    if (strip(now) === strip(old)) {
      writeFileSync(join(DATA, f), old);
      say(`  ${f}: only the date moved, so the old file is kept.`);
    }
  }
}

fetchStep("Game tables: weapon numbers from filediver (npm run game)", "fetch-game.mjs");
fetchStep("Armour sets (npm run armor)", "fetch-armor.mjs");
fetchStep("Missions: time limits, and missions the tool lacks (npm run missions)", "fetch-missions.mjs");
fetchStep("Difficulty table (npm run difficulty)", "fetch-difficulty.mjs");
fetchStep("War effects on the map right now (npm run effects)", "war-effects.mjs", { reportOnly: true });
fetchStep("Planet renders on the wiki (npm run planet-art)", "fetch-planet-art.mjs", { reportOnly: true });

/* ------------------------------------------------------------------ */
/* What no single fetch asks                                           */
/* ------------------------------------------------------------------ */

head("Checks across the data");

const after = measure();

/* The Recoilless reads its rocket, never its backblast. */
{
  const p = after.recoilless;
  const ok = p && Array.isArray(p.ap) && p.ap[0] === 6 && p.durableRatio === 1;
  say(`  Recoilless spot check: ${ok ? "AP 6, 100% durable. Right." : `WRONG, reads ${JSON.stringify(p)}. The wiki fetch picked the wrong attack.`}`);
  if (!ok) failed.push("Recoilless spot check");
}

/* Gear the wiki has and the tool does not, from the wiki report above. */
const wikiOut = lines.join("\n");
const newGear = (wikiOut.match(/NOT IN THE TOOL \d+  \(on the wiki, matched[^\n]*\n((?: {4}.+\n?)*)/) || [, ""])[1]
  .split("\n").map((l) => l.trim()).filter(Boolean);
const newMissions = (wikiOut.match(/NOT IN THE TOOL \d+  \(on the wiki's mission list[^\n]*\n((?: {4}.+\n?)*)/) || [, ""])[1]
  .split("\n").map((l) => l.trim()).filter(Boolean);
const misses = (wikiOut.match(/UNEXPECTED MISSES[^\n]*\n((?: {4}.+\n?)*)/) || [, ""])[1]
  .split("\n").map((l) => l.trim()).filter(Boolean);
say(`  Gear on the wiki, not in the tool: ${newGear.length ? newGear.join(", ") : "none"}`);
say(`  Items the wiki fetch could not match: ${misses.length ? misses.map((m) => m.split(/\s{2,}/)[1] || m).join(", ") : "none"}`);
say(`  Missions on the wiki, not in the tool: ${newMissions.length ? newMissions.join(", ") : "none"}`);
if (newGear.length) needs.push(`New gear to add to items.json (id, slot, warbond, damage type; rating left as ?): ${newGear.join(", ")}`);
if (misses.length) needs.push(`Items the wiki no longer matches by name, each wants an override in fetch-wiki.mjs or an alias: ${misses.map((m) => m.split(/\s{2,}/)[1] || m).join(", ")}`);
if (newMissions.length) needs.push(`New missions: their fronts and traits in missions.json, then npm run missions -- --write: ${newMissions.join(", ")}`);

/* Held weapons the game tables cannot reach. */
{
  const items = json("items.json");
  const ids = json("../../scripts/data/game-ids.json").map;
  const held = items.filter((i) => (i.slot === "primary" || i.slot === "secondary") && !/^CQC-/.test(i.name));
  const unjoined = held.filter((i) => !(i.id in ids));
  say(`  Primaries and sidearms with no game table row: ${unjoined.length} of ${held.length}`);
  quiet(`    ${unjoined.map((i) => i.id).join(", ")}`);
  const fresh = items.filter((i) => i.flag === "new");
  if (fresh.length) {
    say(`  Items marked new, waiting on a rating: ${fresh.map((i) => i.name).join(", ")}`);
    needs.push(`Ratings, notes and tags for items marked new: ${fresh.map((i) => i.name).join(", ")}`);
  }
  const freshUnjoined = fresh.filter((i) => unjoined.includes(i));
  if (freshUnjoined.length) needs.push(`New weapons with no row in scripts/data/game-ids.json, so no game numbers: ${freshUnjoined.map((i) => i.name).join(", ")}`);
}

/* A biome or hazard nothing in the tool has an opinion about. */
{
  const planets = json("planets.json");
  const vocab = json("vocabulary.json");
  const terrain = vocab.terrain.biomes || {};
  const used = new Set(planets.planets.map((p) => p.biome).filter(Boolean));
  const noTerrain = [...used].filter((b) => !(b in terrain)).sort();
  const ruleText = readData("context-rules.json") + readData("build-rules.json");
  const scenarioSrc = readFileSync(join(ROOT, "src", "lib", "scenario.js"), "utf8");
  const dropSrc = readFileSync(join(ROOT, "src", "lib", "drop.js"), "utf8");
  const hazards = new Set(planets.planets.flatMap((p) => p.hazards));
  const unread = [...hazards].filter((h) => !ruleText.includes(`"${h}"`) && !scenarioSrc.includes(`"${h}"`) && !dropSrc.includes(`"${h}"`)).sort();
  say(`  Biomes with no row in the terrain table: ${noTerrain.length ? noTerrain.join(", ") : "none"}`);
  say(`  Hazards no rule or gate reads: ${unread.length ? unread.join(", ") : "none"}`);
  if (noTerrain.length) needs.push(`Terrain rows in vocabulary.json for: ${noTerrain.join(", ")}`);
  if (unread.length) needs.push(`Hazards nothing reads yet. Decide whether each moves a rating or gates builds: ${unread.join(", ")}`);

  const days = Math.round((Date.now() - Date.parse(planets.fetchedAt)) / 86400000);
  say(`  Planet table fetched ${planets.fetchedAt}, ${days} days ago.`);
  if (days > 30 && !WRITE) needs.push(`The planet table is ${days} days old. npm run patch -- --refresh --write brings it up to date.`);

  const lib = join(ROOT, "Image Library", "Planets");
  if (existsSync(lib)) {
    const have = new Set(readdirSync(lib));
    /* The planets the art fetch asks for (fetch-planet-art.mjs leaves the */
    /* unused and void entries out), less those the wiki has no render of. */
    const noWiki = new Set(((wikiOut.match(/no render found for \d+: ([^\n]+)/) || [])[1] || "").split(", ").map((n) => n.toUpperCase()));
    const bare = planets.planets
      .filter((p) => !/\((Void|Unused)\)/.test(p.name) && p.sector !== "TBD")
      .filter((p) => !noWiki.has(p.name.toUpperCase()))
      .filter((p) => !have.has(`planet_${slug(p.name)}.webp`)).map((p) => p.name);
    say(`  Planets with no render in the library: ${bare.length ? `${bare.length} (${bare.slice(0, 8).join(", ")}${bare.length > 8 ? " and more" : ""})` : "none"}`);
    if (bare.length) needs.push(`Renders for ${bare.length} planet(s): npm run planet-art -- --write --full, then npm run images.`);
  }
}

/* Unnamed war effects, from the effects list above. */
{
  const m = wikiOut.match(/(\d+) of (\d+) named or marked hidden/);
  if (m && m[1] !== m[2]) {
    const ids = [...wikiOut.matchAll(/^ +(\d+) +UNNAMED +.*?(\d+) · (.+)$/gm)].map((x) => `${x[1]} (on ${x[3]})`);
    say(`  War effects with no name: ${ids.join("; ")}`);
    needs.push(`War effect numbers with no name, ${ids.map((s) => s.split(" ")[0]).join(", ")}: their words from the game's planet card, in war-effects.json (and subfactions.json if one is a subfaction).`);
  }
}

/* A new war season leaves the map uncoloured until WAR_ID follows it. */
{
  const ours = Number((readFileSync(join(ROOT, "worker", "war.ts"), "utf8").match(/WAR_ID = (\d+)/) || [])[1]);
  try {
    const res = await fetch("https://api.helldivers2.dev/raw/api/WarSeason/current/WarID", {
      headers: { accept: "application/json", "x-super-client": "dilas.me", "x-super-contact": "https://dilas.me" },
    });
    const live = res.ok ? (await res.json()).id : null;
    say(`  War season: the game is on ${live ?? "unknown"}, the tool reads ${ours}.`);
    if (live && live !== ours) needs.push(`A new war season (${live}). WAR_ID in worker/war.ts and scripts/war-effects.mjs must follow, or the map goes uncoloured.`);
  } catch {
    say(`  War season: could not ask. The tool reads ${ours}.`);
  }
}

/* The ratings are read by hand, and only the curator knows the patch date. */
{
  const snaps = readdirSync(join(ROOT, "scripts", "data")).filter((f) => /^ugg-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const last = snaps.at(-1);
  const patchSrc = readFileSync(join(ROOT, "src", "lib", "patch.js"), "utf8");
  const game = (patchSrc.match(/game: "([^"]+)"/) || [])[1];
  const gameDate = (patchSrc.match(/gameDate: "([^"]+)"/) || [])[1];
  say(`  Ratings last read from u.gg: ${last ? last.slice(4, 14) : "never"}. The tool says the game is on ${game}, ${gameDate}.`);
  needs.push(`If Arrowhead's patch is newer than ${game}: read u.gg into scripts/data/ugg-<date>.json, apply it with a copy of apply-ugg-7-1.mjs, then restamp src/lib/patch.js.`);
}

/* ------------------------------------------------------------------ */
/* How many rows moved                                                 */
/* ------------------------------------------------------------------ */

head("Tier rows that moved (Suicide Mission, four of you)");
if (!before) {
  say("  Measured only when writing: nothing has changed yet. The --write run counts them.");
} else {
  const moved = [];
  for (const [id, t] of Object.entries(after.tiers)) {
    const b = before.tiers[id];
    for (const f of FRONTS) if (b && b[f] !== t[f]) moved.push({ id, name: t.name, slot: t.slot, f, from: b[f] ?? "?", to: t[f] ?? "?" });
  }
  const added = Object.keys(after.tiers).filter((id) => !before.tiers[id]);
  say(`  ${moved.length} row(s) changed tier across the three fronts.${added.length ? ` ${added.length} item(s) are new.` : ""}`);
  const bySlot = {};
  for (const m of moved) bySlot[`${m.slot} ${m.f}`] = (bySlot[`${m.slot} ${m.f}`] || 0) + 1;
  for (const [k, n] of Object.entries(bySlot).sort()) say(`    ${k.padEnd(22)} ${n}`);
  for (const m of moved) say(`    ${m.f.padEnd(7)} ${m.name.padEnd(40)} ${m.from} -> ${m.to}`);
}

/* ------------------------------------------------------------------ */
/* The tool's own checks                                               */
/* ------------------------------------------------------------------ */

head("The tool's own checks");
const checks = [
  ["validate", "validate.mjs"],
  ["rules", "check-rules.mjs"],
  ["builds", "check-builds.mjs"],
  ["drop", "check-drop.mjs"],
  ["map", "check-map.mjs"],
];
for (const [name, script] of checks) {
  const r = run(script);
  say(`  ${name.padEnd(9)} ${r.code === 0 ? "pass" : "FAIL"}`);
  if (r.code !== 0) {
    say(indent(r.out.split("\n").slice(-20).join("\n")));
    failed.push(`npm run ${name}`);
  }
  quiet(indent(r.out));
}
if (WRITE) {
  const b = spawnSync("npm run build", { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  say(`  build     ${b.status === 0 ? "pass" : "FAIL"}`);
  if (b.status !== 0) {
    say(indent(((b.stdout || "") + (b.stderr || "")).split("\n").slice(-20).join("\n")));
    failed.push("npm run build");
  }
} else {
  say("  build     not run in a report");
}

/* ------------------------------------------------------------------ */
/* Needs you                                                           */
/* ------------------------------------------------------------------ */

head("Needs you");
if (failed.length) say(`  Stopped or failed: ${failed.join("; ")}. Read those sections first.\n`);
for (const n of needs) say(`  - ${n}`);
if (WRITE) say("  - A line in the top changelog entry saying what the patch brought.");
say(WRITE
  ? "\n  Written. Nothing is committed, deployed or pushed.\n"
  : "\n  Report only. Run npm run patch -- --refresh --write to apply.\n");

writeFileSync(join(ROOT, ".patch-report.txt"), lines.join("\n") + "\n");
console.log("  The whole report, with every check's output, is in .patch-report.txt\n");
process.exit(failed.length ? 1 : 0);
