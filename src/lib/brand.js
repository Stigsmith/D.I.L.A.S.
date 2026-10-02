/* ================================================================== */
/* BRAND                                                              */
/*                                                                    */
/* The tool's name lives here and nowhere else, so every surface reads */
/* it from this file: the sidebar, the mobile drawer, the browser tab   */
/* (vite.config.js writes it into index.html), the footer, the About    */
/* page and the backup file's name. Renaming it again is one edit here, */
/* plus the reset email in worker/email.ts, which the Worker cannot     */
/* import.                                                             */
/*                                                                    */
/* It has changed twice. The Armory, then the Democracy Deployment     */
/* System, D.D.S., and since 2 October 2026 D.I.L.A.S., the Democratic      */
/* Intelligent Loadout Armoury System: the curator's pick, made when   */
/* dilas.me was bought. Every short .me for D.D.S. was long gone.      */
/*                                                                    */
/* SHORT is what the wordmark actually shows. The full name reads      */
/* underneath it in the small caps the org line used to use, and the    */
/* tagline moved to the footer to sit with the disclaimers.             */
/* ================================================================== */

export const BRAND = {
  name: "Democratic Intelligent Loadout & Armoury System",
  short: "D.I.L.A.S.",
  tagline: "unofficial Helldivers 2 community tool",
};
