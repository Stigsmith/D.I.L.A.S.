/* ================================================================== */
/* EVERY ARMOUR SET                                                   */
/*                                                                    */
/*   npm run armor                 report what the wiki says          */
/*   npm run armor -- --write      write src/data/armor.json          */
/*   npm run armor -- --refresh    pull the articles again            */
/*   npm run armor-art             fetch each set's render, and cut   */
/*                                 the app's copy                     */
/*                                                                    */
/* The curator asked for every armour set in the tool, with its art,  */
/* on 4 October 2026, rather than a bare light, medium or heavy       */
/* switch. Each set's wiki article carries an "Infobox Armor": the    */
/* render, the weight, armour, speed, stamina regen, the passive and  */
/* where it comes from. That is everything a build needs to know      */
/* about the armour you wear.                                         */
/*                                                                    */
/* The passive stays the rated item. Ratings are per passive, from    */
/* u.gg, and every rule reads the passive; a set adds its weight and  */
/* its numbers, and the art. So armor.json is a list of sets, each    */
/* pointing at a passive by item id, and nothing about a rating moves */
/* when a set is chosen.                                              */
/*                                                                    */
/* Generated, never edited by hand. Ids are a slug of the set's name  */
/* when first fetched, and the reference invariant holds exactly as   */
/* for items: a rename on the wiki must not move an id. So a set the  */
/* file already holds keeps its id, matched by name or by an earlier   */
/* name kept in its aliases.                                          */
/*                                                                    */
/* The art is extracted game art, so it lands in Image Library        */
/* (gitignored, never in the public repo) and npm run images copies   */
/* the cut into src/assets/armor-sets. Nothing depends on it: a set   */
/* with no art reads by its name.                                     */
/*                                                                    */
/* helldivers.wiki.gg is CC BY-NC-SA 4.0, and armor.json says so.     */
/* ================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "armor.json");
const CACHE = join(ROOT, ".wiki-cache");
const CACHED = join(CACHE, "armor-pages.json");
const ART = join(ROOT, "Image Library", "Armor Sets");
const ORIGINALS = join(ART, "Originals");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");
const ART_TOO = args.includes("--art");

const API = "https://helldivers.wiki.gg/api.php";
const HEADERS = { "user-agent": "dilas.me (https://dilas.me)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const load = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const items = load("src/data/items.json");
const { warbonds } = load("src/data/warbonds.json");
const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { sets: [] };

/* The same slug the rest of the project uses. */
const slug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

