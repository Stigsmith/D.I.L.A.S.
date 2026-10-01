/* ================================================================== */
/* THE ARMOURY                                                        */
/* Your builds, the game's armoury with one thing the game does not   */
/* have: a build is saved, named and kept, stratagems included, so    */
/* the seventy you find fun are still there next month. The curator's */
/* framing and name, 1 October 2026; it was the Loadout Builder plus  */
/* Drop Bay's second tab until then.                                   */
/*                                                                    */
/* Two tabs. Builds browses every build at once, yours and the        */
/* curated presets, and is what Exchange inherits once there is       */
/* somewhere for other people's builds to live. Coverage answers "do  */
/* I have something for each occasion", per front.                    */
/*                                                                    */
/* It used to carry the squad comparison too, as a sticky panel over   */
/* the grid. That moved to the drop screen in 1.24.0, where a squad   */
/* member's slot is the comparison rather than an extra on top of a    */
/* browser.                                                           */
/*                                                                    */
/* Biome and difficulty are hard gates, not soft scoring. A build the  */
/* scenario excludes does not appear. That was explicit feedback on an    */
/* earlier version that merely warned: if the answer is do not bring   */
/* this, it should not be on the card.                                 */
/*                                                                    */
/* No ranking. It is a plain grid, which is the call made when this    */
/* replaced the artifact's three scored picks.                         */
/* ================================================================== */

import { useMemo, useState } from "react";
import { Plus, Star, FilterX, Snowflake, Info, Lock, AlertTriangle } from "lucide-react";

import { LoadoutCard, FACTIONS, BIOMES, BIOME_THEME, MISSION_TYPES, FactionBar, FactionChooser, DifficultySlider, bandForLevel, TierBadge } from "./Tiers.jsx";
import { presets, deriveHeat, loadoutItemIds } from "./lib/loadouts.js";
import { withHeat } from "./lib/drop.js";
import { coverage } from "./lib/coverage.js";

export const ARMOURY_TABS = [{ id: "builds", label: "Builds" }, { id: "coverage", label: "Coverage" }];

const ANY = { id: "any", label: "Any" };

