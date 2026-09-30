/* ================================================================== */
/* THE GALAXY MAP                                                     */
/*                                                                    */
/* Click the planet where you clicked it in the game a minute ago,    */
/* and the scenario fills itself. The curator's framing, and the      */
/* reason this is a map rather than a longer list: finding a place    */
/* again in the same shape is instant.                                */
/*                                                                    */
/* It matches the game's layout and not its styling. A chart to be    */
/* read, with the faction hexes every badge already uses and nothing  */
/* that glows. Everything that is not a picture is in lib/galaxy.js.  */
/*                                                                    */
/* Marks keep their size on screen at every zoom, so zooming in       */
/* spreads the planets apart rather than inflating them, and a        */
/* planet's name appears once there is room for it.                   */
/* ================================================================== */

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useId } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";

import {
  VIEW, CENTRE, RADIUS, MAX_ZOOM, HOME, placed, lanes, sectors, roomFor, placeOf, matchSet,
  clampView, zoomAt, centreOn, placeLabels, labelSide,
  TABLE, sectorZones, sectorHolders, frontArcs, arcPath,
} from "./lib/galaxy.js";
import { SETTINGS, readSetting, writeSetting } from "./lib/storage.js";
import { planetByName, biomeName, hazardName, loudHazards } from "./lib/scenario.js";
import { untilText } from "./lib/war.js";

const OSWALD = "'Oswald', sans-serif";

/* Sizes in screen pixels, converted to map units at the current zoom. */
const DOT = 3.2;
const HOME_DOT = 5;
const HIT = 11;
const NAME_PX = 11;
const SECTOR_PX = 9;
/* The gap a name needs to its nearest neighbour before it is drawn. */
const NAME_ROOM = 62;
/* Past this many screen pixels per map unit, planet names have taken
   over and the sector names step aside. */
const SECTOR_UNTIL = 1.45;
/* Search matches are all named when there are few enough to read. */
const NAME_ALL_MATCHES = 14;

const LANE_PATH = lanes.map(({ a, b }) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join("");

/* ------------------------------------------------------------------ */
/* The Galactic War skin                                               */
/*                                                                     */
/* The curator asked for a second look that resembles the game's own   */
/* war table, 30 September 2026. Its colours are the game's rather     */
/* than the theme's, on purpose: this skin is a picture of a place in  */
/* the game. The faction hexes are the same locked three as everywhere */
/* else. The chart stays the other choice, and each browser remembers  */
/* which it last used.                                                 */
/* ------------------------------------------------------------------ */

const SKINS = ["chart", "war"];

function useMapSkin() {
  const [skin, setSkin] = useState("chart");
  useEffect(() => {
    const saved = readSetting(SETTINGS.mapSkin, SKINS, null);
    if (saved) setSkin(saved);
  }, []);
  const choose = useCallback((next) => {
    if (!SKINS.includes(next)) return;
    setSkin(next);
    writeSetting(SETTINGS.mapSkin, next);
  }, []);
  return [skin, choose];
}

/* A planet's colour on the table, by the kind of world it is: light at the
   top left, the body, and the shadow side. */
const WORLD = {
  moor: ["#b9ccb2", "#5f7a63", "#16211a"],
  desert: ["#f0d6a4", "#b98b4e", "#2e2010"],
  arctic: ["#ffffff", "#b7c7d8", "#34414f"],
  primordial: ["#b5e0a2", "#4f8a4a", "#10250f"],
  forest: ["#a9d488", "#4c7a33", "#12200c"],
  swamp: ["#c2c392", "#6a6b45", "#1c1d14"],
  oasis: ["#b7eee0", "#4f9f93", "#0f2f2b"],
  magma: ["#ffc38c", "#c2451f", "#2e0b04"],
  bug: ["#f8d587", "#b8721f", "#2e1904"],
  grassland: ["#cde6a6", "#6f9a45", "#18260e"],
  super_earth: ["#c4e6ff", "#2f7fd0", "#082037"],
};
const worldOf = (name) => {
  const t = planetByName.get(name);
  return t && WORLD[t.type] ? t.type : "moor";
};

/* The stars behind the table, placed once from a fixed seed so the sky does
   not move between renders, the same rule the ambient layer keeps. */
const STARS = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const out = [];
  while (out.length < 320) {
    const x = rand() * VIEW;
    const y = rand() * VIEW;
    if (Math.hypot(x - CENTRE, y - CENTRE) > TABLE.outer - 6) continue;
    out.push({ x, y, r: 0.4 + rand() * 0.9, o: 0.25 + rand() * 0.6 });
  }
  return out;
})();

