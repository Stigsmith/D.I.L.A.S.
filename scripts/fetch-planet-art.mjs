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
const AGENT = "dilas (community loadout tool; dilas.me)";
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
/* Mars and anything else the map draws that the war does not list. */
const landmarks = JSON.parse(readFileSync(join(ROOT, "src", "data", "landmarks.json"), "utf8")).landmarks;

/* The wiki names the file after the planet as the game writes it. The
   placeholders and Void entries have no render and are not asked for. */
const wanted = [...planets, ...landmarks]
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

/* ------------------------------------------------------------------ */
/* LANDSCAPES                                                          */
/*                                                                     */
/*   npm run planet-art -- --landscapes            report              */
/*   npm run planet-art -- --landscapes --write    fetch and cut       */
/*                                                                     */
/* What the ground looks like, for the planet card in the war room.    */
/* Each planet page's infobox names a landscape shot, 3840 by 2160     */
/* and about 11 MB. Those are never fetched: the wiki's own 1280 pixel */
/* thumbnail is, and cut here to 800 by 450 WebP, about 50 KB. Into    */
/* Image Library/Planets/Landscapes:                                   */
/*                                                                     */
/*   landscape_<slug>.webp            the shot the planet page shows   */
/*   landscape_<slug>__<label>.webp   one more of the same planet,     */
/*                                    the label its caption            */
/*   biome_<biome>.webp               the biome's typical surface, for */
/*                                    a planet with no shot of its own */
/*                                                                     */
/* An infobox that names a biome's shot rather than the planet's own   */
/* gives the planet nothing of its own, so it reads as its biome.      */
/* ------------------------------------------------------------------ */

const LANDSCAPE_DIR = join(SMALL, "Landscapes");
const LANDSCAPE_W = 800;
const LANDSCAPE_H = 450;
const THUMB = 1280;

/* Biome shots the wiki names in a way the biome id does not spell. The
   rest match by their file name: "Swamp base Landscape.png" is
   swamp_base. */
const BIOME_FILES = {
  oasis_base: "Desert Oasis Landscape Day.png",
  deciduous_base: "Deciduous Forest Landscape Sunset.png",
  arctic_glacier_tien_kwan: "Tien Kwan landscape.png",
};

async function wikiJson(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: { "user-agent": AGENT } });
  if (!res.ok) throw new Error(`the wiki answered ${res.status}`);
  return res.json();
}

/* Every file with Landscape in its title, in one list. */
async function landscapeFiles() {
  const out = [];
  let offset = 0;
  for (;;) {
    const doc = await wikiJson({ action: "query", list: "search", srsearch: "intitle:Landscape", srnamespace: "6", srlimit: "500", sroffset: String(offset), srprop: "" });
    out.push(...doc.query.search.map((s) => s.title.replace(/^File:/, "")));
    if (!doc.continue) break;
    offset = doc.continue.sroffset;
    await sleep(300);
  }
  return out;
}

/* The infobox's landscape for each planet page, following redirects. */
async function infoboxShots(names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const doc = await wikiJson({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: batch.join("|") });
    const back = new Map();
    for (const n of doc.query.normalized || []) back.set(n.to, n.from);
    for (const r of doc.query.redirects || []) back.set(r.to, back.get(r.from) || r.from);
    for (const page of Object.values(doc.query.pages || {})) {
      const text = page.revisions ? page.revisions[0].slots.main["*"] : "";
      const m = /\|\s*landscape\s*=\s*([^\n|}]*)/.exec(text);
      const file = m ? m[1].trim().replace(/^File:/i, "").replace(/_/g, " ") : "";
      if (file) out.set(back.get(page.title) || page.title, file);
    }
    await sleep(300);
  }
  return out;
}

/* The thumbnail url of each file, batched. */
async function thumbs(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const doc = await wikiJson({ action: "query", prop: "imageinfo", iiprop: "url|size", iiurlwidth: String(THUMB), titles: batch.map((f) => `File:${f}`).join("|") });
    const back = new Map((doc.query.normalized || []).map((n) => [n.to, n.from]));
    for (const page of Object.values(doc.query.pages || {})) {
      const ii = page.imageinfo && page.imageinfo[0];
      const asked = (back.get(page.title) || page.title).replace(/^File:/, "");
      if (ii) out.set(asked, { url: ii.thumburl || ii.url, width: ii.width });
    }
    await sleep(300);
  }
  return out;
}

/* A second shot's caption, from what its title says after Landscape:
   "Exostorm Night C3" reads "Exostorm night". */
const captionOf = (file) => {
  const words = file.replace(/\.[a-z]+$/i, "").split(/\s+Landscape\s+/i)[1] || "";
  const kept = words.split(/\s+/).filter((w) => w && !/^(Header|Ground|Shot|View|C\d|\d)$/i.test(w));
  if (!kept.length) return null;
  const s = kept.join(" ").toLowerCase();
  return s[0].toUpperCase() + s.slice(1);
};

