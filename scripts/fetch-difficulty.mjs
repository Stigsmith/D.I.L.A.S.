/* ================================================================== */
/* WHAT EACH DIFFICULTY BRINGS                                        */
/*                                                                    */
/* Reads the table on the wiki's Difficulty page into                 */
/* src/data/difficulty.json: per level, the missions in an operation, */
/* the medals, the objectives, how many outposts and of what size,    */
/* what the level introduces, and the reward multiplier. The war      */
/* room's difficulty bar says one line of it per level.               */
/*                                                                    */
/* Its own script rather than a fourth pull in fetch-wiki.mjs,        */
/* because that one restamps planets and enemies on every write, and  */
/* this page changes on a different clock.                            */
/*                                                                    */
/* The enemy columns are deliberately not read. Each enemy article    */
/* already says the level it starts at, and enemies.json carries      */
/* that per front; the table lists them in unlabelled paragraphs that */
/* skip a front with nothing new, so which front a name belongs to    */
/* is a guess here and a fact there.                                  */
/*                                                                    */
/* Reports by default, applies with --write, re-pulls with --refresh, */
/* the same discipline as fetch-wiki.mjs. The page is cached in       */
/* .wiki-cache so a re-run is offline.                                */
/*                                                                    */
/* helldivers.wiki.gg is CC BY-NC-SA 4.0, and the file says so.       */
/* ================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "difficulty.json");
const CACHE = join(ROOT, ".wiki-cache");
const CACHED = join(CACHE, "difficulty.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");

const PAGE = "https://helldivers.wiki.gg/index.php?title=Difficulty&action=raw";

/* The columns as the wiki heads them, in order. The parse refuses a
   table whose header has moved, rather than reading the wrong column. */
const COLUMNS = [
  "#", "Difficulty", "Missions per Operation", "Medal Rewards Per Mission", "Objectives", "Outposts",
  "New Enemies", "New Structures", "New Main Objectives", "New Side Objectives", "Miscellaneous Notes", "Multiplier",
];

async function page() {
  mkdirSync(CACHE, { recursive: true });
  if (!REFRESH && existsSync(CACHED)) return JSON.parse(readFileSync(CACHED, "utf8")).text;
  const res = await fetch(PAGE, { headers: { "user-agent": "dds (community loadout tool)" } });
  if (!res.ok) throw new Error(`Difficulty: ${res.status} ${res.statusText}`);
  const text = await res.text();
  writeFileSync(CACHED, JSON.stringify({ fetchedAt: new Date().toISOString(), text }));
  console.log(`  pulled the Difficulty page, ${(text.length / 1024).toFixed(0)}KB`);
  return text;
}

