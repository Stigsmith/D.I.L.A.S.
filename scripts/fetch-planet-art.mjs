/* ================================================================== */
/* PLANET ART                                                         */
/*                                                                    */
/*   npm run planet-art                    report what is there       */
/*   npm run planet-art -- --write         fetch the small copies     */
/*   npm run planet-art -- --write --full  and the full size ones,    */
/*                                         then cut the map's copies  */
/*   npm run planet-art -- --cut           cut them again, offline    */
/*                                                                    */
/* The planet renders the game shows on its galaxy map, from          */
/* helldivers.wiki.gg, where each planet has a file named             */
/* "<Planet> Planet Icon.png", about 700 pixels square. The curator   */
/* asked for them on 30 September 2026.                               */
/*                                                                    */
/* All gitignored, because this is extracted game art like the item   */
/* images. The full size set measured 374 MB on 30 September 2026 and */
/* the curator said yes to it on 1 October:                           */
/*                                                                    */
/*   Image Library/Planets/Originals/planet_<slug>.png  1720 pixels   */
/*   Image Library/Planets/planet_<slug>.webp           256, the cut  */
/*   Image Library/Planets/planet_<slug>.png            128, the wiki */
/*                                                                    */
/* The cut is what the map draws: 256 pixels, so a render stays sharp */
/* drawn large in full screen, and as WebP about 18 KB, under half    */
/* what the 128 pixel PNG weighs. Cut here from the original with     */
/* sharp, which arrives with wrangler. Without the originals the      */
/* wiki's own 128 pixel thumbnail is the fallback, which needs no     */
/* image library at all. npm run images copies whichever is there     */
/* into src/assets/planets, the cut first.                            */
/*                                                                    */
/* Polite on purpose: one file at a time, and a file already on disk  */
/* is never fetched again. Nothing in the tool depends on any of it:  */
/* a planet with no render is drawn the way it was before.            */
/* ================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
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
const CUT_ONLY = process.argv.includes("--cut");
/* Art is painted at the size it is displayed: up to about 60 pixels on
   the map in full screen and 80 in the hover card, doubled for a sharp
   screen. */
const CUT = 256;
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

/* The map's copy of every original on disk, skipping any already cut
   since its original last changed. No network. */
async function cut() {
  if (!existsSync(FULL)) {
    console.log("  No originals here to cut. npm run planet-art -- --write --full fetches them.\n");
    return;
  }
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("  sharp is not installed, so nothing was cut. It arrives with wrangler: run npm install.\n");
    return;
  }
  let made = 0;
  let kept = 0;
  let bytes = 0;
  for (const name of readdirSync(FULL).filter((n) => /^planet_.+\.png$/i.test(n))) {
    const from = join(FULL, name);
    const to = join(SMALL, name.replace(/\.png$/i, ".webp"));
    if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) {
      kept += 1;
      continue;
    }
    const buf = await sharp(from).resize(CUT, CUT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
    writeFileSync(to, buf);
    made += 1;
    bytes += buf.length;
  }
  console.log(`  ${made} cut at ${CUT} pixels, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${kept} already cut`);
  console.log("  Run npm run images to bring them into the app.\n");
}

/* Cutting needs nothing from the wiki, so it asks it nothing. */
if (CUT_ONLY && !WRITE) {
  await cut();
  process.exit(0);
}

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
if (FULL_TOO || CUT_ONLY) await cut();
else console.log("  Run npm run images to bring the small ones into the app.\n");
