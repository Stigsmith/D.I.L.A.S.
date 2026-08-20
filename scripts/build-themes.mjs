/* ================================================================== */
/* THEME TOKEN BUILDER                                                */
/*                                                                    */
/* Each warbond skin ships a standalone palette study in              */
/* Image Library/Themes/<Name>/. The study is the source: it fixes the   */
/* palette and argues the reasoning before any of it reaches the app. */
/*                                                                    */
/* A study speaks in surfaces (bg, surface, surface2, border, fg).    */
/* The app speaks in one positional ramp where 950 is furthest back   */
/* and 100 is the most prominent text. This converts between them so  */
/* a new skin is a config entry rather than 22 hand mixed values.     */
/*                                                                    */
/*   node scripts/build-themes.mjs                                    */
/*                                                                    */
/* It prints CSS. Paste it into src/index.css, which stays the single */
/* source and stays hand tunable: generated colour is a starting      */
/* point, not a substitute for looking at it.                         */
/* ================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THEMES = join(ROOT, "Image Library", "Themes");

/* Per skin decisions the study does not make for us. `brand` names the  */
/* study token used for the Super Earth mark and the active chrome.      */
/*                                                                       */
/* `accent` is left alone on purpose. It drives the padlock and the star, */
/* and it stays amber in every theme so a locked item never reads as the  */
/* brand mark. Several studies paint their own signature colour there;    */
/* that is a real disagreement and is recorded in CLAUDE.md rather than   */
/* quietly applied.                                                       */
const SKINS = {
  "automaton": { label: "Automaton", note: "Foundry steel and warning red", brand: "led", scheme: "dark" },
  "bile-titan": { label: "Bile Titan", note: "Terminid chitin and acid", brand: "acid", scheme: "dark" },
  "castellans-creed": { label: "Castellan's Creed", note: "Cadian green and gold, the first warbond skin", brand: "gold", scheme: "dark" },
  "entrenched-division": { label: "Entrenched Division", note: "Trench olive and mustard, smoke and gas", brand: "mustard", scheme: "dark" },
  "odst": { label: "ODST", note: "New Mombasa at night, Superintendent green and rain", brand: "super", scheme: "dark" },
  "hellpod-drop-bay": { label: "Hellpod Drop Bay", note: "Deck plate and hazard yellow", brand: "hazard", scheme: "dark" },
  "malevelon-creek": { label: "Malevelon Creek", note: "Jungle green and tracer fire", brand: "sage", scheme: "dark" },
  "ministry-of-truth": { label: "Ministry of Truth", note: "Bureau paper and stamp navy. The second light theme", brand: "accent", scheme: "light" },
  "super-destroyer": { label: "Super Destroyer", note: "Hull grey and console amber", brand: "amber", scheme: "dark" },
  "viper-commandos": { label: "Viper Commandos", note: "Jungle teal and khaki", brand: "teal", scheme: "dark" },
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const hex = (h) => {
  const s = h.replace("#", "").trim();
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const mix = (a, b, t) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t));
const rgb = (v) => (Array.isArray(v) ? v : hex(v)).join(" ");

/* Read the :root block of the newest study in a skin folder. Newest by   */
/* modification time, not by name: Castellan's holds both a v2 and the    */
/* original, and the original speaks a different token vocabulary that    */
/* predates the shared one.                                               */
function tokensFor(folder) {
  const study = readdirSync(join(THEMES, folder))
    .filter((f) => /\.html?$/i.test(f))
    .map((f) => ({ f, t: statSync(join(THEMES, folder, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0].f;
  const css = readFileSync(join(THEMES, folder, study), "utf8");
  const out = {};
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2];
  }
  return { study, tokens: out };
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";

function ramp(t, scheme) {
  const fg = t.fg;
  const soft = t["fg-soft"] || t.dim || fg;
  const far = scheme === "light" ? BLACK : WHITE;
  return {
    950: t.bg,
    900: t.surface,
    800: t.surface2 || t.stripe || t.border,
    700: t.border || t.stripe,
    600: scheme === "light" ? mix(t.border || t.stripe, t.dim || soft, 0.5) : (t["border-hard"] || t.border),
    500: t.dim || soft,
    400: soft,
    300: mix(soft, fg, 0.55),
    200: mix(soft, fg, 0.85),
    100: fg,
    50: mix(fg, far, 0.35),
  };
}

const STOPS = [950, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50];

let out = "";
for (const folder of readdirSync(THEMES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const id = slug(folder);
  const skin = SKINS[id];
  if (!skin) { console.error(`  no config for ${id}, skipped`); continue; }
  const { study, tokens } = tokensFor(folder);
  const brand = tokens[skin.brand];
  if (!brand) { console.error(`  ${id}: no --${skin.brand} in ${study}`); continue; }
  const r = ramp(tokens, skin.scheme);

  out += `\n[data-theme="${id}"] {\n`;
  out += `  /* ${skin.label}. ${skin.note}.\n     Generated from ${study} by scripts/build-themes.mjs. */\n`;
  for (const s of STOPS) out += `  --base-${s}: ${rgb(r[s])};\n`;
  out += `\n  --brand: ${rgb(brand)};\n`;
  out += `  --brand-ink: ${rgb(mix(brand, skin.scheme === "light" ? WHITE : BLACK, 0.82))};\n`;
  out += `\n  color-scheme: ${skin.scheme};\n}\n`;
}

console.log(out);
console.error("  Accent ramps are not generated. They stay amber per CLAUDE.md.");
