/* ================================================================== */
/* ROLE TAGGING                                                       */
/*                                                                    */
/* Writes the `roles` array on every item in items.json. Two tags     */
/* only, anti-armor and objective, because those are the two the      */
/* coverage warnings ask about. Re-runnable and idempotent: change a  */
/* list below, run it again, and the data catches up.                 */
/*                                                                    */
/* This exists as a script rather than as hand edited JSON because    */
/* the anti-armor half is mostly derived, and a derivation you cannot */
/* re-run is a derivation nobody trusts after the first patch.        */
/*                                                                    */
/*   node scripts/tag-roles.mjs          report what would change     */
/*   node scripts/tag-roles.mjs --write  write it                     */
/*                                                                    */
/* These tags are OUR judgment, not a sourced vote. Every rating in   */
/* this project is a u.gg aggregate with a patch stamp. Roles are     */
/* not, and the UI has to say so wherever provenance is shown.        */
/* ================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const ITEMS = join(DATA, "items.json");
const items = JSON.parse(readFileSync(ITEMS, "utf8"));
const write = process.argv.includes("--write");

/* ------------------------------------------------------------------ */
/* anti-armor                                                          */
/*                                                                     */
/* Derived from the armor class the source tables record, then gated   */
/* on lethality, then corrected by hand in both directions.            */
/*                                                                     */
/* The gate is the important part. AP records what armor a projectile  */
/* interacts with, not whether it kills: G-23 Stun is AP6 AT and the   */
/* EMS Mortar Sentry is AP6 AT with a note reading "non-lethal". A     */
/* squad carrying two stun grenades is not carrying anti-tank.         */
/* ------------------------------------------------------------------ */

const LETHALITY_GATE = ["utility", "gas"];

/* AP 4 Heavy items that do open armor. This is the band where no rule */
/* works and the call has to be made one item at a time.               */
const HEAVY_INCLUDE = [
  "ac-8-autocannon",           /* the doc's own example, and it is right */
  "flam-40-flamethrower",      /* burns Charger legs, the classic answer on bugs */
  "b-flam-80-cremator",        /* same job, backpack fed */
  "apw-1-anti-materiel-rifle", /* Hulk eye, Devastator, turret vents */
  "las-98-laser-cannon",       /* Hulk eye and gunship engines, infinite ammo */
];

/* Items the derivation catches that do not answer a heavy in practice. */
const EXCLUDE = [
  "cqc-20-breaching-hammer",   /* melee. You cannot answer a Bile Titan with a hammer */
  "tm-1-lure-mine",            /* it attracts, it does not kill armor */
  "g-109-urchin",              /* AP6 on paper, D on two fronts, demo 0 */
  "cqc-9-defoliation-tool",    /* AP5 on paper, D and C ratings */
];

/* ------------------------------------------------------------------ */
/* chaff                                                               */
/*                                                                     */
/* Sustained clear of light enemies at volume. The distinction that     */
/* matters is rate, not capability: almost anything can kill one        */
/* hunter, and that is not what the tag is about. It is about holding   */
/* off a swarm without reloading into your own death.                   */
/*                                                                     */
/* So the Eruptor is not chaff. It kills a hunter and takes a second    */
/* doing it, and a squad built entirely of Eruptors and Senators has a  */
/* real hole even though every one of those guns can hurt a small       */
/* enemy. Weapon category does most of the work; the rest is listed.    */
/* ------------------------------------------------------------------ */

const CHAFF_CATEGORIES = ["Assault Rifle", "SMG", "Shotgun"];

/* Categories the rule cannot decide. Energy and Special hold both the  */
/* Sickle, which is chaff, and the Railgun, which is not.               */
const CHAFF_INCLUDE = [
  /* Energy and special primaries that genuinely hose a crowd */
  "las-16-sickle",
  "las-17-double-edge-sickle",
  "las-5-scythe",
  "arc-12-blitzer",
  "plas-101-purifier",           /* its own note calls it the best chaff clear on every front */
  "sg-225ie-breaker-incendiary",
  "flam-66-torcher",
  "las-13-trident",
  /* Support weapons built for volume */
  "m-105-stalwart",
  "mgx-42-bullet-storm",
  "mg-43-machine-gun",
  "m-1000-maxigun",
  "mg-206-heavy-machine-gun",
  "flam-40-flamethrower",
  "b-flam-80-cremator",
  "gl-21-grenade-launcher",
  "arc-3-arc-thrower",
  /* Sentries and call-ins that hold a line on their own */
  "a-g-16-gatling-sentry",
  "a-mg-43-machine-gun-sentry",
  "a-flam-40-flame-sentry",
  "a-las-98-laser-sentry",
  "eagle-strafing-run",
  "eagle-napalm-airstrike",
  "eagle-cluster-bomb",
  "orbital-gatling-barrage",
  "orbital-napalm-barrage",
  "orbital-gas-strike",
  "md-i4-incendiary-mines",
  /* Vehicles. No category covers them, so they are listed by hand, and
     a --write run without them here would strip their roles. */
  "m-102-gunner-frv",
  "m-104-incinerator-frv",
  "exo-45-patriot-exosuit",
  "exo-51-lumberer-exosuit",
  "exo-55-breakthrough-exosuit",
];

/* Caught by category, but too slow or too precise to hold off a swarm. */
const CHAFF_EXCLUDE = [
  "cb-9-explosive-crossbow",
  "sg-8s-slugger",
  "sg-451-cookout",
];

