/* ================================================================== */
/* WIKI FETCH                                                         */
/*                                                                    */
/* Pulls the stats this project never had from helldivers.wiki.gg and */
/* the planet table from the community war API, joins them to our own */
/* item ids, and writes two data files.                               */
/*                                                                    */
/* It never touches items.json. Everything in there is curated, and a */
/* re-fetch that could overwrite a hand made call is a re-fetch you   */
/* stop trusting. The app joins the two on read, by id.               */
/*                                                                    */
/* Reports by default, applies with --write, same discipline as       */
/* tag-roles.mjs. Raw pulls are cached so a re-run is offline and     */
/* instant; --refresh goes back to the network.                       */
/*                                                                    */
/*   node scripts/fetch-wiki.mjs              report what would change */
/*   node scripts/fetch-wiki.mjs --write      apply it                 */
/*   node scripts/fetch-wiki.mjs --refresh    re-pull, then report     */
/*                                                                    */
/* The wiki is CC BY-NC-SA 4.0: attribution is required wherever this */
/* data is shown, derived data carries the same licence, and          */
/* commercial use is forbidden. See helldivers-2_data-spike.md.       */
/* ================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const CACHE = join(ROOT, ".wiki-cache");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

const WIKI = "https://helldivers.wiki.gg/index.php?title=";
const raw = (title) => `${WIKI}${encodeURIComponent(title)}&action=raw`;

/* Planets come from the helldivers-2/json community dataset rather than */
/* the training manual API. It is MIT rather than CC BY-NC-SA, it is     */
/* committed to several times a month, and it carries what the training  */
/* manual did not: biome names instead of slugs, and hazard descriptions */
/* that state the actual mechanic. "Extreme Cold: icy temperatures       */
/* reduce rate of fire and delay heat buildup in weapons" is a scoring   */
/* rule, not flavour text.                                                */
const HD2JSON = "https://raw.githubusercontent.com/helldivers-2/json/master";

/* Map positions and supply lines are not in the JSON dataset, so they come */
/* from the same organisation's API. It is live, but position and waypoints */
/* are not: a planet does not move. Fetched here at build time like         */
/* everything else, and the live half of that response is discarded.        */
/*                                                                          */
/* Not the training manual. That source is behind by twelve planets,        */
/* including the one the current Major Order is about.                      */
const HD2API = "https://api.helldivers2.dev/api/v1/planets";

const SOURCES = {
  weapons: raw("Module:Decodedata-Attacks/weapons data.json"),
  stratagems: raw("Module:Decodedata-Attacks/stratagems data.json"),
  planets: `${HD2JSON}/planets/planets.json`,
  biomes: `${HD2JSON}/planets/biomes.json`,
  hazards: `${HD2JSON}/planets/environmentals.json`,
  map: HD2API,
};

async function pull(name, url) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}.json`);
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  const res = await fetch(url, {
    headers: {
      "user-agent": "hd2-armory (community loadout tool)",
      /* helldivers2.dev asks callers to identify themselves and refuses  */
      /* the request without it.                                          */
      "x-super-client": "hd2-armory",
      "x-super-contact": "github.com/helldivers-2",
    },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`);
  const text = await res.text();
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error(`${name}: response was not JSON. First 120 chars: ${text.slice(0, 120)}`);
  }
  writeFileSync(file, JSON.stringify(doc));
  console.log(`  pulled ${name}, ${(text.length / 1024).toFixed(0)}KB`);
  return doc;
}

/* ------------------------------------------------------------------ */
/* The join                                                            */
/*                                                                     */
/* Two rules get 95% of our items. The wiki writes SUPPLY PACK where   */
/* we write B-1 Supply Pack, so a leading model designation is         */
/* stripped as a second attempt. Everything left over is listed by     */
/* hand rather than fuzzy matched, so a wrong pairing is visible in    */
/* review. That is the same call scripts/import-images.mjs makes.      */
/* ------------------------------------------------------------------ */

const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const stripDesignation = (s) => String(s).replace(/^[A-Za-z0-9/-]*[0-9][A-Za-z0-9/-]*\s+/, "");

const OVERRIDES = {
  "cb-9-explosive-crossbow": "CB-9 EXPLODING CROSSBOW",
  "m6c-socom": "M6C/SOCOM PISTOL",
  "sh-20-ballistic-shield": "BALLISTIC SHIELD BACKPACK",
  /* The wiki page titles carry the Exosuit suffix and the data does not. */
  "exo-51-lumberer-exosuit": "LUMBERER",
  "exo-55-breakthrough-exosuit": "BREAKTHROUGH",
};