async function api(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${params.action} ${res.status} ${res.statusText}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* The articles                                                        */
/* ------------------------------------------------------------------ */

async function articles() {
  mkdirSync(CACHE, { recursive: true });
  if (!REFRESH && existsSync(CACHED)) return JSON.parse(readFileSync(CACHED, "utf8")).text;
  /* Every article that uses the armour infobox, in the main namespace. */
  const titles = [];
  let cont = {};
  do {
    const doc = await api({ action: "query", list: "embeddedin", eititle: "Template:Infobox_Armor", einamespace: "0", eilimit: "500", ...cont });
    titles.push(...doc.query.embeddedin.map((e) => e.title));
    cont = doc.continue || null;
  } while (cont);
  const text = {};
  for (let i = 0; i < titles.length; i += 25) {
    const batch = titles.slice(i, i + 25);
    const doc = await api({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: batch.join("|") });
    for (const page of doc.query.pages || []) {
      const rev = page.revisions && page.revisions[0];
      text[page.title] = rev && rev.slots && rev.slots.main ? rev.slots.main.content : null;
    }
    await sleep(200);
  }
  writeFileSync(CACHED, JSON.stringify({ fetchedAt: new Date().toISOString(), text }));
  console.log(`  pulled ${titles.length} armour articles`);
  return text;
}

/* "|armor=150" inside the first Infobox Armor. Fields are one line each
   except the image lists, which are not read. */
function infobox(text) {
  if (!text) return null;
  const start = text.indexOf("{{Infobox Armor");
  if (start < 0) return null;
  /* A few articles write two fields on one line, "|passive=Siege-Ready|source
     = Superstore", so every "|name=" starts a line of its own first. A pipe
     inside a link is never followed by "name =", so links survive it. */
  const body = text.slice(start, text.indexOf("\n}}", start) + 3).replace(/\|(?=[ \t]*[a-z_]+[ \t]*=)/g, "\n|");
  const field = (name) => {
    const m = body.match(new RegExp(`^\\|+[ \\t]*${name}[ \\t]*=(.*)$`, "m"));
    return m ? m[1].trim() : null;
  };
  return {
    image: field("image"),
    type: field("type"),
    armor: Number(field("armor")),
    speed: Number(field("speed")),
    stamina: Number(field("stam_regen")),
    passive: field("passive"),
    source: field("source"),
  };
}

/* Wiki markup down to the words: [[Target|Shown]] to Shown, templates out. */
const plain = (s) =>
  String(s || "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ------------------------------------------------------------------ */
/* Joining it to the project                                           */
/* ------------------------------------------------------------------ */

const armorItems = items.filter((i) => i.slot === "armor");
const passiveByName = new Map();
for (const it of armorItems) {
  passiveByName.set(norm(it.name), it.id);
  for (const a of it.aliases || []) passiveByName.set(norm(a), it.id);
}
/* Where the wiki spells a passive differently from the item's name. */
const PASSIVE_SPELLING = {
  supplementaladrenaline: "supplementary-adrenaline",
};

const warbondByName = new Map(warbonds.map((w) => [norm(w.name.replace(/\s*\(free\)\s*/i, "")), w.id]));
warbondByName.set(norm("Helldivers Mobilize"), "mobilize-free");

/* Where a set comes from, as the acquisition types items already use.
   A warbond the project knows becomes that warbond, so the set can be
   locked with it. Anything else is kept as words the wiki wrote. */
function acquisitionFor(raw) {
  const words = plain(raw);
  const n = norm(words);
  for (const [name, id] of warbondByName) if (name && n.includes(name)) return { type: "warbond", warbond: id, note: words };
  if (/superstore/i.test(words)) return { type: "superstore", warbond: null, note: words };
  if (/starter|issued/i.test(words)) return { type: "starter", warbond: null, note: words };
  if (/super citizen|pre-?order/i.test(words)) return { type: "superCitizen", warbond: null, note: words };
  if (/requisition/i.test(words)) return { type: "requisition", warbond: null, note: words };
  return { type: "campaign", warbond: null, note: words };
}

const WEIGHT = { light: "light", medium: "medium", heavy: "heavy" };

const text = await articles();
const sets = [];
const problems = [];
const helmetsOnly = [];
const idByName = new Map();
for (const s of before.sets || []) {
  idByName.set(norm(s.name), s.id);
  for (const a of s.aliases || []) idByName.set(norm(a), s.id);
}

for (const [title, body] of Object.entries(text).sort(([a], [b]) => a.localeCompare(b))) {
  const box = infobox(body);
  if (!box) { problems.push(`${title}: no armour infobox`); continue; }
  /* A helmet alone uses the same infobox with no body: no weight and no
     passive. IX-Voidwalker is one. It is not a set and is not counted. */
  if (!box.type && !box.passive) { helmetsOnly.push(title); continue; }
  const weight = WEIGHT[String(box.type || "").toLowerCase()];
  if (!weight) { problems.push(`${title}: weight "${box.type}" is not light, medium or heavy`); continue; }
  const passiveWords = plain(box.passive);
  let passive = passiveByName.get(norm(passiveWords)) ?? null;
  if (passive === null && norm(passiveWords) in PASSIVE_SPELLING) passive = PASSIVE_SPELLING[norm(passiveWords)];
  if (!passive) { problems.push(`${title}: passive "${passiveWords}" matches no armour item`); continue; }
  for (const [k, v] of [["armor", box.armor], ["speed", box.speed], ["stamina", box.stamina]]) {
    if (!Number.isFinite(v) || v <= 0) problems.push(`${title}: ${k} is ${JSON.stringify(v)}`);
  }
  const id = idByName.get(norm(title)) || slug(title);
  const kept = (before.sets || []).find((s) => s.id === id);
  sets.push({
    id,
    name: title,
    aliases: kept && kept.name !== title ? [...new Set([...(kept.aliases || []), kept.name])] : (kept && kept.aliases) || [],
    weight,
    armor: box.armor,
    speed: box.speed,
    stamina: box.stamina,
    passive,
    acquisition: acquisitionFor(box.source),
    /* Most articles write "{{PAGENAME}} Armor Render.png", the page's own
       title standing in. */
    image: box.image ? box.image.replace(/^File:/i, "").replace(/\{\{PAGENAME\}\}/g, title).trim() : null,
  });
}

/* A set in the curated index the wiki has not got, or the other way round. */
const curated = load("src/data/armor-sets.json");
const curatedNames = new Set();
for (const v of Object.values(curated)) {
  if (!v || typeof v !== "object") continue;
  for (const w of ["light", "medium", "heavy"]) for (const n of v[w] || []) curatedNames.add(norm(n.split("·")[0]));
}
const fetchedNames = new Set(sets.map((s) => norm(s.name)));
const notFetched = [...curatedNames].filter((n) => !fetchedNames.has(n));
const notCurated = sets.filter((s) => !curatedNames.has(norm(s.name))).map((s) => s.name);

console.log("\n  Armour sets. Source: helldivers.wiki.gg, CC BY-NC-SA 4.0.\n");
const byWeight = (w) => sets.filter((s) => s.weight === w).length;
console.log(`  ${sets.length} sets: ${byWeight("light")} light, ${byWeight("medium")} medium, ${byWeight("heavy")} heavy`);
const byType = {};
for (const s of sets) byType[s.acquisition.type] = (byType[s.acquisition.type] || 0) + 1;
console.log(`  from: ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(", ")}`);
const others = sets.filter((s) => s.acquisition.type === "campaign");
if (others.length) console.log(`  read as campaign or other: ${others.map((s) => `${s.name} (${s.acquisition.note})`).join("; ")}`);
if (helmetsOnly.length) console.log(`  helmets with no armour, not sets: ${helmetsOnly.join(", ")}`);
if (notFetched.length) console.log(`  in armor-sets.json but not on the wiki: ${notFetched.join(", ")}`);
if (notCurated.length) console.log(`  on the wiki but not in armor-sets.json: ${notCurated.join(", ")}`);
if (problems.length) console.log(`\n  ${problems.length} problem(s):\n    ${problems.join("\n    ")}`);

const doc = {
  source: "helldivers.wiki.gg, each set's Infobox Armor",
  licence: "CC BY-NC-SA 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0",
  note: "Generated by scripts/fetch-armor.mjs. Never edit by hand: a re-fetch overwrites it. Every armour set in the game, its weight, the armour, speed and stamina regen the wiki gives (armour includes the passive's own bonus where it has one), the passive as an armour item id, and where it comes from. The passive is still the rated item; a set adds its weight and its numbers. Ids follow the reference invariant: a set keeps its id when the wiki renames it, and the old name goes into aliases.",
  sets: sets.map(({ image, ...s }) => s),
};
const same = JSON.stringify(doc.sets) === JSON.stringify(before.sets);
if (same) console.log("\n  src/data/armor.json is already current.\n");
else if (WRITE) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`\n  Wrote src/data/armor.json, ${sets.length} sets.\n`);
} else console.log(`\n  ${existsSync(OUT) ? "Would change" : "Would create"} src/data/armor.json. Re-run with --write to apply.\n`);

