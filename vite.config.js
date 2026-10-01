import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { emptyInPlace } from "./scripts/lib/empty-in-place.mjs";

/* Vite's own emptyOutDir deletes dist/assets and makes it again, and the
   sync app watching this folder renamed the fresh one to a "Name clash"
   copy seconds after a build on 1 October 2026, leaving the page with no
   script. This empties dist in place instead, removing renamed copies the
   way Vite always removed everything in it. scripts/check-dist.mjs runs
   after every build and before every deploy in case it happens anyway. */
function emptyOutDirInPlace() {
  let outDir = null;
  return {
    name: "dds-empty-out-dir-in-place",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      emptyInPlace(outDir, { dropClashes: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), emptyOutDirInPlace()],
  build: {
    emptyOutDir: false,
    /* Vite inlines assets under 4KB as base64 by default. Most stratagem  */
    /* icons sit just under that, so the default pulled a few hundred KB   */
    /* of art into the JS bundle, which blocks first paint and defeats the */
    /* lazy loading on the rows. Every asset stays a separate file.        */
    assetsInlineLimit: 0,
  },
});
