/* ================================================================== */
/* RATE VEHICLES                                                      */
/*                                                                    */
/* A one shot, run once and kept for the record. The eight vehicles   */
/* went in unrated on 20 August because no tier list covered them.    */
/* u.gg's vehicle page does, and the curator supplied it the same     */
/* day, along with the acquisition path for each one.                 */
/*                                                                    */
/* Column order is Bots, Bugs, Squids, which is what every table in   */
/* helldivers-2_tables.md uses and what u.gg publishes.               */
/*                                                                    */
/* Two of the eight turn out to be warbond items rather than          */
/* requisition, which is exactly what the open question in the        */
/* roadmap asked about. Exo Experts was already in warbonds.json.     */
/*                                                                    */
/*   node scripts/rate-vehicles.mjs           report                   */
/*   node scripts/rate-vehicles.mjs --write   apply                    */
/* ================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const WRITE = process.argv.includes("--write");

const items = JSON.parse(readFileSync(join(DATA, "items.json"), "utf8"));

/* u.gg's vehicle page, stamped patch 7.0.0. Every other u.gg list this  */
/* project uses is stamped 6.3.1, so these eight are the only weapon     */
/* ratings here that are actually current with the game.                 */
const PATCH = "7.0.0";

/* "Patriotic Administration Center" is the ship module shop, which is    */
/* the requisition path. "Campaign Reward" already exists as an           */
/* acquisition type. "Exo Experts" is a premium warbond already listed.   */
const RATED = {
  "m-102-gunner-frv": { t: ["S+", "S+", "S+"], via: { type: "requisition", warbond: null } },
  "m-103-supply-frv": { t: ["S+", "S+", "S+"], via: { type: "campaign", warbond: null } },
  "m-104-incinerator-frv": { t: ["S+", "S+", "S+"], via: { type: "campaign", warbond: null } },
  "exo-45-patriot-exosuit": { t: ["A", "A", "B"], via: { type: "requisition", warbond: null } },
  "exo-49-emancipator-exosuit": { t: ["S", "S", "S+"], via: { type: "requisition", warbond: null } },
  "exo-51-lumberer-exosuit": { t: ["S", "S", "B"], via: { type: "warbond", warbond: "exo-experts" } },
  "exo-55-breakthrough-exosuit": { t: ["S", "S", "S+"], via: { type: "warbond", warbond: "exo-experts" } },
  "td-220-bastion-mk-xvi": { t: ["S+", "B", "B"], via: { type: "requisition", warbond: null } },
};

/* u.gg publishes a cooldown and a hull figure too, and on two counts it  */
/* disagrees with the game data the wiki fetch pulled. Recorded rather    */
/* than reconciled: this project's standing rule is that a real           */
/* disagreement between credible sources is worth knowing rather than     */
/* averaging away.                                                        */
const DISAGREEMENTS = [
  ["exosuit cooldown", "u.gg says 600s for all four exosuits", "game data says 420s"],
  ["EXO-45 Patriot hull", "u.gg says 1600", "game data says 1800"],
];

const changes = [];
for (const it of items) {
  const r = RATED[it.id];
  if (!r) continue;
  const [bots, bugs, squids] = r.t;
  changes.push({
    id: it.id,
    name: it.name,
    was: `${it.ratings.bots.tier ?? "?"}/${it.ratings.bugs.tier ?? "?"}/${it.ratings.squids.tier ?? "?"}`,
    now: `${bots}/${bugs}/${squids}`,
    acqWas: it.acquisition.type,
    acqNow: r.via.warbond ? `${r.via.type} (${r.via.warbond})` : r.via.type,
  });
  if (!WRITE) continue;

  const stamp = (tier) => ({ tier, source: "ugg", patch: PATCH });
  it.ratings = { bots: stamp(bots), bugs: stamp(bugs), squids: stamp(squids) };
  it.acquisition = r.via;
  /* "new" means in the game with no rating yet. They have one now. */
  it.flag = null;
}

const missing = Object.keys(RATED).filter((id) => !items.some((i) => i.id === id));
if (missing.length) {
  console.error(`\n  ${missing.length} id(s) in this script match no item:\n    ${missing.join("\n    ")}\n`);
  process.exit(1);
}

console.log(`\n  ${changes.length} vehicles, rated from u.gg at patch ${PATCH}. Column order Bots / Bugs / Squids.\n`);
for (const c of changes) {
  console.log(`    ${c.name.padEnd(28)} ${c.was.padEnd(9)} -> ${c.now.padEnd(9)}  ${c.acqWas} -> ${c.acqNow}`);
}

console.log(`\n  Where u.gg and the game data disagree, both are kept:`);
for (const [what, a, b] of DISAGREEMENTS) console.log(`    ${what.padEnd(22)} ${a}, ${b}`);

if (!WRITE) {
  console.log("\n  Report only. Re-run with --write to apply.\n");
  process.exit(0);
}

writeFileSync(join(DATA, "items.json"), JSON.stringify(items, null, 2) + "\n");
console.log("\n  Written.\n");
