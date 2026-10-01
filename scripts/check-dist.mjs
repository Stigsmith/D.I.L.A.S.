/* ================================================================== */
/* IS THE BUILD WHOLE?                                                */
/*                                                                    */
/* Runs after every build and again just before a deploy uploads     */
/* anything. Every file the page asks for must be in dist, and no     */
/* "Name clash" copy may sit in it.                                   */
/*                                                                    */
/* Why: the sync app watching this folder renamed dist/assets seconds */
/* after a build on 1 October 2026. Deployed like that, the page asks */
/* for a script that is not there, the server answers with the page   */
/* instead, and _headers tells every browser to keep that answer for  */
/* a year under the script's name. A blank site that stays blank for  */
/* the people who saw it. Exits non zero so the deploy stops.         */
/* ================================================================== */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CLASH } from "./lib/empty-in-place.mjs";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const fail = [];

const page = join(DIST, "index.html");
if (!existsSync(page)) fail.push("dist/index.html is missing: run npm run build");
else {
  const html = readFileSync(page, "utf8");
  const wanted = [...html.matchAll(/(?:src|href)="\/([^"#?]+)"/g)].map((m) => m[1]);
  if (!wanted.some((w) => w.startsWith("assets/") && w.endsWith(".js"))) fail.push("the page names no script under /assets");
  for (const w of wanted) if (!existsSync(join(DIST, w))) fail.push(`the page asks for /${w}, which is not in dist`);
}

const walk = (dir, rel = "") => {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (CLASH.test(d.name)) fail.push(`dist/${rel}${d.name} is a sync app copy`);
    else walk(join(dir, d.name), `${rel}${d.name}/`);
  }
};
if (existsSync(DIST)) walk(DIST);

if (fail.length) {
  console.error("The build in dist is not whole, so it must not be deployed:");
  for (const f of fail) console.error(`  ${f}`);
  console.error("Most likely the sync app renamed a folder. Run npm run build again; if it keeps happening, exclude dist from the sync.");
  process.exit(1);
}
console.log("dist is whole: every file the page asks for is there");
