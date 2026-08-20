/* ================================================================== */
/* ADD VEHICLES                                                       */
/*                                                                    */
/* A one shot. The eight vehicles and exosuits have had art in the    */
/* library since 18 August and no item entry, because no source table */
/* this project had listed a single one of them. The wiki fetch on 20 */
/* August changed that: all eight are in the stratagem data with      */
/* their designations, cooldowns, hull values and mounted weapons.    */
/*                                                                    */
/* Every stat below is read out of the fetched data rather than       */
/* typed in, apart from the four editorial fields at the bottom of    */
/* each entry, which are marked.                                      */
/*                                                                    */
/*   node scripts/add-vehicles.mjs           report                    */
/*   node scripts/add-vehicles.mjs --write   apply                     */
/* ================================================================== */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const CACHE = join(ROOT, ".wiki-cache");
const WRITE = process.argv.includes("--write");

if (!existsSync(join(CACHE, "stratagems.json"))) {
  console.error("\n  No cached wiki data. Run: node scripts/fetch-wiki.mjs --refresh\n");
  process.exit(1);
}

const strat = JSON.parse(readFileSync(join(CACHE, "stratagems.json"), "utf8"));
const items = JSON.parse(readFileSync(join(DATA, "items.json"), "utf8"));

/* Canonical names confirmed against the wiki's own page titles, not     */
/* assembled from the designation and the short name. "EXO-51 Lumberer"  */
/* is a redirect; the page is "EXO-51 Lumberer Exosuit".                 */
/*                                                                       */
/* The editorial fields are damageType, roles and note. Everything else  */
/* is read from the source below.                                        */
const PLAN = [
  {
    wiki: "GUNNER FRV",
    name: "M-102 Gunner FRV",
    damageType: "ballistic",
    roles: ["chaff"],
    note: "four wheels and a Heavy Machine Gun. Someone has to drive, so it costs you a gun and a pair of hands",
  },
  {
    wiki: "SUPPLY FRV",
    name: "M-103 Supply FRV",
    damageType: "utility",
    roles: [],
    note: "resupply that drives to you. The turret is incidental",
  },
  {
    wiki: "INCINERATOR FRV",
    name: "M-104 Incinerator FRV",
    damageType: "fire",
    roles: ["chaff"],
    note: "heavier hull, a roof flamethrower and a ramming grille. Seats three instead of four",
  },
  {
    wiki: "PATRIOT EXOSUIT",
    name: "EXO-45 Patriot Exosuit",
    damageType: "explosive",
    roles: ["anti-armor", "chaff"],
    note: "gatling in one hand, rockets in the other. The rockets are the reason to bring it",
  },
  {
    wiki: "EMANCIPATOR EXOSUIT",
    name: "EXO-49 Emancipator Exosuit",
    damageType: "explosive",
    roles: ["anti-armor"],
    note: "two autocannons. Opens medium armor from either arm and keeps doing it",
  },
  {
    wiki: "LUMBERER",
    name: "EXO-51 Lumberer Exosuit",
    damageType: "fire",
    roles: ["anti-armor", "chaff"],
    note: "flamethrower and an anti-tank cannon on the same frame, which is a strange and useful pair",
  },
  {
    wiki: "BREAKTHROUGH",
    name: "EXO-55 Breakthrough Exosuit",
    damageType: "ballistic",
    roles: ["chaff"],
    note: "a scattergun exosuit. Close range, and the only exosuit with nothing that opens heavy armor",
  },
  {
    wiki: "BASTION MK XVI",
    name: "TD-220 Bastion MK XVI",
    damageType: "explosive",
    roles: ["anti-armor", "objective"],
    note: "a tank destroyer. 8000 hull, a 120mm cannon and demolition 40, which closes holes from outside",
  },
];

const slug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* AP to class, the convention already in the data: 2 and 3 carry no    */
/* class, 4 is Heavy, 5 and above is AT.                                */
const apClassFor = (ap) => (ap === null ? null : ap >= 5 ? "AT" : ap >= 4 ? "Heavy" : null);

/* The best of everything the thing is carrying. A Patriot is an anti    */
/* tank platform because of its rockets, not despite its gatling.        */
function best(entry) {
  let ap = null;
  let demo = null;
  for (const a of entry.attacks || []) {
    const mount = strat.weapons[a.name];
    for (const z of (mount && mount.attacks) || []) {
      if (z.level !== 1 || z.type === "status") continue;
      const d = strat.damage[`${z.name}_dm`];
      if (!d) continue;
      const topAp = Math.max(d.ap1 ?? 0, d.ap2 ?? 0, d.ap3 ?? 0, d.ap4 ?? 0);
      if (topAp && (ap === null || topAp > ap)) ap = topAp;
      if (d.demo && (demo === null || d.demo > demo)) demo = d.demo;
    }
  }
  return { ap, demo };
}

const built = [];
const problems = [];

for (const p of PLAN) {
  const e = strat.stratagems[p.wiki];
  if (!e) {
    problems.push(`${p.wiki}: not in the cached stratagem data`);
    continue;
  }
  const id = slug(p.name);
  if (items.some((i) => i.id === id)) {
    problems.push(`${id}: already exists in items.json`);
    continue;
  }
  const { ap, demo } = best(e);

  built.push({
    id,
    name: p.name,
    aliases: [],
    slot: "stratagem",
    stratType: "vehicle",
    category: null,
    damageType: p.damageType,
    /* You get into it. It cannot also be on your back. */
    usesBackpackSlot: false,
    acquisition: { type: "requisition", warbond: null },
    stats: {
      ap,
      apClass: apClassFor(ap),
      dps: null,
      capacity: null,
      demoForce: demo,
      cooldown: e.cooldown ?? null,
      /* uint32 max is how the source spells unlimited, which is not a    */
      /* number this field can hold. Null reads as "not recorded", which  */
      /* is honest: the real answer is in wiki-stats under callIn.uses.   */
      uses: e.uses === 4294967295 ? null : e.uses ?? null,
      usesUpgraded: null,
      medals: null,
    },
    /* No community rating exists for any of these. Unrated is a first    */
    /* class state here: the row shows a dashed badge and sorts last,     */
    /* and every tier floor lets it through. Same treatment the four      */
    /* Castellan's Creed weapons get.                                     */
    ratings: {
      bots: { tier: null, source: null, patch: null },
      bugs: { tier: null, source: null, patch: null },
      squids: { tier: null, source: null, patch: null },
    },
    roles: p.roles,
    traits: [],
    flag: "new",
    patchNote: null,
    effect: null,
    note: p.note,
  });
}

if (problems.length) {
  console.error("\n  Problems:\n");
  for (const p of problems) console.error(`    ${p}`);
  console.error("");
  if (!built.length) process.exit(1);
}

console.log(`\n  ${built.length} vehicle entries built from the fetched data:\n`);
for (const b of built) {
  console.log(
    `    ${b.id.padEnd(28)} AP ${String(b.stats.ap ?? "-").padStart(2)}${(b.stats.apClass || "").padStart(6)}  ` +
      `demo ${String(b.stats.demoForce ?? "-").padStart(2)}  ${b.stats.cooldown}s  ${b.roles.join(", ") || "no roles"}`
  );
}

if (!WRITE) {
  console.log("\n  Report only. Re-run with --write to apply.\n");
  process.exit(0);
}

/* Appended rather than sorted in. items.json has no ordering contract   */
/* and every lookup is by id, so position carries no meaning.            */
writeFileSync(join(DATA, "items.json"), JSON.stringify([...items, ...built], null, 2) + "\n");
console.log(`\n  Written. items.json is now ${items.length + built.length} items.\n`);