/* ------------------------------------------------------------------ */
/* objective                                                           */
/*                                                                     */
/* Closes a bug hole, a fabricator or a warp ship from the kit you are */
/* carrying, repeatedly. Eagles and orbitals are excluded on purpose:  */
/* the point of the tag is being able to close a hole without burning  */
/* a call-in, which is the thing a squad runs out of.                  */
/*                                                                     */
/* demoForce assists on throwables and reaches nothing else. 40 closes */
/* from outside, 30 needs an inside throw. Everything else is listed.  */
/* ------------------------------------------------------------------ */

const DEMO_FLOOR = 30;

const OBJECTIVE_INCLUDE = [
  "gp-31-grenade-pistol",            /* the reason a secondary slot is worth anything */
  "r-36-eruptor",                    /* its own note already says it closes holes and fabricators */
  "gl-21-grenade-launcher",
  "gl-28-belt-fed-grenade-launcher",
  "ac-8-autocannon",                 /* closes fabricators at range */
  "mls-4x-commando",                 /* fabricators from a distance, four shots */
  "gr-8-recoilless-rifle",
  "eat-17-expendable-anti-tank",
  "las-99-quasar-cannon",
  "gp-20-ultimatum",
  "p-34-breacher",                   /* demo 30 blast on the wiki, like the Grenade Pistol; three rounds */
  "md-17-anti-tank-mines",           /* note: demo 40 as of 7.0.0, closes holes from outside */
  "td-220-bastion-mk-xvi",           /* a main cannon at demo 40 */
];

/* Throwables the demo floor catches that do not actually close a hole. */
const OBJECTIVE_EXCLUDE = [
  "tm-1-lure-mine",                  /* demo 30 recorded, but it is bait, not a charge */
];

/* ================================================================== */

const byId = new Map(items.map((i) => [i.id, i]));
const isRated = (i) => Object.values(i.ratings).some((r) => r && r.tier);

const unknown = [...HEAVY_INCLUDE, ...EXCLUDE, ...CHAFF_INCLUDE, ...CHAFF_EXCLUDE,
  ...OBJECTIVE_INCLUDE, ...OBJECTIVE_EXCLUDE].filter((id) => !byId.has(id));
if (unknown.length) {
  console.error(`\n  These ids resolve to nothing:\n    ${unknown.join("\n    ")}\n`);
  process.exit(1);
}

const antiArmor = (item) => {
  if (EXCLUDE.includes(item.id)) return false;
  if (HEAVY_INCLUDE.includes(item.id)) return true;
  if (LETHALITY_GATE.includes(item.damageType)) return false;
  /* AT class is the clean band. Heavy is AP 4 and is decided by hand   */
  /* through HEAVY_INCLUDE, so it never qualifies on class alone.       */
  return item.stats.apClass === "AT";
};

const chaff = (item) => {
  if (CHAFF_EXCLUDE.includes(item.id)) return false;
  if (CHAFF_INCLUDE.includes(item.id)) return true;
  return CHAFF_CATEGORIES.includes(item.category);
};

const objective = (item) => {
  if (OBJECTIVE_EXCLUDE.includes(item.id)) return false;
  if (OBJECTIVE_INCLUDE.includes(item.id)) return true;
  /* Throwables only, as the comment above the floor has always said. The
     code used to apply it to everything, which would have tagged three
     exosuits as hole closers on the strength of their demolition figure
     the first time anyone ran --write after the vehicles landed. */
  return item.slot === "throwable" && item.stats.demoForce !== null && item.stats.demoForce >= DEMO_FLOOR;
};

let changed = 0;
const added = { "anti-armor": [], chaff: [], objective: [] };

for (const item of items) {
  const roles = [];
  if (antiArmor(item)) roles.push("anti-armor");
  if (chaff(item)) roles.push("chaff");
  if (objective(item)) roles.push("objective");
  for (const r of roles) added[r].push(item.name);

  const before = JSON.stringify(item.roles || []);
  if (before !== JSON.stringify(roles)) changed += 1;
  item.roles = roles;
}

/* Ordered so the field lands next to the other judgment fields rather */
/* than at the end of the object, where it reads as an afterthought.   */
/* An armour passive's numbers sit right after its effect line, since  */
/* the two are edited together; undefined drops out for everything else. */
const ordered = items.map((item) => {
  const { roles, traits, flag, patchNote, effect, passive, note, ...head } = item;
  return { ...head, roles, traits, flag, patchNote, effect, passive, note };
});

const rated = items.filter(isRated);
const tagged = rated.filter((i) => i.roles.length);

console.log(`\n  anti-armor  ${added["anti-armor"].length}`);
console.log(`  chaff       ${added.chaff.length}`);
console.log(`  objective   ${added.objective.length}`);
console.log(`  untagged    ${rated.length - tagged.length} of ${rated.length} rated, which is normal\n`);

if (write) {
  writeFileSync(ITEMS, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(`  Wrote ${changed} changed rows to items.json\n`);
} else {
  console.log(`  ${changed} rows would change. Pass --write to apply.\n`);
  console.log(`  anti-armor: ${added["anti-armor"].join(", ")}\n`);
  console.log(`  chaff: ${added.chaff.join(", ")}\n`);
  console.log(`  objective: ${added.objective.join(", ")}\n`);
}
