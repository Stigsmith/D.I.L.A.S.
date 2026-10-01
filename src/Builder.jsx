/* ================================================================== */
/* THE ARMOURY'S EDITOR                                               */
/* Where a build is made, and the only place one is changed.           */
/*                                                                    */
/* Tapping a slot opens a picker over the whole screen, and that       */
/* picker is the tier list: the same row, ranked by what each item is  */
/* worth where you are dropping, with the vote beside it. Since 1      */
/* October 2026 the tier list has no menu entry of its own, by the     */
/* curator's call, so this is how most people meet it.                 */
/*                                                                    */
/* It opens on its own page from the Armoury, or over the drop screen  */
/* from Drop Bay, the game's own two places: the armoury before, the   */
/* drop screen right before. Over the drop screen, saving puts the     */
/* build straight into your slot.                                      */
/* ================================================================== */

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  X, Search, Plus, Save, Copy, Trash2, Star, Lock, AlertTriangle, ArrowUp, ArrowDown,
  Thermometer, Flame, ChevronLeft, Backpack, Link2, Check,
} from "lucide-react";

import {
  TierRow, TierBadge, ItemArt, sourceLabelFor, itemStatSummary,
  FACTIONS, FACTION_THEME, BIOMES, MISSION_TYPES, DIFFICULTIES, CAT_META, STRAT_GROUP, FactionBar, LoadoutReading,
} from "./Tiers.jsx";
import { CATEGORIES, getItem, itemName, judgedTier, TIER_RANK, averageRank, rank, eatsBackpack } from "./lib/items.js";
import { readBuild } from "./lib/build.js";
import { scoreItem } from "./lib/score.js";
import {
  presets, SLOTS, STRAT_SLOTS, emptyLoadout, forkPreset,
  deriveHeat, heatSources, deriveFire, backpackUsers, hasBackpackConflict, loadoutItemIds,
} from "./lib/loadouts.js";
import { shareUrl } from "./lib/share.js";

/* A fresh build with one item already in its slot, for "build around
   it" from Drop Bay: the curator's "you never tried this here". */
const SLOT_KEY = { primary: "primary", secondary: "secondary", throwable: "grenade", armor: "armor", booster: "booster" };
function seeded(build, id) {
  const it = id ? getItem(id) : null;
  if (!it) return build;
  const named = { ...build, name: `Built around the ${it.name}` };
  if (SLOT_KEY[it.slot]) return { ...named, [SLOT_KEY[it.slot]]: id };
  if (it.slot === "stratagem") return { ...named, strats: [id, ...build.strats.slice(1)] };
  return build;
}

/* Where the list is ranked for, in the words the scenario bar uses. */
function rankedFor(factionMeta, scenario) {
  const where = [scenario.planet ? `on ${scenario.planet}` : null, scenario.mission || null].filter(Boolean);
  return `Ranked for ${factionMeta.label}${where.length ? ", " + where.join(", ") : ""}`;
}

/* ------------------------------------------------------------------ */
/* Picker overlay                                                      */
/* ------------------------------------------------------------------ */

