/* ================================================================== */
/* WEAPON NUMBERS FROM THE GAME'S OWN TABLES                          */
/*                                                                    */
/* Reads the game's settings tables as filediver ships them, decoded, */
/* inside its own source (github.com/xypwn/filediver, BSD-3), and     */
/* writes src/data/game-stats.json in the wiki's field names, so      */
/* statsFor in src/lib/items.js can lay it over wiki-stats.json.      */
/*                                                                    */
/* It never opens the game install and never decrypts anything. The   */
/* tables are filediver's published snapshot; how its maintainers     */
/* obtain them is theirs. Our two Go files in tools/game-dump read    */
/* that snapshot to JSON, applying each weapon's default attachments  */
/* the way the armoury shows it (the Liberator's base magazine is 30, */
/* its default extended magazine makes it 45).                        */
/*                                                                    */
/* scripts/data/game-ids.json says which game entity each item is.    */
/* An item not in it takes nothing from the game.                     */
/*                                                                    */
/*   node scripts/fetch-game.mjs            report what would change  */
/*   node scripts/fetch-game.mjs --write    apply it                  */
/*   node scripts/fetch-game.mjs --refresh  pull filediver again and  */
/*                                          rebuild the dump first    */
/*                                                                    */
/* Needs git and Go (go.dev) for --refresh or a first run. Everything */
/* it fetches and builds lives in .game-data, which git ignores.      */
/* ================================================================== */

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(ROOT, ".game-data");
const FD = join(WORK, "filediver");
const DUMPS = join(WORK, "dumps");
const EXE = join(WORK, process.platform === "win32" ? "dilas-dump.exe" : "dilas-dump");
const OUT = join(ROOT, "src", "data", "game-stats.json");
const REPO = "https://github.com/xypwn/filediver.git";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REFRESH = args.includes("--refresh");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

/* Go is often installed but not on the PATH of a shell opened before it. */
function goBinary() {
  for (const g of ["go", "C:\\Program Files\\Go\\bin\\go.exe"]) {
    try { run(g, ["version"]); return g; } catch { /* next */ }
  }
  throw new Error("Go is not installed. Get it from go.dev (or: winget install GoLang.Go), then run again.");
}

/* ------------------------------------------------------------------ */
/* 1. filediver and the dump                                           */
/* ------------------------------------------------------------------ */