async function landscapes() {
  const shown = wanted.map((w) => w.name);
  console.log("\n  Reading the wiki's landscape files and every planet's infobox...");
  const files = await landscapeFiles();
  const infobox = await infoboxShots(shown);

  /* What to fetch: the planet's own shot, a second of the same planet,
     and each biome's typical surface. */
  const plan = [];
  let own = 0;
  let two = 0;
  const none = [];
  for (const name of shown) {
    const s = slug(name);
    const head = infobox.get(name);
    const mine = head && head.toLowerCase().startsWith(name.toLowerCase() + " ") ? head : null;
    if (!mine) {
      none.push(name);
      continue;
    }
    own += 1;
    plan.push({ file: mine, to: `landscape_${s}.webp` });
    /* One more: another shot of this planet's ground, never a sky, space
       or icon view, preferring a header variant. */
    const more = files
      .filter((f) => f !== mine && f.toLowerCase().startsWith(name.toLowerCase() + " ") && !/\b(Space|Sky|Icon)\b/i.test(f))
      .sort((a, b) => Number(/Header/.test(b)) - Number(/Header/.test(a)));
    const second = more.find((f) => captionOf(f));
    if (second) {
      two += 1;
      plan.push({ file: second, to: `landscape_${s}__${slug(captionOf(second))}.webp` });
    }
  }
  const biomes = new Set(planets.map((p) => p.biome).filter(Boolean));
  const biomeHas = [];
  for (const b of biomes) {
    const file = BIOME_FILES[b] || files.find((f) => f.toLowerCase().replace(/ /g, "_") === `${b}_landscape.png`);
    if (file) {
      biomeHas.push(b);
      plan.push({ file, to: `biome_${b}.webp` });
    }
  }

  console.log(`  ${own} of ${shown.length} planets have a shot of their own, ${two} of them a second`);
  console.log(`  ${biomeHas.length} of ${biomes.size} biomes have a typical surface shot`);
  const bare = [...biomes].filter((b) => !biomeHas.includes(b));
  if (bare.length) console.log(`  biomes with no shot of their own: ${bare.join(", ")}`);

  if (!WRITE) {
    console.log(`\n  ${plan.length} shots to fetch. Add -- --write to fetch and cut them.\n`);
    return;
  }

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("  sharp is not installed, so nothing was fetched. It arrives with wrangler: run npm install.\n");
    return;
  }
  mkdirSync(LANDSCAPE_DIR, { recursive: true });
  const todo = plan.filter((p) => !existsSync(join(LANDSCAPE_DIR, p.to)));
  const urls = await thumbs([...new Set(todo.map((p) => p.file))]);
  let made = 0;
  let bytes = 0;
  for (const p of todo) {
    const got = urls.get(p.file);
    if (!got) {
      console.log(`  ${p.file}: not on the wiki`);
      continue;
    }
    /* Never enlarged: most biome shots are 460 pixels wide, and blown up
       to 800 they are blur. They keep their own width. */
    const w = Math.min(LANDSCAPE_W, got.width || LANDSCAPE_W);
    const h = Math.round((w * LANDSCAPE_H) / LANDSCAPE_W);
    try {
      const res = await fetch(got.url, { headers: { "user-agent": AGENT } });
      if (!res.ok) throw new Error(`answered ${res.status}`);
      const buf = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(w, h, { fit: "cover", position: "attention" })
        .webp({ quality: 78, effort: 5 }).toBuffer();
      writeFileSync(join(LANDSCAPE_DIR, p.to), buf);
      made += 1;
      bytes += buf.length;
      if (made % 25 === 0) console.log(`  ${made} cut`);
    } catch (e) {
      console.log(`  ${p.file}: ${e.message}`);
    }
    await sleep(150);
  }
  console.log(`\n  ${made} cut, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${plan.length - todo.length} already here`);
  console.log("  Run npm run images to bring them into the app.\n");
}

/* ------------------------------------------------------------------ */
/* WHAT IS LEFT OF A PLANET                                            */
/*                                                                     */
/*   npm run planet-art -- --destroyed            report               */
/*   npm run planet-art -- --destroyed --write    fetch and cut        */
/*                                                                     */
/* A black hole or a fractured planet has no render under its planet's */
/* name, so its art is named in war-effects.json (art) and fetched     */
/* here from the files the wiki keeps: the game's own header banner,   */
/* the one its planet card shows, and a render for the map. Into       */
/* Image Library/Planets/Destroyed:                                    */
/*                                                                     */
/*   render_<art>.webp   the map's planet, up to 256, cut round        */
/*   banner_<art>.webp   the card's banner, at its own size            */
/*                                                                     */
/* The fractured planet has no render on the wiki at all, so its       */
/* render is a square from the middle of its banner, cut round.        */
/* ------------------------------------------------------------------ */

