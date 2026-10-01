/* ================================================================== */
/* PLANET ART                                                         */
/*                                                                    */
/*   npm run planet-art                    report what is there       */
/*   npm run planet-art -- --write         fetch the small copies     */
/*   npm run planet-art -- --write --full  and the full size ones     */
/*                                                                    */
/* The planet renders the game shows on its galaxy map, from          */
/* helldivers.wiki.gg, where each planet has a file named             */
/* "<Planet> Planet Icon.png", about 700 pixels square. The curator   */
/* asked for them on 30 September 2026.                               */
/*                                                                    */
/* Two copies of each, both gitignored, because this is extracted     */
/* game art like the item images. The full size set measured 374 MB   */
/* on 30 September 2026, so it is only fetched when asked for:        */
/*                                                                    */
/*   Image Library/Planets/Originals/planet_<slug>.png   full size    */
/*   Image Library/Planets/planet_<slug>.png             128 pixels   */
/*                                                                    */
/* The small one is what the map draws, cut by the wiki's own         */
/* thumbnailer so this needs no image library of its own. Art is      */
/* painted at the size it is displayed. npm run images copies the     */
/* small ones into src/assets/planets like every other kind of art.   */
/*                                                                    */
/* Polite on purpose: one file at a time, and a file already on disk  */
/* is never fetched again. Nothing in the tool depends on any of it:  */
/* a planet with no render is drawn the way it was before.            */
/* ================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SMALL = join(ROOT, "Image Library", "Planets");
const FULL = join(SMALL, "Originals");
const API = "https://helldivers.wiki.gg/api.php";
const AGENT = "dds (community loadout tool; dds.stigly-official.workers.dev)";
const WIDTH = 128;
const WRITE = process.argv.includes("--write");
const FULL_TOO = process.argv.includes("--full");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity;
})();

/* The same slug the rest of the art uses, so a file identifies itself. */
export const slug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const planets = JSON.parse(readFileSync(join(ROOT, "src", "data", "planets.json"), "utf8")).planets;

/* The wiki names the file after the planet as the game writes it. The
   placeholders and Void entries have no render and are not asked for. */
const wanted = planets
  .filter((p) => !/\((Void|Unused)\)/.test(p.name) && p.sector !== "TBD")
  .map((p) => ({ name: p.name, file: `File:${p.name} Planet Icon.png`, slug: slug(p.name) }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function info(batch) {
  const params = new URLSearchParams({
    action: "query", format: "json", prop: "imageinfo", iiprop: "url|size|mime",
    iiurlwidth: String(WIDTH), titles: batch.map((b) => b.file).join("|"),
  });
  const res = await fetch(`${API}?${params}`, { headers: { "user-agent": AGENT } });
  if (!res.ok) throw new Error(`imageinfo answered ${res.status}`);
  const doc = await res.json();
  /* The API normalises titles (underscores, capitals), so map back. */
  const normal = new Map((doc.query.normalized || []).map((n) => [n.to, n.from]));
  const out = new Map();
  for (const page of Object.values(doc.query.pages || {})) {
    const asked = normal.get(page.title) || page.title;
    const ii = page.imageinfo && page.imageinfo[0];
    if (ii) out.set(asked, ii);
  }
  return out;
}

async function download(url, path) {
  const res = await fetch(url, { headers: { "user-agent": AGENT } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf.length;
}

const found = [];
const missing = [];
for (let i = 0; i < wanted.length; i += 50) {
  const batch = wanted.slice(i, i + 50);
  const got = await info(batch);
  for (const w of batch) {
    const ii = got.get(w.file);
    if (ii && ii.url) found.push({ ...w, url: ii.url, thumb: ii.thumburl || ii.url, width: ii.width, bytes: ii.size });
    else missing.push(w.name);
  }
  await sleep(300);
}

const totalMb = found.reduce((n, f) => n + (f.bytes || 0), 0) / 1024 / 1024;
console.log(`\n  ${found.length} of ${wanted.length} planets have a render on the wiki, ${totalMb.toFixed(0)} MB at full size`);
if (missing.length) console.log(`  no render found for ${missing.length}: ${missing.join(", ")}`);

if (!WRITE) {
  console.log("\n  Nothing downloaded. Add -- --write to fetch them.\n");
  process.exit(0);
}

mkdirSync(FULL, { recursive: true });
let fetched = 0;
let skipped = 0;
let bytes = 0;
for (const f of found.slice(0, ONLY)) {
  const small = join(SMALL, `planet_${f.slug}.png`);
  const full = join(FULL, `planet_${f.slug}.png`);
  if (existsSync(small) && (!FULL_TOO || existsSync(full))) {
    skipped += 1;
    continue;
  }
  try {
    if (!existsSync(small)) bytes += await download(f.thumb, small);
    if (FULL_TOO && !existsSync(full)) bytes += await download(f.url, full);
    fetched += 1;
    if (fetched % 25 === 0) console.log(`  ${fetched} fetched`);
  } catch (e) {
    console.log(`  ${f.name}: ${e.message}`);
  }
  await sleep(150);
}
console.log(`\n  ${fetched} fetched, ${skipped} already here, ${(bytes / 1024 / 1024).toFixed(1)} MB written`);
console.log("  Run npm run images to bring the small ones into the app.\n");