function prepare() {
  mkdirSync(WORK, { recursive: true });
  const fresh = !existsSync(join(FD, ".git"));
  if (fresh) {
    console.log("  cloning filediver");
    /* Full history, blobs on demand: the snapshot's date is read from it. */
    run("git", ["clone", "--filter=blob:none", "--quiet", REPO, FD]);
  } else if (REFRESH) {
    if (run("git", ["-C", FD, "rev-parse", "--is-shallow-repository"]) === "true") {
      run("git", ["-C", FD, "fetch", "--quiet", "--unshallow", "--filter=blob:none"]);
    }
    /* Our two files are copied in on every build; drop them before pulling. */
    run("git", ["-C", FD, "checkout", "--quiet", "--", "."]);
    run("git", ["-C", FD, "clean", "-fdq", "cmd/dilas-dump", "datalibrary/dilas_resolve.go"]);
    run("git", ["-C", FD, "pull", "--quiet", "--ff-only"]);
    console.log("  pulled filediver");
  }
  if (fresh || REFRESH || !existsSync(EXE) || !existsSync(join(DUMPS, "resolved.json"))) {
    const go = goBinary();
    mkdirSync(join(FD, "cmd", "dilas-dump"), { recursive: true });
    copyFileSync(join(ROOT, "tools", "game-dump", "main.go"), join(FD, "cmd", "dilas-dump", "main.go"));
    copyFileSync(join(ROOT, "tools", "game-dump", "dilas_resolve.go"), join(FD, "datalibrary", "dilas_resolve.go"));
    console.log("  building the dump");
    run(go, ["build", "-o", EXE, "./cmd/dilas-dump"], { cwd: FD });
    console.log("  dumping the tables");
    try {
      execFileSync(EXE, [DUMPS], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      throw new Error("the dump failed:\n" + (e.stderr || e.message));
    }
  }
}

/* When filediver last refreshed the tables, and which commit we read. */
function stamp() {
  const commit = run("git", ["-C", FD, "rev-parse", "HEAD"]);
  let snapshot = null;
  try {
    snapshot = run("git", ["-C", FD, "log", "-1", "--format=%cs", "--", "datalibrary/generated_damage_settings.dl_bin.gz"]) || null;
  } catch { /* a shallow clone cannot say; --refresh fixes it */ }
  return { commit, snapshot };
}

/* ------------------------------------------------------------------ */
/* 2. One block per item, in the wiki's field names                     */
/* ------------------------------------------------------------------ */

/* The game's noise templates as a number the rules can scale on.
   Suppressed is 0, then small to huge. A weapon whose sound is an
   explosion takes the size of the blast, which is our reading of the
   template's name. NoiseTemplate_None says nothing, so it is unknown,
   not silent. An unheard-of template stops the fetch. */
const NOISE = {
  NoiseTemplate_Supressor_Small: 0,
  NoiseTemplate_Weapon_Small: 1,
  NoiseTemplate_Weapon_Medium: 2,
  NoiseTemplate_Weapon_Large: 3,
  NoiseTemplate_Weapon_Huge: 4,
};
function noiseOf(t) {
  if (t == null || t === "NoiseTemplate_None") return null;
  if (t in NOISE) return NOISE[t];
  if (/^NoiseTemplate_Small_Explosion/.test(t)) return 2;
  if (/^NoiseTemplate_Medium_Explosion/.test(t)) return 3;
  if (/^NoiseTemplate_Large_Explosion/.test(t)) return 4;
  throw new Error(`a noise template nobody has placed yet: ${t}. Add it to NOISE in scripts/fetch-game.mjs.`);
}

const r2 = (x) => Math.round(x * 100) / 100;
const num = (x) => typeof x === "number" && Number.isFinite(x);

function blockFor(entity, projByType, dmgByType) {
  const c = entity.components;
  const wd = c.WeaponDataComponentData;
  const pw = c.ProjectileWeaponComponentData;
  const mag = c.WeaponMagazineComponentData;
  const rounds = c.WeaponRoundsComponentData;
  const eq = c.EquipmentComponentData;
  const b = {};

  if (wd) {
    b.handling = {};
    if (num(wd.ergonomics)) b.handling.ergonomics = wd.ergonomics;
    if (num(wd.recoil_info?.climb?.vertical_recoil)) b.handling.recoilClimb = wd.recoil_info.climb.vertical_recoil;
    const noise = noiseOf(wd.noise_temp);
    if (noise !== null) b.noise = noise;
    b.suppressed = Boolean(wd.is_suppressed);
  }
  if (pw && num(pw.rounds_per_minute?.default) && pw.rounds_per_minute.default > 0) {
    b.handling = { ...(b.handling || {}), rpm: pw.rounds_per_minute.default };
  }
  if (eq && typeof eq.is_one_handed === "boolean") b.oneHanded = eq.is_one_handed;

  /* A launcher fed from a backpack stores no magazines on the weapon, so
     zero spares there means "not on the weapon", not "none". Left out. */
  if (mag && num(mag.capacity) && mag.capacity > 0) {
    b.ammo = { magazine: mag.capacity };
    if (mag.magazines_max > 0) {
      b.ammo.spareMagazines = mag.magazines_max;
      b.ammo.magazinesAtStart = mag.magazines;
      b.ammo.fromSupply = mag.magazines_refill;
    }
  } else if (rounds && Array.isArray(rounds.magazine_capacity)) {
    /* Shell fed: the Punisher is two tubes of 8. */
    const total = rounds.magazine_capacity.reduce((a, n) => a + n, 0);
    if (total > 0) b.ammo = { magazine: total };
  }

  let type = pw?.projectile_type;
  if ((!type || type === "ProjectileType_None") && rounds) type = rounds.ammo_type?.PrimaryProjectileType;
  const p = type && projByType.get(type);
  if (p) {
    b.projectile = { velocity: r2(p.speed), drag: r2(p.drag), caliber: r2(p.calibre), pellets: p.num_projectiles };
    const d = dmgByType.get(p.damage_info_type);
    if (d) {
      b.primary = {
        dmg: d.damage,
        durable: d.durable_damage,
        durableRatio: d.damage > 0 ? r2(d.durable_damage / d.damage) : 0,
        ap: d.armor_penetration_per_angle,
        demo: d.demolition_strength,
        stun: d.force_strength,
        push: d.force_impulse,
      };
    }
  }
  if (b.handling && !Object.keys(b.handling).length) delete b.handling;
  return b;
}

/* Every leaf of a block, as "section.field", for the comparison. */
function leaves(o, pre = "") {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, leaves(v, key));
    else out[key] = v;
  }
  return out;
}
const same = (a, b) =>
  Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : Math.abs(Number(a) - Number(b)) < 0.011 || a === b;

/* ------------------------------------------------------------------ */
/* 3. Report, and write                                                 */
/* ------------------------------------------------------------------ */