/* The nine melee weapons have no data page on the wiki. Recorded so a */
/* future run reports "still nine" rather than rediscovering it.       */
const NO_SOURCE_YET = /^CQC-|^MS-11 /;

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const clean = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return Object.keys(out).length ? out : null;
};

/* A weapon's own attacks are level 1. Level 2 and up are what those   */
/* spawn: the explosion on impact, then its shrapnel. Both are worth   */
/* having, because on a Grenade Pistol the level 1 projectile carries  */
/* the penetration and the level 2 blast carries the damage.           */
function attackProfile(pool, attackName) {
  const d = pool.damage[`${attackName}_dm`];
  if (!d) return null;
  const ap = [d.ap1, d.ap2, d.ap3, d.ap4].map(num);
  return clean({
    dmg: num(d.dmg),
    durable: num(d.dmg2),
    /* The ratio is the readable half. A weapon at 0.1 is a chaff gun    */
    /* whatever its headline damage says; one near 1.0 hurts the big     */
    /* fleshy parts just as hard.                                        */
    durableRatio: d.dmg ? Math.round((d.dmg2 / d.dmg) * 100) / 100 : null,
    ap: ap.some((x) => x !== null) ? ap : null,
    demo: num(d.demo),
    stun: num(d.stun),
    push: num(d.push),
    element: d.element_name && d.element_name !== "none" ? d.element_name : null,
    statuses: Array.isArray(d.statuses) && d.statuses.length ? d.statuses : null,
  });
}

function extract(pool, wikiName, stratEntry) {
  const w = pool.weapons[wikiName] || pool.stratagems?.[wikiName];
  if (!w) return null;

  const attacks = Array.isArray(w.attacks) ? w.attacks : [];
  /* A Guard Dog or a Rover is two entries. The backpack carries the      */
  /* attacks and declares a "weapons" attack pointing at its drone; the   */
  /* drone carries the handling and, on the Rover, the heat. Follow it,   */
  /* or the Rover reports as heat free and the hot biome rule gets it     */
  /* exactly backwards.                                                   */
  const companionRef = attacks.find((a) => a.level === 1 && a.type === "weapons");
  const companion = companionRef ? pool.weapons[companionRef.name] || null : null;
  const src = { ...(companion || {}), ...w };
  if (companion && !w.heatdata && companion.heatdata) src.heatdata = companion.heatdata;
  if (companion && w.ergonomics === undefined) src.ergonomics = companion.ergonomics;
  if (companion && w.sway === undefined) src.sway = companion.sway;

  const level1 = attacks.filter((a) => a.level === 1 && a.type !== "status" && a.type !== "weapons");
  const first = level1[0];
  const blastOf = first && attacks.find((a) => a.parent === first.name && a.type === "explosion");

  const proj = first && pool.projectile ? pool.projectile[first.name] : null;

  /* Heat is the one that changes app behaviour, so it is pulled apart   */
  /* rather than copied through. The cold and hot figures are per weapon */
  /* in the source, not a global constant, and they are the whole reason */
  /* the biome rule can be computed instead of judged.                   */
  let heat = null;
  const h = src.heatdata;
  if (h && h.heat_loss_per_second) {
    heat = clean({
      overheatAt: num(h.overheat_temp),
      perShot: num(h.heat_per_shot),
      lossPerSecond: num(h.heat_loss_per_second),
      coldMultiplier: Math.round((h.heat_loss_per_second_cold / h.heat_loss_per_second) * 100) / 100,
      hotMultiplier: Math.round((h.heat_loss_per_second_hot / h.heat_loss_per_second) * 100) / 100,
      needsReload: h.needs_reload === 1 || h.needs_reload === true ? true : null,
    });
  }

  /* The stratagem block carries what a call-in is rather than what it     */
  /* shoots: its cooldown, how many you get, the input code, and the        */
  /* game's own tags. Those tags are worth more than they look. EXPENDABLE  */
  /* and STATIONARY RELOAD were both on the list to hand author, and they   */
  /* are sourced, which means they are facts rather than our judgement.     */
  /* Resolved by the caller against its own index. An Autocannon is      */
  /* "AC-8 AUTOCANNON" in the weapons block and "AUTOCANNON" in the       */
  /* stratagem block, so looking it up here by wikiName finds nothing and */
  /* every support weapon silently loses its cooldown.                    */
  const strat = stratEntry || pool.stratagems[wikiName] || null;
  const callIn = strat
    ? clean({
        description: strat.description ? strat.description.trim() : null,
        /* The stratagem input code, which this tool has never shown for    */
        /* anything. Seven of these are the difference between remembering  */
        /* a call-in under fire and fumbling it.                            */
        code: Array.isArray(strat.combo) && strat.combo.length ? strat.combo : null,
        cooldown: num(strat.cooldown),
        /* uint32 max is how the source spells "unlimited".                 */
        uses: strat.uses === 4294967295 ? "unlimited" : num(strat.uses),
        tags: Array.isArray(strat.tags) && strat.tags.length ? strat.tags : null,
        health: num(strat.health),
        armor: num(strat.armor),
        lifetime: num(strat.lifetime),
        bombs: num(strat.num_bombs),
        salvos: num(strat.num_salvos),
        areaSize: num(strat.area_size),
        turnSpeed: num(strat.turn_hori),
        range: num(strat.vertical_range),
      })
    : null;

  /* Weapons carry the same tag vocabulary in their own block. */
  const ownTags = Array.isArray(src.tags) && src.tags.length ? src.tags : null;

  return clean({
    wiki: wikiName,
    tags: (callIn && callIn.tags) || ownTags || null,
    callIn: callIn ? (({ tags, ...rest }) => (Object.keys(rest).length ? rest : null))(callIn) : null,
    handling: clean({
      ergonomics: num(src.ergonomics),
      sway: num(src.sway),
      rpm: num(src.rpm) ?? num(src.beam_fire_rate),
      recoilClimb: src.climb ? num(src.climb.y) : null,
      spread: src.spread ? num(src.spread.x) : null,
    }),
    ammo: clean({
      magazine: num(src.cap),
      spareMagazines: num(src.mags),
      magazinesAtStart: num(src.magstart),
      fromSupply: num(src.supply),
      feed: src.roundtype || null,
    }),
    heat,
    fireModes: level1.length > 1 ? level1.length : null,
    primary: first ? attackProfile(pool, first.name) : null,
    blast: blastOf ? attackProfile(pool, blastOf.name) : null,
    projectile: proj
      ? clean({
          velocity: num(proj.velocity),
          drag: num(proj.drag),
          caliber: num(proj.caliber),
          pellets: num(proj.pellets),
        })
      : null,
  });
}

