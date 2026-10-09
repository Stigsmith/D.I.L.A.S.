/* ================================================================== */
/* THE RULES                                                          */
/*                                                                    */
/* Every rule behind the tool's own rating, the curator's idea of 1   */
/* October 2026: what each one does, what it moves where you are      */
/* dropping right now, and a switch to turn it off and see what       */
/* changes. In the bottom of the menu, with the pages about the tool  */
/* rather than the ones you use to drop.                              */
/*                                                                    */
/* Built for dozens of rules rather than a handful: grouped by what   */
/* each reacts to, searchable, filterable to the ones changing        */
/* something here, and closed until opened. Each closed row still     */
/* says how many items it moves right now, which is the thing worth   */
/* scanning for. lib/rules.js holds everything that is not a picture. */
/* ================================================================== */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown, RotateCcw, Scale, Info } from "lucide-react";

import { TierBadge } from "./Tiers.jsx";
import { items } from "./lib/items.js";
import { scoreItem } from "./lib/score.js";
import { readBuild } from "./lib/build.js";
import { presets } from "./lib/loadouts.js";
import { withHeat } from "./lib/drop.js";
import { ALL_RULES, GROUPS, ruleGroup, describeWhen, describeMatch, describeSize, isPairing } from "./lib/rules.js";
import { BRAND } from "./lib/brand.js";
import { Tip } from "./Tip.jsx";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const NONE_OFF = new Set();
const PAIRING_IDS = new Set(ALL_RULES.filter(isPairing).map((r) => r.id));

/* A switch rather than a checkbox: it is on or off, and it says so. */
function Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors " +
        (on ? "border-emerald-600 bg-emerald-600/80" : "border-base-600 bg-base-800")}>
      <span className={"inline-block h-3.5 w-3.5 rounded-full bg-base-100 shadow transition-transform " + (on ? "translate-x-[18px]" : "translate-x-[2px]")} />
    </button>
  );
}

function Effect({ effect, off }) {
  if (!effect) return <span className="text-[10px] text-base-600">no front chosen</span>;
  if (!effect.up && !effect.down) return <span className="text-[10px] text-base-600">no effect here</span>;
  return (
    <Tip passive className={"flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums " + (off ? "opacity-50" : "")}
      text={off ? "How many items or builds it would raise and lower here, if switched on." : "How many items or builds it raises and lowers here."}>
      {effect.up ? <span className="flex items-center text-emerald-400"><ArrowUp className="h-3 w-3" />{effect.up}</span> : null}
      {effect.down ? <span className="flex items-center text-red-400"><ArrowDown className="h-3 w-3" />{effect.down}</span> : null}
      <span className="text-base-600">{off ? "if on" : "here"}</span>
    </Tip>
  );
}

/* What one rule moves right now: each item or build it fires on, with
   its tier as things stand and as it would be the other way round. */