/* Soft colour in the dark, the game's nebula, in fixed places. */
const NEBULAE = [
  { x: 330, y: 360, r: 260, c: "#1f5a8f", o: 0.22 },
  { x: 690, y: 640, r: 240, c: "#3a2a70", o: 0.2 },
  { x: 610, y: 280, r: 200, c: "#16606a", o: 0.14 },
  { x: 300, y: 700, r: 210, c: "#284a7a", o: 0.16 },
];

const RIM_TICKS = Array.from({ length: 96 }, (_, i) => (i / 96) * 2 * Math.PI);

/**
 * `war` is the cleaned live snapshot from lib/war.js, or null. `fronts`
 * maps a front's id to its hex and its name, handed in by the caller so
 * this file does not import the tier list, which imports this file.
 *
 * `picks` and `fits` are the drop planner's answer: the planets it says to
 * go to, in order, which get a numbered marker, and every planet that fits
 * what you asked for, which stay lit while the rest step back. A search
 * overrides both while you are typing.
 */
export default function GalaxyMap({
  chosen, onChoose, query = "", disabled = false, label, war = null, fronts = {}, picks = [], fits = null,
}) {
  const svg = useRef(null);
  const [skin, setSkin] = useMapSkin();
  const table = skin === "war";
  /* Ids inside an inline SVG are page wide, so every gradient and pattern
     here carries this map's own prefix. */
  const gid = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [view, setView] = useState(HOME);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hover, setHover] = useState(null);
  /* The last planet chosen by clicking the map, so choosing it does not
     also fly the map to it. */
  const clicked = useRef(null);

  /* Screen pixels per map unit at zoom 1. Measured rather than assumed,
     because the map is 540 pixels wide on a desktop and 340 on a phone
     and a name has to be readable on both. */
  const [ppu, setPpu] = useState(0.54);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setPpu(w / VIEW);
    };
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* A point on screen, in the view box's own units. The inverse of the
     SVG's screen matrix, so letterboxing and page scroll cannot skew it. */
  const toFrame = useCallback((clientX, clientY) => {
    const el = svg.current;
    const m = el && el.getScreenCTM();
    if (!m) return { x: CENTRE, y: CENTRE };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Dragging, pinching and the click                                  */
  /*                                                                   */
  /* One finger or the mouse drags. Two fingers pinch. A press that    */
  /* barely moved is a click, and a click on a planet chooses it. The  */
  /* planet is read off the press, not the release, because once the  */
  /* map has captured the pointer every later event is the map's.     */
  /* ---------------------------------------------------------------- */

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const [dragging, setDragging] = useState(false);

  const restart = (moved) => {
    gesture.current = {
      view: viewRef.current,
      pts: [...pointers.current.values()].map((p) => ({ ...p })),
      moved,
      planet: null,
    };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = svg.current;
    if (el && el.setPointerCapture) el.setPointerCapture(e.pointerId);
    const frame = toFrame(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, { ...frame, cx: e.clientX, cy: e.clientY });
    if (pointers.current.size === 1) {
      const hit = e.target && e.target.closest ? e.target.closest("[data-planet]") : null;
      restart(false);
      gesture.current.planet = hit ? hit.getAttribute("data-planet") : null;
    } else {
      restart(true);
    }
  };

  const onPointerMove = (e) => {
    const held = pointers.current.get(e.pointerId);
    if (!held) {
      if (e.pointerType === "mouse") {
        const hit = e.target && e.target.closest ? e.target.closest("[data-planet]") : null;
        setHover(hit ? hit.getAttribute("data-planet") : null);
      }
      return;
    }
    const frame = toFrame(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, { ...frame, cx: e.clientX, cy: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (pointers.current.size === 1) {
      const start = g.pts[0];
      if (!g.moved && Math.hypot(e.clientX - start.cx, e.clientY - start.cy) < 5) return;
      if (!g.moved) setDragging(true);
      g.moved = true;
      setHover(null);
      setView(clampView({ k: g.view.k, x: g.view.x + (frame.x - start.x), y: g.view.y + (frame.y - start.y) }));
      return;
    }

    if (pointers.current.size === 2 && g.pts.length === 2) {
      const [a0, b0] = g.pts;
      const [a, b] = [...pointers.current.values()];
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(g.view, mid0, d / d0);
      setView(clampView({ k: zoomed.k, x: zoomed.x + (mid.x - mid0.x), y: zoomed.y + (mid.y - mid0.y) }));
    }
  };

  const release = (e, cancelled) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      if (!cancelled && g && !g.moved && g.planet && !disabled) {
        clicked.current = g.planet;
        onChoose(g.planet);
      }
      gesture.current = null;
      setDragging(false);
    } else {
      /* A finger lifted out of a pinch. What is left drags from here,
         and lifting it is not a click. */
      restart(true);
    }
  };

  /* The wheel zooms around the cursor. At either limit it lets go, so
     scrolling past the map scrolls the page instead of getting stuck. */
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const v = viewRef.current;
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      if ((factor < 1 && v.k <= 1) || (factor > 1 && v.k >= MAX_ZOOM)) return;
      e.preventDefault();
      setView(zoomAt(v, toFrame(e.clientX, e.clientY), factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toFrame]);

  const zoomBy = (factor) => setView((v) => zoomAt(v, { x: CENTRE, y: CENTRE }, factor));

  /* Chosen from the list rather than the map: fly to it, so the map and
     the list never disagree about where you are. A click on the map
     does not move it, because you are already looking at the place. */
  /* Compared against the last value seen rather than a "has mounted"
     flag, so opening the map shows the whole galaxy even when React runs
     the effect twice, as it does in development. */
  const seen = useRef(chosen);
  useEffect(() => {
    if (seen.current === chosen) return;
    seen.current = chosen;
    if (!chosen || clicked.current === chosen) return;
    const p = placeOf(chosen);
    if (p) setView((v) => centreOn(p, Math.max(v.k, 3)));
  }, [chosen]);

  /* ---------------------------------------------------------------- */
  /* What is drawn                                                     */
  /* ---------------------------------------------------------------- */

  const matches = useMemo(() => matchSet(query), [query]);

  /* Screen pixels to map units at this zoom. */
  const u = 1 / (ppu * view.k);
  const namesMatches = matches && matches.size <= NAME_ALL_MATCHES;

  /* Only a snapshot young enough to trust is drawn. An old one is not
     drawn faded or with a warning on top: it is not drawn, and the line
     under the map says why. */
  const live = war && war.fresh ? war.planets : null;

  /* Redrawn when the zoom, the choice, the search or the war changes, never
     on a pan: a pan only moves the group this sits in. */
  const layer = useMemo(() => {
    /* The game names a sector only on hover, and the hover card here does
       the same, so the table leaves the sector names off the map. */
    const showSectors = !table && ppu * view.k < SECTOR_UNTIL;
    const halo = { paintOrder: "stroke", strokeLinejoin: "round" };
    const hexOf = (w) => (w && w.front && fronts[w.front] ? fronts[w.front].hex : null);

    /* Which names are drawn. The chosen planet and the search's matches
       always; then the fronts you can drop on, busiest first, since those
       are the planets anybody is looking for; then any planet with room.
       None of the last two is drawn over a name already placed. */
    const scale = ppu * view.k;
    const wanted = [];
    const pickAt = new Map(matches ? [] : picks.map((name, i) => [name, i]));
    for (const p of placed) {
      const on = p.name === chosen;
      const lit = matches ? matches.has(p.name) : pickAt.has(p.name);
      const w = !matches && live ? live.get(p.name) : null;
      const front = Boolean(w && w.campaign);
      const roomy = !matches && roomFor.get(p.name) * scale >= NAME_ROOM;
      const gap = table
        ? (pickAt.has(p.name) ? DOT * 1.5 + 11 : (front ? DOT * 1.6 : DOT * 1.25) + 4)
        : pickAt.has(p.name) ? DOT * 1.5 + 12 : (front ? DOT * 1.5 : DOT) + 5;
      const base = table
        ? { name: p.name, x: p.x, y: p.y, offset: gap, side: "below", charPx: 6.4, height: front ? 18 : 12 }
        : { name: p.name, x: p.x, y: p.y, offset: gap, side: labelSide(p) };
      /* On the table the rim band carries the fronts' names, so a planet's
         name that would reach into it waits for a closer zoom, the same as
         one that would overlap another name. */
      const intoRim = table && !on && !(lit && (namesMatches || !matches)) && (() => {
        const half = (p.name.length * 6.4 + 4) / 2;
        const bottom = gap + (front ? 18 : 12);
        return [[-half, bottom], [half, bottom], [-half, gap], [half, gap]].some(([dx, dy]) =>
          Math.hypot(p.x + dx * u - CENTRE, p.y + dy * u - CENTRE) > TABLE.outer - 16 * u);
      })();
      if (intoRim) continue;
      if (on || (table && p.home)) wanted.push({ ...base, priority: 0, must: true });
      else if (lit && (namesMatches || !matches)) wanted.push({ ...base, priority: 1, must: true });
      else if (front) wanted.push({ ...base, priority: 2, weight: w.players });
      else if (roomy) wanted.push({ ...base, priority: 3, weight: roomFor.get(p.name) });
    }
    /* Sector names last, and only where no planet's name already is. */
    if (showSectors) {
      for (const s of sectors) {
        wanted.push({ key: "sector:" + s.name, name: s.name, x: s.x, y: s.y, side: "middle", priority: 4,
          weight: s.count, charPx: 6.6, height: 11 });
      }
    }
    const named = placeLabels(wanted, scale);

    const holders = table ? sectorHolders(war) : null;

    return (
      <>
        {table ? (
          <WarBackdrop gid={gid} u={u} holders={holders} fronts={fronts} dimmed={Boolean(matches)} />
        ) : (
          <>
            <circle cx={CENTRE} cy={CENTRE} r={RADIUS + 24} className="fill-base-900/60 stroke-base-800"
              strokeWidth={u} />
            <circle cx={CENTRE} cy={CENTRE} r={RADIUS * 0.5} className="fill-none stroke-base-800/60"
              strokeWidth={u} strokeDasharray={`${3 * u} ${5 * u}`} />
          </>
        )}
        <path d={LANE_PATH} className={table ? "fill-none" : "fill-none stroke-base-700"} strokeWidth={u}
          stroke={table ? "#7ea6cf" : undefined}
          opacity={table ? (matches ? 0.1 : 0.22) : matches ? 0.35 : 0.8} />

        {showSectors
          ? sectors.filter((s) => named.has("sector:" + s.name)).map((s) => (
              <text key={s.name} x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle"
                className={"pointer-events-none " + (table ? "" : "fill-base-500 stroke-base-950")}
                fill={table ? "#9db6cf" : undefined} stroke={table ? "#050a10" : undefined} strokeWidth={3 * u}
                style={{ ...halo, fontFamily: OSWALD, fontSize: SECTOR_PX * u, letterSpacing: 1.2 * u,
                  textTransform: "uppercase", opacity: matches ? 0.35 : 0.75 }}>
                {s.name}
              </text>
            ))
          : null}

        {placed.map((p) => {
          const on = p.name === chosen;
          const lit = matches ? matches.has(p.name) : false;
          /* The planner's fits stay lit and everything else steps back, the
             way a search does, though less far: the rest of the war is still
             worth seeing. */
          const unfit = !matches && fits && !fits.has(p.name) && !on && !p.home;
          const dim = (matches && !lit && !on) || unfit;
          /* With the war live: a planet somebody holds takes their colour, a
             front you can drop on is larger and ringed, and a quiet planet
             Super Earth holds steps back so the war reads first. */
          const w = live ? live.get(p.name) : null;
          const hex = hexOf(w);
          const front = Boolean(w && w.campaign);
          const r = (p.home ? HOME_DOT : front ? DOT * 1.5 : DOT) * u;
          const painted = hex && !on && !lit;
          const fill = on || lit ? "fill-brand"
            : p.home ? "fill-base-100"
            : painted ? ""
            : dim ? "fill-base-700"
            : live ? "fill-base-600"
            : "fill-base-400";
          if (table) {
            /* On the table a planet is a small lit sphere in the colour of
               its world, as in game; who holds it is the ground under it.
               A front you can drop on carries the game's target reticle. */
            const tr = (p.home ? 0 : front ? DOT * 1.6 : DOT * 1.25) * u;
            if (p.home) {
              return (
                <g key={p.name}>
                  <circle cx={p.x} cy={p.y} r={16 * u} fill={`url(#${gid}-glow)`} />
                  <circle cx={p.x} cy={p.y} r={9 * u} fill={`url(#${gid}-w-super_earth)`} />
                  <circle cx={p.x} cy={p.y} r={HIT * u} fill="transparent" data-planet={p.name}
                    className={disabled ? "" : "cursor-pointer"} />
                </g>
              );
            }
            return (
              <g key={p.name} opacity={matches && dim ? 0.3 : unfit ? 0.45 : 1}>
                {on ? (
                  <circle cx={p.x} cy={p.y} r={tr + 5 * u} className="fill-none stroke-brand" strokeWidth={1.6 * u} />
                ) : null}
                <circle cx={p.x} cy={p.y} r={tr} fill={`url(#${gid}-w-${worldOf(p.name)})`}
                  stroke={hex || "#0b1420"} strokeWidth={(hex ? 1 : 0.6) * u} strokeOpacity={hex ? 0.9 : 0.8} />
                {front ? (
                  <g transform={`translate(${p.x} ${p.y - tr - 7 * u})`} className="pointer-events-none">
                    <circle r={4.2 * u} fill="#0a0f16" stroke="#f2f2f2" strokeWidth={1.1 * u} />
                    <circle r={2 * u} fill="none" stroke="#f2f2f2" strokeWidth={0.9 * u} />
                    <circle r={0.7 * u} fill="#f2f2f2" />
                  </g>
                ) : null}
                <circle cx={p.x} cy={p.y} r={HIT * u} fill="transparent" data-planet={p.name}
                  className={disabled ? "" : "cursor-pointer"} />
              </g>
            );
          }
          return (
            <g key={p.name} opacity={matches && dim ? 0.3 : unfit ? 0.4 : 1}>
              {on ? (
                <circle cx={p.x} cy={p.y} r={r + 5 * u} className="fill-none stroke-brand" strokeWidth={1.6 * u} />
              ) : front && hex ? (
                <circle cx={p.x} cy={p.y} r={r + 3.5 * u} fill="none" stroke={hex} strokeWidth={1.3 * u} />
              ) : null}
              <circle cx={p.x} cy={p.y} r={r} className={fill}
                style={painted ? { fill: hex, fillOpacity: front ? 1 : 0.55 } : undefined} />
              <circle cx={p.x} cy={p.y} r={HIT * u} fill="transparent" data-planet={p.name}
                className={disabled ? "" : "cursor-pointer"} />
            </g>
          );
        })}

        {/* The planner's picks, numbered in its order: a ring in the brand
            colour and the number beside it. Drawn over the planets so a
            pick is never hidden under a neighbour. */}
        {matches ? null : picks.map((name, i) => {
          const p = placeOf(name);
          if (!p) return null;
          const r = DOT * 1.5 * u;
          return (
            <g key={"pick-" + name} className="pointer-events-none">
              <circle cx={p.x} cy={p.y} r={r + 8 * u} className="fill-none stroke-brand" strokeWidth={1.8 * u}
                strokeDasharray={`${4 * u} ${2.5 * u}`} />
              <circle cx={p.x - 9 * u} cy={p.y - 9 * u} r={6.5 * u} className="fill-brand" />
              <text x={p.x - 9 * u} y={p.y - 9 * u} textAnchor="middle" dominantBaseline="central"
                className="fill-brand-ink" style={{ fontFamily: OSWALD, fontSize: 9 * u, fontWeight: 700 }}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {placed.map((p) => {
          if (!named.has(p.name)) return null;
          const on = p.name === chosen;
          const pick = !matches && picks.includes(p.name);
          const lit = matches ? matches.has(p.name) : pick;
          const w = !matches && live ? live.get(p.name) : null;
          const front = Boolean(w && w.campaign);
          if (table) {
            /* The game's way: the name under the planet in capitals, in the
               colour of whoever holds it, and under a front, a bar of how
               far it has been taken back, blue for Super Earth. */
            const hex = w && w.front && fronts[w.front] ? fronts[w.front].hex : null;
            const gap = pick ? DOT * 1.5 + 11 : (front ? DOT * 1.6 : DOT * 1.25) + 4;
            const done = w ? (w.defence ? w.defence.progress : w.liberation) : null;
            const barW = 30 * u;
            const barY = p.y + (gap + 12.5) * u;
            return (
              <g key={p.name} className="pointer-events-none">
                <text x={p.x} y={p.y + gap * u} textAnchor="middle" dominantBaseline="hanging"
                  className={on || lit ? "fill-brand" : undefined}
                  fill={on || lit ? undefined : hex || (p.home ? "#e8f3ff" : "#bcd3ea")}
                  stroke="#03070c" strokeWidth={3 * u}
                  style={{ ...halo, fontFamily: OSWALD, fontSize: (p.home ? 10 : 10.5) * u, letterSpacing: 0.9 * u,
                    textTransform: "uppercase" }}>
                  {p.name}
                </text>
                {front && done !== null ? (
                  <g>
                    <rect x={p.x - barW / 2 - 1 * u} y={barY - 1 * u} width={barW + 2 * u} height={5 * u}
                      fill="#03070c" stroke={hex || "#bcd3ea"} strokeWidth={0.7 * u} strokeOpacity={0.8} />
                    <rect x={p.x - barW / 2} y={barY} width={barW} height={3 * u} fill={hex || "#bcd3ea"} opacity={0.85} />
                    <rect x={p.x - barW / 2} y={barY} width={barW * done} height={3 * u} fill="#3fa3ff" />
                  </g>
                ) : null}
              </g>
            );
          }
          /* Clear of the pick's ring when it has one. */
          const gap = pick ? DOT * 1.5 + 12 : (front ? DOT * 1.5 : DOT) + 5;
          return (
            <text key={p.name} dominantBaseline="middle" y={p.y}
              x={labelSide(p) === "left" ? p.x - gap * u : p.x + gap * u}
              textAnchor={labelSide(p) === "left" ? "end" : "start"}
              className={"pointer-events-none stroke-base-950 " +
                (on || lit ? "fill-brand" : front ? "fill-base-100" : "fill-base-300")}
              strokeWidth={3 * u}
              style={{ ...halo, fontFamily: OSWALD, fontSize: NAME_PX * u, letterSpacing: 0.3 * u }}>
              {p.name}
            </text>
          );
        })}
      </>
    );
  }, [view.k, ppu, chosen, matches, namesMatches, disabled, u, live, fronts, picks, fits, table, gid, war]);

  const hovered = hover ? placeOf(hover) : null;
  const detail = hover ? planetByName.get(hover) : null;
  const fight = detail && live ? warLine(live.get(detail.name), fronts) : null;
  /* On the table a front's card leads with the game's own line: how far
     it has been taken back, as a bar and a figure. */
  const hoverWar = detail && live ? live.get(detail.name) : null;
  const cardDone = table && hoverWar && hoverWar.campaign
    ? (hoverWar.defence ? hoverWar.defence.progress : hoverWar.liberation)
    : null;
  const at = hovered
    ? { left: ((hovered.x * view.k + view.x) / VIEW) * 100, top: ((hovered.y * view.k + view.y) / VIEW) * 100 }
    : null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem] select-none">
      <svg ref={svg} viewBox={`0 0 ${VIEW} ${VIEW}`} role="img"
        aria-label={label || "The galaxy map. Click a planet to drop there, or search for it by name or sector."}
        className={"block h-full w-full " + (dragging ? "cursor-grabbing" : "cursor-grab")}
        /* Fully out there is nothing to pan, so a finger sliding up the map
           scrolls the page past it instead of getting stuck. Zoomed in, the
           map takes every gesture. Pinching and tapping are the map's either
           way, since neither is a vertical pan. */
        style={{ touchAction: view.k > 1 ? "none" : "pan-y" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, false)} onPointerCancel={(e) => release(e, true)}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={(e) => setView((v) => zoomAt(v, toFrame(e.clientX, e.clientY), 2))}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {layer}
          {hovered && hovered.name !== chosen ? (
            <circle cx={hovered.x} cy={hovered.y} r={(DOT + 4) * u} className="pointer-events-none fill-none stroke-base-100"
              strokeWidth={1.2 * u} />
          ) : null}
        </g>
      </svg>

      {/* What a planet is, before you commit to it. Mouse only: on a
          touch screen there is no hover, and the tap is the choice. */}
      {detail && at ? (
        <div className={"pointer-events-none absolute z-10 w-max max-w-[15rem] px-2.5 py-1.5 text-left shadow-lg " +
            (table ? "border-2 bg-[#05090e]/95" : "rounded border border-base-700 bg-base-950/95")}
          style={{
            ...(table ? { borderColor: (fight && fight.hex) || "rgb(var(--brand))" } : {}),
            left: `${Math.min(Math.max(at.left, 18), 82)}%`,
            top: `${at.top}%`,
            transform: at.top < 22 ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 14px))",
          }}>
          <p className={"text-xs font-bold " + (table ? "uppercase tracking-wider" : "text-base-100")}
            style={{ fontFamily: OSWALD, ...(table ? { color: (fight && fight.hex) || "#e8f3ff" } : {}) }}>{detail.name}</p>
          {cardDone !== null ? (
            <div className="my-1">
              <div className="h-1.5 w-40 overflow-hidden border border-white/20"
                style={{ backgroundColor: (fight && fight.hex) || "#bcd3ea" }}>
                <div className="h-full bg-[#3fa3ff]" style={{ width: `${Math.round(cardDone * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[#e8f3ff]" style={{ fontFamily: OSWALD }}>
                {Math.round(cardDone * 100)}% {hoverWar.defence ? "defended" : "liberated"}
              </p>
            </div>
          ) : null}
          <p className="text-[10px] text-base-500">
            {[detail.sector ? detail.sector + " sector" : null, detail.biome ? biomeName(detail.biome) : null]
              .filter(Boolean).join(" · ")}
          </p>
          {loudHazards(detail.hazards).length ? (
            <p className="mt-0.5 text-[10px] text-accent-300">{loudHazards(detail.hazards).map(hazardName).join(" · ")}</p>
          ) : (
            <p className="mt-0.5 text-[10px] text-base-500">Nothing permanent here changes what you bring</p>
          )}
          {fight ? (
            <p className={"mt-1 border-t border-base-800 pt-1 text-[10px] leading-snug " + (fight.hex ? "" : "text-base-400")}
              style={fight.hex ? { color: fight.hex } : undefined}>
              {fight.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The skin switch. The chart is for reading; the table looks like the
          game. Same map, same clicks, remembered per browser. */}
      <div className="absolute left-2 top-2 flex overflow-hidden rounded border border-base-700 bg-base-900/90 text-[10px]"
        role="group" aria-label="How the map looks">
        {[["chart", "Chart"], ["war", "Galactic War"]].map(([id, name]) => (
          <button key={id} type="button" onClick={() => setSkin(id)} aria-pressed={skin === id}
            className={"px-2 py-1 uppercase tracking-wider transition-colors " +
              (skin === id ? "bg-base-200 text-base-900" : "text-base-400 hover:text-base-100")}
            style={{ fontFamily: OSWALD }}>
            {name}
          </button>
        ))}
      </div>

      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoomBy(1.6)} disabled={view.k >= MAX_ZOOM}><Plus className="h-3.5 w-3.5" /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.6)} disabled={view.k <= 1}><Minus className="h-3.5 w-3.5" /></MapButton>
        <MapButton label="The whole galaxy" onClick={() => setView(HOME)} disabled={view.k <= 1}><Maximize2 className="h-3.5 w-3.5" /></MapButton>
      </div>
    </div>
  );
}

/**
 * The table under the planets: space, the sectors as zones on the polar
 * grid, each held zone filled and hatched in its front's colour and
 * brighter where there is a front to drop on, the rim with its ticks, the
 * fronts' names along it, and Sol in the middle. Held zones come only from
 * a live war fresh enough to trust; without one the table is dark.
 */
function WarBackdrop({ gid, u, holders, fronts, dimmed }) {
  const arcs = frontArcs(holders);
  return (
    <>
      <defs>
        <radialGradient id={`${gid}-space`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#13283c" />
          <stop offset="70%" stopColor="#0a1622" />
          <stop offset="100%" stopColor="#05090f" />
        </radialGradient>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0%" stopColor="#bfe3ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#bfe3ff" stopOpacity="0" />
        </radialGradient>
        {NEBULAE.map((n, i) => (
          <radialGradient key={i} id={`${gid}-neb-${i}`}>
            <stop offset="0%" stopColor={n.c} stopOpacity={n.o} />
            <stop offset="100%" stopColor={n.c} stopOpacity="0" />
          </radialGradient>
        ))}
        {Object.entries(WORLD).map(([type, [light, body, dark]]) => (
          <radialGradient key={type} id={`${gid}-w-${type}`} cx="36%" cy="32%" r="70%">
            <stop offset="0%" stopColor={light} />
            <stop offset="45%" stopColor={body} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
        ))}
        {Object.entries(fronts).map(([id, f]) => (
          <pattern key={id} id={`${gid}-hatch-${id}`} width="9" height="9" patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)">
            <rect width="4" height="9" fill={f.hex} opacity="0.32" />
          </pattern>
        ))}
        <clipPath id={`${gid}-disc`}>
          <circle cx={CENTRE} cy={CENTRE} r={TABLE.outer} />
        </clipPath>
      </defs>

      <circle cx={CENTRE} cy={CENTRE} r={TABLE.outer} fill={`url(#${gid}-space)`} />
      <g clipPath={`url(#${gid}-disc)`}>
        {NEBULAE.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={`url(#${gid}-neb-${i})`} />
        ))}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * u} fill="#e8f2ff" opacity={s.o} />
        ))}
      </g>

      <g opacity={dimmed ? 0.45 : 1}>
        {[...sectorZones].map(([sector, d]) => {
          const h = holders.get(sector);
          const f = h && h.front ? fronts[h.front] : null;
          return (
            <g key={sector}>
              {f ? (
                <>
                  <path d={d} fill={f.hex} fillOpacity={h.campaign ? 0.4 : 0.26} />
                  <path d={d} fill={`url(#${gid}-hatch-${h.front})`} />
                </>
              ) : null}
              <path d={d} fill="none" stroke={f ? f.hex : "#27405a"} strokeOpacity={f ? 0.55 : 0.55}
                strokeWidth={(f ? 1.1 : 0.8) * u} />
            </g>
          );
        })}
      </g>

      <circle cx={CENTRE} cy={CENTRE} r={TABLE.sol} fill="#081421" stroke="#3a6a96" strokeOpacity="0.6" strokeWidth={u} />
      {/* The rim, a dark band the way the game frames its table, with the
          fronts' names written into it rather than over the planets. */}
      <circle cx={CENTRE} cy={CENTRE} r={TABLE.outer - 7 * u} fill="none" stroke="#08111b" strokeOpacity="0.92"
        strokeWidth={15 * u} />
      <circle cx={CENTRE} cy={CENTRE} r={TABLE.outer - 14.5 * u} fill="none" stroke="#35597d" strokeOpacity="0.7"
        strokeWidth={0.8 * u} />
      <circle cx={CENTRE} cy={CENTRE} r={TABLE.outer} fill="none" stroke="#35597d" strokeOpacity="0.7"
        strokeWidth={1.2 * u} />
      {RIM_TICKS.map((a, i) => (
        <line key={i}
          x1={CENTRE + (TABLE.outer - (i % 4 === 0 ? 5 : 3) * u) * Math.cos(a)}
          y1={CENTRE + (TABLE.outer - (i % 4 === 0 ? 5 : 3) * u) * Math.sin(a)}
          x2={CENTRE + TABLE.outer * Math.cos(a)} y2={CENTRE + TABLE.outer * Math.sin(a)}
          stroke="#6d8fb3" strokeOpacity="0.45" strokeWidth={0.8 * u} />
      ))}

      {arcs.map(({ front, angle }) => {
        const f = fronts[front];
        if (!f) return null;
        const id = `${gid}-arc-${front}`;
        return (
          <g key={front} className="pointer-events-none">
            <path id={id} d={arcPath(angle, TABLE.outer - 8 * u, 0.9)} fill="none" />
            <text fill={f.hex} fillOpacity="0.95" dominantBaseline="middle"
              style={{ fontFamily: OSWALD, fontSize: 10.5 * u, letterSpacing: 3.5 * u, fontWeight: 700,
                textTransform: "uppercase" }}>
              <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{f.label}</textPath>
            </text>
          </g>
        );
      })}
    </>
  );
}

/**
 * The Major Order, above the map, as context for where to go. Its briefing
 * in the game's words, when it ends, and a bar per task in the colour of
 * the front the task is on. Nothing here says what a task asks, because
 * that is not published and the briefing already says it.
 */
export function MajorOrder({ order, fronts = {} }) {
  if (!order) return null;
  return (
    <div className="rounded border border-base-800 bg-base-950/40 px-3 py-2 text-left">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand" style={{ fontFamily: OSWALD }}>
          Major Order
        </span>
        <span className="text-[10px] text-base-500">{untilText(order.endsAt - Date.now())} left</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-base-300">{order.briefing}</p>
      {order.tasks.length ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {order.tasks.map((t, i) => {
            const f = t.front ? fronts[t.front] : null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[10px] text-base-400">{f ? f.label : `Task ${i + 1}`}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-800">
                  <span className={"block h-full rounded-full " + (f ? "" : "bg-brand")}
                    style={{ width: `${Math.round(t.done * 100)}%`, ...(f ? { backgroundColor: f.hex } : {}) }} />
                </span>
                <span className="w-9 shrink-0 text-right text-[10px] text-base-400">{Math.round(t.done * 100)}%</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* What is happening on a planet, in a sentence, for the hover card. */
const pct = (share) => Math.round(share * 100) + "%";

function timeLeft(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return hours === 1 ? "an hour left" : `${hours} hours left`;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  return minutes === 1 ? "a minute left" : `${minutes} minutes left`;
}

function warLine(w, fronts) {
  if (!w) return { text: "Super Earth holds it. Nothing to fight here right now.", hex: null };
  const f = w.front ? fronts[w.front] : null;
  const who = f ? f.label : "the enemy";
  const hex = f ? f.hex : null;
  const crowd = w.players ? ` ${w.players.toLocaleString("en-GB")} Helldivers here.` : "";
  if (w.defence) {
    const left = w.defence.endsAt ? timeLeft(w.defence.endsAt - Date.now()) : null;
    const done = w.defence.progress !== null ? `, ${pct(w.defence.progress)} defended` : "";
    return { text: `Under attack by the ${who}${done}${left ? ", " + left : ""}.${crowd}`, hex };
  }
  if (w.campaign) {
    const done = w.liberation !== null ? `, ${pct(w.liberation)} liberated` : "";
    return { text: `Held by the ${who}${done}.${crowd}`, hex };
  }
  return { text: `Held by the ${who}. No campaign here right now.`, hex };
}

function MapButton({ label, onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className="rounded border border-base-700 bg-base-900/90 p-1.5 text-base-300 hover:border-base-500 hover:text-base-100 disabled:opacity-40 disabled:hover:border-base-700">
      {children}
    </button>
  );
}
