/* ================================================================== */
/* THE TWO TYPEFACES, SERVED FROM THIS ORIGIN                         */
/*                                                                    */
/*   npm run fonts                                                    */
/*                                                                    */
/* Re-fetches Oswald and JetBrains Mono from Google once, writes the  */
/* files to public/fonts/ and the stylesheet to src/fonts.css. **A    */
/* one time job you re-run when a face changes, not a build step.**   */
/* Nothing in npm run build calls it, and the site depends on Google  */
/* neither at build time nor at run time. That is the point.          */
/*                                                                    */
/* Why it exists. App.jsx used to @import both faces from             */
/* fonts.googleapis.com. The Content-Security-Policy in               */
/* public/_headers says style-src 'self' and gives font-src nothing,  */
/* so it blocks both the stylesheet and the font files from           */
/* fonts.gstatic.com. Netlify never applied a policy, which is why    */
/* this never broke. Cloudflare does.                                 */
/*                                                                    */
/* The choice was to widen the policy to two Google hosts, or remove  */
/* the third party. Removing it is better on every axis: the policy   */
/* stays as strict as it reads, first paint stops waiting on a cross  */
/* origin round trip, and Google stops seeing every visitor's IP.     */
/*                                                                    */
/* Ported from Enodia's scripts/fonts.ts, which made the same move    */
/* for the same reason and found the bug the same way.                */
/* ================================================================== */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = join(ROOT, "public/fonts");
const OUT = join(ROOT, "src/fonts.css");

/* The exact request App.jsx used to make, kept as the record of what was
   taken. Same families, same weights: Oswald for headers and tier badges,
   JetBrains Mono for item names (CLAUDE.md, "Presentation"). */
const CSS2 =
  "https://fonts.googleapis.com/css2" +
  "?family=Oswald:wght@500;600;700" +
  "&family=JetBrains+Mono:wght@400;500" +
  "&display=swap";

/* Google serves woff2 only to a browser it recognises. Under node's own
   user agent it answers with truetype, which is roughly twice the bytes. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const slug = (name) => name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/* ------------------------------------------------------------------ */
/* Fetch and parse                                                     */
/*                                                                     */
/* Take every subset Google returns, never a hand picked `latin`.      */
/* Item names carry characters outside basic latin, and whether a      */
/* family ships a given slice varies per family, so a hand picked list */
/* would silently drop glyphs on one face and not the other. The       */
/* browser downloads only the slices a page actually renders: that is  */
/* what unicode-range is for.                                          */
/* ------------------------------------------------------------------ */

const response = await fetch(CSS2, { headers: { "User-Agent": UA } });
if (!response.ok) {
  console.error(`Google Fonts answered ${response.status}. Nothing written.`);
  process.exit(1);
}
const css = await response.text();
if (!css.includes("woff2")) {
  console.error("The response names no woff2. The user agent is probably no longer recognised.");
  process.exit(1);
}

const faces = [];
let cursor = 0;
for (const match of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
  const body = match[0];
  const at = match.index ?? 0;
  /* The subset name arrives as a comment directly above its block. */
  const comments = [...css.slice(cursor, at).matchAll(/\/\*\s*([\w-]+)\s*\*\//g)];
  cursor = at + body.length;

  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(body)?.[1];
  const family = /font-family:\s*['"]([^'"]+)['"]/.exec(body)?.[1];
  if (!url || !family) continue;

  faces.push({
    family,
    weight: /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "400",
    style: /font-style:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "normal",
    subset: comments.at(-1)?.[1] ?? "unnamed",
    url,
    body,
  });
}
if (!faces.length) {
  console.error("Parsed no @font-face blocks out of the response. Nothing written.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

/* Cleared rather than merged, so a face Google stops serving does not
   linger on disk and in the stylesheet forever. */
if (existsSync(FONTS)) {
  for (const file of readdirSync(FONTS)) if (file.endsWith(".woff2")) rmSync(join(FONTS, file));
}
mkdirSync(FONTS, { recursive: true });

const named = new Map();
let bytes = 0;
for (const face of faces) {
  /* Google's basename is already a content hash, which is what lets
     _headers cache /fonts/* as immutable. The family prefix is for
     whoever opens the folder, and it rules a collision out entirely. */
  const file = `${slug(face.family)}-${face.url.split("/").pop()}`;
  const seen = named.get(file);
  if (seen && seen !== face.url) {
    console.error(`Two faces both want ${file}. Refusing to overwrite one with the other.`);
    process.exit(1);
  }
  named.set(file, face.url);

  const path = join(FONTS, file);
  if (!existsSync(path)) {
    const font = await fetch(face.url, { headers: { "User-Agent": UA } });
    if (!font.ok) {
      console.error(`${face.url} answered ${font.status}. Nothing further written.`);
      process.exit(1);
    }
    const buffer = Buffer.from(await font.arrayBuffer());
    writeFileSync(path, buffer);
    bytes += buffer.byteLength;
  }
  face.body = face.body.replace(face.url, `/fonts/${file}`);
}

/* ------------------------------------------------------------------ */
/* The stylesheet                                                      */
/* ------------------------------------------------------------------ */

const families = [...new Set(faces.map((f) => f.family))];
const header = `/* The two typefaces, served from this origin.
 *
 * GENERATED by scripts/fonts.mjs. Do not hand edit, run npm run fonts.
 *
 * ${faces.length} faces across ${families.length} families, taken from Google's css2
 * response verbatim with every unicode-range intact. The browser downloads
 * only the slices a page needs, so the rest cost nothing.
 *
 * Vendored rather than linked so the page loads nothing from a third party
 * and the Content-Security-Policy in public/_headers can stay as strict as
 * it reads. The reasoning is in the script.
 */

`;
const blocks = faces.map((f) => `/* ${f.family} ${f.weight} ${f.style}, ${f.subset} */\n${f.body}`).join("\n\n");
writeFileSync(OUT, `${header}${blocks}\n`, "utf8");

/* ------------------------------------------------------------------ */

console.log(`\n  ${faces.length} faces, ${named.size} files, ${kb(bytes)} downloaded\n`);
for (const family of families) {
  const mine = faces.filter((f) => f.family === family);
  const subsets = [...new Set(mine.map((f) => f.subset))].sort();
  const weights = [...new Set(mine.map((f) => f.weight))];
  console.log(`  ${family.padEnd(16)} ${String(mine.length).padStart(2)} faces   weights ${weights.join(" ")}`);
  console.log(`  ${"".padEnd(16)}    ${subsets.join(" ")}`);
}
console.log("");
