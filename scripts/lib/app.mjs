/* ================================================================== */
/* THE APP'S OWN LIBS, LOADED IN NODE                                 */
/*                                                                    */
/* src/lib imports JSON the way Vite resolves it, which plain Node    */
/* rejects. This inlines those imports and hands back the real        */
/* modules, so a script measures the code that ships rather than a    */
/* copy of it that can drift.                                         */
/*                                                                    */
/* It exists because two scripts needed the same twenty lines, and    */
/* the first copy carried a peril formula that the code had stopped   */
/* matching two versions earlier. That is exactly the drift this      */
/* prevents.                                                          */
/* ================================================================== */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const read = (p) => readFileSync(join(ROOT, p), "utf8");
export const readJson = (p) => JSON.parse(read(p));

const asModule = (src) => "data:text/javascript;base64," + Buffer.from(src).toString("base64");

/* Swaps `import X from "../data/y.json"` for the file's contents.
   A plain string match rather than a pattern: these lines are written by
   hand and never vary, and a regex here has to escape a path separator
   and a dot for no gain. It throws on a miss, because an import that
   quietly failed to inline reads as a resolver error two hundred lines
   later with none of the useful information in it. */
function inlineJson(src, ...names) {
  return names.reduce((s, name) => {
    const line = s.split("\n").find((l) => l.startsWith("import ") && l.includes(`"../data/${name}.json"`));
    if (!line) throw new Error(`no import of ../data/${name}.json to inline`);
    const binding = line.split(/\s+/)[1];
    return s.replace(line, `const ${binding} = ${read(`src/data/${name}.json`)};`);
  }, src);
}

const swap = (src, file, url) => src.replaceAll(`from "./${file}.js"`, `from "${url}"`);

const enemiesUrl = asModule(inlineJson(read("src/lib/enemies.js"), "enemies"));

const itemsUrl = asModule(inlineJson(read("src/lib/items.js"), "items", "warbonds", "vocabulary", "wiki-stats"));

/* scenario.js pulls in React for useScenario, which a script has no use
   for and cannot load. Only the mission traits are ever reached from the
   scoring path, so this stands in for that one export rather than
   dragging the hook and localStorage in behind it. */
const scenarioUrl = asModule(
  `const MISSIONS = ${read("src/data/missions.json")};
   const byName = new Map(MISSIONS.missions.map((m) => [m.name, m]));
   export const missions = MISSIONS.missions;
   export const traitsOf = (n) => (byName.get(n) || { traits: [] }).traits;`
);

let src = inlineJson(read("src/lib/loadouts.js"), "loadouts");
const loadoutsUrl = asModule(swap(src, "items", itemsUrl));

src = inlineJson(read("src/lib/score.js"), "context-rules");
src = swap(src, "items", itemsUrl);
src = swap(src, "loadouts", loadoutsUrl);
src = swap(src, "scenario", scenarioUrl);
const scoreUrl = asModule(swap(src, "enemies", enemiesUrl));

src = swap(read("src/lib/squad.js"), "items", itemsUrl);
src = swap(src, "loadouts", loadoutsUrl);
const squadUrl = asModule(swap(src, "score", scoreUrl));

src = inlineJson(read("src/lib/build.js"), "build-rules");
src = swap(src, "items", itemsUrl);
src = swap(src, "loadouts", loadoutsUrl);
src = swap(src, "score", scoreUrl);
src = swap(src, "squad", squadUrl);
const buildUrl = asModule(swap(src, "enemies", enemiesUrl));

const historyUrl = asModule(swap(read("src/lib/history.js"), "loadouts", loadoutsUrl));

src = inlineJson(read("src/lib/drop.js"), "vocabulary");
src = swap(src, "loadouts", loadoutsUrl);
src = swap(src, "build", buildUrl);
src = swap(src, "history", historyUrl);
const dropUrl = asModule(swap(src, "scenario", scenarioUrl));

src = swap(read("src/lib/coverage.js"), "drop", dropUrl);
const coverageUrl = asModule(swap(src, "scenario", scenarioUrl));

src = inlineJson(read("src/lib/share.js"), "vocabulary");
const shareModuleUrl = asModule(swap(src, "drop", dropUrl));

const galaxyUrl = asModule(inlineJson(read("src/lib/galaxy.js"), "planets"));

export const items = await import(itemsUrl);
export const enemies = await import(enemiesUrl);
export const score = await import(scoreUrl);
export const loadouts = await import(loadoutsUrl);
export const squad = await import(squadUrl);
export const build = await import(buildUrl);
export const drop = await import(dropUrl);
export const history = await import(historyUrl);
export const share = await import(shareModuleUrl);
export const coverage = await import(coverageUrl);
export const galaxy = await import(galaxyUrl);

export const FACTIONS = ["bots", "bugs", "squids"];
