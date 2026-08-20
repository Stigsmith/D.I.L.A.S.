/* ================================================================== */
/* AMBIENT LAYER                                                      */
/*                                                                    */
/* The material half of a warbond skin. A palette study is not just a  */
/* set of colours: the Creek throws tracers under a poster sky, the    */
/* Foundry glows out of the plate, Entrenched Division drifts gas      */
/* across a trench. None of that fits in a colour token, so it lives   */
/* here.                                                               */
/*                                                                    */
/* Three rules this layer keeps to:                                    */
/*                                                                    */
/*  - It is decoration and it never blocks. Fixed, pointer-events      */
/*    none, aria-hidden. Delete this file and the app is unchanged     */
/*    apart from being duller.                                         */
/*  - It never depends on art existing. Every image resolves through   */
/*    themeArt, which returns null when src/assets is empty, and a     */
/*    null image renders nothing rather than a broken URL.             */
/*  - It respects prefers-reduced-motion. Everything that moves stops. */
/*                                                                    */
/* A theme with no entry in FX gets no layer at all, which is why the  */
/* three base themes are untouched.                                    */
/* ================================================================== */

import { useMemo } from "react";
import { themeArt } from "./lib/assets.js";

/* Per skin effect config. Counts are deliberately restrained: this runs  */
/* behind a scrolling list on a laptop, and the studies are airy mockups  */
/* where the app is dense with opaque panels.                             */
export const FX = {
  "malevelon-creek": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    /* Blue night, not jungle green. Tracer fire under a poster sky. */
    streaks: { count: 5, color: "#FF3B22", glow: "255, 59, 34" },
    embers: { count: 14, color: "#FFB08A", glow: "255, 59, 34" },
    firelight: [
      { at: "right bottom", size: 96, tint: "rgba(255,59,34,.30)", secs: 11 },
      { at: "left top", size: 82, tint: "rgba(159,196,210,.16)", secs: 17, delay: -4 },
    ],
  },
  "entrenched-division": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    /* Smoke, gas and grit. Gas drifts sideways slowly enough that you    */
    /* notice the room has changed rather than seeing anything move.      */
    gas: { count: 9, color: "#9CB05A" },
    embers: { count: 18, color: "#E8B94A", glow: "232, 185, 74", slow: true },
    /* Grain is a lens property, not a surface, so it sits above the      */
    /* panels rather than behind them. The one texture that touches data. */
    grain: { file: "study_bg-after-0", opacity: 0.055, size: 160 },
    firelight: [
      { at: "left bottom", size: 88, tint: "rgba(156,176,90,.16)", secs: 23 },
      { at: "right top", size: 74, tint: "rgba(232,185,74,.10)", secs: 31, delay: -8 },
    ],
  },
  "super-destroyer": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    /* The ship keyed and bleeding off the right, over a starfield. */
    stars: { count: 46 },
    firelight: [{ at: "left bottom", size: 82, tint: "rgba(255,176,32,.12)", secs: 16 }],
  },
  "viper-commandos": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    /* The real camo, mirrored four ways into a seamless tile. The badge  */
    /* sits bottom right like a patch on the webbing.                     */
    texture: { file: "study_bg-camoband-2", opacity: 0.07, size: 512 },
    badge: { file: "study_badge-v", size: 132, opacity: 0.16 },
    firelight: [{ at: "left top", size: 78, tint: "rgba(95,224,210,.12)", secs: 21 }],
  },
  "bile-titan": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    drips: { count: 14, color: "#C7DE1F", glow: "199, 222, 31" },
    embers: { count: 10, color: "#C7DE1F", glow: "199, 222, 31", slow: true },
    firelight: [
      { at: "right bottom", size: 88, tint: "rgba(199,222,31,.18)", secs: 19 },
      { at: "left top", size: 70, tint: "rgba(199,222,31,.10)", secs: 25, delay: -7 },
    ],
  },
  "ministry-of-truth": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.2, position: "center" },
    /* Paper cannot emit light, so there is no glow and no particle here. */
    /* It gets weight instead: the DSS blueprint pressed under the page.  */
    underlay: { file: "study_bg-before-0", opacity: 0.07, size: 900, position: "right top" },
  },
  "automaton": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    embers: { count: 9, color: "#FF6A55", glow: "255, 45, 24", slow: true },
    firelight: [
      { at: "left bottom", size: 92, tint: "rgba(255,45,24,.30)", secs: 9 },
      { at: "right top", size: 76, tint: "rgba(255,45,24,.20)", secs: 14, delay: -3 },
    ],
  },
  "odst": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    rain: { count: 34, color: "#BFD4E4" },
    firelight: [
      { at: "right top", size: 74, tint: "rgba(124,163,63,.16)", secs: 7 },
      { at: "left bottom", size: 66, tint: "rgba(124,163,63,.10)", secs: 11, delay: -3 },
    ],
  },
  "hellpod-drop-bay": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.42, position: "center" },
    firelight: [{ at: "right top", size: 76, tint: "rgba(255,210,0,.13)", secs: 13 }],
  },
  "castellans-creed": {
    masthead: { file: "masthead", fit: "cover", opacity: 0.38, position: "center" },
    firelight: [{ at: "right bottom", size: 78, tint: "rgba(232,192,99,.14)", secs: 18 }],
  },
};

