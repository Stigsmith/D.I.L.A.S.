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

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";

import {
  VIEW, CENTRE, RADIUS, MAX_ZOOM, HOME, placed, lanes, sectors, roomFor, placeOf, matchSet,
  clampView, zoomAt, centreOn,
} from "./lib/galaxy.js";
import { planetByName, biomeName, hazardName, loudHazards } from "./lib/scenario.js";

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

export default function GalaxyMap({ chosen, onChoose, query = "", disabled = false, label }) {
  const svg = useRef(null);
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

  /* Redrawn when the zoom, the choice or the search changes, never on a
     pan: a pan only moves the group this sits in. */
  const layer = useMemo(() => {
    const showSectors = ppu * view.k < SECTOR_UNTIL;
    const halo = { paintOrder: "stroke", strokeLinejoin: "round" };

    return (
      <>
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS + 24} className="fill-base-900/60 stroke-base-800"
          strokeWidth={u} />
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS * 0.5} className="fill-none stroke-base-800/60"
          strokeWidth={u} strokeDasharray={`${3 * u} ${5 * u}`} />
        <path d={LANE_PATH} className="fill-none stroke-base-700" strokeWidth={u} opacity={matches ? 0.35 : 0.8} />

        {showSectors
          ? sectors.map((s) => (
              <text key={s.name} x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-none fill-base-500 stroke-base-950" strokeWidth={3 * u}
                style={{ ...halo, fontFamily: OSWALD, fontSize: SECTOR_PX * u, letterSpacing: 1.2 * u,
                  textTransform: "uppercase", opacity: matches ? 0.35 : 0.75 }}>
                {s.name}
              </text>
            ))
          : null}

        {placed.map((p) => {
          const on = p.name === chosen;
          const lit = matches ? matches.has(p.name) : false;
          const dim = matches && !lit && !on;
          const r = (p.home ? HOME_DOT : DOT) * u;
          const fill = on || lit ? "fill-brand" : p.home ? "fill-base-100" : dim ? "fill-base-700" : "fill-base-400";
          return (
            <g key={p.name}>
              {on ? (
                <circle cx={p.x} cy={p.y} r={r + 5 * u} className="fill-none stroke-brand" strokeWidth={1.6 * u} />
              ) : null}
              <circle cx={p.x} cy={p.y} r={r} className={fill} />
              <circle cx={p.x} cy={p.y} r={HIT * u} fill="transparent" data-planet={p.name}
                className={disabled ? "" : "cursor-pointer"} />
            </g>
          );
        })}

        {placed.map((p) => {
          const on = p.name === chosen;
          const lit = matches ? matches.has(p.name) : false;
          const roomy = !matches && roomFor.get(p.name) * ppu * view.k >= NAME_ROOM;
          if (!on && !roomy && !(lit && namesMatches)) return null;
          return (
            <text key={p.name} x={p.x + (DOT + 5) * u} y={p.y} dominantBaseline="middle"
              className={"pointer-events-none stroke-base-950 " + (on || lit ? "fill-brand" : "fill-base-300")}
              strokeWidth={3 * u}
              style={{ ...halo, fontFamily: OSWALD, fontSize: NAME_PX * u, letterSpacing: 0.3 * u }}>
              {p.name}
            </text>
          );
        })}
      </>
    );
  }, [view.k, ppu, chosen, matches, namesMatches, disabled, u]);

  const hovered = hover ? placeOf(hover) : null;
  const detail = hover ? planetByName.get(hover) : null;
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
        <div className="pointer-events-none absolute z-10 w-max max-w-[15rem] rounded border border-base-700 bg-base-950/95 px-2.5 py-1.5 text-left shadow-lg"
          style={{
            left: `${Math.min(Math.max(at.left, 18), 82)}%`,
            top: `${at.top}%`,
            transform: at.top < 22 ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 14px))",
          }}>
          <p className="text-xs font-bold text-base-100" style={{ fontFamily: OSWALD }}>{detail.name}</p>
          <p className="text-[10px] text-base-500">
            {[detail.sector ? detail.sector + " sector" : null, detail.biome ? biomeName(detail.biome) : null]
              .filter(Boolean).join(" · ")}
          </p>
          {loudHazards(detail.hazards).length ? (
            <p className="mt-0.5 text-[10px] text-accent-300">{loudHazards(detail.hazards).map(hazardName).join(" · ")}</p>
          ) : (
            <p className="mt-0.5 text-[10px] text-base-500">Nothing permanent here changes what you bring</p>
          )}
        </div>
      ) : null}

      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoomBy(1.6)} disabled={view.k >= MAX_ZOOM}><Plus className="h-3.5 w-3.5" /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.6)} disabled={view.k <= 1}><Minus className="h-3.5 w-3.5" /></MapButton>
        <MapButton label="The whole galaxy" onClick={() => setView(HOME)} disabled={view.k <= 1}><Maximize2 className="h-3.5 w-3.5" /></MapButton>
      </div>
    </div>
  );
}

function MapButton({ label, onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className="rounded border border-base-700 bg-base-900/90 p-1.5 text-base-300 hover:border-base-500 hover:text-base-100 disabled:opacity-40 disabled:hover:border-base-700">
      {children}
    </button>
  );
}
