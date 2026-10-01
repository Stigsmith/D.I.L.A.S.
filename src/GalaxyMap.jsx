/* ================================================================== */
/* THE GALAXY MAP                                                     */
/*                                                                    */
/* Click the planet where you clicked it in the game a minute ago,    */
/* and the scenario fills itself. The curator's framing, and the      */
/* reason this is a map rather than a longer list: finding a place    */
/* again in the same shape is instant. Everything that is not a       */
/* picture is in lib/galaxy.js.                                       */
/*                                                                    */
/* Two views, the game's way, the curator's call on 30 September     */
/* 2026: the galaxy, and one sector. Click a sector and the map       */
/* glides in to planet level; move around in there, zoom in, zoom    */
/* out a little; zoom out further and it glides back to the whole     */
/* galaxy rather than stopping at some level in between.              */
/*                                                                    */
/* Two looks, switched in the corner and remembered per browser:      */
/* Tactical, sleek, glowing and animated in the theme's own colours,  */
/* with the game's planet renders once you are in a sector; and the   */
/* Chart, plain dots and lines for reading. A half copy of the game's */
/* own screen was tried and cut the same day: exactly the game or     */
/* clearly the tool's own, not something in between.                  */
/*                                                                    */
/* Marks keep their size on screen at every zoom, so zooming in       */
/* spreads the planets apart rather than inflating them, and a        */
/* planet's name appears once there is room for it.                   */
/*                                                                    */
/* Full screen, the curator's ask of 1 October 2026, is the same map  */
/* over the whole screen, tilted back like a table unless you flatten */
/* it. The tilt is a CSS perspective, and lib/galaxy.js holds the     */
/* same projection written out, so a click still lands on the planet  */
/* drawn under it.                                                    */
/* ================================================================== */

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, ChevronLeft, Maximize2, Minimize2 } from "lucide-react";

import {
  VIEW, CENTRE, RADIUS, MAX_ZOOM, HOME, placed, lanes, sectors, roomFor, placeOf, matchSet,
  clampView, zoomAt, toMap, placeLabels, labelSide,
  sectorHolders, frontArcs, arcPath, sectorMembers, sectorNear, sectorView, leavesSector, glide, towards, LEAVE_AT,
  sectorZones, sectorOutlines, zoneAt, stageFit, stageCover, stageTransform, onStage, offStage, stageDepth,
} from "./lib/galaxy.js";
import { SETTINGS, readSetting, writeSetting } from "./lib/storage.js";
import { planetByName, biomeName, hazardName, loudHazards } from "./lib/scenario.js";
import { untilText, agoText } from "./lib/war.js";
import { planetArt } from "./lib/assets.js";

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
   over and the chart's sector names step aside. */
const SECTOR_UNTIL = 1.45;
/* Search matches are all named when there are few enough to read. */
const NAME_ALL_MATCHES = 14;
/* A planet's render inside a sector, in screen pixels. */
const WORLD_PX = 30;
const FRONT_WORLD_PX = 36;
/* How long a glide between the galaxy and a sector takes. */
const GLIDE_MS = 480;
/* Full screen draws every mark, name and render this much bigger, since
   the map is twice the size, and keeps this many pixels clear round it. */
const FULL_MARKS = 1.3;
const FULL_MARGIN = 28;

