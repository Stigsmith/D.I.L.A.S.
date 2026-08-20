import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    /* Vite inlines assets under 4KB as base64 by default. Most stratagem  */
    /* icons sit just under that, so the default pulled a few hundred KB   */
    /* of art into the JS bundle, which blocks first paint and defeats the */
    /* lazy loading on the rows. Every asset stays a separate file.        */
    assetsInlineLimit: 0,
  },
});