/* Deterministic, so a re-render never makes the sky jump. Seeded off the */
/* index rather than Math.random for exactly that reason.                 */
const rand = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const build = (count, seed, step, fn) =>
  Array.from({ length: count }, (_, i) => fn((n) => rand(seed + i * step + n), i));

function Streaks({ count, color, glow, seed }) {
  const bits = useMemo(() => build(count, seed, 7.3, (r) => ({
    left: `${Math.round(r(1) * 96)}%`, top: `${Math.round(r(2) * 88)}%`,
    dx: `${Math.round(420 + r(3) * 320)}px`, dy: `${-Math.round(240 + r(4) * 220)}px`,
    dur: `${(2.6 + r(5) * 3.4).toFixed(2)}s`, delay: `${(r(6) * 14).toFixed(2)}s`,
    h: `${Math.round(120 + r(7) * 70)}px`,
  })), [count, seed]);

  return bits.map((b, i) => (
    <i key={i} className="fx-streak" style={{
      left: b.left, top: b.top, height: b.h,
      background: `linear-gradient(180deg, transparent, ${color} 55%, transparent)`,
      boxShadow: `0 0 12px rgba(${glow},.85), 0 0 34px rgba(${glow},.4)`,
      "--fx-dx": b.dx, "--fx-dy": b.dy,
      animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

function Embers({ count, color, glow, slow, seed }) {
  const bits = useMemo(() => build(count, seed, 3.1, (r) => ({
    left: `${Math.round(r(1) * 98)}%`, size: `${(2 + r(2) * 2.4).toFixed(1)}px`,
    dx: `${Math.round(r(3) * 90 - 45)}px`,
    dur: `${((slow ? 20 : 15) + r(4) * (slow ? 14 : 14)).toFixed(1)}s`,
    delay: `${(r(5) * -30).toFixed(1)}s`, op: (0.5 + r(6) * 0.45).toFixed(2),
  })), [count, slow, seed]);

  return bits.map((b, i) => (
    <em key={i} className="fx-ember" style={{
      left: b.left, width: b.size, height: b.size,
      background: `radial-gradient(circle, ${color}, ${color} 40%, transparent 70%)`,
      boxShadow: `0 0 8px rgba(${glow},.9)`,
      "--fx-dx": b.dx, "--fx-o": b.op,
      animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

function Rain({ count, color, seed }) {
  const bits = useMemo(() => build(count, seed, 5.7, (r) => ({
    left: `${Math.round(r(1) * 100)}%`, h: `${Math.round(50 + r(2) * 70)}px`,
    dx: `${Math.round(40 + r(3) * 70)}px`, dur: `${(0.9 + r(4) * 1.1).toFixed(2)}s`,
    delay: `${(r(5) * -4).toFixed(2)}s`, op: (0.22 + r(6) * 0.4).toFixed(2),
  })), [count, seed]);

  return bits.map((b, i) => (
    <i key={i} className="fx-rain" style={{
      left: b.left, height: b.h,
      background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
      "--fx-dx": b.dx, "--fx-o": b.op,
      animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

/* Bile falls with a heavy glowing head, which is what separates a drip   */
/* from rain: the head is the thing you see, the tail is just the path.   */
function Drips({ count, color, glow, seed }) {
  const bits = useMemo(() => build(count, seed, 4.9, (r) => ({
    left: `${Math.round(r(1) * 98)}%`, h: `${Math.round(22 + r(2) * 34)}px`,
    dur: `${(3.4 + r(3) * 4.2).toFixed(2)}s`, delay: `${(r(4) * -9).toFixed(2)}s`,
    op: (0.4 + r(5) * 0.5).toFixed(2), w: `${(2 + r(6) * 2).toFixed(1)}px`,
  })), [count, seed]);

  return bits.map((b, i) => (
    <i key={i} className="fx-drip" style={{
      left: b.left, height: b.h, width: b.w,
      background: `linear-gradient(180deg, transparent, ${color})`,
      boxShadow: `0 6px 10px rgba(${glow},.75), 0 0 18px rgba(${glow},.45)`,
      "--fx-o": b.op, animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

/* Gas crosses the full width slowly enough that you notice the room has  */
/* changed rather than seeing anything move. Blur does the work; the      */
/* opacity is deliberately low because this sits under the whole page.    */
function Gas({ count, color, seed }) {
  const bits = useMemo(() => build(count, seed, 8.6, (r) => ({
    top: `${Math.round(r(1) * 92)}%`, size: `${Math.round(340 + r(2) * 460)}px`,
    dur: `${Math.round(48 + r(3) * 48)}s`, delay: `${Math.round(r(4) * -90)}s`,
    op: (0.05 + r(5) * 0.08).toFixed(3),
  })), [count, seed]);

  return bits.map((b, i) => (
    <span key={i} className="fx-gas" style={{
      top: b.top, width: b.size, height: `${parseInt(b.size, 10) * 0.55}px`,
      background: `radial-gradient(ellipse at 50% 50%, ${color}, transparent 68%)`,
      "--fx-o": b.op, animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

function Stars({ count, seed }) {
  const bits = useMemo(() => build(count, seed, 2.7, (r) => ({
    left: `${(r(1) * 100).toFixed(2)}%`, top: `${(r(2) * 100).toFixed(2)}%`,
    size: `${(1 + r(3) * 1.8).toFixed(1)}px`,
    dur: `${(2.4 + r(4) * 5).toFixed(2)}s`, delay: `${(r(5) * -8).toFixed(2)}s`,
    op: (0.3 + r(6) * 0.6).toFixed(2),
  })), [count, seed]);

  return bits.map((b, i) => (
    <span key={i} className="fx-star" style={{
      left: b.left, top: b.top, width: b.size, height: b.size,
      "--fx-o": b.op, animationDuration: b.dur, animationDelay: b.delay,
    }} />
  ));
}

const CORNER = {
  "right bottom": { right: "-14%", bottom: "-20%" },
  "left bottom": { left: "-18%", bottom: "-22%" },
  "right top": { right: "-16%", top: "-18%" },
  "left top": { left: "-20%", top: "-16%" },
};

function Firelight({ spec }) {
  return spec.map((f, i) => (
    <span key={i} className="fx-firelight" style={{
      ...CORNER[f.at], width: `${f.size}%`, height: `${f.size}%`,
      background: `radial-gradient(ellipse at 50% 50%, ${f.tint}, transparent 70%)`,
      animationDuration: `${f.secs}s`,
      animationDelay: f.delay ? `${f.delay}s` : undefined,
    }} />
  ));
}

/* ------------------------------------------------------------------ */

/* Grain rides above every panel, because it is a property of the lens   */
/* rather than of any surface. Overlay blend at a few percent reads as   */
/* film rather than as dirt on the screen, and it is the only part of    */
/* this file that is allowed over the data.                              */
export function Grain({ theme }) {
  const fx = FX[theme];
  const art = fx && fx.grain ? themeArt(theme, fx.grain.file) : null;
  if (!art) return null;
  return (
    <div className="fx-grain" aria-hidden="true" style={{
      backgroundImage: `url(${art})`,
      backgroundSize: `${fx.grain.size}px`,
      opacity: fx.grain.opacity,
    }} />
  );
}

/* Art that belongs to the masthead rather than to the page: the Creek's  */
/* poster, the Destroyer's hull. Rendered inside the header so it sits    */
/* behind the title instead of behind the opaque chrome.                  */
/* dim is for the phone row, where the same art sits behind a menu button, */
/* a tab strip and a theme control inside 44px instead of behind a title in */
/* 86px. The art is tuned for the taller box, and at full strength in the   */
/* short one it competes with the only navigation on the screen.           */
export function Masthead({ theme, dim = 1, small }) {
  const fx = FX[theme];
  /* The phone row is a 44px slit at roughly 10:1 and the header is 86px  */
  /* at up to 27:1, so one cut cannot serve both without throwing away    */
  /* half of it. A skin may ship masthead-sm for the narrow case; without */
  /* one it falls back to the wide cut and crops, which is what every     */
  /* skin did before this existed.                                        */
  const art = fx && fx.masthead
    ? (small ? themeArt(theme, `${fx.masthead.file}-sm`) : null) || themeArt(theme, fx.masthead.file)
    : null;
  if (!art) return null;
  const m = fx.masthead;
  return (
    <div className="fx-masthead" aria-hidden="true" style={{
      backgroundImage: `url(${art})`,
      backgroundSize: m.fit,
      backgroundPosition: m.position,
      opacity: m.opacity * dim,
    }} />
  );
}

export default function Ambient({ theme }) {
  const fx = FX[theme];
  /* Resolved every render rather than memoised, because it is a map      */
  /* lookup and because deleting src/assets has to change the answer.     */
  const texture = fx && fx.texture ? themeArt(theme, fx.texture.file) : null;
  const underlay = fx && fx.underlay ? themeArt(theme, fx.underlay.file) : null;
  const badge = fx && fx.badge ? themeArt(theme, fx.badge.file) : null;
  if (!fx) return null;

  return (
    <div className="fx-layer" aria-hidden="true">
      {texture ? (
        <span className="fx-texture" style={{
          backgroundImage: `url(${texture})`,
          backgroundSize: `${fx.texture.size}px`,
          opacity: fx.texture.opacity,
        }} />
      ) : null}
      {underlay ? (
        <span className="fx-underlay" style={{
          backgroundImage: `url(${underlay})`,
          backgroundSize: `${fx.underlay.size}px`,
          backgroundPosition: fx.underlay.position,
          opacity: fx.underlay.opacity,
        }} />
      ) : null}
      {fx.gas ? <Gas {...fx.gas} seed={53} /> : null}
      {fx.firelight ? <Firelight spec={fx.firelight} /> : null}
      {fx.stars ? <Stars {...fx.stars} seed={67} /> : null}
      {fx.embers ? <Embers {...fx.embers} seed={11} /> : null}
      {fx.streaks ? <Streaks {...fx.streaks} seed={29} /> : null}
      {fx.rain ? <Rain {...fx.rain} seed={47} /> : null}
      {fx.drips ? <Drips {...fx.drips} seed={73} /> : null}
      {badge ? (
        <span className="fx-badge" style={{
          backgroundImage: `url(${badge})`,
          width: `${fx.badge.size}px`, height: `${fx.badge.size}px`,
          opacity: fx.badge.opacity,
        }} />
      ) : null}
    </div>
  );
}
