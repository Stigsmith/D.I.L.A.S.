/* ================================================================== */
/* THE TIER BADGE                                                     */
/*                                                                    */
/* Ported from Image Library/UI/Tier Badges/hd2-tier-badge-component  */
/* .html, which is the design document and the source of truth. Read  */
/* it before changing anything here. It carries the reasoning, the     */
/* exact token values, and a list of things already built and cut.    */
/*                                                                    */
/* One portrait plate, one Oswald stencil letter, one tier colour.    */
/* Two independent axes sit on top:                                    */
/*                                                                    */
/*   FINISH   seven interior treatments, chosen by the user           */
/*   SURFACE  three booleans: sheen, glow, grain                       */
/*                                                                    */
/* All 7 x 8 combinations are valid and none of them mean anything.   */
/* They are cosmetic.                                                  */
/*                                                                    */
/* > FINISH IS NOT THEME. The app has a theme picker carrying the      */
/* > warbond skins. Finish is a narrower setting that touches only     */
/* > this badge. They are stored separately, chosen separately, and    */
/* > a theme change must never move a finish. The prop is called       */
/* > finish for exactly this reason.                                   */
/*                                                                    */
/* THE RULE THAT OVERRIDES THE REST: rank is never carried by          */
/* degrading legibility. A D reads exactly as clearly as an S+. Rank   */
/* is hue, and optionally sheen and glow intensity. Never size, never  */
/* fade, never damage. Every earlier pass that dimmed the low tiers    */
/* was rejected for this.                                              */
/*                                                                    */
/* ALREADY TRIED AND CUT, do not rebuild: rivets, base bands, cap      */
/* bands, double rims, the bevel edge, scratches and wear, and the     */
/* filled versus outline split at the A boundary. The document says    */
/* why for each.                                                       */
/* ================================================================== */

import { useId } from "react";

/* Two clipped corners, top right and bottom left, so the plate reads   */
/* as stamped sheet rather than a rounded rectangle. One constant,      */
/* shared by every finish. Do not fork it.                              */
const PLATE = "M6 2 H32 L42 12 V50 Q42 56 36 56 H12 L2 46 V8 Q2 2 8 2 Z";

const KEY = { "S+": "splus", S: "s", A: "a", B: "b", C: "c", D: "d" };

/* One scalar per tier driving both the sheen gradient and the glow      */
/* opacity. Not a colour, not a size. It stays in JS because it is       */
/* arithmetic rather than paint: a CSS variable cannot be multiplied     */
/* into an SVG stop-opacity without a calc that Safari has opinions      */
/* about.                                                                */
const SHEEN = { "S+": 1.0, S: 0.8, A: 0.6, B: 0.42, C: 0.26, D: 0.14 };

export const FINISHES = [
  { id: "ghost", label: "Ghost", note: "No interior. The row shows straight through." },
  { id: "void", label: "Void", note: "Flat near black, sealed off from the row." },
  { id: "steel", label: "Steel", note: "One flat grey. A plate, not a hole." },
  { id: "gradient", label: "Gradient", note: "Vertical grey, light at the top. No hue in the fill." },
  { id: "tint", label: "Tint", note: "Thirteen percent of the tier colour across the interior." },
  { id: "wash", label: "Wash", note: "Tier colour rising from the base, gone by the middle." },
  { id: "paint", label: "Paint", note: "Full tier colour, letter knocked out dark." },
];
export const FINISH_IDS = FINISHES.map((f) => f.id);
export const DEFAULT_FINISH = "paint";
export const DEFAULT_SURFACE = { sheen: true, glow: true, grain: true };

/* Every colour goes through a token, which is what lets a warbond skin  */
/* repaint the ramp and what makes the two candidate ramps a one line    */
/* swap. The interior colours are tokens too, which the design document  */
/* leaves hardcoded: it assumes a dark ground, and two of the eleven     */
/* themes are light.                                                     */
const plate = (t) => `var(--tier-${KEY[t]}-plate)`;

