/* Tailwind 3, not 4, on purpose. The component uses placeholder-base-600, */
/* which 4 removed, and 4 changes the default border colour to             */
/* currentColor.                                                           */
/*                                                                         */
/* Colours come from CSS custom properties so a theme is a token set        */
/* rather than a rewrite. The ramps are positional in both themes:          */
/* the high end is surface, the low end is ink. bg-base-950 is always       */
/* the furthest back, text-base-100 is always the most prominent, whether   */
/* the theme is dark or light.                                             */
/*                                                                         */
/* Tier badge and faction colours are deliberately NOT tokens. They encode  */
/* data rather than chrome, so they have to read identically in both        */
/* themes. See CLAUDE.md.                                                  */

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ramp = (name) =>
  Object.fromEntries(STOPS.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: ramp("base"),
        accent: ramp("accent"),
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
