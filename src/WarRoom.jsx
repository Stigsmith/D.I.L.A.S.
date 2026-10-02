/* ================================================================== */
/* THE WAR ROOM                                                       */
/*                                                                    */
/* Where the scenario is set, laid out like the game's Galactic War   */
/* screen: the galaxy map fills everything right of the menu, and the */
/* rest sits over it. The curator's call, 2 October 2026, replacing   */
/* a scenario screen that stacked a planner, a map, a difficulty dial */
/* and a mission picker down a page.                                  */
/*                                                                    */
/*   left    "Where would you like to play?": the search, the         */
/*           planner and what you are dropping on, folding to a tab   */
/*   right   the Major Order and the war's running totals, laid over  */
/*           the map rather than taking room from it                  */
/*   bottom  difficulty, stepped the way the game steps it, with what */
/*           the level brings off the wiki, how many of you, and Done */
/*                                                                    */
/* On a wide screen the open planner takes its width off the map, so  */
/* the galaxy is never drawn under it. On a narrow one it lays over   */
/* the map and starts folded, and choosing a planet folds it again.   */
/* ================================================================== */

import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";

import GalaxyMap, { MajorOrder } from "./GalaxyMap.jsx";
import { FACTIONS, Planner, PlanetBar, SearchField, PickRow, Empty, DifficultyIcon, difficultyAt } from "./Tiers.jsx";
import { searchPlanets, unplaced, frontOf, suggestFronts } from "./lib/galaxy.js";
import { useWar, agoText } from "./lib/war.js";
import { usePlannerPrefs, planets, biomeName, loudHazards, hazardName } from "./lib/scenario.js";
import { levelParts, levelNew, DIFFICULTY_SOURCE } from "./lib/difficulty.js";
import { enemiesUpTo, arrivalsLine } from "./lib/enemies.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

/* The fronts as the map needs them: the locked hex, and the name. */
const FRONTS = Object.fromEntries(FACTIONS.map((f) => [f.id, { hex: f.hex, label: f.label }]));

/* The planner's width, and the gap it keeps from the edges. */
const PANEL_PX = 368;
const GAP_PX = 12;
/* Below this the room is too narrow for the planner beside the map, so
   it lays over it instead. */
const WIDE_PX = 900;

/* Watches a box's size. The room's own width decides the layout rather
   than the window's, because the menu beside it comes and goes. */
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return size;
}

/**
 * `onDone` goes back to the surface you came from. It is offered once a
 * front is chosen: the tier list and Drop Bay send you here without one,
 * and would only send you straight back. `party` is the live party, whose
 * member count says how many of you there are.
 */
