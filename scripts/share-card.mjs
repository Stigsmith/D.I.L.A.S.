/* npm run share-card: draws public/share.png, the picture WhatsApp, Discord
   and the rest show when a link to the tool is pasted.

   scripts/share-card/card.html is the drawing. This fills in the name from
   src/lib/brand.js, writes the page to a temporary folder and shoots it with
   headless Edge at 1200 x 630, the way the README screenshots are taken.
   The PNG is committed: it is our own drawing, like the favicon. After a
   change, raise the ?v= on SHARE_CARD in vite.config.js, or the chat apps
   keep showing the old card. Never part of the build. */

import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { BRAND } from "../src/lib/brand.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "public", "share.png");
const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!EDGE) {
  console.error("Microsoft Edge not found; it draws the card.");
  process.exit(1);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fill = {
  root: pathToFileURL(ROOT).href,
  short: esc(BRAND.short),
  line1: esc(BRAND.nameLines[0]),
  line2: esc(BRAND.nameLines[1]),
  cardLine: esc(BRAND.cardLine),
  host: esc(new URL(BRAND.url).host),
};
const html = readFileSync(join(ROOT, "scripts", "share-card", "card.html"), "utf8").replace(
  /\{\{(\w+)\}\}/g,
  (_, key) => {
    if (!(key in fill)) throw new Error(`card.html asks for {{${key}}}, which nothing fills`);
    return fill[key];
  },
);

const scratch = mkdtempSync(join(tmpdir(), "dilas-card-"));
try {
  const page = join(scratch, "card.html");
  writeFileSync(page, html);
  execFileSync(EDGE, [
    "--headless=new",
    `--user-data-dir=${join(scratch, "profile")}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    "--virtual-time-budget=4000",
    `--screenshot=${OUT}`,
    pathToFileURL(page).href,
  ], { stdio: "ignore" });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`Wrote public/share.png, ${Math.round(statSync(OUT).size / 1024)} KB.`);