function main() {
  console.log("\n  Weapon numbers. Source: Helldivers 2 game files, via filediver's decoded snapshot.\n");
  prepare();

  for (const f of ["resolved", "projectile", "damage"]) {
    if (!existsSync(join(DUMPS, f + ".json"))) throw new Error(`the dump wrote no ${f}.json. Run again with --refresh.`);
  }
  const resolved = readJson(join(DUMPS, "resolved.json"));
  const projByType = new Map(readJson(join(DUMPS, "projectile.json")).map((p) => [p.type, p]));
  const dmgByType = new Map(readJson(join(DUMPS, "damage.json")).infos.map((d) => [d.type, d]));
  const ids = readJson(join(ROOT, "scripts", "data", "game-ids.json")).map;
  const items = new Map(readJson(join(ROOT, "src", "data", "items.json")).map((i) => [i.id, i]));
  const wiki = readJson(join(ROOT, "src", "data", "wiki-stats.json")).stats;

  const stats = {};
  const problems = [];
  for (const [id, entity] of Object.entries(ids)) {
    if (!items.has(id)) { problems.push(`${id} is in game-ids.json but not in items.json`); continue; }
    if (!resolved[entity]) { problems.push(`${id}: ${entity} is not in the dump`); continue; }
    const b = blockFor(resolved[entity], projByType, dmgByType);
    if (!Object.keys(b).length) { problems.push(`${id}: ${entity} gave no numbers`); continue; }
    stats[id] = b;
  }
  if (problems.length) throw new Error("the join does not read cleanly:\n    " + problems.join("\n    "));

  /* A decode that has drifted reads garbage, and garbage disagrees with
     the wiki almost everywhere. Agreement under 80% on the fields both
     carry stops the fetch rather than writing it. */
  const diffs = [];
  const fills = {};
  let both = 0, agree = 0;
  for (const [id, b] of Object.entries(stats)) {
    const g = leaves(b), w = leaves(wiki[id]);
    for (const [k, v] of Object.entries(g)) {
      if (w[k] === undefined) { fills[k] = (fills[k] || 0) + 1; continue; }
      both++;
      if (same(v, w[k])) agree++;
      else diffs.push(`${id.padEnd(34)} ${k.padEnd(24)} wiki ${JSON.stringify(w[k])}, game ${JSON.stringify(v)}`);
    }
  }
  const share = both ? agree / both : 0;
  console.log(`  ${Object.keys(stats).length} items from the game. ${agree} of ${both} shared figures agree with the wiki (${Math.round(share * 100)}%).`);
  if (share < 0.8) throw new Error("under 80% agreement with the wiki. The decode has probably drifted; check filediver before writing.");

  console.log("\n  Fields the wiki does not have, filled from the game:");
  for (const [k, n] of Object.entries(fills).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(24)} ${n}`);
  console.log(`\n  Where the game and the wiki disagree (${diffs.length}); the game's figure is used unless items.js lists an exception:`);
  for (const d of diffs) console.log("    " + d);

  /* Our suppressed tag against the game's flag. The Re-Educator is kept
     tagged by hand: the game gives it no noise at all. */
  const tagDiffs = [];
  for (const [id, b] of Object.entries(stats)) {
    const ours = (items.get(id).tags || []).includes("suppressed");
    if (b.suppressed !== ours) tagDiffs.push(`${id}: tag ${ours}, game ${b.suppressed}`);
  }
  if (tagDiffs.length) console.log("\n  Suppressed, our tag against the game:\n    " + tagDiffs.join("\n    "));

  const { commit, snapshot } = stamp();
  const doc = {
    source: "Helldivers 2 game files, via filediver's decoded snapshot",
    sourceUrl: "https://github.com/xypwn/filediver",
    filediverCommit: commit,
    snapshotDate: snapshot,
    note: "Generated by scripts/fetch-game.mjs. Never edit by hand: a re-fetch overwrites it. Laid over wiki-stats.json by statsFor in src/lib/items.js, field by field. noise is the game's noise template: 0 suppressed, 1 small, 2 medium, 3 large, 4 huge.",
    stats,
  };

  const before = existsSync(OUT) ? readJson(OUT) : null;
  const unchanged = before && JSON.stringify(before.stats) === JSON.stringify(stats) && before.filediverCommit === commit;
  if (!WRITE) {
    console.log(`\n  ${before ? (unchanged ? "No change to" : "Would change") : "Would create"} src/data/game-stats.json. Re-run with --write to apply.\n`);
    return;
  }
  if (unchanged) {
    console.log("\n  src/data/game-stats.json is already current.\n");
    return;
  }
  /* Written in place: writeFileSync truncates rather than replacing. */
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log("\n  Written: src/data/game-stats.json\n");
}

try {
  main();
} catch (e) {
  console.error("\n  " + e.message + "\n");
  process.exit(1);
}
