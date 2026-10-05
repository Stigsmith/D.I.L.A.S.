/* ================================================================== */
/* ARMOUR SETS, DRAWN                                                 */
/*                                                                    */
/* The sets under each passive in the builder's armour picker, and    */
/* the weight filter above them. The curator asked for every set with */
/* its art on 4 October 2026. The passive above a strip is still the  */
/* rated row; a set says what you wear it as: its weight, and the     */
/* armour, speed and stamina that weight brings.                      */
/* ================================================================== */

import { Check, Lock } from "lucide-react";
import { armorSetArt } from "./lib/assets.js";
import { WEIGHTS, WEIGHT_LABEL } from "./lib/armor.js";

const initials = (name) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* A set's render, or its initials in a dashed box when there is no art.
   Nothing depends on the art: a fresh clone has none. */
export function ArmorSetArt({ set, className = "h-14 w-10" }) {
  const url = armorSetArt(set.id);
  if (!url) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center rounded border border-dashed border-base-700 text-[9px] font-bold text-base-600`}
        style={{ fontFamily: "'Oswald', sans-serif" }} title={`No art for ${set.name}`}>
        {initials(set.name)}
      </span>
    );
  }
  return <img src={url} alt="" loading="lazy" decoding="async" className={`${className} shrink-0 object-contain`} />;
}

/* "Light · 70 armour, 530 speed, 115 stamina". */
export const setLine = (set) =>
  `${WEIGHT_LABEL[set.weight]} · ${set.armor} armour, ${set.speed} speed, ${set.stamina} stamina`;

/* All, or one weight. Shown only in the armour picker. */
export function WeightFilter({ value, onChange }) {
  const options = [{ id: null, label: "All weights" }, ...WEIGHTS.map((w) => ({ id: w, label: WEIGHT_LABEL[w] }))];
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Armour weight">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.label} onClick={() => onChange(o.id)} aria-pressed={on}
            className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (on ? "border-base-200 bg-base-200 text-base-900" : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* The sets that carry one passive, as small cards. Choosing one chooses
   its passive too. */
export function SetStrip({ sets, current, accent, lockedSet = null, onPick }) {
  if (!sets.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5 pl-1">
      {sets.map((s) => {
        const on = current === s.id;
        /* Shown only when locked gear is shown: a set from a warbond you
           do not own, dimmed with the accent padlock the rows use. */
        const locked = Boolean(lockedSet && lockedSet.has(s.id));
        return (
          <button key={s.id} onClick={() => onPick(s.id)} aria-pressed={on}
            title={`${s.name}. ${setLine(s)}. ${s.acquisition.note || ""}`.trim()}
            className={"relative flex w-[11.5rem] items-center gap-2 rounded border bg-base-900 p-1.5 text-left transition-colors " +
              (on ? "" : "border-base-800 hover:border-base-600")}
            style={on ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}>
            <span className={locked ? "opacity-40" : ""}><ArmorSetArt set={s} /></span>
            <span className="min-w-0">
              <span className={"flex items-center gap-1 truncate text-[11px] " + (locked ? "text-base-500" : "text-base-100")}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {locked ? <Lock className="h-2.5 w-2.5 shrink-0 text-accent-500" /> : null}
                {s.name}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-base-400"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                {WEIGHT_LABEL[s.weight]}
              </span>
              <span className="block text-[10px] text-base-500">
                {s.armor} / {s.speed} / {s.stamina}
              </span>
            </span>
            {on ? <Check className="absolute right-1 top-1 h-3 w-3" style={{ color: accent }} /> : null}
          </button>
        );
      })}
    </div>
  );
}