const DESTROYED_DIR = join(SMALL, "Destroyed");
const DESTROYED = {
  "meridian-black-hole": { render: "Meridian Black Hole.png", banner: "MeridianBlackHole Header.png" },
  "conventional-black-hole": { render: "Penta Black Hole Planet Icon.png", banner: "Conventional Black Hole Header.png" },
  "fractured-planet": {
    render: { from: "Fractured Planet Header.png", crop: { left: 330, top: 20, width: 310, height: 310 }, keyAll: true },
    banner: "Fractured Planet Header.png",
  },
};

/* Debris on the dark of space, cut out whole: every pixel near the
   ground's colour goes clear, wherever it is, so the rocks float on the
   map's own space rather than a disc of the banner's. A soft round edge
   keeps a crop's corners from showing. */
async function keyOutSpace(sharp, from) {
  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const at = (x, y) => (y * W + x) * 4;
  const ground = [0, 0, 0];
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  for (const [x, y] of corners) for (let c = 0; c < 3; c += 1) ground[c] += data[at(x, y) + c] / corners.length;
  const R = Math.min(W, H) / 2;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = at(x, y);
      const d = Math.hypot(x - (W - 1) / 2, y - (H - 1) / 2) / R;
      const edge = Math.max(0, Math.min(1, (1 - d) / 0.12));
      const off = Math.max(Math.abs(data[i] - ground[0]), Math.abs(data[i + 1] - ground[1]), Math.abs(data[i + 2] - ground[2]));
      data[i + 3] = Math.round(255 * edge * Math.max(0, Math.min(1, (off - 14) / 40)));
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

async function destroyed() {
  const fileOf = (r) => (typeof r === "string" ? r : r.from);
  const files = [...new Set(Object.values(DESTROYED).flatMap((d) => [fileOf(d.render), d.banner]))];
  const doc = await wikiJson({ action: "query", prop: "imageinfo", iiprop: "url|size", titles: files.map((f) => `File:${f}`).join("|") });
  const back = new Map((doc.query.normalized || []).map((n) => [n.to, n.from]));
  const urls = new Map();
  for (const page of Object.values(doc.query.pages || {})) {
    const ii = page.imageinfo && page.imageinfo[0];
    if (ii) urls.set((back.get(page.title) || page.title).replace(/^File:/, ""), ii);
  }
  for (const f of files) {
    const ii = urls.get(f);
    console.log(`  ${ii ? "found  " : "MISSING"} ${f}${ii ? `  ${ii.width} x ${ii.height}` : ""}`);
  }
  if (!WRITE) {
    console.log("\n  Nothing downloaded. Add -- --write to fetch and cut them.\n");
    return;
  }
  const sharp = (await import("sharp")).default;
  mkdirSync(DESTROYED_DIR, { recursive: true });
  const got = new Map();
  for (const f of files) {
    if (!urls.has(f)) continue;
    const res = await fetch(urls.get(f).url, { headers: { "user-agent": AGENT } });
    if (!res.ok) {
      console.log(`  ${f}: answered ${res.status}`);
      continue;
    }
    got.set(f, Buffer.from(await res.arrayBuffer()));
    await sleep(300);
  }
  for (const [art, d] of Object.entries(DESTROYED)) {
    const banner = got.get(d.banner);
    if (banner) {
      writeFileSync(join(DESTROYED_DIR, `banner_${art}.webp`), await sharp(banner).webp({ quality: 80, effort: 5 }).toBuffer());
    }
    let src = got.get(fileOf(d.render));
    if (!src) continue;
    if (typeof d.render !== "string") src = await sharp(src).extract(d.render.crop).png().toBuffer();
    const meta = await sharp(src).metadata();
    const shaped = d.render.keyAll ? await keyOutSpace(sharp, src) : meta.hasAlpha ? sharp(src) : await opaqueToRound(sharp, src);
    /* Never enlarged: a 128 pixel icon stays 128. */
    const side = Math.min(CUT, Math.max(meta.width, meta.height));
    const buf = await shaped
      .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
      .webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
    writeFileSync(join(DESTROYED_DIR, `render_${art}.webp`), buf);
    console.log(`  ${art}: render ${side} px${banner ? ", banner" : ""}`);
  }
  console.log("  Run npm run images to bring them into the app.\n");
}

if (process.argv.includes("--destroyed")) {
  await destroyed();
  process.exit(0);
}

if (process.argv.includes("--landscapes")) {
  await landscapes();
  process.exit(0);
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
