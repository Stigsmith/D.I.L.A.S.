import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { emptyInPlace } from "./scripts/lib/empty-in-place.mjs";
import { BRAND } from "./src/lib/brand.js";

/* Vite's own emptyOutDir deletes dist/assets and makes it again, and the
   sync app watching this folder renamed the fresh one to a "Name clash"
   copy seconds after a build on 1 October 2026, leaving the page with no
   script. This empties dist in place instead, removing renamed copies the
   way Vite always removed everything in it. scripts/check-dist.mjs runs
   after every build and before every deploy in case it happens anyway. */
function emptyOutDirInPlace() {
  let outDir = null;
  return {
    name: "dilas-empty-out-dir-in-place",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      emptyInPlace(outDir, { dropClashes: true });
    },
  };
}

/* The browser tab's title and the link preview tags, from src/lib/brand.js,
   so the name lives in one file. In the page itself rather than set by
   script, because WhatsApp, Discord and the rest read the page without
   running it. The image link must be absolute or the apps ignore it, and
   its ?v= rises whenever public/share.png changes, because they cache
   previews for days. */
const SHARE_CARD = { path: "/share.png?v=1", width: 1200, height: 630 };

function brandHead() {
  const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const image = BRAND.url + SHARE_CARD.path;
  const tags = [
    ["name", "description", BRAND.description],
    ["name", "theme-color", "#FFE900"],
    ["property", "og:type", "website"],
    ["property", "og:site_name", BRAND.short],
    ["property", "og:title", `${BRAND.short} · ${BRAND.name}`],
    ["property", "og:description", BRAND.description],
    ["property", "og:url", BRAND.url + "/"],
    ["property", "og:image", image],
    ["property", "og:image:type", "image/png"],
    ["property", "og:image:width", String(SHARE_CARD.width)],
    ["property", "og:image:height", String(SHARE_CARD.height)],
    ["property", "og:image:alt", `${BRAND.short}: ${BRAND.cardLine}`],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", `${BRAND.short} · ${BRAND.name}`],
    ["name", "twitter:description", BRAND.description],
    ["name", "twitter:image", image],
  ].map(([key, name, content]) => `<meta ${key}="${name}" content="${attr(content)}" />`);
  return {
    name: "dilas-brand-head",
    transformIndexHtml(html) {
      return html.replace(
        /<title>[^<]*<\/title>/,
        `<title>${BRAND.short}</title>\n    ${tags.join("\n    ")}`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), emptyOutDirInPlace(), brandHead()],
  build: {
    emptyOutDir: false,
    /* Vite inlines assets under 4KB as base64 by default. Most stratagem  */
    /* icons sit just under that, so the default pulled a few hundred KB   */
    /* of art into the JS bundle, which blocks first paint and defeats the */
    /* lazy loading on the rows. Every asset stays a separate file.        */
    assetsInlineLimit: 0,
  },
  /* 5173 unless told otherwise. Two Claude sessions in this folder each get
     their own dev server, and the second is handed a free port through
     PORT; nothing here depends on the number. */
  server: { port: Number(process.env.PORT) || 5173 },
});
