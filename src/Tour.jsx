/* ================================================================== */
/* THE TOUR, DRAWN                                                    */
/*                                                                    */
/* One thing lit, everything else dimmed, and a card beside it. The    */
/* steps and the reasoning about them are in src/lib/tour.js.          */
/*                                                                    */
/* The cutout is a box-shadow, Enodia's trick: a box the size of the   */
/* target with `0 0 0 9999px` of dim around it. No mask, and moving    */
/* the box between steps makes the light travel.                       */
/*                                                                    */
/* A step that changes page goes there first, then waits for its       */
/* anchor to turn up, because pages render after the hash changes and */
/* the war room's panels after the map has measured itself. An anchor  */
/* is the first *visible* element carrying its data-tour value: the    */
/* party button is in the DOM twice, one copy for each width, and the  */
/* hidden one measures zero.                                           */
/*                                                                    */
/* Below the lg breakpoint the menu is a drawer, so a step about the   */
/* menu opens it first and every other step closes it again.          */
/* ================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { BORROWED_FRONT, TOUR } from "./lib/tour.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };
/* Room round the lit element, so the ring is not on its edge. */
const HALO = 8;
const GAP = 18;
const PAD = 14;
/* The card's width on a wide screen, as w-[400px] below. */
const CARD_W = 400;