/* ------------------------------------------------------------------ */
/* The art                                                             */
/* ------------------------------------------------------------------ */

if (ART_TOO) await art(sets);

async function art(sets) {
  mkdirSync(ORIGINALS, { recursive: true });
  /* The wiki's own thumbnail at 512 is plenty: the picker draws a set at
     about 64 pixels and its detail at about 160. */
  const wanted = sets.filter((s) => s.image);
  let fetched = 0;
  let had = 0;
  const missing = [];
  for (let i = 0; i < wanted.length; i += 50) {
    const batch = wanted.slice(i, i + 50);
    const doc = await api({
      action: "query", prop: "imageinfo", iiprop: "url|size", iiurlwidth: "512",
      titles: batch.map((s) => `File:${s.image}`).join("|"),
    });
    const normal = new Map((doc.query.normalized || []).map((n) => [n.to, n.from]));
    const info = new Map();
    for (const page of doc.query.pages || []) {
      const ii = page.imageinfo && page.imageinfo[0];
      if (ii) info.set(normal.get(page.title) || page.title, ii);
    }
    for (const s of batch) {
      const ii = info.get(`File:${s.image}`);
      if (!ii) { missing.push(s.name); continue; }
      const to = join(ORIGINALS, `armorset_${s.id}.png`);
      if (existsSync(to)) { had += 1; continue; }
      const res = await fetch(ii.thumburl || ii.url, { headers: HEADERS });
      if (!res.ok) { missing.push(`${s.name} (${res.status})`); continue; }
      writeFileSync(to, Buffer.from(await res.arrayBuffer()));
      fetched += 1;
      await sleep(150);
    }
  }
  console.log(`  art: ${fetched} fetched, ${had} already here${missing.length ? `, none for ${missing.join(", ")}` : ""}`);

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("  sharp is not installed, so nothing was cut. It arrives with wrangler: run npm install.\n");
    return;
  }
  /* Trimmed to the figure and fitted inside 256 pixels, as WebP. */
  let cut = 0;
  let bytes = 0;
  for (const name of readdirSync(ORIGINALS).filter((n) => /^armorset_.+\.png$/i.test(n))) {
    const from = join(ORIGINALS, name);
    const to = join(ART, name.replace(/\.png$/i, ".webp"));
    if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
    const trimmed = await sharp(from).trim({ threshold: 1 }).png().toBuffer();
    const buf = await sharp(trimmed)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ quality: 82, alphaQuality: 90, effort: 5 })
      .toBuffer();
    writeFileSync(to, buf);
    cut += 1;
    bytes += buf.length;
  }
  console.log(`  ${cut} cut, ${(bytes / 1024).toFixed(0)} KB. Run npm run images to bring them into the app.\n`);
}
