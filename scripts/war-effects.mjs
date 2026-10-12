/* ================================================================== */
/* THE WAR'S EFFECTS, LISTED                                          */
/*                                                                    */
/*   npm run effects                                                  */
/*                                                                    */
/* Every effect number the game has on a planet right now, how many   */
/* planets carry it and which, and its name from                      */
/* src/data/war-effects.json, or that it has none yet. Reports only:  */
/* naming one is an edit to that file, by the curator, from the       */
/* game's own map. Two requests to api.helldivers2.dev, the same      */
/* service the Worker reads, naming the tool as it does.              */
/* ================================================================== */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const table = JSON.parse(readFileSync(join(ROOT, "src", "data", "war-effects.json"), "utf8")).effects;
const subfactions = JSON.parse(readFileSync(join(ROOT, "src", "data", "subfactions.json"), "utf8")).subfactions;
/* Which subfaction each number means, from subfactions.json. */
const forceOf = new Map(Object.entries(subfactions).flatMap(([key, s]) => s.effects.map((n) => [n, key])));
const UPSTREAM = "https://api.helldivers2.dev";
const WAR_ID = 801;
const headers = { accept: "application/json", "x-super-client": "dilas.me", "x-super-contact": "https://dilas.me" };

const ask = async (path) => {
  const res = await fetch(UPSTREAM + path, { headers });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json();
};

const planets = await ask("/api/v1/planets");
await new Promise((r) => setTimeout(r, 2500));
const status = await ask(`/raw/api/WarSeason/${WAR_ID}/Status`);

const nameOf = new Map(planets.map((p) => [p.index, p.name]));
const by = new Map();
for (const e of status.planetActiveEffects || []) {
  if (!by.has(e.galacticEffectId)) by.set(e.galacticEffectId, new Set());
  by.get(e.galacticEffectId).add(nameOf.get(e.index) || `#${e.index}`);
}

const rows = [...by.entries()].sort((a, b) => a[1].size - b[1].size || a[0] - b[0]);
let named = 0;
console.log(`\n  ${rows.length} effect numbers on ${new Set([...by.values()].flatMap((s) => [...s])).size} planets\n`);
for (const [id, list] of rows) {
  const e = table[String(id)];
  if (e) named += 1;
  const label = e ? (e.name ? e.name + (e.from === "companion" ? " *" : "") : e.draw === "cloud" ? "(hidden, drawn as cloud)" : "(hidden)") : "UNNAMED";
  const names = [...list].sort();
  const force = forceOf.get(id);
  console.log(`  ${String(id).padEnd(6)} ${label.padEnd(34)} ${(force ? "subfaction " + force : "").padEnd(30)} ${names.length} · ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} more` : ""}`);
}
const stale = Object.keys(table).filter((id) => !by.has(Number(id)));
console.log(`\n  ${named} of ${rows.length} named or marked hidden in war-effects.json. * is the Companion's label; the game card's own words are not seen yet.`);
if (stale.length) console.log(`  Named but on no planet right now: ${stale.join(", ")}. Keep them: an effect can come back.`);
console.log("  To name one, add it to src/data/war-effects.json with the words on the game's planet card.");
const waiting = Object.entries(subfactions).filter(([, s]) => !s.effects.length).map(([key]) => key);
if (waiting.length) console.log(`  Subfactions with no number yet: ${waiting.join(", ")}. When one appears, name it in war-effects.json and add its number in subfactions.json.`);
console.log("");
