/* ================================================================== */
/* DROP BAY                                                           */
/* The read surface for the moment before you drop, and the only place */
/* that browses every build at once: yours and the curated presets.    */
/*                                                                    */
/* Biome and difficulty are hard gates, not soft scoring. A build the  */
/* brief excludes does not appear. That was explicit feedback on an    */
/* earlier version that merely warned: if the answer is do not bring   */
/* this, it should not be on the card.                                 */
/*                                                                    */
/* No ranking. It is a plain grid, which is the call made when this    */
/* replaced the artifact's three scored picks.                         */
/* ================================================================== */

import { useMemo, useState } from "react";
import { Plus, Star, FilterX, Thermometer, Snowflake, Users, X, AlertTriangle, Info, ChevronDown, Lock } from "lucide-react";

import { LoadoutCard, FACTIONS, BIOMES, BIOME_THEME, MISSION_TYPES, FactionBar, FactionChooser, DifficultySlider, bandForLevel } from "./Armory.jsx";
import { presets, deriveHeat, loadoutItemIds } from "./lib/loadouts.js";
import { squadWarnings, isQuietBand } from "./lib/squad.js";

const ANY = { id: "any", label: "Any" };

/* ------------------------------------------------------------------ */
/* The squad panel                                                     */
/*                                                                     */
/* Not a room. No code, no link, no sync, nothing shared. You put two  */
/* to four builds side by side and it tells you what is going to hurt. */
/* Drop Bay's own faction, biome, mission and difficulty controls are  */
/* the squad context, because they already exist and already mean this. */
/* ------------------------------------------------------------------ */

/* Three words for three levels of "this is going to hurt". Critical is    */
/* something you will meet and cannot answer. Warning is a call that is    */
/* probably wrong. Note is information, not a problem.                     */
/* Three words for three levels of "this is going to hurt", with their     */
/* plurals written out rather than guessed at, because "2 criticals" is    */
/* not a phrase. Critical is something you will meet and cannot answer.    */
/* Warning is a call that is probably wrong. Note is information.          */
const SEVERITY = {
  red: { Icon: AlertTriangle, one: "critical", many: "critical", box: "border-red-800/70 bg-red-950/40", text: "text-red-300", chip: "text-red-300" },
  amber: { Icon: AlertTriangle, one: "warning", many: "warnings", box: "border-accent-800/60 bg-accent-950/40", text: "text-accent-300", chip: "text-accent-300" },
  grey: { Icon: Info, one: "note", many: "notes", box: "border-base-700 bg-base-900", text: "text-base-400", chip: "text-base-400" },
};

const tallyLabel = (n, k) => `${n} ${n === 1 ? SEVERITY[k].one : SEVERITY[k].many}`;