function Picker({ slot, stratSlot, current, faction, scenario, takenBackpack, taken = [], lockedSet, favoriteItems, onPick, onClear, onClose }) {
  const [query, setQuery] = useState("");
  /* Unavailable gear is hidden by default. You are choosing what to    */
  /* actually drop with, and a list full of things you do not own is    */
  /* a list you have to read past every time.                           */
  const [showLocked, setShowLocked] = useState(false);
  const favSet = useMemo(() => new Set(favoriteItems), [favoriteItems]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Ranked for where you are dropping, against the front the build is
     for: our reading, the same number the slot shows once chosen. It
     ranked by the vote until 1 October 2026, which made "already sorted
     for my drop" untrue the moment a scenario said anything. The vote is
     still on every row, beside it. */
  const scored = useMemo(() => {
    const category = CATEGORIES.find((c) => c.slot === slot);
    const all = category ? category.items : [];
    return new Map(all.map((it) => [it.id, scoreItem(it, { ...scenario, faction })]));
  }, [slot, scenario, faction]);
  const pointsOf = (it) => {
    const r = scored.get(it.id);
    return r && typeof r.score === "number" ? r.score : null;
  };

  const pool = useMemo(() => {
    const category = CATEGORIES.find((c) => c.slot === slot);
    const all = category ? category.items : [];
    return all
      .filter((it) => {
        /* You cannot bring the same stratagem twice, so anything already */
        /* sitting in another slot is not an option here.                 */
        if (taken.includes(it.id)) return false;
        if (!showLocked && lockedSet.has(it.id)) return false;
        if (query && !it.name.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const aFav = favSet.has(a.id) ? 0 : 1;
        const bFav = favSet.has(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        /* Unrated sorts last but is never removed. Being seen is the    */
        /* only way a new warbond weapon ever gets tried.                */
        const pa = pointsOf(a);
        const pb = pointsOf(b);
        if ((pa === null) !== (pb === null)) return pa === null ? 1 : -1;
        if (pa !== pb) return pb - pa;
        return a.name.localeCompare(b.name);
      });
  }, [slot, query, showLocked, lockedSet, favSet, taken, scored]);

  /* The best reading actually available in this slot, so "top pick" means
     the top of what you can reach for this drop rather than a fixed tier. */
  const tierOf = (it) => (scored.get(it.id) || {}).tier || null;
  const topRank = useMemo(
    () => pool.reduce((best, it) => Math.max(best, rank(tierOf(it))), 0),
    [pool, scored]
  );

  const hiddenCount = useMemo(() => {
    const category = CATEGORIES.find((c) => c.slot === slot);
    if (!category) return 0;
    return category.items.filter((it) => lockedSet.has(it.id)).length;
  }, [slot, lockedSet]);

  const title = stratSlot != null ? `Stratagem ${stratSlot + 1}` : (SLOTS.find((s) => s.slot === slot) || {}).label;
  const factionMeta = FACTIONS.find((f) => f.id === faction) || FACTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-950">
      <div className="flex items-center gap-3 border-b border-base-800 px-4 py-3">
        <button onClick={onClose} aria-label="Close picker"
          className="rounded p-1.5 text-base-400 hover:bg-base-800 hover:text-base-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>{title}</h2>
          <p className="text-[11px]" style={{ color: factionMeta.hex }}>
            {rankedFor(factionMeta, scenario)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {current ? (
            <button onClick={onClear}
              className="rounded border border-base-700 px-2.5 py-1 text-xs text-base-400 hover:border-red-600 hover:text-red-400">
              Clear slot
            </button>
          ) : null}
          <button onClick={onClose} aria-label="Close"
            className="rounded p-1.5 text-base-400 hover:bg-base-800 hover:text-base-100">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-base-800 px-4 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-500" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
            className="w-full rounded border border-base-700 bg-base-900 py-1.5 pl-7 pr-2 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
        </div>
        {hiddenCount > 0 ? (
          <button onClick={() => setShowLocked((v) => !v)} aria-pressed={showLocked}
            className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (showLocked
                ? "border-accent-500 bg-accent-500 text-accent-950"
                : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            <Lock className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" />
            {showLocked ? `Showing ${hiddenCount} locked` : `${hiddenCount} locked hidden`}
          </button>
        ) : null}
        <span className="text-[11px] text-base-500">
          {pool.length} to choose from
          {taken.length ? `, ${taken.length} already in this build` : ""}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {pool.length === 0 ? (
          <div className="rounded-lg border border-dashed border-base-700 py-10 text-center text-sm text-base-400">
            {hiddenCount > 0 && !showLocked
              ? "Everything here is marked as not unlocked. Show the locked ones, or open Collection to fix what you own."
              : "Nothing matches that search. Clear it to see the full list."}
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-1.5">
            {pool.map((it) => {
              const best = topRank > 0 && rank(tierOf(it)) === topRank;
              /* Warn before the pick, not after. Choosing this would be */
              /* the second thing wanting your back.                     */
              const clash = takenBackpack && (it.stratType === "backpack" || it.usesBackpackSlot === true);
              return (
                <div key={it.id} className="relative">
                  {best || clash ? (
                    <div className="mb-0.5 flex items-center gap-2 pl-1 text-[10px]">
                      {best ? (
                        <span className="font-semibold uppercase tracking-wider" style={{ color: factionMeta.hex }}>
                          Top pick for this drop
                        </span>
                      ) : null}
                      {clash ? (
                        <span className="flex items-center gap-1 text-accent-400">
                          <Backpack className="h-3 w-3" /> clashes with {takenBackpack.name}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <TierRow item={it} factionFilter={faction} scenario={scenario}
                    isLocked={lockedSet.has(it.id)} lockedByWarbond={false}
                    toggleLock={() => {}} isFav={favSet.has(it.id)} toggleFav={() => {}}
                    open={false} onToggleOpen={() => {}}
                    onSelect={() => onPick(it.id)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slot                                                                */
/* ------------------------------------------------------------------ */

function Slot({ label, itemId, locked, onOpen, warn, faction, scenario }) {
  const item = itemId ? getItem(itemId) : null;
  const stratMeta = item && item.slot === "stratagem" ? CAT_META[item.stratType] : null;

  /* One badge, for the front this build is for.
   *
   * It used to render all three, unlabelled, so you could not tell which
   * was which and two of them answered a question nobody asked: a build
   * declares a front and keeps it when saved. The picker below already
   * ranks by that front and says so in its header, and the tier list
   * dropped its three faction columns for the same reason back in 1.9.0.
   * This row was the last place they survived.
   *
   * It shows our reading rather than the vote, because that is what the
   * loadout reading above is made of: the gear badge is the mean of these
   * nine, so a slot showing a different number would be the two halves of
   * one screen disagreeing. The vote is not hidden, it is the marker: the
   * same top left dot the tier row uses whenever the two differ, and the
   * whole community rating is one tap away in the picker. */
  const scored = item && faction ? scoreItem(item, { ...scenario, faction }) : null;
  const shown = scored ? scored.tier : null;

  return (
    <button onClick={onOpen}
      className={"flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors " +
        (item
          ? "border-base-800 bg-base-900 hover:border-base-600"
          : "border-dashed border-base-700 bg-base-900/40 hover:border-base-500")}>
      {item ? (
        <ItemArt item={item} className="h-10 w-10" dim={locked} />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-base-700 text-base-600">
          <Plus className="h-4 w-4" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          {label}
        </span>
        {item ? (
          <>
            <span className={"flex items-center gap-1.5 truncate text-sm " + (locked ? "text-base-500 line-through" : "text-base-100")}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {locked ? <Lock className="h-3 w-3 shrink-0 text-accent-500" /> : null}
              {item.name}
              {eatsBackpack(item) ? (
                <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (warn ? "bg-red-500" : "bg-accent-500")}
                  title="Uses your backpack slot" />
              ) : null}
            </span>
            <span className="block truncate text-[11px] text-base-500">
              {[sourceLabelFor(item), ...itemStatSummary(item)].join(" · ")}
            </span>
          </>
        ) : (
          <span className="block text-sm text-base-600">Empty, tap to choose</span>
        )}
      </span>

      {item ? (
        <span className="flex shrink-0 items-center gap-1">
          {stratMeta ? (
            <stratMeta.Icon className="h-4 w-4" style={{ color: STRAT_GROUP[stratMeta.group].hex }} />
          ) : null}
          {scored ? (
            <span className="relative flex items-center"
              title={scored.reasons.length
                ? `${scored.base || "unrated"} on the vote. ${scored.reasons.map((r) => r.say).join(" ")}`
                : "Nothing about where you are dropping changes where this sits"}>
              <TierBadge tier={shown} />
              {/* Top left, the square corner. The top right is the chamfer
                  and a round marker over a cut corner reads as damage. */}
              {scored.delta ? (
                <span className={"absolute -left-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-base-900 " +
                  (scored.delta > 0 ? "bg-emerald-500 text-emerald-950" : "bg-red-500 text-red-950")}>
                  {scored.delta > 0 ? <ArrowUp className="h-2 w-2" strokeWidth={3} />
                    : <ArrowDown className="h-2 w-2" strokeWidth={3} />}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

const MultiToggle = ({ label, hint, options, value, onChange }) => (
  <div>
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500"
        style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
      {hint ? <span className="text-[9px] lowercase text-base-600">{hint}</span> : null}
    </div>
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button key={o.id}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            aria-pressed={on} title={o.title}
            className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (on ? "border-base-200 bg-base-200 text-base-900"
                 : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            {o.label}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * `overlay` is set when the builder opens over the drop screen:
 * { onClose, onSaved(id) }. Saving then hands the build back to the slot
 * that opened it rather than moving the page. `startWith` opens one slot's
 * picker straight away, which is how somebody with no builds yet starts
 * one from Drop Bay: the first thing they see is the list.
 */
export default function Builder({ state, loadoutId, navigate, faction, scenario, overlay = null, startWith = null, seedItem = null }) {
  const stored = state.loadouts.find((l) => l.id === loadoutId);
  const preset = presets.find((p) => p.id === loadoutId);

  const [draft, setDraft] = useState(() => {
    if (stored) return stored;
    if (preset) return forkPreset(preset);
    /* A fresh build starts on the front you already told the tool you are */
    /* dropping on. You can still change it per build below.               */
    return seeded(emptyLoadout(faction || undefined), seedItem);
  });
  const [picking, setPicking] = useState(() => {
    const s = startWith ? SLOTS.find((x) => x.key === startWith) : null;
    return s ? { key: s.key, slot: s.slot, stratSlot: null } : null;
  });
  const [dirty, setDirty] = useState(Boolean(preset && !stored) || Boolean(seedItem));
  const [justSaved, setJustSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Following a link to a different build swaps the draft rather than   */
  /* leaving you editing the previous one under a new title.             */
  useEffect(() => {
    if (stored) { setDraft(stored); setDirty(false); }
    else if (preset) { setDraft(forkPreset(preset)); setDirty(true); }
    else if (loadoutId) { setDraft(emptyLoadout(faction || undefined)); setDirty(false); }
  }, [loadoutId]);

  const patch = useCallback((changes) => {
    setDraft((d) => ({ ...d, ...changes }));
    setDirty(true);
    setJustSaved(false);
  }, []);

  /* Against the front the build declares, not the one the scenario names.
     Changing the front above changes what this says, immediately, which is
     the whole reason the two controls are separate. */
  const reading = useMemo(
    () => (draft.faction ? readBuild(draft, { ...scenario, faction: draft.faction }) : null),
    [draft, scenario]
  );

  const heat = deriveHeat(draft);
  const heatFrom = heatSources(draft);
  const packs = backpackUsers(draft);
  const conflict = hasBackpackConflict(draft);
  const lockedHere = loadoutItemIds(draft).filter((id) => state.lockedSet.has(id));
  const filled = loadoutItemIds(draft).length;
  const theme = FACTION_THEME[draft.faction];

  const save = () => {
    state.saveLoadout({ ...draft, heat });
    setDirty(false);
    setJustSaved(true);
    if (overlay) overlay.onSaved(draft.id);
    else if (!stored) navigate(`builder/${draft.id}`);
  };

  /* Over the drop screen, your edit can become a new build instead, so
     the one you made for another night is left as it was. */
  const saveAsNew = () => {
    const copy = state.duplicate({ ...draft, heat });
    if (overlay) overlay.onSaved(copy.id);
    else navigate(`builder/${copy.id}`);
  };

  /* Closing with unsaved changes takes two presses, the second one saying
     what it throws away. */
  const close = () => {
    if (dirty && !leaving) { setLeaving(true); return; }
    overlay.onClose();
  };

  const copyLink = async () => {
    const url = shareUrl(draft, `${window.location.origin}${window.location.pathname}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link to share the build", url);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {overlay ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-base-800 pb-3">
          <button onClick={close} aria-label="Back to the drop"
            className="rounded p-1.5 text-base-400 hover:bg-base-800 hover:text-base-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {stored ? "Adjust your build" : preset ? "Adjust a copy of this preset" : "A new build"}
            </p>
            <p className="text-[11px] text-base-500">
              Saving puts it in your slot on the drop screen, still to confirm.
            </p>
          </div>
          {leaving ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-accent-400">Unsaved changes.</span>
              <button onClick={() => overlay.onClose()}
                className="rounded border border-red-700 bg-red-950/40 px-2.5 py-1 text-xs text-red-300 hover:border-red-500">
                Throw them away
              </button>
              <button onClick={() => setLeaving(false)}
                className="rounded border border-base-700 px-2.5 py-1 text-xs text-base-300 hover:border-base-500">
                Keep editing
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The same control the tier list and Drop Bay carry, but bound to  */}
      {/* the build rather than to the scenario. A build is for a front and   */}
      {/* keeps that when you save it, so changing it here changes what    */}
      {/* you are making, not where the rest of the tool is looking. The   */}
      {/* picker below already ranks by it.                                */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          This build is for
        </span>
        <FactionBar faction={draft.faction} onChoose={(id) => patch({ faction: id })} />
      </div>

      {picking ? (
        <Picker
          slot={picking.slot}
          stratSlot={picking.stratSlot}
          current={picking.stratSlot != null ? draft.strats[picking.stratSlot] : draft[picking.key]}
          faction={draft.faction}
          scenario={scenario}
          takenBackpack={
            picking.stratSlot == null
              ? null
              : packs.find((p) => p.id !== draft.strats[picking.stratSlot]) || null
          }
          taken={
            picking.stratSlot == null
              ? []
              : draft.strats.filter((id, i) => id && i !== picking.stratSlot)
          }
          lockedSet={state.lockedSet}
          favoriteItems={state.favoriteItems}
          onPick={(id) => {
            if (picking.stratSlot != null) {
              const next = [...draft.strats];
              next[picking.stratSlot] = id;
              patch({ strats: next });
            } else {
              patch({ [picking.key]: id });
            }
            setPicking(null);
          }}
          onClear={() => {
            if (picking.stratSlot != null) {
              const next = [...draft.strats];
              next[picking.stratSlot] = null;
              patch({ strats: next });
            } else {
              patch({ [picking.key]: null });
            }
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}

      {/* Identity */}
      <div className="rounded-lg border border-base-800 bg-base-900 overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: theme.hex }} />
        <div className="flex flex-wrap items-center gap-3 p-3">
          <input value={draft.name} onChange={(e) => patch({ name: e.target.value })}
            aria-label="Loadout name"
            className="min-w-[200px] flex-1 rounded border border-base-700 bg-base-900 px-2.5 py-1.5 text-lg font-bold text-base-100 outline-none focus:border-base-500"
            style={{ fontFamily: "'Oswald', sans-serif" }} />
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={save} disabled={!dirty}
              className={"flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors " +
                (dirty
                  ? "border-base-200 bg-base-200 text-base-900 hover:bg-base-100"
                  : "border-base-800 bg-base-900 text-base-600 cursor-default")}>
              <Save className="h-3.5 w-3.5" />
              {dirty ? (overlay ? "Save and use it" : "Save") : justSaved ? "Saved" : "No changes"}
            </button>
            {overlay && stored && dirty ? (
              <button onClick={saveAsNew} title="Keep the original as it was and use a new copy with these changes"
                className="flex items-center gap-1.5 rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
                <Copy className="h-3.5 w-3.5" /> Save as a new build
              </button>
            ) : null}
            <button onClick={copyLink} disabled={filled === 0}
              title="Copy a link to this build. Whoever opens it can keep a copy"
              className="flex items-center gap-1.5 rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100 disabled:opacity-40">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? "Link copied" : "Share"}
            </button>
            {stored && !overlay ? (
              <>
                <button onClick={() => { const c = state.duplicate(draft); navigate(`builder/${c.id}`); }}
                  title="Duplicate"
                  className="rounded border border-base-700 p-1.5 text-base-400 hover:border-base-500 hover:text-base-100">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { state.deleteLoadout(draft.id); navigate("armoury/builds"); }}
                  title="Delete"
                  className="rounded border border-base-700 p-1.5 text-base-400 hover:border-red-600 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        {preset && !stored ? (
          <p className="border-t border-base-800 bg-base-800/40 px-3 py-2 text-[11px] text-base-400">
            Forked from the curated build <span className="text-base-200">{preset.name}</span>. The original is untouched;
            save to keep this copy.
          </p>
        ) : null}
      </div>

      {/* What the nine of them are worth together, and where the holes are. */}
      {reading && reading.score !== null ? (
        <div className="rounded-lg border border-base-800 bg-base-900/60 px-4 pb-3">
          <LoadoutReading reading={reading} />
        </div>
      ) : null}

      {/* Warnings */}
      {conflict || lockedHere.length > 0 ? (
        <div className="flex flex-col gap-2">
          {conflict ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">
              <Backpack className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Two things want your back: </span>
                {packs.map((p) => p.name).join(" and ")}. Only one can come. Left as a warning rather than blocked, since
                a squadmate can carry a pack for you.
              </span>
            </div>
          ) : null}
          {lockedHere.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-accent-800/60 bg-accent-950/40 px-3 py-2 text-[11px] text-accent-300">
              <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {lockedHere.length} {lockedHere.length === 1 ? "item is" : "items are"} marked as not unlocked:{" "}
                {lockedHere.map(itemName).join(", ")}.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Slots */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          {SLOTS.map((s) => (
            <Slot key={s.key} label={s.label} itemId={draft[s.key]}
              locked={state.lockedSet.has(draft[s.key])}
              faction={draft.faction} scenario={scenario}
              onOpen={() => setPicking({ key: s.key, slot: s.slot, stratSlot: null })} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: STRAT_SLOTS }, (_, i) => (
            <Slot key={i} label={`Stratagem ${i + 1}`} itemId={draft.strats[i]}
              locked={state.lockedSet.has(draft.strats[i])}
              warn={conflict && draft.strats[i] && packs.some((p) => p.id === draft.strats[i])}
              faction={draft.faction} scenario={scenario}
              onOpen={() => setPicking({ key: null, slot: "stratagem", stratSlot: i })} />
          ))}
          <div className="rounded-lg border border-base-800 bg-base-900/40 px-3 py-2 text-[11px] text-base-500">
            {filled} of 9 slots filled
            {packs.length === 1 ? (
              <span className="ml-2 text-base-400">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-500 align-middle" />
                {packs[0].name} takes your backpack
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
              style={{ fontFamily: "'Oswald', sans-serif" }}>Mission</span>
            <div className="flex flex-wrap gap-1.5">
              {MISSION_TYPES.map((m) => (
                <button key={m.id} onClick={() => patch({ mission: m.id })} aria-pressed={draft.mission === m.id}
                  className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
                    (draft.mission === m.id ? "border-base-200 bg-base-200 text-base-900"
                      : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <MultiToggle label="Difficulty" hint="hard gate" options={DIFFICULTIES}
            value={draft.diff} onChange={(v) => patch({ diff: v })} />

          <MultiToggle label="Built for these biomes" hint="leave empty for anywhere"
            options={BIOMES.filter((b) => b.id !== "any")}
            value={draft.biomes} onChange={(v) => patch({ biomes: v })} />

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
              style={{ fontFamily: "'Oswald', sans-serif" }}>Behaviour</span>
            <div className="flex flex-col gap-1.5 text-[11px]">
              <span className={"flex items-center gap-1.5 " + (heat ? "text-base-200" : "text-base-500")}>
                <Thermometer className="h-3.5 w-3.5" />
                {heat
                  ? `Heat dependent, from ${heatFrom.map((i) => i.name).join(", ")}`
                  : "Not heat dependent"}
              </span>
              <span className="text-base-600">
                Worked out from the gear you hold, so hot biomes gate it automatically.
              </span>
              <button onClick={() => patch({ fire: !draft.fire })} aria-pressed={draft.fire}
                className={"mt-1 flex w-fit items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors " +
                  (draft.fire ? "border-accent-500 bg-accent-500 text-accent-950"
                    : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
                <Flame className="h-3.5 w-3.5" />
                Fire based kit
              </button>
              {draft.fire !== deriveFire(draft) ? (
                <span className="text-base-600">
                  The gear suggests {deriveFire(draft) ? "yes" : "no"}. Your call wins.
                </span>
              ) : null}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
              style={{ fontFamily: "'Oswald', sans-serif" }}>Note</span>
            <textarea value={draft.blurb} onChange={(e) => patch({ blurb: e.target.value })} rows={2}
              placeholder="What this build is for. Short and opinionated beats hedged."
              className="w-full rounded border border-base-700 bg-base-900 px-2.5 py-1.5 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