function Row({ label, options, value, onChange, hint }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
        {hint ? <span className="text-[9px] lowercase text-base-600">{hint}</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
            className={"flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (value === o.id
                ? "border-base-200 bg-base-200 text-base-900"
                : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            {o.Icon ? <o.Icon className="h-3.5 w-3.5" /> : null}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ArmouryBuilds({ state, navigate, faction, setFaction, scenario }) {
  const [biome, setBiome] = useState("any");
  const [mission, setMission] = useState("any");
  /* A level from 1 to 10, or 0 for any. The four bands are what a build */
  /* declares and what the gate below reads, so the level derives one     */
  /* rather than replacing it and no saved build has to migrate.          */
  const [level, setLevel] = useState(0);
  const difficulty = bandForLevel(level);
  const [source, setSource] = useState("all");
  const [favesOnly, setFavesOnly] = useState(false);
  /* Restored. This existed on the picker Drop Bay replaced and was lost
     in that port, not dropped on purpose. A build you cannot field is
     noise when you are deciding what to bring tonight. */
  const [gear, setGear] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Both derive their heat flag, which is what this comment always      */
  /* claimed and the code did not do: presets kept the hand authored     */
  /* flag out of loadouts.json and only your own builds were derived.    */
  /*                                                                     */
  /* That mattered once the derivation stopped keying off damageType.    */
  /* The authored flags were made the same way, so they say the Purifier */
  /* and the Blitzer build heat, and the source says neither can. Three  */
  /* Purifier builds and one Blitzer build were being removed from every */
  /* hot planet over a mechanic they do not have.                        */
  /*                                                                     */
  /* loadouts.json is not rewritten. The curated set is his; its heat     */
  /* field is simply no longer the thing the gate reads.                 */
  const everything = useMemo(() => {
    const mine = state.loadouts.map((l) => ({ ...l, preset: false, heat: deriveHeat(l) }));
    return [...mine, ...presets.map((p) => ({ ...p, preset: true, heat: deriveHeat(p) }))];
  }, [state.loadouts]);

  const { shown, removedByHeat, removedByLock } = useMemo(() => {
    let heatCut = 0;
    let lockCut = 0;
    const out = everything.filter((l) => {
      if (source === "mine" && l.preset) return false;
      if (source === "presets" && !l.preset) return false;
      if (favesOnly && !state.favorites.includes(l.id)) return false;
      if (gear === "owned" && loadoutItemIds(l).some((id) => state.lockedSet.has(id))) { lockCut += 1; return false; }
      if (l.faction !== faction) return false;
      if (mission !== "any" && l.mission !== mission && !(l.alt || []).includes(mission)) return false;
      if (difficulty !== "any" && !(l.diff || []).includes(difficulty)) return false;

      if (biome !== "any") {
        /* Hot planets speed up heat buildup, so a heat venting kit is   */
        /* removed from the pool rather than flagged.                    */
        if (biome === "hot" && l.heat) { heatCut += 1; return false; }
        /* A build declaring biomes is specialised for them. One that    */
        /* declares none is general purpose and always survives.         */
        const built = l.biomes || [];
        if (built.length && !built.includes(biome)) return false;
      }
      return true;
    });
    return { shown: out, removedByHeat: heatCut, removedByLock: lockCut };
  }, [everything, source, favesOnly, gear, faction, mission, difficulty, biome, state.favorites, state.lockedSet]);

  /* Cold slows heat buildup, so laser and plasma fire longer before      */
  /* venting. The first version modelled only the hot penalty and missed  */
  /* this entirely, which is why it is called out rather than implied.    */
  const coldBonus = biome === "cold" ? shown.filter((l) => l.heat).length : 0;

  /* The front is not one of these. It is the scenario, it is shared with   */
  /* the rest of the tool, and clearing the filters must not silently     */
  /* change which war you are looking at.                                 */
  const clearAll = () => {
    setBiome("any"); setMission("any");
    setLevel(0); setSource("all"); setFavesOnly(false); setGear("all");
  };
  const filtering = biome !== "any" || mission !== "any"
    || level !== 0 || source !== "all" || favesOnly || gear !== "all";

  if (!faction) {
    return <FactionChooser onChoose={setFaction} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The same control, the same state, as the one above the tier      */}
      {/* list. Drop Bay used to keep a faction of its own, which meant    */}
      {/* choosing bots in one place and finding bugs in the other.        */}
      <FactionBar faction={faction} onChoose={setFaction} />

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("builder/new")}
          className="flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-1.5 text-xs text-base-900 hover:bg-base-100">
          <Plus className="h-3.5 w-3.5" /> New loadout
        </button>
        <span className="text-[11px] text-base-500">
          {state.loadouts.length} of your own, {presets.length} curated presets
        </span>
        {/* The tier list has no menu entry since 1 October 2026; it is the
            picker inside every build. For anyone who prefers it whole, this
            is the door. */}
        <button onClick={() => navigate("tiers/primary")}
          className="ml-auto text-[11px] text-base-400 underline hover:text-base-100">
          Browse the full tier list
        </button>
      </div>

      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Biome" hint="hard gate" value={biome} onChange={setBiome}
            options={[ANY, ...BIOMES.filter((b) => b.id !== "any")]} />
          <Row label="Mission" value={mission} onChange={setMission}
            options={[ANY, ...MISSION_TYPES]} />
          <div className="sm:col-span-2">
            <DifficultySlider value={level} onChange={setLevel} hint="hard gate" />
          </div>
          <Row label="Source" value={source} onChange={setSource}
            options={[{ id: "all", label: "Everything" }, { id: "mine", label: "Mine" }, { id: "presets", label: "Presets" }]} />
          <Row label="Gear" hint="what you can field" value={gear} onChange={setGear}
            options={[{ id: "all", label: "All builds" }, { id: "owned", label: "Only unlocked gear" }]} />
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-base-500"
              style={{ fontFamily: "'Oswald', sans-serif" }}>Favorites</span>
            <button onClick={() => setFavesOnly((v) => !v)} aria-pressed={favesOnly}
              className={"flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors " +
                (favesOnly ? "border-accent-400 bg-accent-400 text-accent-950"
                  : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
              <Star className={"h-3.5 w-3.5 " + (favesOnly ? "fill-accent-950" : "")} /> Starred only
            </button>
          </div>
        </div>

        {biome !== "any" && BIOME_THEME[biome] && BIOME_THEME[biome].note ? (
          <div className="mt-3 flex items-start gap-2 rounded border px-2.5 py-2 text-[11px] leading-relaxed"
            style={{ borderColor: BIOME_THEME[biome].dot + "55", backgroundColor: BIOME_THEME[biome].dot + "12", color: "rgb(var(--base-300))" }}>
            <Info className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: BIOME_THEME[biome].dot }} />
            <span>{BIOME_THEME[biome].note}</span>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-base-800 pt-3 text-[11px] text-base-500">
          <span>{shown.length} of {everything.length} shown</span>
          {removedByHeat > 0 ? (
            <span className="flex items-center gap-1 text-accent-500">
              <FilterX className="h-3.5 w-3.5" />{removedByHeat} heat venting build{removedByHeat === 1 ? "" : "s"} excluded, hot planet
            </span>
          ) : null}
          {removedByLock > 0 ? (
            <span className="flex items-center gap-1 text-accent-500">
              <Lock className="h-3.5 w-3.5" />{removedByLock} need gear you have not unlocked
            </span>
          ) : null}
          {coldBonus > 0 ? (
            <span className="flex items-center gap-1 text-sky-400">
              <Snowflake className="h-3.5 w-3.5" />{coldBonus} heat venting build{coldBonus === 1 ? "" : "s"} run longer here
            </span>
          ) : null}
          {filtering ? (
            <button onClick={clearAll} className="text-base-400 underline hover:text-base-100">clear filters</button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-700 px-4 py-10 text-center">
          <p className="text-sm text-base-400">Nothing survives that scenario.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-base-600">
            {removedByHeat > 0
              ? "Every build that fit was heat venting, and hot planets rule those out. Try a different biome, or build something ballistic."
              : "Drop the difficulty band or widen the biome. Or start a new loadout for this scenario."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => (
            <LoadoutCard key={l.id} loadout={l}
              isFavorite={state.favorites.includes(l.id)}
              onToggleFavorite={state.toggleFavorite}
              rankLabel={l.preset ? "Curated preset" : "Yours"}
              biome={biome}
              scenario={scenario}
              lockedSet={state.lockedSet}
              onOpen={() => navigate(`builder/${l.id}`)}
              onDelete={l.preset ? undefined : () => setConfirmDelete(l)} />
          ))}
        </div>
      )}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-lg border border-base-700 bg-base-900 p-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-base-100"
              style={{ fontFamily: "'Oswald', sans-serif" }}>Delete this loadout</h3>
            <p className="mt-1 text-xs text-base-400">
              <span className="text-base-200">{confirmDelete.name}</span> goes for good. Presets are never touched, so
              anything you forked can be forked again.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500">
                Cancel
              </button>
              <button onClick={() => { state.deleteLoadout(confirmDelete.id); setConfirmDelete(null); }}
                className="rounded border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs text-red-300 hover:border-red-500">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coverage                                                            */
/* ------------------------------------------------------------------ */

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

/* Why nothing you have answers a situation, from what the gates took out. */
function gapWhy(row) {
  const c = row.cut || {};
  const bits = [
    c.heat ? `${c.heat} vent${c.heat === 1 ? "s" : ""} heat` : null,
    c.band ? `${c.band} built for other difficulties` : null,
    c.biome ? `${c.biome} built for other terrain` : null,
    c.locked ? `${c.locked} need${c.locked === 1 ? "s" : ""} gear you have not unlocked` : null,
  ].filter(Boolean);
  return bits.length ? `Ruled out: ${bits.join(", ")}.` : "Nothing for this front yet.";
}

function CoverageRow({ row, onOpen, onStart }) {
  const { situation, best, fit, standing } = row;
  return (
    <div className={"flex items-center gap-2.5 rounded border px-2.5 py-2 " +
      (standing === "gap" ? "border-red-900/60 bg-red-950/20" : standing === "thin" ? "border-accent-900/60 bg-accent-950/20" : "border-base-800 bg-base-900/60")}>
      <span className={"min-w-0 flex-1 text-xs " + (standing === "absent" ? "text-base-600" : "text-base-300")}>{situation.label}</span>
      {standing === "absent" ? (
        <span className="text-[10px] text-base-600">Not on this front</span>
      ) : best ? (
        <button onClick={() => onOpen(best.build)} title={`Open ${best.build.name} in the Armoury`}
          className="flex min-w-0 max-w-[60%] items-center gap-1.5 text-left hover:opacity-80">
          <span className="min-w-0 truncate text-[11px] text-base-200">{best.build.name}</span>
          {fit > 1 ? <span className="shrink-0 text-[10px] text-base-600">+{fit - 1}</span> : null}
          <TierBadge tier={best.reading.tier} className="h-auto w-6 shrink-0" />
        </button>
      ) : (
        <span className="flex min-w-0 max-w-[65%] flex-col items-end gap-1 text-right">
          <span className="text-[10px] leading-snug text-red-300">{gapWhy(row)}</span>
          <button onClick={onStart} className="text-[10px] text-base-400 underline hover:text-base-100">Build one for this</button>
        </span>
      )}
    </div>
  );
}

function FrontColumn({ front, rows, navigate }) {
  const live = rows.filter((r) => r.standing !== "absent");
  const covered = live.filter((r) => r.standing === "covered").length;
  const gaps = live.filter((r) => r.standing === "gap");
  const thin = live.filter((r) => r.standing === "thin");
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-base-800 bg-base-900/40">
      <div className="h-1 w-full" style={{ backgroundColor: front.hex }} />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <front.Icon className="h-4 w-4" style={{ color: front.hex }} />
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ ...OSWALD, color: front.hex }}>{front.label}</h3>
          <span className="ml-auto text-[11px] text-base-500">{covered} of {live.length} covered</span>
        </div>
        <p className="text-[11px] leading-relaxed text-base-500">
          {gaps.length
            ? `Nothing for ${gaps.map((g) => g.situation.label.toLowerCase()).join(", ")}.`
            : thin.length
              ? `Something for everything, but only a B or worse for ${thin.map((g) => g.situation.label.toLowerCase()).join(", ")}.`
              : "An A or better for every situation here."}
        </p>
        <div className="flex flex-col gap-1">
          {rows.map((r) => (
            <CoverageRow key={r.situation.id} row={r}
              onOpen={(b) => navigate(`builder/${b.id}`)}
              onStart={() => navigate(`builder/new-${front.id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Coverage({ state, navigate, scenario }) {
  const [withPresets, setWithPresets] = useState(false);
  const own = useMemo(() => withHeat(state.loadouts.map((l) => ({ ...l, preset: false }))), [state.loadouts]);
  /* With nothing of your own, the presets stand in rather than leaving
     three columns of gaps, and the page says so. */
  const usingPresets = withPresets || own.length === 0;
  const pool = useMemo(
    () => (usingPresets ? [...own, ...withHeat(presets.map((p) => ({ ...p, preset: true })))] : own),
    [usingPresets, own]
  );
  const cov = useMemo(
    () => coverage(pool, { lockedSet: state.lockedSet, rulesOff: scenario.rulesOff }),
    [pool, state.lockedSet, scenario.rulesOff]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-base-800 bg-base-900/60 p-4">
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-bold text-base-200" style={OSWALD}>Do you have something for each occasion</p>
          <p className="mt-1 text-xs leading-relaxed text-base-500">
            Your best build for each situation, per front, by the same reading every badge in the tool shows and
            through the same gates the drop screen applies. Read at Suicide Mission with four of you unless a row says
            otherwise. An A or better counts as covered; a B is thin. Only builds you can field: gear you have not
            unlocked rules a build out here.
          </p>
          {own.length === 0 ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-accent-300">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              You have no builds of your own yet, so this shows what the curated presets cover. Build or fork your own and
              this becomes yours.
            </p>
          ) : null}
        </div>
        {own.length ? (
          <button onClick={() => setWithPresets((v) => !v)} aria-pressed={withPresets}
            className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (withPresets ? "border-base-200 bg-base-200 text-base-900" : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            Count the curated presets too
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {FACTIONS.map((f) => <FrontColumn key={f.id} front={f} rows={cov[f.id]} navigate={navigate} />)}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-base-600">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
        A gap is worth a build, not an emergency. Every reading here is the tool's own, from the rules on the Rules page,
        and a rule you have switched off there is switched off here too.
      </p>
    </div>
  );
}
