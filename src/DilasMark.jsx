/* ================================================================== */
/* THE D.I.L.A.S. MARK                                                */
/*                                                                    */
/* Our own drawing from public/favicon.svg, beside the name wherever  */
/* a theme has no mark of its own: Dark, Light, Neon, and any skin    */
/* whose art is not on disk. It replaced the game's booster skull,    */
/* which is extracted art and so missing from a fresh clone.          */
/*                                                                    */
/* The favicon keeps its plate and shield; here the skull stands on   */
/* its own, framed tight so it draws larger. The bone half is white,  */
/* and black on the light themes (--mark-bone in index.css); it never */
/* takes the skin's colour. The robot half is the favicon's gunmetal  */
/* and the optic red, both fixed. The eye, nose and seams are cut out */
/* with a mask, so the surface behind shows through.                  */
/* ================================================================== */

import { useId } from "react";

const SKULL = "M61 21.5H67L93.5 32V61L100 70V72L90 84L89 85.5H87L82 81.5L80 82L79 83V88L78 88V94L74 95L69 96.5L64 98.5L59 96.5L54 95L50 94V88L49 88V83L48 82L46 81.5L41 85.5H39L38 84L28 72V70L34.5 61V32Z";

export default function DilasMark({ className = "h-9 w-9", title = null }) {
  /* Two marks render at once (sidebar and drawer), so the ids differ. */
  const id = useId().replace(/:/g, "");
  /* --mark-bone in index.css: white, black on the light themes. */
  const bone = "var(--mark-bone, #F2F0E8)";
  return (
    <svg viewBox="22 16 84 86" className={className} aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={`${id}r`}><rect x="64" y="0" width="64" height="128" /></clipPath>
        {/* White keeps the skull, black cuts it away. */}
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
          <path d={SKULL} fill="#fff" />
          <path d="M64 46H93.5M64 88H79M64 22V98" stroke="#000" strokeWidth="2.4" fill="none" />
          <circle cx="72" cy="39" r="1.8" fill="#000" />
          <circle cx="86" cy="39" r="1.8" fill="#000" />
          <circle cx="47" cy="65.5" r="8" fill="#000" />
          <path d="M64 73.5L58.5 81L60 83H68L69.5 81Z" fill="#000" />
          <circle cx="81" cy="65.5" r="9.5" fill="#000" />
        </mask>
        {/* The favicon's gunmetal, fixed in every theme like the optic. */}
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#C9CED6" />
          <stop offset=".45" stopColor="#7C828C" />
          <stop offset="1" stopColor="#3E434B" />
        </linearGradient>
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
      <g mask={`url(#${id}m)`}>
        <path d={SKULL} fill={bone} />
        {/* The robot half: gunmetal grey, as on the favicon. */}
        <path d={SKULL} fill={`url(#${id}s)`} clipPath={`url(#${id}r)`} />
      </g>
      <circle cx="81" cy="65.5" r="18" fill={`url(#${id}g)`} />
      <circle cx="81" cy="65.5" r="6.2" fill={`url(#${id}l)`} />
    </svg>
  );
}
