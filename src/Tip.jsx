/* ================================================================== */
/* TIP                                                                */
/*                                                                    */
/* The tool's own tooltip, replacing the browser's plain title text,   */
/* which is slow, unstyled and absent on a phone. The curator's ask of */
/* 9 October 2026, with the writing guide: the answer sits on screen,  */
/* what a term means or where a number came from sits one hover away.  */
/* See dilas-writing.md, "Layers".                                     */
/*                                                                    */
/* Hover and keyboard focus open it. A tap opens it on touch, and a    */
/* tap anywhere else, Escape or a scroll closes it. The panel is drawn */
/* into document.body, because tier rows clip their overflow, and is   */
/* placed above its anchor, or below when there is no room above.     */
/* ================================================================== */

import { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import { createPortal } from "react-dom";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

/* `text` is the body, a string or a node. `title` is an optional small
   heading. `as` picks the anchor element, so a tip can wrap a whole
   table cell as readily as one word. */
export function Tip({ text, title = null, as: Tag = "span", className = "", style, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchor = useRef(null);
  const panel = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !anchor.current || !panel.current) return;
    const a = anchor.current.getBoundingClientRect();
    const p = panel.current.getBoundingClientRect();
    const gap = 6;
    const edge = 8;
    let top = a.top - p.height - gap;
    if (top < edge) top = a.bottom + gap;
    const left = Math.max(edge, Math.min(a.left + a.width / 2 - p.width / 2, window.innerWidth - p.width - edge));
    setPos({ top, left });
  }, [open, text, title]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (anchor.current && !anchor.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!text) return <Tag className={className} style={style}>{children}</Tag>;

  /* Pointer type, not mouse events: a tap fires emulated mouse events
     too, and reacting to both opens and shuts it in one touch. */
  const show = () => { setPos(null); setOpen(true); };
  return (
    <>
      <Tag ref={anchor} tabIndex={0} aria-describedby={open ? id : undefined}
        className={className} style={style}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
        onPointerUp={(e) => { if (e.pointerType !== "mouse") (open ? setOpen(false) : show()); }}
        onFocus={show} onBlur={() => setOpen(false)}>
        {children}
      </Tag>
      {open ? createPortal(
        <div ref={panel} id={id} role="tooltip"
          style={{ position: "fixed", top: pos ? pos.top : -9999, left: pos ? pos.left : -9999, zIndex: 90 }}
          className="pointer-events-none max-w-[260px] overflow-hidden rounded border border-base-700 bg-base-900 px-2.5 pb-2 pt-2.5 text-left text-[11px] normal-case leading-relaxed tracking-normal text-base-300 shadow-lg shadow-black/40">
          <span className="absolute inset-x-0 top-0 h-px bg-brand" aria-hidden="true" />
          {title ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-base-100" style={OSWALD}>{title}</p>
          ) : null}
          {typeof text === "string" ? <p>{text}</p> : text}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

/* The dotted underline that says a label has more behind it. */
export const HAS_TIP = "cursor-help underline decoration-dotted decoration-base-600 underline-offset-2";

/* A field nothing has a figure for. A marker instead of a paragraph:
   the guide's "admit gaps with a marker". */
export function MissingData({ why = "No source has this yet." }) {
  return (
    <Tip text={why} className="cursor-help">
      <span className="inline-block rounded border border-dashed border-base-700 px-1.5 text-[10px] uppercase leading-4 tracking-wider text-base-500">
        Missing data
      </span>
    </Tip>
  );
}
