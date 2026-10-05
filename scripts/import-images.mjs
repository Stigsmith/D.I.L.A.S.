/* ================================================================== */
/* IMAGE IMPORT                                                       */
/*                                                                    */
/* Copies art out of "Image Library" into src/assets, renamed to the id   */
/* it belongs to, so the resolver is a plain id to file lookup with    */
/* nothing to keep in sync by hand.                                    */
/*                                                                    */
/* "Image Library" is the source of truth and is never written to. Rerun  */
/* this after adding art:  node scripts/import-images.mjs             */
/* ================================================================== */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { emptyInPlace } from "./lib/empty-in-place.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "Image Library");
const ASSETS = join(ROOT, "src", "assets");
const DATA = join(ROOT, "src", "data");

/* The favicon when there is no skull art to cut it from: the brand yellow
   with a D, drawn here rather than taken from the game. A clone without
   the library still gets an icon, and check-dist, which wants every file
   the page asks for, still passes. */
const PLAIN_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#FFE900"/>
  <text x="32" y="45" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#121214">D</text>
</svg>
`;
const writePlainFavicon = () => {
  mkdirSync(join(ROOT, "public"), { recursive: true });
  writeFileSync(join(ROOT, "public", "favicon.svg"), PLAIN_FAVICON, "utf8");
};

/* A clone from GitHub has no library: the art is extracted from the game
   and stays on the curator's machine, out of the public repository. The
   tool runs art free without it, every item read by its name, so this
   says so, writes the plain favicon if there is none, and changes nothing
   else rather than failing the build. */
if (!existsSync(SOURCE)) {
  if (!existsSync(join(ROOT, "public", "favicon.svg"))) writePlainFavicon();
  console.log("\n  No Image Library here, so there is no art to copy. The tool runs art free: every item reads by its name.\n");
  process.exit(0);
}

const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const items = read("items.json");
const { warbonds } = read("warbonds.json");

/* Files whose name does not slug to the id they belong to. Everything  */
/* else matches automatically. Kept explicit so a wrong pairing is      */
/* visible in review rather than buried in fuzzy matching.              */
const OVERRIDES = {
  "uav-recon-booster": "booster_uav_recon.png",
  /* One shared illustration. The three Concussive Padding passives are */
  /* one armor look in game with different secondary effects.           */
  "concussive-padding-reinforced": "armor_concussive_padding.jpg",
  "concussive-padding-hazmat": "armor_concussive_padding.jpg",
  "concussive-padding-grenadier": "armor_concussive_padding.jpg",
};

const WARBOND_OVERRIDES = {
  /* The tables call it "Mobilize (free)". The game calls it Helldivers */
  /* Mobilize, which is what the art is named after.                    */
  "mobilize-free": "warbond_helldivers_mobilize.jpg",
};

const PREFIXES = ["weapon", "stratagem", "throwable", "booster", "armor"];
const slug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* The library is sorted into category folders, so this walks rather than */
/* reading one flat directory. Themes are skipped here: a skin folder is  */
/* handled by its own pass further down, and its art must not be mistaken */
/* for item art on the way past.                                          */
/*                                                                        */
/* The filename prefix is still what matches a file to an id, so a file   */
/* keeps identifying itself even if it is moved between folders. The      */
/* folder is organisation; the prefix is the key.                         */
const walk = (dir, out = []) => {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      /* Themes and planets each have a pass of their own further down.
         The planet folder also keeps full size originals under the same
         names as the small copies, which must never be mistaken for them. */
      if (["themes", "planets", "armor sets"].includes(d.name.toLowerCase())) continue;
      walk(join(dir, d.name), out);
    } else {
      out.push({ name: d.name, path: join(dir, d.name) });
    }
  }
  return out;
};

const found = walk(SOURCE);
const files = found.map((f) => f.name);
const pathOf = new Map(found.map((f) => [f.name, f.path]));

/* Index the source by the id its filename implies. */
const byItemKey = new Map();
const byWarbondKey = new Map();
const generic = [];
for (const file of files) {
  const base = file.replace(/\.[^.]+$/, "");
  const cut = base.indexOf("_");
  const prefix = cut < 0 ? "" : base.slice(0, cut);
  const key = slug(cut < 0 ? base : base.slice(cut + 1));
  if (PREFIXES.includes(prefix)) byItemKey.set(key, file);
  else if (prefix === "warbond") byWarbondKey.set(key, file);
  else generic.push(file);
}

/* Each art folder is emptied and refilled in place, never deleted and made
   again, so the sync app watching this folder does not rename it. See
   scripts/lib/empty-in-place.mjs. */
for (const dir of ["items", "warbonds", "ui", "themes"]) emptyInPlace(join(ASSETS, dir));

const manifest = { items: {}, warbonds: {}, ui: [], themes: {} };
const missingItems = [];
const missingWarbonds = [];

/* Warbond skins keep their reference art and their palette study in      */
/* Image Library/Themes/<Warbond>/. The folder name slugs to the theme id,   */
/* so a new skin needs no wiring here. The study itself is left behind:   */
/* it is a design document, not something the app ships.                  */
const themeDirs = readdirSync(join(SOURCE, "themes"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const folder of themeDirs) {
  const id = slug(folder);
  mkdirSync(join(ASSETS, "themes", id), { recursive: true });
  const all = readdirSync(join(SOURCE, "themes", folder), { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);

  const files = all.filter((f) => !/\.html?$/i.test(f));
  for (const file of files) {
    copyFileSync(join(SOURCE, "themes", folder, file), join(ASSETS, "themes", id, file));
  }

  /* The study embeds its own artwork as data URIs. Those are already cut */
  /* to transparency and coloured for the theme, which the loose JPG      */
  /* references are not, so they are the ones worth drawing with. Pulled  */
  /* out as real files and named after the class the study gives them.    */
  for (const study of all.filter((f) => /\.html?$/i.test(f))) {
    const html = readFileSync(join(SOURCE, "themes", folder, study), "utf8");
    let found = 0;
    for (const tag of html.match(/<img[^>]*>/gi) || []) {
      const src = /src="data:image\/(png|webp|jpeg|jpg);base64,([^"]+)"/i.exec(tag);
      if (!src) continue;
      const cls = /class="([^"]+)"/i.exec(tag);
      const base = cls ? cls[1].trim().split(/\s+/)[0] : `embedded-${found}`;
      const ext = src[1].toLowerCase() === "jpg" ? "jpeg" : src[1].toLowerCase();
      const name = `study_${base}.${ext === "jpeg" ? "jpg" : ext}`;
      writeFileSync(join(ASSETS, "themes", id, name), Buffer.from(src[2], "base64"));
      files.push(name);
      found += 1;
    }
    /* Some studies set their art as a CSS background rather than an img,  */
    /* which has no class to name it after. Those are numbered off the     */
    /* rule they appear in, so they still land as real files instead of    */
    /* being silently left inside the HTML.                                */
    let bg = 0;
    for (const m of html.matchAll(/([a-z-]+)\s*\{[^}]*url\(\s*["']?data:image\/(png|webp|jpeg|jpg);base64,([^"')]+)/gi)) {
      const ext = m[2].toLowerCase() === "jpg" ? "jpeg" : m[2].toLowerCase();
      const name = `study_bg-${m[1].toLowerCase()}-${bg}.${ext === "jpeg" ? "jpg" : ext}`;
      writeFileSync(join(ASSETS, "themes", id, name), Buffer.from(m[3], "base64"));
      files.push(name);
      bg += 1;
    }
    found += bg;
    if (found) console.log(`  ${id}: extracted ${found} embedded image(s) from ${study}`);
  }

  manifest.themes[id] = files;
}

for (const it of items) {
  const source = OVERRIDES[it.id] || byItemKey.get(it.id);
  if (!source) { missingItems.push(it); continue; }
  const target = `${it.id}${extname(source)}`;
  copyFileSync(pathOf.get(source), join(ASSETS, "items", target));
  manifest.items[it.id] = source;
}

for (const w of warbonds) {
  const source = WARBOND_OVERRIDES[w.id] || byWarbondKey.get(w.id);
  if (!source) { missingWarbonds.push(w); continue; }
  const target = `${w.id}${extname(source)}`;
  copyFileSync(pathOf.get(source), join(ASSETS, "warbonds", target));
  manifest.warbonds[w.id] = source;
}

for (const file of generic) {
  copyFileSync(pathOf.get(file), join(ASSETS, "ui", file));
  manifest.ui.push(file);
}

/* Planet renders: the copies npm run planet-art made, straight from
   Image Library/Planets and never from its Originals folder, which hold
   3 MB apiece. One per planet, named by the slug the map looks it up by,
   and the 256 pixel WebP cut wins over the wiki's 128 pixel PNG. */
const PLANETS_SOURCE = join(SOURCE, "Planets");
emptyInPlace(join(ASSETS, "planets"));
let planetArt = 0;
if (existsSync(PLANETS_SOURCE)) {
  const rank = (ext) => (ext === "webp" ? 0 : 1);
  const best = new Map();
  for (const d of readdirSync(PLANETS_SOURCE, { withFileTypes: true })) {
    const m = d.isFile() ? /^planet_(.+)\.(png|jpe?g|webp)$/i.exec(d.name) : null;
    if (!m) continue;
    const ext = m[2].toLowerCase();
    const had = best.get(m[1]);
    if (!had || rank(ext) < rank(had.ext)) best.set(m[1], { name: d.name, ext });
  }
  for (const [key, { name, ext }] of best) {
    copyFileSync(join(PLANETS_SOURCE, name), join(ASSETS, "planets", `${key}.${ext}`));
    planetArt += 1;
  }
}

/* Armour set renders: the cuts npm run armor-art made, by set id. Never
   the Originals folder beside them. */
const ARMOR_SETS_SOURCE = join(SOURCE, "Armor Sets");
emptyInPlace(join(ASSETS, "armor-sets"));
let armorSetArt = 0;
if (existsSync(ARMOR_SETS_SOURCE)) {
  for (const d of readdirSync(ARMOR_SETS_SOURCE, { withFileTypes: true })) {
    const m = d.isFile() ? /^armorset_(.+).webp$/i.exec(d.name) : null;
    if (!m) continue;
    copyFileSync(join(ARMOR_SETS_SOURCE, d.name), join(ASSETS, "armor-sets", `${m[1]}.webp`));
    armorSetArt += 1;
  }
}

/* Anything in the source that no id claimed. Not an error, but if a    */
/* file is here it is doing nothing, which is usually a naming slip.    */
const claimed = new Set([...Object.values(manifest.items), ...Object.values(manifest.warbonds), ...manifest.ui]);
const unused = files.filter((f) => !claimed.has(f));

writeFileSync(
  join(ASSETS, "manifest.json"),
  JSON.stringify({ generatedFrom: "Image Library", ...manifest }, null, 2) + "\n",
  "utf8"
);

/* Favicon. The skull art is black on transparent, which disappears on a */
/* dark tab bar, so it is composited onto the neon yellow taken from     */
/* ui_logo_helldivers_yellow.svg. An SVG wrapper with the PNG inlined    */
/* avoids pulling in an image library just to draw a rectangle behind    */
/* it. A favicon is a static file, so it cannot follow the active theme. */
const NEON = "#FFE900";
/* Resolved through the walk rather than a flat path. The library is
   sorted into folders now, so this file lives under UI. */
const skull = pathOf.get("ui_icon_booster_skull.png");
try {
  if (!skull) throw new Error("skull not found");
  const b64 = readFileSync(skull).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${NEON}"/>
  <image href="data:image/png;base64,${b64}" x="6" y="6" width="52" height="52"/>
</svg>
`;
  mkdirSync(join(ROOT, "public"), { recursive: true });
  writeFileSync(join(ROOT, "public", "favicon.svg"), svg, "utf8");
  console.log("favicon written from the skull art");
} catch (e) {
  writePlainFavicon();
  console.log("no skull art, so the plain favicon instead");
}

console.log(`items with art:    ${Object.keys(manifest.items).length} of ${items.length}`);
console.log(`warbonds with art: ${Object.keys(manifest.warbonds).length} of ${warbonds.length}`);
console.log(`ui and other:      ${manifest.ui.length}`);
console.log(`planets with art:  ${planetArt}${planetArt ? "" : " (npm run planet-art -- --write fetches them)"}`);
console.log(`armour sets:       ${armorSetArt}${armorSetArt ? "" : " (npm run armor-art fetches them)"}`);
if (missingItems.length) {
  console.log(`\nitems with no art (these fall back to text): ${missingItems.length}`);
  for (const m of missingItems) console.log(`  ${m.slot.padEnd(10)} ${m.id.padEnd(34)} ${m.name}`);
}
if (missingWarbonds.length) {
  console.log(`\nwarbonds with no art: ${missingWarbonds.length}`);
  for (const w of missingWarbonds) console.log(`  ${w.id}`);
}
if (unused.length) {
  console.log(`\nsource files nothing claimed: ${unused.length}`);
  for (const u of unused) console.log(`  ${u}`);
}