/* `at` may name several anchors, best first. The first one that leaves */
/* room for the card, beside it or above or below, is lit: on a phone  */
/* the Collection guide is taller than the screen, and lighting all of */
/* it means standing on it.                                            */
function find(at) {
  if (!at) return null;
  let seen = null;
  for (const name of [].concat(at)) {
    for (const el of document.querySelectorAll(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const beside = window.innerWidth - r.width >= CARD_W + GAP + PAD * 2;
      if (beside || r.height <= window.innerHeight * 0.6) return el;
      seen = seen || el;
    }
  }
  return seen;
}

const inMenu = (at) => [].concat(at || []).some((a) => a.startsWith("nav"));

function rectOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/**
 * `front` and `setFront` are the scenario's. `canBorrow` is false in a
 * party, where the host's front would reach everybody.
 */
export default function Tour({ navigate, onClose, setMenu, front, setFront, canBorrow }) {
  const [index, setIndex] = useState(0);
  /* Which way you were going, so a skipped step skips the same way. */
  const way = useRef(1);
  const [spot, setSpot] = useState(null);
  const [ready, setReady] = useState(false);
  const card = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 240 });
  const sizeNow = useRef(size);
  sizeNow.current = size;
  const step = TOUR[index];
  /* Whether the tour lent you a front, so it can say so and take it back. */
  const [borrowed, setBorrowed] = useState(false);
  const lent = useRef(false);
  const last = index === TOUR.length - 1;

  const go = useCallback((to) => {
    if (to < 0) return;
    if (to >= TOUR.length) return onClose();
    way.current = to >= index ? 1 : -1;
    setIndex(to);
  }, [index, onClose]);

  /* Go where the step is, wait for its anchor, bring it into view, then */
  /* measure it once the scroll has settled. A rect read mid-scroll is   */
  /* where the element used to be, and the light lands on empty floor.   */
  useEffect(() => {
    let alive = true;
    const timers = [];
    const later = (fn, ms) => timers.push(window.setTimeout(() => alive && fn(), ms));
    setReady(false);
    /* A new page: the light would sit over whatever is there now until */
    /* the anchor turns up, so it goes dark in between.                */
    if (step.route && window.location.hash.replace(/^#\/?/, "") !== step.route) setSpot(null);
    if (step.front && !front && canBorrow && !lent.current) {
      lent.current = true;
      setBorrowed(true);
      setFront(BORROWED_FRONT.id);
    }
    if (step.route) navigate(step.route, { replace: true });
    /* Not when the same thing is also outside the menu and on screen: */
    /* your skill level is in the drawer only on a phone.              */
    const outside = [].concat(step.at || []).filter((a) => !a.startsWith("nav"));
    setMenu(inMenu(step.at) && !window.matchMedia("(min-width: 1024px)").matches && !find(outside));

    if (!step.at) {
      setSpot(null);
      later(() => setReady(true), step.route ? 120 : 0);
      return () => { alive = false; timers.forEach(clearTimeout); };
    }

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tries = 0;
    const look = () => {
      const el = find(step.at);
      if (el) {
        /* Centred, unless that leaves no room for the card above or below */
        /* it, as on a small or sideways phone: then it goes to the top,   */
        /* clear of the sticky chrome, and the card sits underneath.       */
        const tight = (window.innerHeight - el.getBoundingClientRect().height) / 2 < sizeNow.current.h + GAP + HALO;
        if (tight) {
          const chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shell-chrome")) || 0;
          el.style.scrollMarginTop = `${chrome + 8 + HALO + PAD}px`;
        }
        el.scrollIntoView({ block: tight ? "start" : "center", inline: "nearest", behavior: still ? "auto" : "smooth" });
        later(() => { el.style.scrollMarginTop = ""; setSpot(rectOf(find(step.at))); setReady(true); }, still ? 30 : 360);
        return;
      }
      if (++tries < 20) return later(look, 80);
      /* Never turned up. An optional step is about something this     */
      /* browser does not have yet, so it is skipped the way you were   */
      /* going; any other is said from the middle of the screen.        */
      if (step.optional) {
        const next = index + way.current;
        if (next >= TOUR.length) onClose();
        else if (next < 0) setIndex(0);
        else setIndex(next);
        return;
      }
      setSpot(null);
      setReady(true);
    };
    later(look, step.route ? 60 : 0);
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    setMenu(false);
    if (lent.current) setFront(null);
  }, [setMenu, setFront]);

  /* Keep the light on the element when anything moves under it. Capture */
  /* phase, so a scrolling panel is heard as well as the window.         */
  useEffect(() => {
    if (!step.at || !ready) return undefined;
    const track = () => setSpot(rectOf(find(step.at)));
    window.addEventListener("scroll", track, true);
    window.addEventListener("resize", track);
    return () => {
      window.removeEventListener("scroll", track, true);
      window.removeEventListener("resize", track);
    };
  }, [step, ready]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, go, onClose]);

  /* The card's real size, measured: a line that wraps to four or a     */
  /* phone narrowing the card both change where it fits.                */
  useLayoutEffect(() => {
    const node = card.current;
    if (!node) return undefined;
    const read = () => {
      const r = node.getBoundingClientRect();
      setSize((was) => (Math.abs(was.w - r.width) < 1 && Math.abs(was.h - r.height) < 1 ? was : { w: r.width, h: r.height }));
    };
    read();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    if (ro) ro.observe(node);
    return () => { if (ro) ro.disconnect(); };
  }, [index]);

  /* Beside the lit thing if there is room: right, left, below, above.  */
  /* Standing on what it points at is the failure; when nothing fits,   */
  /* the card takes the corner furthest from the lit thing's middle,    */
  /* top or bottom by whichever side has more room.                     */
  const place = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { w, h } = size;
    const cx = (x) => Math.min(Math.max(x, PAD), Math.max(PAD, vw - w - PAD));
    const cy = (y) => Math.min(Math.max(y, PAD), Math.max(PAD, vh - h - PAD));
    if (!spot) return { left: cx((vw - w) / 2), top: cy((vh - h) / 2) };
    const beside = cy(spot.y + spot.h / 2 - h / 2);
    if (vw - (spot.x + spot.w) - GAP >= w + PAD) return { left: spot.x + spot.w + GAP, top: beside };
    if (spot.x - GAP >= w + PAD) return { left: spot.x - w - GAP, top: beside };
    if (vh - (spot.y + spot.h) - GAP >= h + PAD) return { left: cx(spot.x), top: spot.y + spot.h + GAP };
    if (spot.y - GAP >= h + PAD) return { left: cx(spot.x), top: spot.y - h - GAP };
    const roomy = vh - (spot.y + spot.h) >= spot.y;
    return { left: spot.x + spot.w / 2 > vw / 2 ? cx(PAD) : cx(vw - w - PAD), top: roomy ? cy(vh - h - PAD) : cy(PAD) };
  };
  const { left, top } = place();

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="A tour of the tool">
      {/* Catches every click, so the page cannot be operated by accident */}
      {/* mid-tour. The cutout is only light; it never takes a press.     */}
      <div className="absolute inset-0" />

      {spot ? (
        <div aria-hidden="true" className="tour-spot pointer-events-none absolute rounded-lg"
          style={{ left: spot.x - HALO, top: spot.y - HALO, width: spot.w + HALO * 2, height: spot.h + HALO * 2 }} />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/70 transition-opacity" />
      )}

      <div ref={card}
        className={"absolute flex w-[400px] max-w-[calc(100vw-28px)] flex-col gap-3 rounded-lg border border-brand/50 bg-base-950/95 p-4 shadow-2xl [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:p-3 backdrop-blur-md transition-[left,top,opacity] duration-300 " +
          (ready ? "opacity-100" : "pointer-events-none opacity-0")}
        style={{ left, top }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand/60 bg-brand/10 text-brand">
            <Megaphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {/* On a phone the speaker gives way, so the section and count keep one line. */}
              <span className="hidden sm:inline">Democracy Officer · </span>{step.section} · {index + 1} of {TOUR.length}
            </p>
            <h3 className="text-lg font-bold uppercase leading-tight tracking-wide text-brand" style={OSWALD}>{step.title}</h3>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed text-base-100 [@media(max-height:640px)]:text-[13px] [@media(max-height:640px)]:leading-snug" role="status">"{step.speech}"</p>
        <p className="border-t border-base-800 pt-2.5 text-[12px] leading-relaxed text-base-400 [@media(max-height:640px)]:pt-2 [@media(max-height:640px)]:text-[11px] [@media(max-height:640px)]:leading-snug">{step.plain}</p>
        {borrowed && step.front ? (
          <p className="text-[11px] leading-snug text-accent-300">
            Shown against the {BORROWED_FRONT.label} for this tour only. You choose your front in the war room.
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="rounded px-2 py-1 text-[11px] uppercase tracking-wider text-base-500 hover:text-base-200" style={OSWALD}>
            Skip
          </button>
          <span className="flex-1" />
          {index > 0 ? (
            <button type="button" onClick={() => go(index - 1)} aria-label="Back a step"
              className="flex items-center gap-1 rounded border border-base-700 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-base-300 hover:border-base-500 hover:text-base-100" style={OSWALD}>
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          ) : null}
          <button type="button" onClick={() => go(index + 1)} autoFocus
            className="flex items-center gap-1 rounded border border-brand bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-ink hover:shadow-[0_0_16px_rgb(var(--brand)/0.5)]" style={OSWALD}>
            {last ? "For Super Earth!" : index === 0 ? "Sir, yes sir" : "Understood"}
            {last ? null : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
