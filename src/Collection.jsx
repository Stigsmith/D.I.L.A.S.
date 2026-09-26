/* ================================================================== */
/* COLLECTION                                                         */
/*                                                                    */
/* What you own, on two axes, because they are two separate purchases: */
/* super credits buy the warbond, medals unlock each item inside it.   */
/* Warbonds is the coarse axis, Items is the fine one, and neither is  */
/* derived from the other.                                             */
/*                                                                    */
/* Availability is derived from both and stored nowhere. A warbond     */
/* item is available only when the warbond is owned and the item is    */
/* unlocked. Anything on another acquisition path ignores the warbond  */
/* axis entirely.                                                      */
/*                                                                    */
/* Three rules keep the two mechanisms from fighting:                  */
/*  - Owning a warbond never mass unlocks its items. They keep the per */
/*    item state they had. The bulk action on the warbond is explicit. */
/*  - Not owning a warbond disables its items' own toggles. The only   */
/*    way back is the warbond. That one way door is deliberate.        */
/*  - A warbond lock wears a dimmer amber padlock than a per item      */
/*    lock, the same pair of shades the tier rows use.                 */
/* ================================================================== */

import { useState, useMemo } from "react";
import { Search, Lock, Unlock, FilterX, CheckCheck, X, User, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

import { warbondArt } from "./lib/assets.js";
import { Chips, ItemArt, sourceLabelFor } from "./Tiers.jsx";
import {
  items, warbonds, acquisitionLabels, itemCountByWarbond, itemCountByAcquisition,
  itemIdsByWarbond, SLOT_LABEL,
} from "./lib/items.js";

/* The three warbond tiers, and the acquisition paths that are not      */
/* warbonds and so are never gated on that axis.                        */
const WARBOND_TIERS = [
  { id: "standard", label: "Standard", note: "Free. Everyone has this." },
  { id: "premium", label: "Premium", note: "1,000 Super Credits each, or a Premium Warbond Token." },
  { id: "legendary", label: "Legendary", note: "1,500 Super Credits. No reclaimable Super Credits inside, no token unlock." },
];

const UNGATED_PATHS = ["requisition", "starter", "superstore", "campaign", "superCitizen", "armorSet"];

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* Derived on read from the two lock sets, never stored. The warbond    */
/* axis wins when both apply, because that is the one whose toggle is   */
/* still live.                                                          */
/* ------------------------------------------------------------------ */

export const AVAILABILITY = {
  available: { label: "Available", tone: "text-base-500" },
  warbond: { label: "Warbond not owned", tone: "text-accent-700" },
  item: { label: "Not unlocked", tone: "text-accent-500" },
};

const availabilityOf = (id, itemLocks, warbondLocks) => {
  if (warbondLocks.has(id)) return "warbond";
  if (itemLocks.has(id)) return "item";
  return "available";
};

/* ================================================================== */
/* PROFILES                                                           */
/*                                                                    */
/* Switching lives in the header, because every lock on every screen   */
/* belongs to the active profile and you need to know which one that   */
/* is from anywhere. Creating, renaming and deleting live here, next   */
/* to the thing a profile actually holds.                              */
/* ================================================================== */

const START_MODES = [
  { id: "empty", label: "Nothing owned", note: "Everything locked. Fastest for a new player: add the few things he has." },
  { id: "copy", label: "Copy of this one", note: "Starts as whatever the active profile owns right now." },
  { id: "full", label: "Everything owned", note: "Nothing locked, the way a fresh browser starts." },
];

function ProfileBar({ state }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("empty");
  const active = state.activeProfile;
  const only = state.profiles.length <= 1;

  const close = () => { setOpen(null); setName(""); setMode("empty"); };

  return (
    <div className="rounded-lg border border-base-800 bg-base-900 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          <User className="h-3.5 w-3.5" /> Profile
        </span>
        <select value={state.activeProfileId} onChange={(e) => state.setActiveProfile(e.target.value)}
          className="rounded border border-base-700 bg-base-900 px-2 py-1 text-xs text-base-100 outline-none focus:border-base-500">
          {state.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <button onClick={() => setOpen(open === "new" ? null : "new")}
          className="flex items-center gap-1 rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-400 hover:border-base-500 hover:text-base-100">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <button onClick={() => { setName(active.name); setOpen(open === "rename" ? null : "rename"); }}
          className="flex items-center gap-1 rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-400 hover:border-base-500 hover:text-base-100">
          <Pencil className="h-3.5 w-3.5" /> Rename
        </button>
        <button onClick={() => setOpen(open === "delete" ? null : "delete")} disabled={only}
          title={only ? "There is always at least one profile" : `Delete ${active.name}`}
          className={"flex items-center gap-1 rounded border px-2 py-1 text-[11px] " + (only
            ? "cursor-default border-base-800 text-base-700"
            : "border-base-700 bg-base-900 text-base-400 hover:border-red-600 hover:text-red-400")}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>

        <span className="ml-auto text-[11px] text-base-600">
          {active.lockedWarbonds.length} warbonds and {active.lockedItems.length} items marked as not owned
        </span>
      </div>

      {open === "new" ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-base-800 pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Brother"
            className="w-full max-w-xs rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
          <div className="flex flex-wrap gap-1.5">
            {START_MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id} title={m.note}
                className={"rounded border px-2.5 py-1.5 text-xs transition-colors " + (mode === m.id
                  ? "border-base-200 bg-base-200 text-base-900"
                  : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-base-500">{(START_MODES.find((m) => m.id === mode) || {}).note}</p>
          <div className="flex gap-2">
            <button onClick={() => { if (name.trim()) { state.createProfile(name, mode); close(); } }}
              disabled={!name.trim()}
              className={"rounded border px-3 py-1.5 text-xs " + (name.trim()
                ? "border-base-200 bg-base-200 text-base-900 hover:bg-base-100"
                : "cursor-default border-base-800 text-base-700")}>
              Create and switch to it
            </button>
            <button onClick={close} className="rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {open === "rename" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-base-800 pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={active.name}
            className="w-full max-w-xs rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
          <button onClick={() => { state.renameProfile(active.id, name); close(); }} disabled={!name.trim()}
            className={"rounded border px-3 py-1.5 text-xs " + (name.trim()
              ? "border-base-200 bg-base-200 text-base-900 hover:bg-base-100"
              : "cursor-default border-base-800 text-base-700")}>
            Rename
          </button>
          <button onClick={close} className="rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500">
            Cancel
          </button>
          <span className="text-[11px] text-base-600">The name changes, nothing it owns does.</span>
        </div>
      ) : null}

      {open === "delete" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-base-800 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Delete {active.name}? Everything it records about what that player owns goes with it.
          </span>
          <button onClick={() => { state.deleteProfile(active.id); close(); }}
            className="rounded border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs text-red-300 hover:border-red-500">
            Delete
          </button>
          <button onClick={close} className="rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500">
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* WARBONDS TAB                                                       */
/* ================================================================== */

function WarbondTile({ warbond, locked, unlockedHere, total, onToggle, onSetItems }) {
  const cover = warbondArt(warbond.id);
  const partial = unlockedHere !== total;

  return (
    <div className={"flex items-stretch overflow-hidden rounded border text-xs transition-colors " +
      (locked ? "border-accent-700/60 bg-accent-950/40" : "border-base-800 bg-base-900")}>
      <button onClick={onToggle} aria-pressed={locked}
        title={locked ? `Mark ${warbond.name} as owned` : `Mark ${warbond.name} as not owned`}
        className={"flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left transition-colors " +
          (locked ? "text-accent-400" : "text-base-200 hover:bg-base-800/60")}>
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async"
            className={"h-8 w-8 shrink-0 rounded object-cover " + (locked ? "opacity-40 grayscale" : "")} />
        ) : null}
        {locked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Unlock className="w-3.5 h-3.5 shrink-0 text-base-700" />}
        <span className={"truncate " + (locked ? "line-through" : "")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {warbond.name}
        </span>
      </button>

      {/* The medal axis for this warbond, as all or nothing. A tick and a  */}
      {/* cross rather than two more padlocks: three padlocks in a row read */}
      {/* as the same control repeated, and these act on the contents       */}
      {/* rather than on the warbond. Disabled while the warbond is not     */}
      {/* owned, because every item in it is already held by the warbond    */}
      {/* and the only way back is the toggle on the left.                  */}
      <div className="flex shrink-0 items-center gap-0.5 border-l border-base-800 pl-1.5 pr-1">
        <span className={"mr-0.5 text-[10px] tabular-nums " + (partial && !locked ? "text-accent-500" : "text-base-600")}
          title={`${unlockedHere} of ${total} tracked items unlocked`}>
          {partial ? `${unlockedHere}/${total}` : total}
        </span>
        <button onClick={() => onSetItems(false)} disabled={locked}
          title={locked ? "Mark the warbond as owned first" : `Unlock all ${total} items in ${warbond.name}`}
          aria-label={`Unlock all items in ${warbond.name}`}
          className={"rounded p-1 " + (locked ? "cursor-default text-base-800" : "text-base-600 hover:bg-base-800 hover:text-base-100")}>
          <CheckCheck className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onSetItems(true)} disabled={locked}
          title={locked ? "Mark the warbond as owned first" : `Mark all ${total} items in ${warbond.name} as not unlocked`}
          aria-label={`Lock all items in ${warbond.name}`}
          className={"rounded p-1 " + (locked ? "cursor-default text-base-800" : "text-base-600 hover:bg-base-800 hover:text-accent-400")}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function WarbondsTab({ lockedItems, lockedWarbonds, toggleWarbond, setWarbondGroup, setItemGroup }) {
  const wbSet = new Set(lockedWarbonds);
  const itemLocks = new Set(lockedItems);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4 text-xs leading-relaxed text-base-400">
        Mark a warbond you do not own and every item in it is held across the tier lists and the loadout picker at once.
        That is separate from per item unlocking, so turning a warbond back on will not wipe the individual items you
        locked by hand, and marking one as owned does not hand you its contents. Use the padlocks on the right of a
        warbond for that.
        <span className="mt-2 block text-base-500">
          Armor passives are not listed here. The source data maps passives to armor sets, not to warbonds, so armor
          stays on per item unlocking in the Items tab.
        </span>
      </div>

      {WARBOND_TIERS.map((g) => {
        const inTier = warbonds.filter((w) => w.tier === g.id);
        const ids = inTier.map((w) => w.id);
        const lockedInGroup = ids.filter((id) => wbSet.has(id)).length;
        return (
          <div key={g.id} className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
            <div className="flex items-center justify-between gap-3 border-b border-base-800 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {g.label} <span className="font-normal text-base-600">({inTier.length})</span>
                </h3>
                <p className="text-[11px] text-base-500">{g.note}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setWarbondGroup(ids, true)}
                  className="rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-400 hover:border-accent-600 hover:text-accent-400">
                  Own none
                </button>
                <button onClick={() => setWarbondGroup(ids, false)}
                  className="rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-400 hover:border-base-500 hover:text-base-100">
                  Own all
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {inTier.map((w) => {
                const contents = itemIdsByWarbond.get(w.id) || [];
                return (
                  <WarbondTile key={w.id} warbond={w} locked={wbSet.has(w.id)}
                    total={itemCountByWarbond[w.id] || 0}
                    unlockedHere={contents.filter((id) => !itemLocks.has(id)).length}
                    onToggle={() => toggleWarbond(w.id)}
                    onSetItems={(locked) => setItemGroup(contents, locked)} />
                );
              })}
            </div>
            {lockedInGroup > 0 ? (
              <p className="border-t border-base-800 px-4 py-1.5 text-[11px] text-accent-500">
                {lockedInGroup} not owned in this group
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
        <div className="border-b border-base-800 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Not warbond gated <span className="font-normal text-base-600">({UNGATED_PATHS.length})</span>
          </h3>
          <p className="text-[11px] text-base-500">
            Requisition slips, starter kit, rotating store or event. Never gated here, only per item in the Items tab.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {UNGATED_PATHS.map((path) => (
            <div key={path} className="flex items-center justify-between gap-2 rounded border border-base-800 bg-base-900/40 px-2.5 py-2 text-xs text-base-500">
              <span className="truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{acquisitionLabels[path]}</span>
              <span className="shrink-0 text-[10px] text-base-600">{itemCountByAcquisition[path] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-base-600">
        Counts are items this tool tracks from that warbond, not total warbond contents. Cosmetics, capes, player cards and
        vehicle patterns are not tracked. Righteous Revenants is the Killzone crossover; the reference tables never label it
        by tier, so its placement under Legendary is inferred from how many warbonds those tables list.
      </p>
    </div>
  );
}

/* ================================================================== */
/* ITEMS TAB                                                          */
/* ================================================================== */

const SLOT_ORDER = ["primary", "secondary", "throwable", "stratagem", "armor", "booster"];

const SLOT_FILTERS = [
  { id: "all", label: "All" },
  ...SLOT_ORDER.map((s) => ({ id: s, label: SLOT_LABEL[s] })),
];

const AVAIL_FILTERS = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "locked", label: "Not available" },
  { id: "warbond", label: "Warbond not owned" },
  { id: "item", label: "Not unlocked" },
];

const BLANK = { slot: "all", source: "all", avail: "all", query: "" };

/* Sorted once. The list is a flat 228 rows and the order never depends  */
/* on lock state, so there is nothing to recompute per toggle.           */
const SORTED = [...items].sort(
  (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.name.localeCompare(b.name)
);

function ItemRow({ item, availability, source, onToggle }) {
  const held = availability !== "available";
  const byWarbond = availability === "warbond";
  const meta = AVAILABILITY[availability];

  return (
    <div
      onClick={byWarbond ? undefined : onToggle}
      role={byWarbond ? undefined : "button"}
      tabIndex={byWarbond ? undefined : 0}
      onKeyDown={(e) => {
        if (byWarbond) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
      }}
      title={byWarbond
        ? `Held by the ${source} warbond. Change it in the Warbonds tab.`
        : held ? `Mark ${item.name} as unlocked` : `Mark ${item.name} as not unlocked`}
      className={"flex items-center gap-2 rounded-lg border border-base-800 px-2.5 py-2 " +
        (byWarbond ? "bg-base-900/40" : "cursor-pointer bg-base-900 hover:bg-base-800/50")}>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} disabled={byWarbond}
        aria-label={held ? `Mark ${item.name} as unlocked` : `Mark ${item.name} as not unlocked`}
        className={"shrink-0 rounded p-1 " + (byWarbond ? "cursor-default" : "hover:bg-base-800")}>
        {held ? <Lock className={"w-4 h-4 " + (byWarbond ? "text-accent-700" : "text-accent-500")} />
          : <Unlock className="w-4 h-4 text-base-700 hover:text-base-400" />}
      </button>

      <div className={"flex min-w-0 flex-1 items-center gap-2.5 " + (held ? "opacity-40" : "")}>
        <ItemArt item={item} className="h-8 w-8" />
        <span className="hidden w-[78px] shrink-0 truncate text-[10px] font-semibold uppercase tracking-wider text-base-500 sm:inline-block"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          {SLOT_LABEL[item.slot]}
        </span>
        <div className="min-w-0 flex-1">
          <p className={"truncate text-sm " + (held ? "text-base-400 line-through" : "text-base-100")}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {item.name}
          </p>
          <p className="truncate text-[11px] text-base-500">{source}</p>
        </div>
      </div>

      <span className={"shrink-0 text-[10px] font-semibold uppercase tracking-wider " + meta.tone}
        style={{ fontFamily: "'Oswald', sans-serif" }}>
        {meta.label}
      </span>
    </div>
  );
}

function ItemsTab({ lockedItems, warbondLockedSet, toggleLock, setItemGroup }) {
  const [f, setF] = useState(BLANK);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const itemLocks = useMemo(() => new Set(lockedItems), [lockedItems]);

  /* The source label is precomputed because the search matches it too,   */
  /* so typing a warbond name finds its contents without touching the     */
  /* source dropdown.                                                     */
  const rows = useMemo(() => {
    const q = f.query.trim().toLowerCase();
    return SORTED.filter((it) => {
      if (f.slot !== "all" && it.slot !== f.slot) return false;
      if (f.source !== "all") {
        if (f.source.startsWith("path:")) {
          if (it.acquisition.type !== f.source.slice(5)) return false;
        } else if (it.acquisition.type !== "warbond" || it.acquisition.warbond !== f.source) {
          return false;
        }
      }
      if (f.avail !== "all") {
        const a = availabilityOf(it.id, itemLocks, warbondLockedSet);
        if (f.avail === "locked" ? a === "available" : a !== f.avail) return false;
      }
      if (q && !it.name.toLowerCase().includes(q) && !sourceLabelFor(it).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [f, itemLocks, warbondLockedSet]);

  const counts = useMemo(() => {
    const c = { available: 0, warbond: 0, item: 0 };
    for (const it of rows) c[availabilityOf(it.id, itemLocks, warbondLockedSet)] += 1;
    return c;
  }, [rows, itemLocks, warbondLockedSet]);

  /* Bulk actions skip anything held by a warbond, so a click here can    */
  /* never quietly write per item state that the one way door is meant to */
  /* be guarding.                                                          */
  const editable = rows.filter((it) => !warbondLockedSet.has(it.id)).map((it) => it.id);
  const dirty = f.slot !== "all" || f.source !== "all" || f.avail !== "all" || f.query !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <p className="mb-4 text-xs leading-relaxed text-base-400">
          Every item this tool tracks, and whether you can actually take it. A warbond item is available only when you own
          the warbond and have spent the medals on the item. Everything from requisition, the store, a campaign or an armor
          set ignores the warbond axis and answers to this list alone.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Chips label="Slot" options={SLOT_FILTERS} value={f.slot} onChange={(v) => set({ slot: v })}
            activeClass="bg-base-200 text-base-900 border-base-200" />
          <Chips label="Availability" options={AVAIL_FILTERS} value={f.avail} onChange={(v) => set({ avail: v })}
            activeClass="bg-accent-500 text-accent-950 border-accent-500" />
          <div className="flex flex-col gap-3">
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                Source
              </span>
              <select value={f.source} onChange={(e) => set({ source: e.target.value })}
                className="w-full rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-100 outline-none focus:border-base-500">
                <option value="all">All sources</option>
                <optgroup label="Warbonds">
                  {warbonds.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({itemCountByWarbond[w.id] || 0})</option>
                  ))}
                </optgroup>
                <optgroup label="Other paths">
                  {UNGATED_PATHS.map((p) => (
                    <option key={p} value={`path:${p}`}>{acquisitionLabels[p]} ({itemCountByAcquisition[p] || 0})</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                Search
              </span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-base-500" />
                <input value={f.query} onChange={(e) => set({ query: e.target.value })} placeholder="Name or source"
                  className="w-full rounded border border-base-700 bg-base-900 py-1.5 pl-7 pr-2 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-base-800 pt-3 text-[11px] text-base-500">
          <span>{rows.length} of {items.length} shown</span>
          {counts.available > 0 ? <span>{counts.available} available</span> : null}
          {counts.warbond > 0 ? <span className="text-accent-700">{counts.warbond} held by a warbond</span> : null}
          {counts.item > 0 ? <span className="text-accent-500">{counts.item} not unlocked</span> : null}
          {editable.length > 0 ? (
            <span className="flex items-center gap-2">
              <button onClick={() => setItemGroup(editable, false)} className="text-base-400 underline hover:text-base-100">
                unlock {editable.length} shown
              </button>
              <button onClick={() => setItemGroup(editable, true)} className="text-base-400 underline hover:text-accent-400">
                lock {editable.length} shown
              </button>
            </span>
          ) : null}
          {dirty ? (
            <button onClick={() => setF(BLANK)} className="flex items-center gap-1 text-base-400 underline hover:text-base-100">
              <FilterX className="w-3.5 h-3.5" /> clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-base-700 py-8 text-center text-sm text-base-400">
            Nothing matches those filters. Clear the search, widen the source, or set availability back to All.
          </div>
        ) : (
          rows.map((it) => (
            <ItemRow key={it.id} item={it} source={sourceLabelFor(it)}
              availability={availabilityOf(it.id, itemLocks, warbondLockedSet)}
              onToggle={() => toggleLock(it.id)} />
          ))
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-base-600">
        A dimmer padlock means the item is held by a warbond you do not own, and its own toggle is disabled: change the
        warbond and it comes back with whatever per item state it already had. The brighter padlock is a per item lock,
        which is yours to set here or on any tier row.
      </p>
    </div>
  );
}

/* ================================================================== */

export const COLLECTION_TABS = [
  { id: "warbonds", label: "Warbonds" },
  { id: "items", label: "Items" },
];

export default function Collection({ tab, state }) {
  return (
    <div className="flex flex-col gap-4">
      <ProfileBar state={state} />
      {/* Keyed on the profile so switching resets the tab's own filter    */}
      {/* state rather than carrying one player's search onto another.     */}
      {tab === "items" ? (
        <ItemsTab
          key={state.activeProfileId}
          lockedItems={state.lockedItems}
          warbondLockedSet={state.warbondLockedSet}
          toggleLock={state.toggleLock}
          setItemGroup={state.setItemGroup}
        />
      ) : (
        <WarbondsTab
          lockedItems={state.lockedItems}
          lockedWarbonds={state.lockedWarbonds}
          toggleWarbond={state.toggleWarbond}
          setWarbondGroup={state.setWarbondGroup}
          setItemGroup={state.setItemGroup}
        />
      )}
    </div>
  );
}