function SquadPanel({ builds, context, onRemove, onClear }) {
  const warnings = squadWarnings(builds, context);
  const size = builds.length;
  const [open, setOpen] = useState(true);

  /* Counts per level, in severity order, for the collapsed summary.      */
  const tally = ["red", "amber", "grey"]
    .map((k) => ({ k, n: warnings.filter((w) => w.severity === k).length }))
    .filter((x) => x.n > 0);

  return (
    /* Sticky under the shell chrome, whose real height is published as a  */
    /* variable rather than guessed at. The point is fixing a warning down */
    /* in the grid and watching it clear without scrolling back up.        */
    <div className="sticky z-20 rounded-lg border border-base-700 bg-base-900/95 p-4 backdrop-blur"
      style={{ top: "calc(var(--shell-chrome, 0px) + 0.5rem)" }}>
      <div className={"flex flex-wrap items-center gap-x-3 gap-y-2 " + (open ? "mb-3" : "")}>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
          title={open ? "Collapse to a summary" : "Show every warning"}
          className="flex items-center gap-1.5 rounded p-0.5 text-base-500 hover:bg-base-800 hover:text-base-200">
          <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "" : "-rotate-90")} />
        </button>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          <Users className="h-3.5 w-3.5" /> Squad of {size}
        </span>

        {/* Collapsed, the tally is the whole panel, so it has to carry     */}
        {/* enough to tell you whether anything still needs fixing.        */}
        {!open ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {tally.length === 0 ? (
              <span className="text-base-500">nothing flagged</span>
            ) : tally.map(({ k, n }, i) => (
              <span key={k} className={SEVERITY[k].chip}>
                {tallyLabel(n, k)}{i < tally.length - 1 ? "," : ""}
              </span>
            ))}
          </span>
        ) : null}
        {builds.map((l) => (
          <span key={l.id} className="flex items-center gap-1 rounded border border-base-700 bg-base-900 py-1 pl-2 pr-1 text-xs text-base-200">
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.name}</span>
            <button onClick={() => onRemove(l.id)} aria-label={`Remove ${l.name} from the comparison`}
              className="rounded p-0.5 text-base-600 hover:bg-base-800 hover:text-base-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button onClick={onClear} className="text-[11px] text-base-500 underline hover:text-base-200">clear</button>
      </div>

      {!open ? null : size < 2 ? (
        <p className="text-xs text-base-500">
          Add one more build and this starts checking what the two of you are missing.
        </p>
      ) : isQuietBand(context.difficulty) ? (
        /* Never claim coverage here. The checks are switched off at this  */
        /* band, which is not the same as the squad being fine.            */
        <p className="text-xs text-base-500">
          Coverage checks are off below difficulty 7. Everything behind them assumes 7 and up, and under that the gaps
          stop mattering.
        </p>
      ) : warnings.length === 0 ? (
        /* Silence is the normal state, but an empty box reads as broken,  */
        /* so it says once that it looked and found nothing.               */
        <p className="text-xs text-base-500">
          Nothing worth flagging. Anti-tank and hole closing are covered for this brief.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {warnings.map((w) => {
            const s = SEVERITY[w.severity];
            return (
              <div key={w.id} className={`flex items-start gap-2 rounded border px-2.5 py-2 text-xs leading-relaxed ${s.box} ${s.text}`}>
                <s.Icon className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{w.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <p className="mt-3 text-[10px] leading-relaxed text-base-600">
          Advisory only, and nothing here is removed from the grid below. Role tags are our own call, not a community
          vote. Set faction, biome, mission and difficulty above to sharpen what this says.
        </p>
      ) : null}
    </div>
  );
}

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

export default function DropBay({ state, navigate, faction, setFaction }) {
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
  /* Ids rather than objects, so a build edited elsewhere is re-read      */
  /* rather than held as a stale copy inside the comparison.              */
  const [compare, setCompare] = useState([]);

  const toggleCompare = (id) =>
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]));

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

  /* The front is not one of these. It is the brief, it is shared with   */
  /* the rest of the tool, and clearing the filters must not silently     */
  /* change which war you are looking at.                                 */
  const clearAll = () => {
    setBiome("any"); setMission("any");
    setLevel(0); setSource("all"); setFavesOnly(false); setGear("all");
  };
  const filtering = biome !== "any" || mission !== "any"
    || level !== 0 || source !== "all" || favesOnly || gear !== "all";

  /* Resolved against everything, not against the filtered grid, so       */
  /* narrowing the brief never silently drops a member of the squad.      */
  const compared = useMemo(
    () => compare.map((id) => everything.find((l) => l.id === id)).filter(Boolean),
    [compare, everything]
  );

  if (!faction) {
    return <FactionChooser onChoose={setFaction} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The same control, the same state, as the one above the tier      */}
      {/* list. Drop Bay used to keep a faction of its own, which meant    */}
      {/* choosing bots in one place and finding bugs in the other.        */}
      <FactionBar faction={faction} onChoose={setFaction} />

      {compared.length > 0 ? (
        <SquadPanel builds={compared} context={{ faction, biome, mission, difficulty }}
          onRemove={toggleCompare} onClear={() => setCompare([])} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("builder/new")}
          className="flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-1.5 text-xs text-base-900 hover:bg-base-100">
          <Plus className="h-3.5 w-3.5" /> New loadout
        </button>
        <span className="text-[11px] text-base-500">
          {state.loadouts.length} of your own, {presets.length} curated presets
        </span>
        {compare.length === 0 ? (
          <span className="flex items-center gap-1.5 text-[11px] text-base-600">
            <Users className="h-3.5 w-3.5" /> tap the squad icon on two builds to check them against each other
          </span>
        ) : null}
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
          <p className="text-sm text-base-400">Nothing survives that brief.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-base-600">
            {removedByHeat > 0
              ? "Every build that fit was heat venting, and hot planets rule those out. Try a different biome, or build something ballistic."
              : "Drop the difficulty band or widen the biome. Or start a new loadout for this brief."}
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
              lockedSet={state.lockedSet}
              onOpen={() => navigate(`builder/${l.id}`)}
              onDelete={l.preset ? undefined : () => setConfirmDelete(l)}
              inCompare={compare.includes(l.id)}
              compareFull={compare.length >= 4}
              onToggleCompare={toggleCompare} />
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
