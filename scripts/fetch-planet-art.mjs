/* ================================================================== */
/* PLANET ART                                                         */
/*                                                                    */
/*   npm run planet-art                    report what is there       */
/*   npm run planet-art -- --write         fetch the small copies     */
/*   npm run planet-art -- --write --full  and the full size ones,    */
/*                                         then cut the map's copies  */
/*   npm run planet-art -- --cut           cut them again, offline    */
/*   npm run planet-art -- --cut --force   and every one, not only    */
/*                                         the ones that changed      */
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
const FORCE = process.argv.includes("--force");
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

/* Half the wiki's "originals" are not renders at all. Checked on 1
   October 2026: 133 of 271 are 48 to 85 pixel crops of the game's own
   galaxy map, and five more are full size on a solid ground, 138 with no
   transparency between them. Drawn as they are, each sits in a dark
   square. So an original with no alpha is cut round: a soft edged circle,
   and the dark ground keyed out of its outer ring only, so a planet's own
   night side is left alone. It is never enlarged either; a 48 pixel crop
   blown up to 256 is blur, not detail. */
async function opaqueToRound(sharp, from) {
  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const at = (x, y) => (y * W + x) * 4;
  /* The ground's colour, from the four corners. */
  const ground = [0, 0, 0];
  const corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]];
  for (const [x, y] of corners) for (let c = 0; c < 3; c += 1) ground[c] += data[at(x, y) + c] / corners.length;
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const R = Math.min(W, H) / 2;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = at(x, y);
      const d = Math.hypot(x - cx, y - cy) / R;
      const edge = Math.max(0, Math.min(1, (1 - d) / 0.08));
      const off = Math.max(Math.abs(data[i] - ground[0]), Math.abs(data[i + 1] - ground[1]), Math.abs(data[i + 2] - ground[2]));
      const key = d > 0.62 ? Math.max(0, Math.min(1, (off - 6) / 22)) : 1;
      data[i + 3] = Math.round(255 * edge * key);
    }
  }
  /* Trimmed to the planet, so it fills its frame the way a real render
     does and is not drawn smaller than its neighbours on the map. */
  const round = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(await sharp(round).trim({ threshold: 1 }).png().toBuffer());
}

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
  let rounded = 0;
  for (const name of readdirSync(FULL).filter((n) => /^planet_.+\.png$/i.test(n))) {
    const from = join(FULL, name);
    const to = join(SMALL, name.replace(/\.png$/i, ".webp"));
    if (!FORCE && existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) {
      kept += 1;
      continue;
    }
    const meta = await sharp(from).metadata();
    const source = meta.hasAlpha ? sharp(from) : await opaqueToRound(sharp, from);
    if (!meta.hasAlpha) rounded += 1;
    /* Sized from the source: a small crop is doubled with a sharp filter
       rather than padded out to the full cut, which would leave the planet
       a quarter of the size of every other one on the map. */
    const side = Math.min(CUT, 2 * Math.max(meta.width, meta.height));
    const buf = await source
      .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
      .webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
    writeFileSync(to, buf);
    made += 1;
    bytes += buf.length;
  }
  console.log(`  ${made} cut at up to ${CUT} pixels, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${kept} already cut`);
  if (rounded) console.log(`  ${rounded} had no transparency, a crop of the game's map rather than a render, and were cut round`);
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