function RuleDetail({ rule, scenario, off, builds, buildsArePresets }) {
  const isOff = off.has(rule.id);
  const rows = useMemo(() => {
    if (!scenario.faction) return [];
    const withIt = new Set(off); withIt.delete(rule.id);
    const without = new Set(off); without.add(rule.id);
    /* A pairing fires on a part of a build, never on a bare row, so it
       lists each build it reads and the piece in it that moved. */
    if (isPairing(rule)) {
      return builds
        .filter((l) => l.faction === scenario.faction)
        .flatMap((l) => {
          const a = readBuild(l, { ...scenario, rulesOff: withIt });
          const b = readBuild(l, { ...scenario, rulesOff: without });
          return a.parts
            .map((p, i) => {
              const hit = p.reasons.find((r) => r.id === rule.id);
              if (!hit) return null;
              return { key: `${l.id}-${p.item.id}`, name: `${p.item.name}, in ${l.name}`, points: hit.delta, withTier: p.tier, withoutTier: b.parts[i].tier };
            })
            .filter(Boolean);
        })
        .sort((x, y) => Math.abs(y.points) - Math.abs(x.points));
    }
    if (rule.kind === "item") {
      return items
        .map((it) => {
          const a = scoreItem(it, { ...scenario, rulesOff: withIt });
          const hit = a.reasons.find((r) => r.id === rule.id);
          if (!hit) return null;
          const b = scoreItem(it, { ...scenario, rulesOff: without });
          return { key: it.id, name: it.name, points: hit.delta, withTier: a.tier, withoutTier: b.tier };
        })
        .filter(Boolean)
        .sort((x, y) => Math.abs(y.points) - Math.abs(x.points));
    }
    return builds
      .filter((l) => l.faction === scenario.faction)
      .map((l) => {
        const a = readBuild(l, { ...scenario, rulesOff: withIt });
        const hit = a.notes.find((n) => n.id === rule.id);
        if (!hit) return null;
        const b = readBuild(l, { ...scenario, rulesOff: without });
        return { key: l.id, name: l.name, points: hit.delta, withTier: a.tier, withoutTier: b.tier };
      })
      .filter(Boolean);
  }, [rule, scenario, off, builds]);

  return (
    <div className="grid grid-cols-1 gap-4 border-t border-base-800 px-3 pb-3 pt-3 lg:grid-cols-2">
      <div className="flex flex-col gap-2.5 text-xs leading-relaxed">
        <p className="text-base-200">{rule.say}</p>
        {rule.sayInverted ? (
          <p className="text-base-400"><span className="text-base-500">When it runs the other way: </span>{rule.sayInverted}</p>
        ) : null}
        <p><span className="text-base-500">When: </span><span className="text-base-300">{describeWhen(rule).join(" · ")}</span></p>
        <p><span className="text-base-500">Checks: </span><span className="text-base-300">{describeMatch(rule).join("; ")}.</span></p>
        <p><span className="text-base-500">Size: </span><span className="text-base-300">{describeSize(rule)}</span></p>
        {rule.source ? <p className="text-[11px] text-base-500">Source: {rule.source}.</p> : null}
        {rule.judgement ? <p className="text-[11px] text-accent-300">Our judgement: {rule.judgement}</p> : null}
        {rule.measured ? <p className="text-[11px] text-base-500">Measured: {rule.measured}</p> : null}
        <p className="text-[10px] text-base-600" style={MONO}>{rule.id}</p>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>
          {isPairing(rule) ? `What it changes in your builds here${buildsArePresets ? ", using the presets until you have builds" : ""}` : rule.kind === "item" ? "What it changes here" : `Your builds it applies to here${buildsArePresets ? ", using the presets until you have builds" : ""}`}
        </p>
        {!scenario.faction ? (
          <p className="text-xs text-base-500">Choose a front to see what this rule changes.</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-base-500">No effect in this scenario.</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            <div className="flex items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-base-600">
              <span className="flex-1">{rows.length} {rule.kind === "item" ? (rows.length === 1 ? "item" : "items") : (rows.length === 1 ? "build" : "builds")}</span>
              <span className="w-10 text-right">points</span>
              <span className="w-[4.5rem] text-center">{isOff ? "now, off" : "now"}</span>
              <span className="w-[4.5rem] text-center">{isOff ? "if on" : "if off"}</span>
            </div>
            {rows.map((r) => {
              const now = isOff ? r.withoutTier : r.withTier;
              const other = isOff ? r.withTier : r.withoutTier;
              return (
                <div key={r.key} className="flex items-center gap-2 rounded bg-base-900/70 px-1 py-1">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-base-200" style={MONO}>{r.name}</span>
                  <span className={"w-10 text-right text-[11px] tabular-nums " + (r.points > 0 ? "text-emerald-400" : r.points < 0 ? "text-red-400" : "text-base-500")}>
                    {r.points > 0 ? "+" : ""}{r.points}
                  </span>
                  <span className="flex w-[4.5rem] justify-center">{now ? <TierBadge tier={now} className="h-auto w-6" /> : <span className="text-[10px] text-base-600">unrated</span>}</span>
                  <span className={"flex w-[4.5rem] justify-center " + (now === other ? "opacity-40" : "")}>
                    {other ? <TierBadge tier={other} className="h-auto w-6" /> : <span className="text-[10px] text-base-600">unrated</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const FILTERS = [["all", "All rules"], ["here", "Changing something here"], ["off", "Switched off"]];

export default function Rules({ scenario, rulesOff, toggleRule, clearRules, state }) {
  const off = rulesOff || NONE_OFF;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const [folded, setFolded] = useState(() => new Set());

  /* Build rules read builds, so they need some to read: yours, or the
     presets standing in until you have some. */
  const own = useMemo(() => withHeat(state.loadouts.map((l) => ({ ...l, preset: false }))), [state.loadouts]);
  const buildsArePresets = own.length === 0;
  const builds = useMemo(
    () => (buildsArePresets ? withHeat(presets.map((p) => ({ ...p, preset: true }))) : own),
    [buildsArePresets, own]
  );

  /* One pass with every rule on, so a switched off rule can still say
     what it would move. What each rule moves here, up and down. */
  const effects = useMemo(() => {
    if (!scenario.faction) return null;
    const all = { ...scenario, rulesOff: NONE_OFF };
    const tally = new Map();
    const add = (id, delta) => {
      const t = tally.get(id) || { up: 0, down: 0 };
      if (delta > 0) t.up += 1; else if (delta < 0) t.down += 1;
      tally.set(id, t);
    };
    for (const it of items) for (const r of scoreItem(it, all).reasons) add(r.id, r.delta);
    for (const l of builds.filter((b) => b.faction === scenario.faction)) {
      const reading = readBuild(l, all);
      for (const n of reading.notes) add(n.id, n.delta || (n.severity ? -1 : 0));
      /* Pairings move a part, so they are counted from inside each build. */
      for (const p of reading.parts) for (const r of p.reasons) if (PAIRING_IDS.has(r.id)) add(r.id, r.delta);
    }
    return tally;
  }, [scenario, builds]);

  const effectOf = (rule) => (effects ? effects.get(rule.id) || { up: 0, down: 0 } : null);

  const q = query.trim().toLowerCase();
  const shown = ALL_RULES.filter((r) => {
    if (q && !`${r.name} ${r.say} ${r.id}`.toLowerCase().includes(q)) return false;
    if (filter === "off" && !off.has(r.id)) return false;
    if (filter === "here") {
      const e = effectOf(r);
      if (!e || (!e.up && !e.down)) return false;
    }
    return true;
  });

  const toggleFold = (id) => setFolded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const itemCount = ALL_RULES.filter((r) => r.kind === "item").length;
  const buildCount = ALL_RULES.length - itemCount;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-[16rem] flex-1">
            <p className="text-sm font-bold text-base-200" style={OSWALD}>The rules behind the {BRAND.short} tier</p>
            <p className="mt-1 text-xs leading-relaxed text-base-500">
              Each {BRAND.short} tier starts from the community tier, then these rules change it for where you are
              dropping. {itemCount} rules check one item, {buildCount} check a whole build. Switching a rule off affects
              this browser only.
            </p>
          </div>
          {off.size ? (
            <button onClick={clearRules}
              className="flex shrink-0 items-center gap-1.5 rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
              <RotateCcw className="h-3.5 w-3.5" /> Switch all {off.size} back on
            </button>
          ) : null}
        </div>
        {!scenario.faction ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-accent-300">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Choose a front to see what each rule changes.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the rules"
            className="w-full rounded border border-base-700 bg-base-900 py-1.5 pl-7 pr-2 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
              className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
                (filter === id ? "border-base-200 bg-base-200 text-base-900" : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
              {label}{id === "off" && off.size ? ` (${off.size})` : ""}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-700 px-4 py-10 text-center text-sm text-base-400">
          {filter === "off" ? "Every rule is on."
            : filter === "here" ? "No rule applies to this scenario."
              : "No rule matches that search. Clear it to see them all."}
        </div>
      ) : GROUPS.map((g) => {
        const rules = shown.filter((r) => ruleGroup(r) === g.id);
        if (!rules.length) return null;
        const isFolded = folded.has(g.id);
        const busy = rules.filter((r) => { const e = effectOf(r); return e && (e.up || e.down); }).length;
        return (
          <section key={g.id} className="overflow-hidden rounded-lg border border-base-800 bg-base-900/40">
            <button onClick={() => toggleFold(g.id)} aria-expanded={!isFolded}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-base-800/40">
              {isFolded ? <ChevronRight className="h-4 w-4 text-base-500" /> : <ChevronDown className="h-4 w-4 text-base-500" />}
              <span className="text-sm font-bold uppercase tracking-wide text-base-100" style={OSWALD}>{g.label}</span>
              <span className="hidden text-[11px] text-base-500 sm:inline">{g.line}</span>
              <span className="ml-auto shrink-0 text-[11px] text-base-500">
                {rules.length} {rules.length === 1 ? "rule" : "rules"}{effects ? `, ${busy} apply here` : ""}
              </span>
            </button>
            {isFolded ? null : (
              <div className="flex flex-col gap-1 px-2 pb-2">
                {rules.map((rule) => {
                  const isOff = off.has(rule.id);
                  const isOpen = open === rule.id;
                  return (
                    <div key={rule.id} className={"overflow-hidden rounded border " + (isOff ? "border-base-800 bg-base-950/40" : "border-base-800 bg-base-900")}>
                      <div role="button" tabIndex={0} aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : rule.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : rule.id); } }}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-base-800/40">
                        <Switch on={!isOff} onChange={() => toggleRule(rule.id)} label={`${isOff ? "Switch on" : "Switch off"}: ${rule.name}`} />
                        {/* The name says when the rule applies, so the closed row needs no second line. */}
                        <span className={"min-w-0 flex-1 truncate text-xs " + (isOff ? "text-base-500 line-through" : "text-base-100")}>{rule.name}</span>
                        {rule.judgement ? <span className="hidden shrink-0 rounded border border-accent-800/60 px-1 text-[9px] uppercase tracking-wider text-accent-400 sm:inline">judgement</span> : null}
                        <Effect effect={effectOf(rule)} off={isOff} />
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-base-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-base-600" />}
                      </div>
                      {isOpen ? (
                        <RuleDetail rule={rule} scenario={scenario} off={off} builds={builds} buildsArePresets={buildsArePresets} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
