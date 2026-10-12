/* ================================================================== */
/* THE D.I.L.A.S. MARK                                                */
/*                                                                    */
/* Our own drawing from public/favicon.svg, beside the name wherever  */
/* a theme has no mark of its own: Dark, Light, Neon, and any skin    */
/* whose art is not on disk. It replaced the game's booster skull,    */
/* which is extracted art and so missing from a fresh clone.          */
/*                                                                    */
/* The favicon's colours are fixed; here they are the theme's. The    */
/* yellow plate is dropped, the shield takes the brand colour and the */
/* skull the brand ink, the pair every theme already sets to read on  */
/* each other. The red optic stays red in every theme.                */
/* ================================================================== */

import { useId } from "react";

const SKULL = "M61 21.5H67L93.5 32V61L100 70V72L90 84L89 85.5H87L82 81.5L80 82L79 83V88L78 88V94L74 95L69 96.5L64 98.5L59 96.5L54 95L50 94V88L49 88V83L48 82L46 81.5L41 85.5H39L38 84L28 72V70L34.5 61V32Z";

export default function DilasMark({ className = "h-9 w-9", title = null }) {
  /* Two marks render at once (sidebar and drawer), so the ids differ. */
  const id = useId().replace(/:/g, "");
  const brand = "rgb(var(--brand))";
  const ink = "rgb(var(--brand-ink))";
  return (
    <svg viewBox="8 2 112 126" className={className} aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={`${id}r`}><rect x="64" y="0" width="64" height="128" /></clipPath>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="#FF5A4A" stopOpacity=".9" />
          <stop offset=".45" stopColor="#EF4444" stopOpacity=".45" />
          <stop offset="1" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}l`}>
          <stop offset="0" stopColor="#FFF1E8" />
          <stop offset=".35" stopColor="#FF6B5A" />
          <stop offset="1" stopColor="#C81E1E" />
        </radialGradient>
      </defs>
      <path d="M64 6L13 16V92C13 104 34 116 64 124C94 116 115 104 115 92V16Z" fill={brand} />
      <path d={SKULL} fill={ink} />
      {/* The gunmetal half: the same ink, lifted, so the split reads. */}
      <path d={SKULL} fill={brand} fillOpacity=".28" clipPath={`url(#${id}r)`} />
      <path d="M64 46H93.5M64 88H79M64 22V98" stroke={brand} strokeWidth="2.4" fill="none" />
      <circle cx="72" cy="39" r="1.8" fill={brand} />
      <circle cx="86" cy="39" r="1.8" fill={brand} />
      <circle cx="47" cy="65.5" r="8" fill={brand} />
      <path d="M64 73.5L58.5 81L60 83H68L69.5 81Z" fill={brand} />
      <circle cx="81" cy="65.5" r="22" fill={`url(#${id}g)`} />
      <circle cx="81" cy="65.5" r="9.5" fill={ink} />
      <circle cx="81" cy="65.5" r="6.2" fill={`url(#${id}l)`} />
    </svg>
  );
}