export default function TierBadge({
  tier,
  finish = DEFAULT_FINISH,
  sheen = true,
  glow = true,
  grain = true,
  size = 44,
  quiet = false,
  className = "",
}) {
  /* One id per instance. A shared or random one makes badges inherit    */
  /* each other's defs, which the document calls out explicitly.         */
  const uid = useId().replace(/:/g, "");
  const h = Math.round((size * 58) / 44);
  /* className lands last so a caller can override the width. Pair it   */
  /* with h-auto: the viewBox then keeps the 58 by 44 ratio without the  */
  /* caller doing the arithmetic.                                        */
  const cls =
    "shrink-0 transition-opacity" + (quiet ? " opacity-50" : "") + (className ? " " + className : "");

  /* Unrated is a first class state, not missing data: same plate, a     */
  /* dashed rim, a question mark, no glow.                               */
  if (!tier) {
    return (
      <svg width={size} height={h} viewBox="0 0 44 58" className={cls} role="img" aria-label="No rating yet">
        <path d={PLATE} fill="none" stroke="rgb(var(--base-600))" strokeWidth="1.8" strokeDasharray="4 3" />
        <text x="22" y="41.5" textAnchor="middle" fontFamily="Oswald,'Arial Narrow',sans-serif"
          fontWeight="700" fontSize="33" fill="rgb(var(--base-600))">?</text>
      </svg>
    );
  }

  const col = plate(tier);
  const sv = SHEEN[tier] ?? 0.5;
  const defs = [];
  const interior = [];
  let letterCol = col;

  /* Finish paints the interior and nothing else. No geometry: anything  */
  /* drawn inside the plate competes with the letter, which is why the   */
  /* rivets and the bands were cut.                                      */
  if (finish === "void") interior.push(<rect key="v" width="44" height="58" fill="var(--tier-plate-void)" />);
  if (finish === "steel") interior.push(<rect key="v" width="44" height="58" fill="var(--tier-plate-steel)" />);
  if (finish === "tint") {
    interior.push(<rect key="v" width="44" height="58" fill="var(--tier-plate-void)" />);
    interior.push(<rect key="t" width="44" height="58" fill={col} opacity=".13" />);
  }
  if (finish === "paint") {
    interior.push(<rect key="v" width="44" height="58" fill={col} />);
    letterCol = "var(--tier-plate-ink)";
  }
  if (finish === "gradient") {
    defs.push(
      <linearGradient key="g" id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--tier-plate-grad-top)" />
        <stop offset="1" stopColor="var(--tier-plate-grad-base)" />
      </linearGradient>
    );
    interior.push(<rect key="v" width="44" height="58" fill={`url(#g${uid})`} />);
  }
  if (finish === "wash") {
    defs.push(
      <linearGradient key="g" id={`g${uid}`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={col} stopOpacity=".30" />
        <stop offset="1" stopColor={col} stopOpacity="0" />
      </linearGradient>
    );
    interior.push(<rect key="v" width="44" height="58" fill="var(--tier-plate-void)" />);
    interior.push(<rect key="w" width="44" height="58" fill={`url(#g${uid})`} />);
  }

  /* Skipped on paint: a white sweep over saturated colour reads as a    */
  /* smudge rather than as light.                                        */
  if (sheen && finish !== "paint") {
    defs.push(
      <linearGradient key="s" id={`s${uid}`} x1="0" y1="0" x2=".9" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={(0.26 * sv).toFixed(3)} />
        <stop offset=".45" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#ffffff" stopOpacity={(0.08 * sv).toFixed(3)} />
      </linearGradient>
    );
    interior.push(<rect key="sh" width="44" height="58" fill={`url(#s${uid})`} />);
  }

  /* Seed is 7 on every badge, deliberately. A per instance seed would   */
  /* make the grain differ between tiers, which is the degradation the   */
  /* top rule forbids. Skipped on ghost: no surface to grain.            */
  if (grain && finish !== "ghost") {
    defs.push(
      <filter key="n" id={`n${uid}`}>
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="7" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope=".12" />
        </feComponentTransfer>
        <feComposite operator="in" in2="SourceGraphic" />
      </filter>
    );
    interior.push(<rect key="gr" width="44" height="58" fill="#ffffff" filter={`url(#n${uid})`} opacity=".5" />);
  }

  defs.push(
    <clipPath key="c" id={`c${uid}`}>
      <path d={PLATE} />
    </clipPath>
  );

  /* Behind the plate, never inside the clip, and ramped by the same     */
  /* scalar as the sheen so the top tier glows hardest.                  */
  let glowNode = null;
  if (glow) {
    defs.push(
      <filter key="b" id={`b${uid}`} x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
    );
    glowNode = (
      <path d={PLATE} fill="none" stroke={col} strokeWidth="3.5"
        opacity={(0.5 * sv).toFixed(3)} filter={`url(#b${uid})`} />
    );
  }

  /* S+ is a full height S with a raised plus, never two shrunken        */
  /* characters. The top tier having the smallest letter was a real bug  */
  /* in an earlier pass.                                                 */
  const letter =
    tier === "S+" ? (
      <>
        <text x="19" y="41.5" textAnchor="middle" fontFamily="Oswald,'Arial Narrow',sans-serif"
          fontWeight="700" fontSize="33" fill={letterCol}>S</text>
        <text x="34" y="26" textAnchor="middle" fontFamily="Oswald,'Arial Narrow',sans-serif"
          fontWeight="700" fontSize="17" fill={letterCol}>+</text>
      </>
    ) : (
      <text x="22" y="41.5" textAnchor="middle" fontFamily="Oswald,'Arial Narrow',sans-serif"
        fontWeight="700" fontSize="33" fill={letterCol}>{tier}</text>
    );

  /* Draw order is load bearing: glow, interior, rim, letter. */
  return (
    <svg width={size} height={h} viewBox="0 0 44 58" className={cls} role="img" aria-label={`Tier ${tier}`}>
      <defs>{defs}</defs>
      {glowNode}
      <g clipPath={`url(#c${uid})`}>{interior}</g>
      <path d={PLATE} fill="none" stroke={col} strokeWidth="1.8" />
      {letter}
    </svg>
  );
}