export default function WarRoom({ scenario, setFaction, setPlanet, setMission, setDifficulty, setSquad, clearEnvironment, onDone, party }) {
  const roomRef = useRef(null);
  const barRef = useRef(null);
  const room = useSize(roomRef);
  const bar = useSize(barRef);
  const wide = room.w >= WIDE_PX;

  /* Open on a wide screen and folded on a narrow one, until you say. */
  const [planner, setPlanner] = useState(null);
  const plannerOpen = planner === null ? wide : planner;
  const [orderOpen, setOrderOpen] = useState(null);
  const [totalsOpen, setTotalsOpen] = useState(false);

  const [query, setQuery] = useState("");
  const war = useWar(true);
  const [prefs, setPrefs] = usePlannerPrefs();
  const plan = useMemo(
    () => suggestFronts(war, { front: scenario.faction, ...prefs }),
    [war, scenario.faction, prefs]
  );

  /* A planet with fighting on it brings its front along: the "whole
     scenario fills itself" half. The planner's picks name their front;
     the map and the search ask the live war. */
  const choose = (name, front = frontOf(war, name)) => {
    setPlanet(name);
    if (front && front !== scenario.faction) setFaction(front);
    if (!wide) setPlanner(false);
  };

  const bottom = (bar.h || 64) + GAP_PX;
  const insets = { left: plannerOpen && wide ? PANEL_PX + GAP_PX : 0, bottom };

  return (
    <div ref={roomRef} className="relative w-full overflow-hidden"
      style={{
        /* Clip rather than hide: the map's drawing reaches past the room's
           edges so a tilted sector fills it, and a box that only hides its
           overflow can still be scrolled, by focus or by a script bringing
           something into view. A browser without clip keeps hidden. */
        overflow: "clip",
        height: "calc(100dvh - var(--shell-chrome, 56px) - 0.5rem)",
        background: "radial-gradient(ellipse 80% 70% at 55% 42%, rgb(var(--base-900)) 0%, rgb(var(--base-950)) 72%)",
      }}>
      <GalaxyMap room insets={insets} chosen={scenario.planet} query={query} onChoose={(name) => choose(name)}
        war={war} fronts={FRONTS}
        picks={plan ? plan.picks.map((x) => x.name) : []} fits={plan && plan.count ? plan.fits : null} />

      {/* Left: where would you like to play. */}
      {plannerOpen ? (
        <aside className="absolute z-20 flex flex-col overflow-hidden rounded-lg border border-base-700/80 bg-base-950/90 shadow-2xl backdrop-blur-md"
          style={{ left: GAP_PX, top: GAP_PX, bottom, width: `min(${PANEL_PX}px, calc(100% - ${2 * GAP_PX}px))` }}
          aria-label="Where would you like to play">
          <div className="flex items-center justify-between gap-2 border-b border-base-800 px-3 py-2.5">
            <p className="text-sm font-bold text-base-100" style={OSWALD}>Where would you like to play?</p>
            <button type="button" onClick={() => setPlanner(false)} title="Fold away" aria-label="Fold the planner away"
              className="rounded border border-base-800 p-1 text-base-400 hover:border-base-600 hover:text-base-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
            <PlanetSearch query={query} setQuery={setQuery} war={war} chosen={scenario.planet} onChoose={choose} />
            <Planner bare scenario={scenario} setFaction={setFaction} prefs={prefs} setPrefs={setPrefs}
              war={war} plan={plan} onChoose={choose} />
            {scenario.faction ? (
              <PlanetBar stack scenario={scenario} setMission={setMission} clearEnvironment={clearEnvironment}
                kind={prefs.kind} onClearKind={() => setPrefs({ kind: null })} />
            ) : null}
            <WarLine war={war} />
          </div>
        </aside>
      ) : (
        <button type="button" onClick={() => setPlanner(true)}
          className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-r-md border border-l-0 border-base-700 bg-base-950/90 px-1.5 py-3 text-base-300 shadow-xl backdrop-blur-md hover:text-base-100"
          title="Where would you like to play?">
          <span className="text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180" style={OSWALD}>
            Where to play
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Right: the Major Order and the war so far, over the map. */}
      {(war && war.fresh && (war.order || war.stats)) ? (
        <div className="absolute z-10 flex flex-col gap-2 overflow-y-auto"
          style={{
            right: GAP_PX,
            top: wide ? GAP_PX : 52,
            width: `min(20rem, calc(100% - ${2 * GAP_PX}px))`,
            maxHeight: `calc(100% - ${bottom + GAP_PX + 84}px)`,
          }}>
          <MajorOrder order={war.order} fronts={FRONTS}
            open={orderOpen === null ? wide : orderOpen} onToggle={() => setOrderOpen(!(orderOpen === null ? wide : orderOpen))} />
          <WarTotals stats={war.stats} open={totalsOpen} onToggle={() => setTotalsOpen(!totalsOpen)} />
        </div>
      ) : null}

      {/* Bottom: how hard, how many, and done. */}
      <div ref={barRef}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-base-800 bg-base-950/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <DifficultyStepper value={scenario.difficulty} onChange={setDifficulty} />
        <LevelLine level={scenario.difficulty} faction={scenario.faction} />
        <SquadCount value={scenario.squad} onChange={setSquad} party={party} />
        {onDone && scenario.faction ? (
          <button type="button" onClick={onDone}
            className="ml-auto flex items-center gap-1.5 rounded border border-brand bg-brand px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-brand-ink hover:brightness-110"
            style={OSWALD}>
            <Check className="h-4 w-4" />
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The left panel's pieces                                             */
/* ------------------------------------------------------------------ */

/* The search lights its matches on the map and lists the first few here,
   which is also the way in for a keyboard and for the planets with no
   place on the map. With the war live, a front comes first. */
function PlanetSearch({ query, setQuery, war, chosen, onChoose }) {
  const live = war && war.fresh ? war.planets : null;
  const hits = useMemo(() => {
    const found = searchPlanets(query, 40);
    const ranked = live
      ? [...found].sort((a, b) => Number(Boolean(live.get(b.name)?.campaign)) - Number(Boolean(live.get(a.name)?.campaign)))
      : found;
    return ranked.slice(0, 8);
  }, [query, live]);

  return (
    <div className="flex flex-col gap-1.5">
      <SearchField placeholder={"Search " + planets.length + " planets or a sector"} query={query} setQuery={setQuery}
        autoFocus={false} />
      {query.trim() ? (
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto text-left">
          {hits.length === 0 ? (
            <Empty>No planet by that name. Try a sector.</Empty>
          ) : hits.map((p) => {
            const w = live ? live.get(p.name) : null;
            const fighting = w && w.campaign && w.front ? " · a front, against the " + FRONTS[w.front].label : "";
            return (
              <PickRow key={p.name} on={p.name === chosen} onClick={() => { onChoose(p.name); setQuery(""); }}
                title={p.name}
                sub={(p.sector ? p.sector + " sector · " : "") + biomeName(p.biome) + fighting +
                  (unplaced.includes(p.name) ? " · not on the map" : "")}
                tags={loudHazards(p.hazards).map((h) => ({ key: h, label: hazardName(h), warn: true }))} />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* How fresh the war is, and what to do with the map. */
function WarLine({ war }) {
  return (
    <p className="mt-auto text-[10px] leading-relaxed text-base-600">
      {war && war.fresh ? (
        <>
          <span className="text-base-400">Live, read {agoText(war.age)}.</span>{" "}
          {war.fronts === 1 ? "One front is" : `${war.fronts} fronts are`} open, ringed in the colour of who you would
          fight. Choose one and your front fills itself in too.
        </>
      ) : war ? (
        `The live war was last read ${agoText(war.age)}, too long ago to trust, so the map is not coloured in.`
      ) : (
        "Click a sector to go in, then a planet to drop there. Zoom out, or press Escape, to go back to the galaxy."
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The war so far                                                      */
/* ------------------------------------------------------------------ */

/* A count the way a person reads one: 227 billion, not 226,645,807,204. */
function big(n) {
  const at = (unit, word) => `${(n / unit).toLocaleString("en-GB", { maximumFractionDigits: n / unit >= 100 ? 0 : 1 })} ${word}`;
  if (n >= 1e12) return at(1e12, "trillion");
  if (n >= 1e9) return at(1e9, "billion");
  if (n >= 1e6) return at(1e6, "million");
  return n.toLocaleString("en-GB");
}

/* The war's running totals, as the community API keeps them. Shown only
   for what arrived; a row with no figure is left out rather than zero. */
function WarTotals({ stats, open, onToggle }) {
  if (!stats) return null;
  const rows = [
    ["Terminids killed", stats.bugs, FRONTS.bugs.hex],
    ["Automatons destroyed", stats.bots, FRONTS.bots.hex],
    ["Illuminate killed", stats.squids, FRONTS.squids.hex],
    ["Helldivers lost", stats.deaths, null],
    ["Bullets fired", stats.bullets, null],
    ["Missions won", stats.won, null],
    ["Missions lost", stats.lost, null],
  ].filter(([, n]) => n);
  return (
    <div className="overflow-hidden rounded-md border border-base-700/80 bg-base-950/85 text-left shadow-xl backdrop-blur-sm">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
          The war so far
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-base-500">
          {stats.players ? `${stats.players.toLocaleString("en-GB")} Helldivers in it now` : null}
          <ChevronDown className={"h-3 w-3 self-center transition-transform " + (open ? "rotate-180" : "")} />
        </span>
      </button>
      {open && rows.length ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-base-800 px-3 pb-2.5 pt-2 text-[11px]">
          {rows.map(([label, n, hex]) => (
            <div key={label} className="contents">
              <dt className="flex items-center gap-1.5 text-base-500">
                {hex ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} /> : null}
                {label}
              </dt>
              <dd className="text-right tabular-nums text-base-200">{big(n)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The bottom bar                                                      */
/* ------------------------------------------------------------------ */

/* The game steps difficulty with two arrows either side of the mark and
   the name, so this does too. Level 0 is "not said", one step below
   Trivial, because a level you have not chosen is not the easiest one. */
function DifficultyStepper({ value, onChange }) {
  const level = Number(value) || 0;
  const d = difficultyAt(level);
  const step = (by) => onChange(Math.max(0, Math.min(10, level + by)));
  const arrow = "rounded border border-base-700 bg-base-900 p-1.5 text-base-300 hover:border-base-500 hover:text-base-100 disabled:opacity-30 disabled:hover:border-base-700";
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Difficulty">
      <button type="button" className={arrow} onClick={() => step(-1)} disabled={level === 0}
        aria-label={level === 1 ? "Difficulty not said" : "Easier"} title={level === 1 ? "Not said" : "Easier"}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex w-[11.5rem] items-center gap-2">
        <span className="flex h-7 w-14 shrink-0 items-center justify-center">
          {d ? <DifficultyIcon level={d.level} className="h-7 w-14" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold uppercase leading-none tracking-wide text-base-100" style={OSWALD}>
            {d ? d.name : "Difficulty"}
          </span>
          <span className="mt-1 block text-[10px] leading-none text-base-500">
            {d ? `Level ${d.level} of 10` : "not said"}
          </span>
        </span>
      </div>
      <button type="button" className={arrow} onClick={() => step(1)} disabled={level === 10}
        aria-label="Harder" title="Harder">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* What the level brings, from the wiki's Difficulty table, and what it
   means for the ratings: how many of the front's enemies are counted.
   Wide screens only; the stepper says the name on a phone. */
function LevelLine({ level, faction }) {
  const parts = levelParts(level);
  const fresh = levelNew(level);
  const enemies = faction && level ? `Ratings count the ${enemiesUpTo(faction, level)} enemies this front fields here.` + arrivalsLine(faction, level) : "";
  return (
    <div className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex">
      {parts ? (
        <>
          <p className="truncate text-[11px] text-base-300" title={fresh.length ? "New at this level: " + fresh.join("; ") : undefined}>
            {parts.join(" · ")}
          </p>
          <p className="truncate text-[10px] text-base-500" title={enemies || undefined}>
            {enemies || "Choose a front and the line says which of its enemies the ratings count here."}{" "}
            <a href={DIFFICULTY_SOURCE.url} target="_blank" rel="noreferrer" className="text-base-600 underline hover:text-base-300"
              title={`${DIFFICULTY_SOURCE.name}, ${DIFFICULTY_SOURCE.licence}`}>
              wiki
            </a>
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-base-500">
          Ratings count every enemy the front can field. Set a level and the tool stops warning you about things that
          do not spawn there, and says what the level brings.
        </p>
      )}
    </div>
  );
}

/* How many of you. Not a squad to fill in: nobody rebuilds three other
   people's loadouts in the thirty seconds before a drop. It is here
   because solo on Super Helldive and four of you on it rate gear
   differently, and a solo player is in no party for the tool to count.
   In a party the party's own count decides, and this only says it. */
function SquadCount({ value, onChange, party }) {
  const n = Number(value) || 0;
  const members = party && party.state ? party.state.members.length : 0;
  if (party && party.code) {
    return (
      <span className="text-[11px] text-base-400">
        <span className="font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>Dropping with </span>
        {members ? `${members}, your party` : "your party"}
      </span>
    );
  }
  const options = [[0, "Not said"], [1, "Solo"], [2, "2"], [3, "3"], [4, "4"]];
  return (
    <div className="flex items-center gap-2" role="group" aria-label="How many of you">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>How many of you</span>
      <div className="flex overflow-hidden rounded border border-base-700">
        {options.map(([k, label]) => (
          <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={n === k}
            title={k === 0 ? "Not said: nothing that depends on it will fire" : k === 1 ? "Just you" : `${k} of you`}
            className={"border-l border-base-700 px-2 py-1 text-[11px] transition-colors first:border-l-0 " +
              (n === k ? (k ? "bg-brand/15 text-base-100" : "bg-base-800 text-base-100") : "bg-base-900 text-base-500 hover:text-base-200")}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
