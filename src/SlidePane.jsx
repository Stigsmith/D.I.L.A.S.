/* ================================================================== */
/* SLIDE PANE                                                         */
/*                                                                    */
/* A pane over the map that slides in from the room's left or right   */
/* edge, pulled by a tab fixed to its inner side. The tab is part of  */
/* the pane: open, it sits on the pane's edge facing the map; folded, */
/* the pane slides out past the room's edge and the tab stays at the  */
/* edge, at the same height. Every pane on the war room and the Star  */
/* Map uses it, the curator's call of 13 October 2026.                */
/*                                                                    */
/* The pane stays mounted while folded, so it can slide both ways,    */
/* and is inert while out of sight so focus never lands in it. The    */
/* room clips it. Nothing moves under prefers-reduced-motion.         */
/* ================================================================== */

import { ChevronRight } from "lucide-react";

/* How far the tab reaches past the pane. The map keeps its controls
   clear of it (TAB_PX in WarRoom.jsx is the folded inset). */
export const TAB_W = 36;

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

/* The big left panes' own box. */
export const PANE_CLASS = "rounded-lg border border-base-700/80 bg-base-950/90 shadow-2xl backdrop-blur-md";

/**
 * The right edge's stack: the Major Order and the war so far, each its
 * own pane with its own tab. A folded pane keeps its place in the stack,
 * so the tabs never jump. `panes` holds { label, open, onToggle, body }
 * or null; `room` is the room's size, which splits the height between
 * them so a long briefing scrolls rather than running off the bottom.
 */
export function RightPanes({ panes, top, bottom, room, gap = 12 }) {
  const list = panes.filter(Boolean);
  if (!list.length) return null;
  const avail = Math.max(160, (room.h || 600) - top - bottom);
  const each = Math.floor((avail - 8 * (list.length - 1)) / list.length);
  return (
    <div className="pointer-events-none absolute z-10 flex flex-col items-stretch gap-2"
      style={{ right: gap, top, width: `min(20rem, calc(100% - ${gap + TAB_W}px))` }}>
      {list.map((p) => (
        <SlidePane key={p.label} side="right" open={p.open} onToggle={p.onToggle} label={p.label} gap={gap}
          className="relative" ariaLabel={p.label}>
          <div className="overflow-y-auto rounded-md" style={{ maxHeight: each }}>{p.body}</div>
        </SlidePane>
      ))}
    </div>
  );
}

/**
 * side      "left" or "right": the room edge it slides from
 * open      whether it is pulled out
 * onToggle  pulls it out or pushes it back
 * label     the tab's words, which read top to bottom
 * gap       the space between the room's edge and the open pane
 * className, style   where the pane sits when open (position, size)
 * paneClass the pane's own box, for its border and background
 */
export default function SlidePane({ side = "left", open, onToggle, label, gap = 12, className = "", style = {},
  paneClass = "", ariaLabel, tour, children }) {
  const left = side === "left";
  const out = left ? `translateX(calc(-100% - ${gap}px))` : `translateX(calc(100% + ${gap}px))`;
  return (
    <div className={"pointer-events-none transition-transform duration-300 ease-out motion-reduce:transition-none " + className}
      style={{ ...style, transform: open ? "translateX(0)" : out }}
      data-tour={tour}>
      <aside className={"pointer-events-auto flex h-full flex-col overflow-hidden " + paneClass} aria-label={ariaLabel}
        inert={open ? undefined : ""} aria-hidden={open ? undefined : "true"}>
        {children}
      </aside>
      <button type="button" onClick={onToggle} aria-expanded={open}
        title={open ? `Fold ${label} away` : label}
        className={"pointer-events-auto absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 border border-base-700 bg-base-950/90 py-4 text-base-300 shadow-xl backdrop-blur-md hover:text-base-100 " +
          (left ? "left-full rounded-r-md border-l-0" : "right-full rounded-l-md border-r-0")}
        style={{ width: TAB_W }}>
        <span className={"text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] " + (left ? "rotate-180" : "")}
          style={OSWALD}>
          {label}
        </span>
        {/* Points the way the pane will move. */}
        <ChevronRight className={"h-4 w-4 transition-transform duration-300 motion-reduce:transition-none " +
          ((left ? open : !open) ? "rotate-180" : "")} />
      </button>
    </div>
  );
}