const LANE_PATH = lanes.map(({ a, b }) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join("");

/* The Tactical skin's rim ticks and its slow sweep, drawn once. */
const TICKS = Array.from({ length: 72 }, (_, i) => (i / 72) * 2 * Math.PI);
const SWEEP_R = RADIUS + 24;
/* One turn of the sweep, in seconds. The territory glows key off it. */
const SWEEP_S = 20;
const SWEEP_PATH = `M${CENTRE} ${CENTRE}L${(CENTRE + SWEEP_R * Math.cos(-0.55)).toFixed(1)} ${(CENTRE + SWEEP_R * Math.sin(-0.55)).toFixed(1)}` +
  `A${SWEEP_R} ${SWEEP_R} 0 0 1 ${CENTRE + SWEEP_R} ${CENTRE}Z`;

const SKINS = ["tactical", "chart"];

function useMapSkin() {
  const [skin, setSkin] = useState("tactical");
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

/* Whether full screen lays the map back like a table. On unless turned
   off, and remembered per browser. The map on the page stays flat: it is
   small, and a tilt there costs room and legibility for nothing. */
function useMapTilt() {
  const [tilted, setTilted] = useState(true);
  useEffect(() => {
    setTilted(readSetting(SETTINGS.mapTilt, ["on", "off"], "on") === "on");
  }, []);
  const choose = useCallback((next) => {
    setTilted(next);
    writeSetting(SETTINGS.mapTilt, next ? "on" : "off");
  }, []);
  return [tilted, choose];
}

/* Everything that moves stops for somebody who asked their system for
   less motion: the glides become cuts and the pulses hold still. */
function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(q.matches);
    read();
    q.addEventListener("change", read);
    return () => q.removeEventListener("change", read);
  }, []);
  return still;
}

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
  /* What takes the gestures: the map and, when tilted, the upright
     planets over it. */
  const surface = useRef(null);
  const [skin, setSkin] = useMapSkin();
  const tactical = skin === "tactical";
  const still = useStill();
  /* Ids inside an inline SVG are page wide, so every gradient here
     carries this map's own prefix. */
  const gid = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const [view, setView] = useState(HOME);
  const viewRef = useRef(view);
  viewRef.current = view;
  /* The sector you are in, or null for the whole galaxy. */
  const [focus, setFocus] = useState(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const [hover, setHover] = useState(null);
  const [hoverSector, setHoverSector] = useState(null);
  const [hoverAt, setHoverAt] = useState(null);
  /* The last planet chosen by clicking the map, so choosing it does not
     also fly the map to it. */
  const clicked = useRef(null);

  /* Full screen, and whether it is tilted. One map either way, so going
     full screen keeps the sector you are in and where you are looking. */
  const [expanded, setExpanded] = useState(false);
  const [tilted, setTilted] = useMapTilt();

  /* The box the map is drawn in: its square on the page, or the whole
     screen. Measured rather than assumed, because the map is 540 pixels
     wide on a desktop, 340 on a phone, and the screen in full screen, and
     a name has to be readable on all of them. */
  const stage = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded]);

  /* Where the map sits in that box and how it leans. */
  const fit = useMemo(
    () => stageFit(box.w, box.h, expanded ? { tilt: tilted, margin: FULL_MARGIN } : { fill: true }),
    [box, expanded, tilted]);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  /* Screen pixels per map unit at zoom 1. Full screen draws every mark a
     little bigger, and dividing it down here is all that takes. */
  const ppu = fit.S > 0 ? fit.S / VIEW / (expanded ? FULL_MARKS : 1) : 0.54;

  /* In full screen the drawing reaches past the map's own square to the
     edges of the screen, in view box units on every side, so a sector
     fills the screen instead of ending in a floating trapezoid. */
  const pad = expanded ? stageCover(fit, box.w, box.h) : 0;
  const padPx = (pad * fit.S) / VIEW;

  /* A point on screen, in the view box's own units, through the same
     projection that draws the map. The SVG's own screen matrix would do
     on a flat map and is wrong on a tilted one, since it flattens a
     perspective to a plain 2D matrix. */
  const toFrame = useCallback((clientX, clientY) => {
    const el = stage.current;
    if (!el) return { x: CENTRE, y: CENTRE };
    const r = el.getBoundingClientRect();
    return offStage(fitRef.current, clientX - r.left, clientY - r.top);
  }, []);

  /* ---------------------------------------------------------------- */
  /* The two views and the glide between them                          */
  /* ---------------------------------------------------------------- */

  const anim = useRef(null);
  /* A glide is not interrupted by the tail of the wheel spin that
     started it. Wheel events inside this window are swallowed. */
  const quietUntil = useRef(0);

  /* Where the wheel is taking the view, and the frame loop easing toward
     it. Each notch moves the target; the view follows, catching up in
     about a tenth of a second, so a spin reads as one zoom. */
  const target = useRef(null);
  const easing = useRef(null);

  const stop = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
    if (easing.current) cancelAnimationFrame(easing.current);
    easing.current = null;
    target.current = null;
  };

  const easeTo = useCallback((to) => {
    target.current = to;
    if (still) {
      setView(to);
      target.current = null;
      return;
    }
    if (easing.current) return;
    let last = performance.now();
    const step = (now) => {
      const cur = viewRef.current;
      const tgt = target.current;
      if (!tgt) {
        easing.current = null;
        return;
      }
      const share = 1 - Math.exp(-Math.min(64, now - last) / 85);
      last = now;
      const settled = Math.abs(Math.log(tgt.k / cur.k)) < 0.002 && Math.hypot(tgt.x - cur.x, tgt.y - cur.y) < 0.5;
      const next = settled ? tgt : towards(cur, tgt, share);
      viewRef.current = next;
      setView(next);
      if (settled) {
        easing.current = null;
        target.current = null;
      } else {
        easing.current = requestAnimationFrame(step);
      }
    };
    easing.current = requestAnimationFrame(step);
  }, [still]);

  const fly = useCallback((to) => {
    stop();
    if (still) {
      setView(to);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / GLIDE_MS);
      setView(t < 1 ? glide(from, to, t) : to);
      anim.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }, [still]);

  const enter = useCallback((sector) => {
    if (!sector || !sectorMembers.has(sector)) return;
    setFocus(sector);
    setHoverSector(null);
    quietUntil.current = performance.now() + 420;
    fly(sectorView(sector));
  }, [fly]);

  const leave = useCallback(() => {
    setFocus(null);
    setHover(null);
    quietUntil.current = performance.now() + 420;
    fly({ ...HOME });
  }, [fly]);

  useEffect(() => () => stop(), []);

  const focusK = focus ? sectorView(focus).k : 1;

  /* Full screen: the browser's own where it allows it, and a layer over
     the whole window either way, so it still works where the browser
     says no. Leaving the browser's full screen, which Escape does there
     whatever the page says, closes the layer with it. */
  const viaBrowser = useRef(false);
  const open = () => {
    setHover(null);
    setHoverSector(null);
    setExpanded(true);
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen().then(() => { viaBrowser.current = true; }).catch(() => {});
    }
  };
  const close = useCallback(() => {
    setHover(null);
    setHoverSector(null);
    setExpanded(false);
    if (viaBrowser.current && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    viaBrowser.current = false;
  }, []);
  useEffect(() => {
    if (!expanded) return undefined;
    const onChange = () => {
      if (document.fullscreenElement || !viaBrowser.current) return;
      viaBrowser.current = false;
      setHover(null);
      setHoverSector(null);
      setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    /* The page behind stays where it was while the map covers it. */
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      html.style.overflow = before;
    };
  }, [expanded]);
  /* Drop Bay folds the map away once a planet is chosen, full screen or
     not, so a map that goes away hands the screen back as it goes. */
  useEffect(() => () => {
    if (viaBrowser.current && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  /* Escape goes back to the galaxy, and from the galaxy out of full
     screen, unless you are typing somewhere. */
  useEffect(() => {
    if (!focus && !expanded) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (focusRef.current) leave();
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, expanded, leave, close]);

  /* ---------------------------------------------------------------- */
  /* Dragging, pinching and the click                                  */
  /*                                                                   */
  /* In the galaxy a click, a pinch or the wheel goes into the sector  */
  /* under it; there is nothing to drag, so a finger sliding up the    */
  /* map scrolls the page. In a sector one finger or the mouse drags,  */
  /* two fingers pinch, and a click on a planet chooses it. The planet */
  /* is read off the press, because the map captures the pointer.      */
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
      done: false,
    };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stop();
    const el = surface.current;
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

  const sectorOfPlanet = (name) => {
    const p = placeOf(name);
    return p && sectorMembers.has(p.sector) ? p.sector : null;
  };

  /* The sector under a point: the block it falls in, the way the game
     reads a click, so the shape you see is the shape you click. */
  const sectorAt = (at) => zoneAt(at.x, at.y);

  const onPointerMove = (e) => {
    const held = pointers.current.get(e.pointerId);
    if (!held) {
      if (e.pointerType !== "mouse") return;
      const hit = e.target && e.target.closest ? e.target.closest("[data-planet]") : null;
      const name = hit ? hit.getAttribute("data-planet") : null;
      if (focusRef.current) {
        setHover(name);
      } else {
        const frame = toFrame(e.clientX, e.clientY);
        setHoverSector((name && sectorOfPlanet(name)) || sectorAt(toMap(viewRef.current, frame)));
        setHoverAt(frame);
      }
      return;
    }
    const frame = toFrame(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, { ...frame, cx: e.clientX, cy: e.clientY });
    const g = gesture.current;
    if (!g || g.done) return;
    const inSector = Boolean(focusRef.current);

    if (pointers.current.size === 1) {
      const start = g.pts[0];
      if (!g.moved && Math.hypot(e.clientX - start.cx, e.clientY - start.cy) < 5) return;
      g.moved = true;
      if (!inSector) return;
      setDragging(true);
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
      if (!inSector) {
        if (d / d0 > 1.25) {
          g.done = true;
          const at = toMap(g.view, mid0);
          enter(sectorAt(at) || sectorNear(at, Infinity));
        }
        return;
      }
      const zoomed = zoomAt(g.view, mid0, d / d0);
      if (leavesSector(zoomed.k, sectorView(focusRef.current).k)) {
        g.done = true;
        leave();
        return;
      }
      setView(clampView({ k: zoomed.k, x: zoomed.x + (mid.x - mid0.x), y: zoomed.y + (mid.y - mid0.y) }));
    }
  };

  const release = (e, cancelled) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      if (!cancelled && g && !g.moved && !g.done) {
        const at = toMap(viewRef.current, g.pts[0]);
        if (!focusRef.current) {
          enter((g.planet && sectorOfPlanet(g.planet)) || sectorAt(at));
        } else if (g.planet) {
          if (!disabled) {
            clicked.current = g.planet;
            onChoose(g.planet);
          }
        } else {
          /* A click on another sector's blocks moves you there. */
          const s = sectorAt(at);
          if (s && s !== focusRef.current) enter(s);
        }
      }
      gesture.current = null;
      setDragging(false);
    } else {
      /* A finger lifted out of a pinch. What is left drags from here,
         and lifting it is not a click. */
      restart(true);
    }
  };

  /* The wheel: in the galaxy, scrolling in goes into the sector under
     the cursor and scrolling out is the page's. In a sector it zooms
     around the cursor, and zooming out far enough goes back out. */
  useEffect(() => {
    const el = surface.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (performance.now() < quietUntil.current) {
        e.preventDefault();
        return;
      }
      const v = viewRef.current;
      const f = focusRef.current;
      const frame = toFrame(e.clientX, e.clientY);
      if (!f) {
        if (e.deltaY >= 0) return;
        e.preventDefault();
        const at = toMap(v, frame);
        enter(sectorAt(at) || sectorNear(at, Infinity));
        return;
      }
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      /* Each notch builds on where the wheel is already heading, not on
         where the view has got to, so a fast spin goes as far as it should. */
      const from = target.current || v;
      if (factor > 1 && from.k >= MAX_ZOOM) return;
      e.preventDefault();
      if (anim.current) {
        cancelAnimationFrame(anim.current);
        anim.current = null;
      }
      const next = zoomAt(from, frame, factor);
      if (leavesSector(next.k, sectorView(f).k)) leave();
      else easeTo(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    /* Going full screen draws a new SVG, which needs its own listener. */
  }, [toFrame, enter, leave, easeTo, expanded]);

  const zoomBy = (factor) => {
    const from = target.current || viewRef.current;
    const next = zoomAt(from, { x: CENTRE, y: CENTRE }, factor);
    if (focus && leavesSector(next.k, focusK)) leave();
    else easeTo(next);
  };

  /* Chosen from the list, the planner or a search rather than the map:
     go into its sector, so the map and the list never disagree about
     where you are. A click on the map does not move it, because you are
     already looking at the place. Compared against the last value seen
     rather than a "has mounted" flag, so opening the map shows the whole
     galaxy even when React runs the effect twice, as it does in
     development. */
  const seen = useRef(chosen);
  useEffect(() => {
    if (seen.current === chosen) return;
    seen.current = chosen;
    if (!chosen || clicked.current === chosen) return;
    const s = sectorOfPlanet(chosen);
    if (s) enter(s);
  }, [chosen, enter]);

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
  const holders = useMemo(() => sectorHolders(war), [war]);

  /* Inside a sector only the planets in view, and a margin round it, are
     drawn as renders; the rest stay points of light. Loading all 271 at
     once cost 5 MB for the handful on screen. The area is rounded to a
     coarse step so a pan redraws the planets now and then rather than on
     every frame. */
  const reach = focus ? `${Math.round(view.x / 160)}:${Math.round(view.y / 160)}` : "";

  /* Redrawn when the zoom, the choice, the search or the war changes, and
     inside a sector when a pan moves the view a step. A pan otherwise only
     moves the group this sits in. */
  /* Who is named, and what every planet is doing, once per redraw. The
     ground and the planets are drawn from this separately, because on a
     tilted map they are drawn in two different places. */
  const plan = useMemo(() => {
    const inSector = Boolean(focus);
    const worlds = tactical && inSector;
    /* Mid glide the view is still far out, and judged by it every planet
       is in view, which loaded all 271 renders at the start of every glide
       in. Until the view is properly in, the sector being glided to is what
       counts as in view. */
    const judged = inSector && view.k < sectorView(focus).k * LEAVE_AT ? sectorView(focus) : view;
    const frameMap = { x0: -judged.x / judged.k, y0: -judged.y / judged.k, size: VIEW / judged.k };
    const inView = (p) => {
      const m = frameMap.size * 0.35 + pad / judged.k;
      return p.x > frameMap.x0 - m && p.x < frameMap.x0 + frameMap.size + m &&
        p.y > frameMap.y0 - m && p.y < frameMap.y0 + frameMap.size + m;
    };
    const scale = ppu * view.k;
    const hexOf = (w) => (w && w.front && fronts[w.front] ? fronts[w.front].hex : null);
    const pickAt = new Map(matches ? [] : picks.map((name, i) => [name, i]));
    const showSectors = !tactical && !inSector && scale < SECTOR_UNTIL;

    /* Which names are drawn. The chosen planet and what you searched for
       or were pointed to always; then, where the view has names at all,
       the fronts you can drop on, busiest first, then any planet with
       room. None of the last two is drawn over a name already placed. In
       the Tactical galaxy only the first two: the sector card names the
       rest when you hover, which is how the game does it. */
    const wanted = [];
    for (const p of placed) {
      const on = p.name === chosen;
      const lit = matches ? matches.has(p.name) : pickAt.has(p.name);
      const w = !matches && live ? live.get(p.name) : null;
      const front = Boolean(w && w.campaign);
      const roomy = !matches && roomFor.get(p.name) * scale >= NAME_ROOM;
      const size = front ? FRONT_WORLD_PX : WORLD_PX;
      const base = worlds
        ? { name: p.name, x: p.x, y: p.y, offset: size / 2 + 3, side: "below", charPx: 6.4, height: front ? 18 : 12 }
        : { name: p.name, x: p.x, y: p.y, offset: pickAt.has(p.name) ? DOT * 1.5 + 12 : (front ? DOT * 1.5 : DOT) + 5, side: labelSide(p) };
      const quietView = tactical && !inSector;
      if (on || (worlds && p.home)) wanted.push({ ...base, priority: 0, must: true });
      else if (lit && (namesMatches || !matches)) wanted.push({ ...base, priority: 1, must: true });
      else if (quietView) continue;
      else if (front) wanted.push({ ...base, priority: 2, weight: w.players });
      else if (roomy) wanted.push({ ...base, priority: 3, weight: roomFor.get(p.name) });
    }
    if (showSectors) {
      for (const s of sectors) {
        wanted.push({ key: "sector:" + s.name, name: s.name, x: s.x, y: s.y, side: "middle", priority: 4,
          weight: s.count, charPx: 6.6, height: 11 });
      }
    }
    const named = placeLabels(wanted, scale);

    const rows = placed.map((p) => {
      const on = p.name === chosen;
      const found = matches ? matches.has(p.name) : false;
      const unfit = !matches && fits && !fits.has(p.name) && !on && !p.home;
      const dim = (matches && !found && !on) || unfit;
      const w = live ? live.get(p.name) : null;
      const hex = hexOf(w);
      const front = Boolean(w && w.campaign);
      return {
        p, on, found, unfit, dim, w, hex, front,
        pulse: front && hex && !still ? (w.defence ? "1.5s" : "2.6s") : null,
        world: worlds && inView(p),
        /* Names read the war only when no search is running. */
        nameLit: matches ? found : pickAt.has(p.name),
        nameWar: !matches && live ? live.get(p.name) : null,
      };
    });
    return { inSector, worlds, showSectors, named, pickAt, rows, hexOf };
  }, [view.k, reach, ppu, chosen, matches, namesMatches, live, fronts, picks, fits, tactical, focus, pad, still]);

  const layer = useMemo(() => {
    const { inSector, showSectors, named } = plan;
    const halo = { paintOrder: "stroke", strokeLinejoin: "round" };

    /* Sectors as blocks, the game's way, and the curator's description of
       it, 30 September 2026: one big block per sector with only its outer
       edge drawn, a gentle glow of the holder's colour inside, and the
       hazard stripes very faint behind that, only once you are zoomed in.
       Every held sector is a block; one with a front you can drop on has
       a brighter edge, which is how the game shows where the war is. The
       sector under the cursor in the galaxy, or the one you are in, is lit
       on top in the brand colour.

       The chart keeps to its plain self: an edge round each sector with a
       front, in that front's colour, and nothing inside. */
    const blocks = live
      ? [...holders].filter(([, h]) => h.front || h.campaign).map(([sector, h]) => {
          const tone = h.front || h.against;
          return { sector, front: tone, campaign: h.campaign, hex: tone && fronts[tone] ? fronts[tone].hex : null };
        })
      : [];
    const lit = inSector ? focus : hoverSector;
    const region = (
      <g className="pointer-events-none">
        {blocks.map(({ sector, front, campaign, hex }) => {
          if (!tactical && !campaign) return null;
          const colour = hex ? { fill: hex, stroke: hex } : null;
          const plain = hex ? "" : "fill-base-300 stroke-base-300";
          return (
            <g key={sector}>
              {tactical ? (
                <>
                  <path d={sectorZones.get(sector)} className={plain} {...(colour ? { fill: colour.fill } : {})}
                    fillOpacity={campaign ? 0.1 : 0.06} stroke="none" />
                  {inSector && front ? (
                    <path d={sectorZones.get(sector)} fill={`url(#${gid}-stripes-${front})`} stroke="none" />
                  ) : null}
                  <path d={sectorOutlines.get(sector)} fill="none" className={plain} {...(colour ? { stroke: colour.stroke } : {})}
                    strokeOpacity={campaign ? 0.14 : 0.07} strokeWidth={7 * u} strokeLinecap="round" />
                </>
              ) : null}
              <path d={sectorOutlines.get(sector)} fill="none" className={plain} {...(colour ? { stroke: colour.stroke } : {})}
                strokeOpacity={campaign ? 0.85 : 0.35} strokeWidth={(campaign ? 1.3 : 0.9) * u} strokeLinecap="round" />
            </g>
          );
        })}
        {lit && sectorZones.has(lit) ? (
          <>
            <path d={sectorZones.get(lit)} className={tactical ? "fill-brand" : "fill-base-100"}
              fillOpacity={inSector ? 0.02 : 0.08} stroke="none" />
            <path d={sectorOutlines.get(lit)} fill="none" className={tactical ? "stroke-brand" : "stroke-base-100"}
              strokeOpacity={inSector ? 0.4 : 0.9} strokeWidth={1.5 * u} strokeLinecap="round" />
          </>
        ) : null}
      </g>
    );

    /* ------------------------------------------------------------ */
    /* Tactical                                                      */
    /* ------------------------------------------------------------ */
    if (tactical) {
      return (
        <>
          <defs>
            <radialGradient id={`${gid}-disc`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{ stopColor: "rgb(var(--base-900))" }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--base-950))" }} />
            </radialGradient>
            {Object.entries(fronts).map(([id, f]) => (
              <radialGradient key={id} id={`${gid}-glow-${id}`}>
                <stop offset="0%" stopColor={f.hex} stopOpacity="0.42" />
                <stop offset="55%" stopColor={f.hex} stopOpacity="0.13" />
                <stop offset="100%" stopColor={f.hex} stopOpacity="0" />
              </radialGradient>
            ))}
            {Object.entries(fronts).map(([id, f]) => (
              <pattern key={id} id={`${gid}-stripes-${id}`} width="12" height="12" patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="3" height="12" fill={f.hex} opacity="0.1" />
              </pattern>
            ))}
            <radialGradient id={`${gid}-home`}>
              <stop offset="0%" style={{ stopColor: "rgb(var(--brand))", stopOpacity: 0.6 }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--brand))", stopOpacity: 0 }} />
            </radialGradient>
            <clipPath id={`${gid}-clip`}>
              <circle cx={CENTRE} cy={CENTRE} r={SWEEP_R} />
            </clipPath>
          </defs>

          {/* The ground: the theme's own darks, three faint rings and a
              ticked rim. */}
          <circle cx={CENTRE} cy={CENTRE} r={SWEEP_R} fill={`url(#${gid}-disc)`} className="stroke-base-700"
            strokeOpacity={0.7} strokeWidth={u} />
          {[0.25, 0.5, 0.75].map((f) => (
            <circle key={f} cx={CENTRE} cy={CENTRE} r={RADIUS * f} fill="none" className="stroke-base-700"
              strokeOpacity={0.45} strokeWidth={0.8 * u} strokeDasharray={`${2 * u} ${7 * u}`} />
          ))}
          {TICKS.map((a, i) => (
            <line key={i} className="stroke-base-600" strokeOpacity={0.55} strokeWidth={0.8 * u}
              x1={CENTRE + (SWEEP_R - (i % 6 === 0 ? 8 : 4) * u) * Math.cos(a)}
              y1={CENTRE + (SWEEP_R - (i % 6 === 0 ? 8 : 4) * u) * Math.sin(a)}
              x2={CENTRE + SWEEP_R * Math.cos(a)} y2={CENTRE + SWEEP_R * Math.sin(a)} />
          ))}

          {/* A slow sweep, the only thing that moves when nothing else
              does. Off for reduced motion. */}
          {still ? null : (
            <g clipPath={`url(#${gid}-clip)`} className="pointer-events-none">
              <g>
                <path d={SWEEP_PATH} className="fill-brand" fillOpacity={0.045} />
                <line x1={CENTRE} y1={CENTRE} x2={CENTRE + SWEEP_R} y2={CENTRE} className="stroke-brand"
                  strokeOpacity={0.28} strokeWidth={u} />
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${CENTRE} ${CENTRE}`} to={`360 ${CENTRE} ${CENTRE}`} dur={`${SWEEP_S}s`} repeatCount="indefinite" />
              </g>
            </g>
          )}

          <path d={LANE_PATH} fill="none" className="stroke-base-600" strokeOpacity={matches ? 0.12 : 0.32}
            strokeWidth={0.8 * u} />

          {/* Territory: a soft field of the holder's colour round every
              held planet, stronger round a front. Overlapping fields
              become the front line.

              The sweep lights them as it passes, the curator's idea: each
              field rests at 70% and comes up to full, which is where it
              stood before this existed, the moment the sweep's edge
              reaches its angle, then fades back over the turn. The sweep
              and the fields run on the one animation clock the SVG keeps,
              so the timing is exact rather than guessed. */}
          {live ? (
            <g className="pointer-events-none" opacity={matches ? 0.35 : 1}>
              {placed.map((p) => {
                const w = live.get(p.name);
                if (!w || !w.front) return null;
                let angle = Math.atan2(p.y - CENTRE, p.x - CENTRE);
                if (angle < 0) angle += 2 * Math.PI;
                return (
                  <circle key={p.name} cx={p.x} cy={p.y} r={w.campaign ? 62 : 44} fill={`url(#${gid}-glow-${w.front})`}
                    opacity={still ? 1 : 0.7}>
                    {still ? null : (
                      <animate attributeName="opacity" values="1;0.7" keyTimes="0;1" calcMode="spline"
                        keySplines="0.2 0.5 0.5 1" dur={`${SWEEP_S}s`}
                        begin={`${((angle / (2 * Math.PI)) * SWEEP_S).toFixed(2)}s`} repeatCount="indefinite" />
                    )}
                  </circle>
                );
              })}
            </g>
          ) : null}

          {region}

          {/* Each front's name round the rim, where its territory is. */}
          {inSector ? null : frontArcs(holders).map(({ front, angle }) => {
            const f = fronts[front];
            if (!f) return null;
            const id = `${gid}-arc-${front}`;
            return (
              <g key={front} className="pointer-events-none">
                <path id={id} d={arcPath(angle, RADIUS + 8, 0.9)} fill="none" />
                <text fill={f.hex} fillOpacity={0.75} dominantBaseline="middle"
                  style={{ fontFamily: OSWALD, fontSize: 10.5 * u, letterSpacing: 5 * u, fontWeight: 600, textTransform: "uppercase" }}>
                  <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{f.label}</textPath>
                </text>
              </g>
            );
          })}

        </>
      );
    }

    /* ------------------------------------------------------------ */
    /* Chart                                                         */
    /* ------------------------------------------------------------ */
    return (
      <>
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS + 24} className="fill-base-900/60 stroke-base-800"
          strokeWidth={u} />
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS * 0.5} className="fill-none stroke-base-800/60"
          strokeWidth={u} strokeDasharray={`${3 * u} ${5 * u}`} />
        <path d={LANE_PATH} className="fill-none stroke-base-700" strokeWidth={u} opacity={matches ? 0.35 : 0.8} />
        {region}

        {showSectors
          ? sectors.filter((s) => named.has("sector:" + s.name)).map((s) => (
              <text key={s.name} x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-none fill-base-500 stroke-base-950" strokeWidth={3 * u}
                style={{ ...halo, fontFamily: OSWALD, fontSize: SECTOR_PX * u, letterSpacing: 1.2 * u,
                  textTransform: "uppercase", opacity: matches ? 0.35 : 0.75 }}>
                {s.name}
              </text>
            ))
          : null}

      </>
    );
  }, [plan, u, live, fronts, tactical, gid, focus, hoverSector, holders, still, matches]);

  /* ---------------------------------------------------------------- */
  /* The planets, drawn round their own centre                         */
  /*                                                                   */
  /* In units of `uu` screen pixels, round the origin, so the same      */
  /* drawing goes on the map (translated to the planet, uu being map    */
  /* units per pixel) or upright over a tilted map (translated to where */
  /* the tilt puts the planet, uu being 1). The curator's point, 1      */
  /* October 2026: tilted with the ground, the renders squashed into    */
  /* ovals and the names leaned like italics. A planet stands on the    */
  /* table; it is not painted on it.                                    */
  /* ---------------------------------------------------------------- */

  const halo = { paintOrder: "stroke", strokeLinejoin: "round" };
  const hit = (name, r) => (
    <circle r={r} fill="transparent" data-planet={name} className={"pointer-events-auto " + (disabled ? "" : "cursor-pointer")} />
  );

  const drawMark = (row, uu) => {
    const { p, on, found, unfit, dim, hex, front, pulse } = row;
    const hovering = focus && hover === p.name && !on;
    const hoverRing = hovering ? (
      <circle r={(tactical ? FRONT_WORLD_PX * 0.6 : DOT + 4) * uu} className="pointer-events-none fill-none stroke-base-100" strokeWidth={1.2 * uu} />
    ) : null;

    if (!tactical) {
      /* The chart: a planet somebody holds takes their colour, a front you
         can drop on is larger and ringed, and a quiet planet Super Earth
         holds steps back so the war reads first. */
      const r = (p.home ? HOME_DOT : front ? DOT * 1.5 : DOT) * uu;
      const painted = hex && !on && !found;
      const fill = on || found ? "fill-brand"
        : p.home ? "fill-base-100"
        : painted ? ""
        : dim ? "fill-base-700"
        : live ? "fill-base-600"
        : "fill-base-400";
      return (
        <g opacity={matches && dim ? 0.3 : unfit ? 0.4 : 1}>
          {on ? (
            <circle r={r + 5 * uu} className="fill-none stroke-brand" strokeWidth={1.6 * uu} />
          ) : front && hex ? (
            <circle r={r + 3.5 * uu} fill="none" stroke={hex} strokeWidth={1.3 * uu} />
          ) : null}
          <circle r={r} className={fill} style={painted ? { fill: hex, fillOpacity: front ? 1 : 0.55 } : undefined} />
          {hoverRing}
          {hit(p.name, HIT * uu)}
        </g>
      );
    }

    if (row.world) {
      /* In a sector: the planet itself, as the game renders it. */
      const size = (front ? FRONT_WORLD_PX : WORLD_PX) * uu;
      const art = planetArt(p.name);
      return (
        <g opacity={matches && dim ? 0.3 : unfit ? 0.45 : 1}>
          {p.home ? <circle r={size * 1.1} fill={`url(#${gid}-home)`} /> : null}
          {hex ? <circle r={size * 0.62} fill="none" stroke={hex} strokeOpacity={0.55} strokeWidth={1.2 * uu} /> : null}
          {front && hex ? (
            <g>
              <circle r={size * 0.78} fill="none" stroke={hex} strokeOpacity={0.85} strokeWidth={1.3 * uu}
                strokeDasharray={`${5 * uu} ${4 * uu}`} />
              {still ? null : (
                <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="14s" repeatCount="indefinite" />
              )}
            </g>
          ) : null}
          {pulse ? (
            <circle r={size * 0.5} fill="none" stroke={hex} strokeWidth={1.2 * uu}>
              <animate attributeName="r" values={`${size * 0.5};${size * 1.25}`} dur={pulse} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur={pulse} repeatCount="indefinite" />
            </circle>
          ) : null}
          {art ? (
            <image href={art} x={-size / 2} y={-size / 2} width={size} height={size} opacity={hex || p.home ? 1 : 0.8} />
          ) : (
            <circle r={size * 0.3} fill={hex || undefined} className={hex ? "" : "fill-base-400"} />
          )}
          {on ? <circle r={size * 0.88} className="fill-none stroke-brand" strokeWidth={1.8 * uu} /> : null}
          {hoverRing}
          {hit(p.name, Math.max(HIT * uu, size * 0.55))}
        </g>
      );
    }

    /* In the galaxy: a point of light. */
    if (p.home) {
      return (
        <g>
          <circle r={16 * uu} fill={`url(#${gid}-home)`} />
          <circle r={3.6 * uu} className="fill-base-50" />
          {hit(p.name, HIT * uu)}
        </g>
      );
    }
    const r = (front ? 3 : hex ? 2.3 : 1.7) * uu;
    return (
      <g opacity={matches && dim ? 0.3 : unfit ? 0.4 : 1}>
        {pulse ? (
          <circle r={r} fill="none" stroke={hex} strokeWidth={1.2 * uu}>
            <animate attributeName="r" values={`${3 * uu};${13 * uu}`} dur={pulse} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.75;0" dur={pulse} repeatCount="indefinite" />
          </circle>
        ) : null}
        {on ? <circle r={r + 5 * uu} className="fill-none stroke-brand" strokeWidth={1.6 * uu} /> : null}
        <circle r={r}
          className={front ? "fill-base-50" : hex ? "" : found ? "fill-brand" : "fill-base-500"}
          fill={!front && hex ? hex : undefined}
          stroke={front ? hex : undefined} strokeWidth={front ? 1.4 * uu : undefined}
          opacity={front || hex || found ? 1 : 0.75} />
        {hoverRing}
        {hit(p.name, HIT * uu)}
      </g>
    );
  };

  /* The planner's picks, numbered in its order: a ring in the brand colour
     and the number beside it, drawn over the planets so a pick is never
     hidden under a neighbour. */
  const drawPick = (i, uu) => {
    const ring = (plan.worlds ? FRONT_WORLD_PX * 0.62 : DOT * 1.5 + 8) * uu;
    const off = ring * 0.72;
    return (
      <g className="pointer-events-none">
        <circle r={ring} className="fill-none stroke-brand" strokeWidth={1.8 * uu} strokeDasharray={`${4 * uu} ${2.5 * uu}`} />
        <circle cx={-off} cy={-off} r={6.5 * uu} className="fill-brand" />
        <text x={-off} y={-off} textAnchor="middle" dominantBaseline="central"
          className="fill-brand-ink" style={{ fontFamily: OSWALD, fontSize: 9 * uu, fontWeight: 700 }}>
          {i + 1}
        </text>
      </g>
    );
  };

  const drawName = (row, uu) => {
    const { p, on, nameLit, nameWar } = row;
    const hex = plan.hexOf(nameWar);
    const front = Boolean(nameWar && nameWar.campaign);
    const pick = plan.pickAt.has(p.name);
    if (tactical && row.world) {
      const gap = (front ? FRONT_WORLD_PX : WORLD_PX) / 2 + 3;
      const done = nameWar ? (nameWar.defence ? nameWar.defence.progress : nameWar.liberation) : null;
      const barW = 32 * uu;
      const barY = (gap + 15) * uu;
      return (
        <g className="pointer-events-none">
          <text y={gap * uu} textAnchor="middle" dominantBaseline="hanging"
            className={"stroke-base-950 " + (on || nameLit ? "fill-brand" : hex ? "" : "fill-base-200")}
            fill={on || nameLit || !hex ? undefined : hex} strokeWidth={3 * uu}
            style={{ ...halo, fontFamily: OSWALD, fontSize: 10.5 * uu, letterSpacing: 0.9 * uu, textTransform: "uppercase" }}>
            {p.name}
          </text>
          {front && done !== null ? (
            <g>
              <rect x={-barW / 2} y={barY} width={barW} height={2.5 * uu} rx={1.2 * uu} fill={hex || "#94a3b8"} opacity={0.35} />
              <rect x={-barW / 2} y={barY} width={barW * done} height={2.5 * uu} rx={1.2 * uu} fill="#60a5fa" />
            </g>
          ) : null}
        </g>
      );
    }
    /* Clear of the pick's ring when it has one. */
    const gap = pick ? DOT * 1.5 + 12 : (front ? DOT * 1.5 : DOT) + 5;
    const left = labelSide(p) === "left";
    return (
      <text x={left ? -gap * uu : gap * uu} dominantBaseline="middle" textAnchor={left ? "end" : "start"}
        className={"pointer-events-none stroke-base-950 " + (on || nameLit ? "fill-brand"
          : tactical ? "fill-base-100" : front ? "fill-base-100" : "fill-base-300")}
        strokeWidth={3 * uu}
        style={{ ...halo, fontFamily: OSWALD, fontSize: NAME_PX * uu, letterSpacing: 0.3 * uu }}>
        {p.name}
      </text>
    );
  };

  /* Marks, then picks over them, then names over everything. `place`
     says where a planet goes, as an SVG transform, or null to skip it. */
  const drawPlanets = (place, uu) => {
    const marks = [];
    const pickEls = [];
    const names = [];
    for (const row of plan.rows) {
      const t = place(row.p);
      if (!t) continue;
      marks.push(<g key={row.p.name} transform={t}>{drawMark(row, uu)}</g>);
      const pi = plan.pickAt.get(row.p.name);
      if (pi !== undefined) pickEls.push(<g key={"pick-" + row.p.name} transform={t}>{drawPick(pi, uu)}</g>);
      if (plan.named.has(row.p.name)) names.push(<g key={"name-" + row.p.name} transform={t}>{drawName(row, uu)}</g>);
    }
    return <>{marks}{pickEls}{names}</>;
  };

  /* Upright over the tilt in full screen, on the map otherwise. */
  const upright = expanded && fit.a > 0;
  const flatPlanets = useMemo(
    () => (upright ? null : drawPlanets((q) => `translate(${q.x} ${q.y})`, u)),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [upright, plan, u, hover, focus, gid, still, disabled, tactical, matches, live]
  );
  const uprightPlanets = upright
    ? drawPlanets((q) => {
        const fx = q.x * view.k + view.x;
        const fy = q.y * view.k + view.y;
        const at = onStage(fit, fx, fy);
        if (at.x < -90 || at.y < -90 || at.x > box.w + 90 || at.y > box.h + 90) return null;
        const k = FULL_MARKS * stageDepth(fit, fx, fy);
        return `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${k.toFixed(3)})`;
      }, 1)
    : null;

  /* The cards. In the galaxy the sector under the cursor, the way the game
     names a sector on hover; in a sector the planet under it. */
  const hovered = focus && hover ? placeOf(hover) : null;
  const detail = hovered ? planetByName.get(hover) : null;
  const fight = detail && live ? warLine(live.get(detail.name), fronts) : null;
  const hoverWar = detail && live ? live.get(detail.name) : null;
  const done = hoverWar && hoverWar.campaign
    ? (hoverWar.defence ? hoverWar.defence.progress : hoverWar.liberation)
    : null;
  const art = detail ? planetArt(detail.name) : null;

  /* A card sits beside the point it is about, through the tilt, kept clear
     of the sides, and below the point when that is near the top. */
  const edge = Math.min(150, box.w * 0.25);
  const cardAt = (fx, fy) => {
    const p = onStage(fit, fx, fy);
    return { left: Math.min(Math.max(p.x, edge), Math.max(edge, box.w - edge)), top: p.y, below: p.y < box.h * 0.3 };
  };
  const at = hovered ? cardAt(hovered.x * view.k + view.x, hovered.y * view.k + view.y) : null;

  const sectorCard = !focus && hoverSector && hoverAt ? (() => {
    const h = holders.get(hoverSector);
    const f = h && h.front ? fronts[h.front] : null;
    const members = sectorMembers.get(hoverSector) || [];
    const openNow = live
      ? members.map((p) => ({ p, w: live.get(p.name) })).filter((x) => x.w && x.w.campaign)
        .sort((a, b) => b.w.players - a.w.players)
      : [];
    return { f, members, openNow, ...cardAt(hoverAt.x, hoverAt.y) };
  })() : null;

  const focusHolder = focus ? holders.get(focus) : null;
  const focusFront = focusHolder && focusHolder.front ? fronts[focusHolder.front] : null;
  const chosenPlace = chosen ? planetByName.get(chosen) : null;

  /* Tailwind needs whole class names, so the corners are spelled out. */
  const corner = expanded
    ? { tl: "left-4 top-4", tr: "right-4 top-4", br: "bottom-4 right-4", bl: "bottom-4 left-4" }
    : { tl: "left-2 top-2", tr: "right-2 top-2", br: "bottom-2 right-2", bl: "bottom-2 left-2" };

  const map = (
    <div ref={stage}
      className={expanded ? "absolute inset-0" : "relative mx-auto aspect-square w-full max-w-[34rem] select-none"}>
      {/* The surface takes every gesture, for the map and for the upright
          planets over it alike. The buttons in the corners are its
          siblings, so pressing one is never mistaken for a drag. */}
      <div ref={surface}
        className={"absolute inset-0 " + (focus ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer")}
        style={{
          /* In the galaxy on the page there is nothing to pan, so a finger
             sliding up the map scrolls the page past it. In a sector, and in
             full screen, the map takes every gesture. */
          touchAction: focus || expanded ? "none" : "pan-y",
        }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, false)} onPointerCancel={(e) => release(e, true)}
        onPointerLeave={() => {
          setHover(null);
          setHoverSector(null);
        }}
        onDoubleClick={(e) => {
          if (focus) zoomBy(2);
          else enter(sectorAt(toMap(viewRef.current, toFrame(e.clientX, e.clientY))));
        }}>
        <svg ref={svg} viewBox={`${-pad} ${-pad} ${VIEW + 2 * pad} ${VIEW + 2 * pad}`} role="img"
          aria-label={label || "The galaxy map. Click a sector to go in, then a planet to drop there, or search for it by name or sector."}
          className={fit.S > 0 ? "absolute block" : "block h-full w-full"}
          style={{
            ...(fit.S > 0 ? { left: fit.left - padPx, top: fit.top - padPx, width: fit.S + 2 * padPx, height: fit.S + 2 * padPx } : {}),
            transform: stageTransform(fit),
            transformOrigin: "50% 50%",
          }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {layer}
            {flatPlanets}
          </g>
        </svg>
        {upright ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${box.w || 1} ${box.h || 1}`} aria-hidden="true">
            {uprightPlanets}
          </svg>
        ) : null}
      </div>

      {/* A planet, before you commit to it. Mouse only: on a touch screen
          there is no hover, and the tap is the choice. */}
      {detail && at ? (
        <div className={"pointer-events-none absolute z-10 flex w-max gap-2.5 overflow-hidden rounded-md border border-base-700 bg-base-950/90 py-2 pl-3 pr-3 text-left shadow-xl backdrop-blur-sm " +
          (expanded ? "max-w-[20rem]" : "max-w-[17rem]")}
          style={{
            left: at.left,
            top: at.top,
            transform: at.below ? "translate(-50%, 26px)" : "translate(-50%, calc(-100% - 26px))",
            boxShadow: fight && fight.hex ? `inset 3px 0 0 ${fight.hex}, 0 10px 30px rgb(0 0 0 / 0.35)` : undefined,
          }}>
          {art ? <img src={art} alt="" className={(expanded ? "h-20 w-20" : "h-12 w-12") + " shrink-0 self-center"} /> : null}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-base-100" style={{ fontFamily: OSWALD }}>{detail.name}</p>
            <p className="text-[10px] text-base-500">
              {[detail.sector ? detail.sector + " sector" : null, detail.biome ? biomeName(detail.biome) : null]
                .filter(Boolean).join(" · ")}
            </p>
            {loudHazards(detail.hazards).length ? (
              <p className="mt-0.5 text-[10px] text-accent-300">{loudHazards(detail.hazards).map(hazardName).join(" · ")}</p>
            ) : (
              <p className="mt-0.5 text-[10px] text-base-500">Nothing permanent here changes what you bring</p>
            )}
            {done !== null ? (
              <div className="mt-1.5">
                <div className="h-1 w-36 overflow-hidden rounded-full"
                  style={{ backgroundColor: ((fight && fight.hex) || "#94a3b8") + "59" }}>
                  <div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${Math.round(done * 100)}%` }} />
                </div>
              </div>
            ) : null}
            {fight ? (
              <p className={"mt-1 text-[10px] leading-snug " + (fight.hex ? "" : "text-base-400")}
                style={fight.hex ? { color: fight.hex } : undefined}>
                {fight.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* A sector, from the galaxy: who holds it and what is open in it. */}
      {sectorCard ? (
        <div className="pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-md border border-base-700 bg-base-950/90 px-3 py-2 text-left shadow-xl backdrop-blur-sm"
          style={{
            left: sectorCard.left,
            top: sectorCard.top,
            transform: sectorCard.below ? "translate(-50%, 22px)" : "translate(-50%, calc(-100% - 22px))",
            boxShadow: sectorCard.f ? `inset 3px 0 0 ${sectorCard.f.hex}, 0 10px 30px rgb(0 0 0 / 0.35)` : undefined,
          }}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-100" style={{ fontFamily: OSWALD }}>
            {hoverSector} sector
          </p>
          <p className="text-[10px]" style={sectorCard.f ? { color: sectorCard.f.hex } : undefined}>
            {sectorCard.f ? `${sectorCard.f.label} control` : live ? <span className="text-base-500">Super Earth holds it</span> : null}
            <span className="text-base-500">
              {sectorCard.f || live ? " · " : ""}{sectorCard.members.length} planet{sectorCard.members.length === 1 ? "" : "s"}
            </span>
          </p>
          {sectorCard.openNow.length ? (
            <p className="mt-1 text-[10px] leading-snug text-base-300">
              {sectorCard.openNow.slice(0, 4).map((x) => x.p.name).join(", ")}
              {sectorCard.openNow.length > 4 ? ` and ${sectorCard.openNow.length - 4} more` : ""}
              <span className="text-base-500"> {sectorCard.openNow.length === 1 ? "is" : "are"} open to drop on.</span>
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-base-500">Click to go in</p>
        </div>
      ) : null}

      {/* The look, and in full screen the tilt. The Tactical map for
          choosing, the chart for reading; same map, same clicks, both
          remembered per browser. The Major Order sits under them in full
          screen, where a wide screen has room beside the map for it. */}
      <div className={"absolute flex flex-col items-start gap-3 " + corner.tl}>
        <div className="flex gap-1.5">
          <div className="flex overflow-hidden rounded border border-base-700 bg-base-900/90 text-[10px]"
            role="group" aria-label="How the map looks">
        {[["tactical", "Tactical"], ["chart", "Chart"]].map(([id, name]) => (
          <button key={id} type="button" onClick={() => setSkin(id)} aria-pressed={skin === id}
            className={"px-2 py-1 uppercase tracking-wider transition-colors " +
              (skin === id ? "bg-base-200 text-base-900" : "text-base-400 hover:text-base-100")}
            style={{ fontFamily: OSWALD }}>
            {name}
          </button>
        ))}
          </div>
          {expanded ? (
            <button type="button" onClick={() => setTilted(!tilted)} aria-pressed={tilted}
              title={tilted ? "Lay the map flat" : "Tilt the map back like a table"}
              className={"rounded border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors " +
                (tilted ? "border-base-200 bg-base-200 text-base-900" : "border-base-700 bg-base-900/90 text-base-400 hover:text-base-100")}
              style={{ fontFamily: OSWALD }}>
              Tilt
            </button>
          ) : null}
        </div>
        {expanded && war && war.order ? (
          <div className="hidden w-72 rounded bg-base-950/70 backdrop-blur-sm xl:block">
            <MajorOrder order={war.order} fronts={fronts} />
          </div>
        ) : null}
      </div>

      {/* Where you are, the way back out, and full screen. */}
      <div className={"absolute flex items-center gap-1 " + corner.tr}>
        {focus ? (
          <button type="button" onClick={leave}
            className="flex items-center gap-1 rounded border border-base-700 bg-base-900/90 py-1 pl-1 pr-2 text-[10px] uppercase tracking-wider text-base-300 hover:border-base-500 hover:text-base-100"
            style={{ fontFamily: OSWALD }} title="Back to the whole galaxy (Esc)">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-base-500">Galaxy</span>
            <span className="text-base-600">/</span>
            <span style={focusFront ? { color: focusFront.hex } : undefined}>{focus}</span>
          </button>
        ) : null}
        <MapButton label={expanded ? "Leave full screen (Esc)" : "Full screen"} onClick={expanded ? close : open}>
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </MapButton>
      </div>

      {focus ? (
        <div className={"absolute flex flex-col gap-1 " + corner.br}>
          <MapButton label="Zoom in" onClick={() => zoomBy(1.5)} disabled={view.k >= MAX_ZOOM}><Plus className="h-3.5 w-3.5" /></MapButton>
          <MapButton label="Zoom out, and back to the galaxy past a point" onClick={() => zoomBy(1 / 1.5)}><Minus className="h-3.5 w-3.5" /></MapButton>
        </div>
      ) : null}

      {/* Full screen hides the page, so what you have chosen and how fresh
          the war is come with it. */}
      {expanded ? (
        <div className={"pointer-events-none absolute max-w-[20rem] text-left " + corner.bl}>
          {chosenPlace ? (
            <p className="text-xs">
              <span className="text-base-500">Dropping on </span>
              <span className="font-semibold uppercase tracking-wider text-base-100" style={{ fontFamily: OSWALD }}>{chosenPlace.name}</span>
              {chosenPlace.sector ? <span className="text-base-500">, {chosenPlace.sector} sector</span> : null}
            </p>
          ) : (
            <p className="text-xs text-base-500">Click a sector to go in, then a planet to drop there.</p>
          )}
          {war ? (
            <p className="mt-0.5 text-[10px] text-base-600">
              {war.fresh ? `The war is live, read ${agoText(war.age)}.` : `The war was last read ${agoText(war.age)}, too long ago to colour the map.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!expanded) return map;
  return (
    <>
      {/* The map's place on the page, held while it is away. */}
      <div className="relative mx-auto flex aspect-square w-full max-w-[34rem] flex-col items-center justify-center gap-2 rounded border border-dashed border-base-800 text-center">
        <p className="text-xs text-base-500">The map is open full screen.</p>
        <button type="button" onClick={close}
          className="rounded border border-base-700 px-2.5 py-1 text-[11px] text-base-300 hover:border-base-500 hover:text-base-100">
          Bring it back here
        </button>
      </div>
      {createPortal(
        <div className="fixed inset-0 z-[90] select-none overflow-hidden" role="dialog" aria-modal="true"
          aria-label="The galaxy map, full screen"
          style={{ background: "radial-gradient(ellipse at 50% 42%, rgb(var(--base-900)) 0%, rgb(var(--base-950)) 72%)" }}>
          {map}
        </div>,
        document.body,
      )}
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