/* Wiki markup down to the words a reader sees. */
const plain = (s) => s
  .replace(/<sup>[^<]*<\/sup>/g, "")
  .replace(/<br\s*\/?>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
  .replace(/'''?/g, "")
  .replace(/²/g, "2")
  .replace(/[ \t]+/g, " ")
  .trim();

const paragraphs = (s) => plain(s).split(/\n+/).map((x) => x.trim()).filter(Boolean);

/* "3-5" or "4", as written. Ranges stay strings, because "1-3" is what
   the wiki knows and turning it into a number would invent one. */
const RANGE = /^(\d+(?:-\d+)?)$/;

/* The table's rows, each a list of its cells with the empty ones kept:
   an empty cell is a column with nothing new, and dropping it shifts
   every column after it. */
function table(text) {
  const start = text.indexOf('{| class="wikitable"');
  const end = text.indexOf("\n|}", start);
  if (start < 0 || end < 0) throw new Error("no wikitable on the Difficulty page");
  const rows = text.slice(start, end).split("\n|-").map((r) => {
    const cells = [];
    for (const line of r.split("\n")) {
      if (line.startsWith("{|") || line.startsWith("|+")) continue;
      if (line.startsWith("!") || line.startsWith("|")) cells.push(line.slice(1));
      else if (cells.length) cells[cells.length - 1] += "\n" + line;
    }
    return cells.map((c) => c.trim());
  });
  return rows;
}

function parse(text) {
  const [head, ...rows] = table(text);
  const names = head.map((h) => plain(h));
  if (names.join("|") !== COLUMNS.join("|")) {
    throw new Error(`the Difficulty table's columns moved:\n    ${names.join(" | ")}`);
  }
  const col = (name) => COLUMNS.indexOf(name);

  const levels = rows.map((cells) => {
    if (cells.length !== COLUMNS.length) {
      throw new Error(`a row with ${cells.length} cells, not ${COLUMNS.length}: ${cells[0]}`);
    }
    const level = Number(plain(cells[col("#")]));
    const missions = Number(plain(cells[col("Missions per Operation")]));

    const medalText = plain(cells[col("Medal Rewards Per Mission")]);
    const perMission = (medalText.split(/Total/)[0].match(/\d+/g) || []).map(Number);
    const total = Number((medalText.match(/Total:\s*(\d+)/) || [])[1]);

    const objText = plain(cells[col("Objectives")]);
    const main = (objText.match(/Main:\s*([\d-]+)/) || [])[1] || null;
    const optional = (objText.match(/Optional:\s*([\d-]+)/) || [])[1] || null;

    const outposts = { total: null, light: null, medium: null, heavy: null, giant: null };
    for (const p of paragraphs(cells[col("Outposts")])) {
      const m = p.match(/^([\d-]+)\s+(Total|Light|Medium|Heavy|Giant)$/i);
      if (m && RANGE.test(m[1])) outposts[m[2].toLowerCase()] = m[1];
    }

    const notes = paragraphs(cells[col("Miscellaneous Notes")]);
    const mapLine = notes.find((n) => /Map size/i.test(n));
    const mapRadius = mapLine ? Number((mapLine.match(/(\d+)-meter radius/) || [])[1]) || null : null;
    /* What the level brings that the one below did not, in the wiki's
       words, minus the map size, which is its own field. */
    const introduces = notes.filter((n) => n !== mapLine).map((n) => n.replace(/\.$/, ""));

    const multiplier = Number((plain(cells[col("Multiplier")]).match(/(\d+)%/) || [])[1]);

    return { level, missions, medals: { perMission, total }, objectives: { main, optional }, outposts, mapRadius, introduces, multiplier };
  });

  /* Refuse a parse that does not add up, rather than ship it. */
  const wrong = [];
  if (levels.length !== 10) wrong.push(`${levels.length} levels, not 10`);
  levels.forEach((l, i) => {
    if (l.level !== i + 1) wrong.push(`row ${i + 1} says level ${l.level}`);
    if (!Number.isFinite(l.missions) || l.missions < 1) wrong.push(`level ${l.level}: missions per operation`);
    if (l.medals.perMission.length !== l.missions) wrong.push(`level ${l.level}: ${l.medals.perMission.length} medal figures for ${l.missions} missions`);
    if (l.medals.perMission.reduce((a, b) => a + b, 0) !== l.medals.total) wrong.push(`level ${l.level}: medals do not add up to ${l.medals.total}`);
    if (!l.objectives.main) wrong.push(`level ${l.level}: no main objective count`);
    if (!Number.isFinite(l.multiplier)) wrong.push(`level ${l.level}: no multiplier`);
  });
  if (wrong.length) throw new Error("the Difficulty table did not read cleanly:\n    " + wrong.join("\n    "));

  /* What carries up from below. The map stops growing at 4 and says so
     by saying nothing; a later level keeps the last size stated. */
  let radius = null;
  for (const l of levels) {
    if (l.mapRadius) radius = l.mapRadius;
    else l.mapRadius = radius;
  }

  /* Two facts the effects list states outright, cross-checked against the
     table's notes so a change to one without the other is caught. */
  const said = (re) => levels.find((l) => l.introduces.some((n) => re.test(n)));
  const checks = {
    "operation modifiers start at 5": (said(/Introduces Operation Modifiers/i) || {}).level === 5,
    "a second modifier at 8": (said(/second Operation Modifier/i) || {}).level === 8,
    "rare samples from 4": (said(/Rare Samples/i) || {}).level === 4,
    "super samples from 6": (said(/Super Samples/i) || {}).level === 6,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) throw new Error("the Difficulty page no longer says: " + failed.join(", "));

  return levels;
}

async function main() {
  console.log("\n  Difficulty. Source: helldivers.wiki.gg, CC BY-NC-SA 4.0.\n");
  const levels = parse(await page());

  for (const l of levels) {
    const out = Object.entries(l.outposts).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ") || "none";
    console.log(`  ${String(l.level).padStart(2)}  ${l.missions} missions, ${String(l.medals.total).padStart(2)} medals, ` +
      `+${l.multiplier}%, outposts ${out}${l.introduces.length ? "\n        " + l.introduces.join("\n        ") : ""}`);
  }

  const doc = {
    source: "helldivers.wiki.gg, Difficulty",
    sourceUrl: "https://helldivers.wiki.gg/wiki/Difficulty",
    licence: "CC BY-NC-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0",
    note: "Generated by scripts/fetch-difficulty.mjs from the table on the wiki's Difficulty page. Never edit by hand: a re-fetch overwrites it. Ranges are kept as the wiki writes them. The enemy columns are not read; enemies.json carries the level each enemy starts at, per front.",
    levels,
  };

  const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const same = before && JSON.stringify(before.levels) === JSON.stringify(levels);
  if (!WRITE) {
    console.log(`\n  ${before ? (same ? "No change to" : "Would change") : "Would create"} src/data/difficulty.json. Re-run with --write to apply.\n`);
    return;
  }
  if (same) {
    console.log("\n  src/data/difficulty.json is already current.\n");
    return;
  }
  /* Written in place: a sync app watches this folder and renames a file
     that is replaced rather than rewritten. writeFileSync truncates. */
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log("\n  Written: src/data/difficulty.json\n");
}

main().catch((e) => {
  console.error("\n  " + e.message + "\n");
  process.exit(1);
});
