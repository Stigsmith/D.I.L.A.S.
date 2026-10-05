/* ================================================================== */
/* HOW LONG EACH MISSION GIVES YOU                                    */
/*                                                                    */
/* Reads the time limit from each mission's own wiki article, the     */
/* `time_limit_main` field of its infobox, into `minutes` on that     */
/* mission in src/data/missions.json. A rule may then ask how long    */
/* the clock is: three Orbital Lasers on a five minute cooldown all   */
/* fit an Eradicate's fifteen minutes, and do not stretch across a    */
/* forty minute operation.                                            */
/*                                                                    */
/* Its own script rather than a pull in fetch-wiki.mjs, for the       */
/* reason fetch-difficulty.mjs gives: that one restamps planets and   */
/* enemies on every write. missions.json is otherwise kept by hand,   */
/* so this touches one field per mission and nothing else.            */
/*                                                                    */
/* A mission whose article states no limit gets no `minutes`, and a   */
/* rule asking about the clock does not fire on it. That is the       */
/* honest absence; a guessed forty would not be.                      */
/*                                                                    */
/* Reports by default, applies with --write, re-pulls with --refresh. */
/* The articles are cached in .wiki-cache so a re-run is offline.     */
/*                                                                    */
/* helldivers.wiki.gg is CC BY-NC-SA 4.0, which missions.json says.   */
/* ================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "src", "data", "missions.json");
const CACHE = join(ROOT, ".wiki-cache");
const CACHED = join(CACHE, "mission-pages.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");

const API = "https://helldivers.wiki.gg/api.php";
/* The same name the other fetches give: the tool's own address. */
const HEADERS = { "user-agent": "dilas.me (https://dilas.me)" };

const BATCH = 10;

/* Missions whose article is not titled with the mission's name. */
const ARTICLE_TITLES = {
  "Blitz: Search and Destroy": "Blitz Search And Destroy/Automaton",
};
const articleFor = (name) => ARTICLE_TITLES[name] || name;

async function articles(titles) {
  mkdirSync(CACHE, { recursive: true });
  if (!REFRESH && existsSync(CACHED)) {
    const cached = JSON.parse(readFileSync(CACHED, "utf8"));
    if (titles.every((t) => t in cached.text)) return cached.text;
  }
  const text = {};
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const url = new URL(API);
    for (const [k, v] of Object.entries({
      action: "query", prop: "revisions", rvprop: "content", rvslots: "main",
      redirects: "1", format: "json", formatversion: "2", titles: batch.join("|"),
    })) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`missions ${i}: ${res.status} ${res.statusText}`);
    const doc = await res.json();
    const q = doc.query || {};
    /* A title the API normalised or followed a redirect from comes back
       under its new name, so walk both lists back to the one we asked for. */
    const asked = new Map();
    for (const n of q.normalized || []) asked.set(n.to, n.from);
    for (const r of q.redirects || []) asked.set(r.to, asked.get(r.from) || r.from);
    for (const page of q.pages || []) {
      const title = asked.get(page.title) || page.title;
      const rev = page.revisions && page.revisions[0];
      text[title] = rev && rev.slots && rev.slots.main ? rev.slots.main.content : null;
    }
    for (const t of batch) if (!(t in text)) text[t] = null;
  }
  writeFileSync(CACHED, JSON.stringify({ fetchedAt: new Date().toISOString(), text }));
  console.log(`  pulled ${titles.length} mission articles`);
  return text;
}

/* " | time_limit_main=  15 Minutes". Minutes only: every limit the wiki
   writes is a whole number of them, and anything else is refused rather
   than read as a number it is not. */
function minutesIn(text) {
  if (!text) return null;
  const m = text.match(/^[ \t]*\|[ \t]*time_limit_main[ \t]*=(.*)$/m);
  if (!m) return null;
  const hit = m[1].match(/(\d+)\s*min/i);
  return hit ? Number(hit[1]) : null;
}

const data = JSON.parse(readFileSync(FILE, "utf8"));
const text = await articles(data.missions.map((m) => articleFor(m.name)));

console.log("\n  Mission time limits. Source: helldivers.wiki.gg, CC BY-NC-SA 4.0.\n");
let changed = 0;
const none = [];
for (const m of data.missions) {
  const minutes = minutesIn(text[articleFor(m.name)]);
  if (minutes === null) none.push(m.name);
  const before = m.minutes ?? null;
  if (before !== minutes) changed += 1;
  console.log(`  ${minutes === null ? "  -" : String(minutes).padStart(3)}  ${m.name}${before !== minutes ? `   (was ${before ?? "none"})` : ""}`);
  if (minutes === null) delete m.minutes;
  else m.minutes = minutes;
}
if (none.length) console.log(`\n  ${none.length} mission(s) state no time limit, and keep none.`);

if (!changed) {
  console.log("\n  src/data/missions.json is already current.\n");
} else if (WRITE) {
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`\n  Wrote ${changed} change(s) to src/data/missions.json.\n`);
} else {
  console.log(`\n  Would change ${changed} mission(s). Re-run with --write to apply.\n`);
}