/* ------------------------------------------------------------------ */

const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

async function main() {
  console.log("\n  Fetching. Source: helldivers.wiki.gg, CC BY-NC-SA 4.0.\n");

  const weaponsDoc = await pull("weapons", SOURCES.weapons);
  const stratDoc = await pull("stratagems", SOURCES.stratagems);
  const planetDoc = await pull("planets", SOURCES.planets);
  const biomeDoc = await pull("biomes", SOURCES.biomes);
  const hazardDoc = await pull("hazards", SOURCES.hazards);
  const mapDoc = await pull("map", SOURCES.map);

  /* One pool. A support weapon is described in the weapons file and     */
  /* called in like a stratagem, so neither file alone covers our list.  */
  const pool = {
    weapons: { ...(weaponsDoc.weapons || {}), ...(stratDoc.weapons || {}) },
    stratagems: stratDoc.stratagems || {},
    damage: { ...(weaponsDoc.damage || {}), ...(stratDoc.damage || {}) },
    projectile: { ...(weaponsDoc.projectile || {}), ...(stratDoc.projectile || {}) },
    explosion: { ...(weaponsDoc.explosion || {}), ...(stratDoc.explosion || {}) },
  };

  const index = new Map();
  const remember = (name) => {
    for (const key of [norm(name), norm(stripDesignation(name))]) {
      if (key && !index.has(key)) index.set(key, name);
    }
  };
  for (const n of Object.keys(pool.weapons)) remember(n);
  for (const n of Object.keys(pool.stratagems)) remember(n);

  /* The stratagem block needs its own index for the same reason the      */
  /* main one exists, and separately, because the main index resolves a   */
  /* support weapon to its weapons entry and stops there.                 */
  const stratIndex = new Map();
  for (const n of Object.keys(pool.stratagems)) {
    for (const key of [norm(n), norm(stripDesignation(n))]) {
      if (key && !stratIndex.has(key)) stratIndex.set(key, pool.stratagems[n]);
    }
  }

  const items = load("items.json");
  const wanted = items.filter(
    (i) => i.slot === "primary" || i.slot === "secondary" || i.slot === "throwable" || i.slot === "stratagem"
  );

  const stats = {};
  const missing = [];
  for (const it of wanted) {
    const name =
      OVERRIDES[it.id] || index.get(norm(it.name)) || index.get(norm(stripDesignation(it.name))) || null;
    const strat =
      stratIndex.get(norm(it.name)) || stratIndex.get(norm(stripDesignation(it.name))) || null;
    const got = name ? extract(pool, name, strat) : null;
    if (got) stats[it.id] = got;
    else missing.push(it);
  }

  const expected = missing.filter((m) => NO_SOURCE_YET.test(m.name));
  const surprises = missing.filter((m) => !NO_SOURCE_YET.test(m.name));

  console.log(`  matched   ${Object.keys(stats).length} of ${wanted.length}  (${Math.round((Object.keys(stats).length / wanted.length) * 100)}%)`);
  console.log(`  no source ${expected.length}  (melee and Solo Silo, known)`);
  if (surprises.length) {
    console.log(`\n  UNEXPECTED MISSES, these want an override:`);
    for (const m of surprises) console.log(`    ${m.id.padEnd(34)} ${m.name}`);
  }

  /* Planets. Biome and hazards are static facts about a planet, so this */
  /* ships as a table and the app never makes a network call.            */
  /* "none" is how the source spells no hazard, and it carries a real     */
  /* description saying so. It is not a hazard and does not belong in a   */
  /* planet's list.                                                       */
  const realHazard = (h) => h && h !== "none" && h !== "normal_temperature";
  const slugHazard = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_");

  /* Two hazard fields, and the useful one is the second. environmentals  */
  /* names the headline condition; weather_effects is everything the       */
  /* planet actually throws at you, which is where the temperature lives.  */
  /* Klen Dahth II reads as sandstorms in the first and as intense heat,   */
  /* extreme cold and sandstorms in the second. A planet that is scorching */
  /* by day and freezing at night matters to a heat weapon in both         */
  /* directions, so taking only the headline would have lost half the      */
  /* rule.                                                                 */
  /* Position and supply lines, keyed by name rather than by index. Two  */
  /* sources agreeing on an order is not something to bet a map on.      */
  const mapList = Array.isArray(mapDoc) ? mapDoc : mapDoc.planets || [];
  const mapByName = new Map(mapList.map((m) => [String(m.name).toUpperCase(), m]));
  const nameOf = new Map(mapList.map((m) => [m.index, m.name]));

  const planets = Object.values(planetDoc)
    .filter((p) => p && p.name && p.name !== "Unknown")
    .map((p) => {
      /* The two sources carry two different hazard fields and neither is  */
      /* a superset of the other. weather_effects holds the temperature,   */
      /* environmentals holds the headline condition, and Widow's Harbor   */
      /* proves the point: extreme cold in one, meteor storms in the       */
      /* other. Union them or lose half the answer either way.             */
      const m = mapByName.get(String(p.name).toUpperCase());
      const hazards = [
        ...new Set([
          ...(p.weather_effects || []),
          ...(p.environmentals || []),
          ...((m && m.hazards) || []).map((h) => slugHazard(h.name)),
        ].filter(realHazard)),
      ].sort();

      return {
        name: p.name,
        sector: p.sector || null,
        biome: p.biome || null,
        type: p.type || null,
        hazards,
        headline: (p.environmentals || []).filter(realHazard)[0] || null,
        /* Normalised to roughly -1 to 1, Super Earth at the origin. This  */
        /* is what lets the picker be a map you click rather than a list   */
        /* of 281 names you scroll.                                        */
        position: m && m.position ? { x: m.position.x, y: m.position.y } : null,
        links: m && Array.isArray(m.waypoints)
          ? m.waypoints.map((i) => nameOf.get(i)).filter(Boolean)
          : [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  /* The vocabularies ship whole rather than derived from what planets    */
  /* happen to use, because the descriptions are the point: they state    */
  /* the mechanic, which is what the scoring rules will read.             */
  const named = (doc) =>
    Object.fromEntries(
      Object.entries(doc).map(([slug, v]) => [slug, { name: v.name, description: (v.description || "").trim() }])
    );
  const biomes = named(biomeDoc);
  const hazards = named(hazardDoc);
  const hazarded = planets.filter((p) => p.hazards.length).length;
  const totalHaz = planets.reduce((n, p) => n + p.hazards.length, 0);
  console.log(`
  planets   ${planets.length}, ${Object.keys(biomes).length} biomes, ${Object.keys(hazards).length} hazard kinds`);
  const placed = planets.filter((p) => p.position).length;
  const linked = planets.reduce((n, p) => n + p.links.length, 0);
  console.log(`            ${hazarded} carry at least one hazard, ${totalHaz} assignments in total`);
  console.log(`            ${placed} have map coordinates, ${linked} supply lines between them`);

  /* What the fetch says about heat, which is the field that changes app */
  /* behaviour. Reported every run because it is the load bearing one.   */
  const vents = Object.entries(stats).filter(([, s]) => s.heat);
  const flaggedThermal = items.filter((i) => i.damageType === "heat" || i.damageType === "arc");
  const wrongly = flaggedThermal.filter((i) => stats[i.id] && !stats[i.id].heat);
  const withCode = Object.values(stats).filter((v) => v.callIn && v.callIn.code).length;
  const withTags = Object.values(stats).filter((v) => v.tags).length;
  const withCooldown = Object.values(stats).filter((v) => v.callIn && v.callIn.cooldown).length;
  console.log(`
  call-ins  ${withCode} with an input code, ${withCooldown} with a cooldown`);
  console.log(`  tags      ${withTags} carry the game own tags`);
  console.log(`\n  heat      ${vents.length} items actually vent heat`);
  console.log(`            ${flaggedThermal.length} are flagged thermal by damageType`);
  if (wrongly.length) {
    console.log(`            ${wrongly.length} flagged thermal with no heat mechanic in the source:`);
    for (const i of wrongly) console.log(`              ${i.name}`);
  }

  const statsDoc = {
    source: "helldivers.wiki.gg",
    licence: "CC BY-NC-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0",
    fetchedAt: new Date().toISOString().slice(0, 10),
    note: "Generated by scripts/fetch-wiki.mjs. Never edit by hand: a re-fetch overwrites it. Curated fields live in items.json.",
    stats,
  };
  const planetsDoc = {
    source: "github.com/helldivers-2/json, positions and supply lines from api.helldivers2.dev",
    licence: "MIT",
    fetchedAt: new Date().toISOString().slice(0, 10),
    note: "Generated by scripts/fetch-wiki.mjs. Biome and hazards are static facts about a planet, so this ships as a table and the app makes no network call.",
    biomes,
    hazards,
    planets,
  };

  if (!WRITE) {
    diff("wiki-stats.json", statsDoc, (d) => d.stats);
    diff("planets.json", planetsDoc, (d) => Object.fromEntries(d.planets.map((p) => [p.name, p])));
    console.log("\n  Report only. Re-run with --write to apply.\n");
    return;
  }

  writeFileSync(join(DATA, "wiki-stats.json"), JSON.stringify(statsDoc, null, 2) + "\n");
  writeFileSync(join(DATA, "planets.json"), JSON.stringify(planetsDoc, null, 2) + "\n");
  console.log("\n  Written: src/data/wiki-stats.json, src/data/planets.json\n");
}

/* A diff rather than a silent overwrite. A generated file nobody reads */
/* the changes to is a generated file that quietly rewrites your data.  */
function diff(file, nextDoc, pick) {
  const path = join(DATA, file);
  if (!existsSync(path)) {
    console.log(`\n  ${file}: does not exist yet, ${Object.keys(pick(nextDoc)).length} entries would be created.`);
    return;
  }
  const prev = pick(JSON.parse(readFileSync(path, "utf8")));
  const next = pick(nextDoc);
  const added = Object.keys(next).filter((k) => !(k in prev));
  const removed = Object.keys(prev).filter((k) => !(k in next));
  const changed = Object.keys(next).filter(
    (k) => k in prev && JSON.stringify(prev[k]) !== JSON.stringify(next[k])
  );
  console.log(`\n  ${file}: ${added.length} added, ${removed.length} removed, ${changed.length} changed`);
  for (const k of added.slice(0, 10)) console.log(`    + ${k}`);
  for (const k of removed.slice(0, 10)) console.log(`    - ${k}`);
  for (const k of changed.slice(0, 20)) console.log(`    ~ ${k}`);
  const more = added.length + removed.length + changed.length - Math.min(added.length, 10) - Math.min(removed.length, 10) - Math.min(changed.length, 20);
  if (more > 0) console.log(`    and ${more} more`);
}

main().catch((e) => {
  console.error(`\n  Fetch failed: ${e.message}\n`);
  process.exit(1);
});
