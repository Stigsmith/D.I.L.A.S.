/* ================================================================== */
/* THE STAR MAP                                                       */
/*                                                                    */
/* The galaxy map as its own place: for reading the war rather than   */
/* setting up a drop. The curator's ask of 21 August 2026, built on 2 */
/* October: the same map the war room uses, reachable from the menu,  */
/* with depth the drop flow would not want in the way.                */
/*                                                                    */
/*   left       the fronts, grouped by who you would fight, busiest   */
/*              first; choose a planet and it becomes that planet's    */
/*              intel, with its history and a way to drop there        */
/*   top right  the Major Order and the war so far, with how many     */
/*              were fighting hour by hour                            */
/*                                                                    */
/* Clicking a planet here reads it rather than choosing it. Choosing  */
/* is Drop here, one button, so a look around never moves your        */
/* scenario. The planet is in the address, #/map/<planet>, so a       */
/* planet can be linked and Back goes back.                           */
/*                                                                    */
/* History is the tool's own: nobody publishes the war's past, so the */
/* server keeps one copy an hour for thirty days, from the day it     */
/* first ran. Until then this says so rather than drawing nothing.    */
/* ================================================================== */

import { useState, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";

import GalaxyMap, { MajorOrder } from "./GalaxyMap.jsx";
import { FACTIONS } from "./Tiers.jsx";
import { FRONTS, PANEL_PX, GAP_PX, WIDE_PX, useSize, PlanetSearch, WarLine, WarTotals, big } from "./WarRoom.jsx";
import { frontOf, progressAt } from "./lib/galaxy.js";
import { useWar, useWarHistory, useWarTrend, untilText } from "./lib/war.js";
import { planetByName, biomeInfo, biomeName, hazardName, hazardEffect, loudHazards } from "./lib/scenario.js";
import { planetArt } from "./lib/assets.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

const pct = (share) => Math.round(share * 100) + "%";
const dateText = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/* What is happening on a planet, as a sentence, a colour and a share. */
function stateOf(w) {
  if (!w) return { text: "Super Earth holds it. Nothing to fight here right now.", hex: null, share: null };
  const f = w.front ? FRONTS[w.front] : null;
  const who = f ? f.label : "the enemy";
  if (w.defence) {
    const left = w.defence.endsAt ? w.defence.endsAt - Date.now() : null;
    return {
      text: `Under attack by the ${who}` +
        (w.defence.progress !== null ? `, ${pct(w.defence.progress)} defended` : "") +
        (left && left > 0 ? `, ${untilText(left)} left` : ""),
      hex: f ? f.hex : null,
      share: w.defence.progress,
    };
  }
  if (w.campaign) {
    return { text: `Held by the ${who}` + (w.liberation !== null ? `, ${pct(w.liberation)} liberated` : ""), hex: f ? f.hex : null, share: w.liberation };
  }
  return { text: `Held by the ${who}. No campaign here right now.`, hex: f ? f.hex : null, share: null };
}

/* ------------------------------------------------------------------ */

/**
 * `selected` is the planet the address names, or null. `onSelect` changes
 * it. `onDropHere` sets the scenario to a planet and goes to Drop Bay.
 */
export default function StarMap({ selected, onSelect, onDropHere }) {
  const roomRef = useRef(null);
  const room = useSize(roomRef);
  const wide = room.w >= WIDE_PX;

  /* Open on a wide screen, and on a narrow one whenever a planet is
     chosen, since its intel is the point; folded otherwise until you say. */
  const [panel, setPanel] = useState(null);
  const panelOpen = panel === null ? wide || Boolean(selected) : panel;
  const [orderOpen, setOrderOpen] = useState(null);
  const [totalsOpen, setTotalsOpen] = useState(null);
  const [query, setQuery] = useState("");

  const war = useWar(true);
  const trend = useWarTrend(true);
  const live = war && war.fresh ? war : null;

  const select = (name) => {
    setPanel(null);
    onSelect(name);
  };

  return (
    <div ref={roomRef} className="relative w-full overflow-hidden"
      style={{
        /* Clip, not hide: see the war room. */
        overflow: "clip",
        height: "calc(100dvh - var(--shell-chrome, 56px) - 0.5rem)",
        background: "radial-gradient(ellipse 80% 70% at 55% 42%, rgb(var(--base-900)) 0%, rgb(var(--base-950)) 72%)",
      }}>
      <GalaxyMap room openOnChosen insets={{ left: panelOpen && wide ? PANEL_PX + GAP_PX : 0 }}
        chosen={selected} query={query} onChoose={select} war={war} fronts={FRONTS}
        label="The galaxy map. Click a sector to go in, then a planet to read about it." />

      {panelOpen ? (
        <aside className="absolute z-20 flex flex-col overflow-hidden rounded-lg border border-base-700/80 bg-base-950/90 shadow-2xl backdrop-blur-md"
          style={{ left: GAP_PX, top: GAP_PX, bottom: GAP_PX, width: `min(${PANEL_PX}px, calc(100% - ${2 * GAP_PX}px))` }}
          aria-label={selected ? `About ${selected}` : "The fronts"}>
          {selected ? (
            <Intel key={selected} name={selected} war={live} onBack={() => select(null)} onSelect={select}
              onDropHere={() => onDropHere(selected, frontOf(war, selected))} onFold={() => setPanel(false)} />
          ) : (
            <Fronts war={war} live={live} query={query} setQuery={setQuery} onSelect={select} onFold={() => setPanel(false)} />
          )}
        </aside>
      ) : (
        <button type="button" onClick={() => setPanel(true)}
          className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-r-md border border-l-0 border-base-700 bg-base-950/90 px-1.5 py-3 text-base-300 shadow-xl backdrop-blur-md hover:text-base-100"
          title={selected ? `About ${selected}` : "The fronts"}>
          <span className="rotate-180 text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]" style={OSWALD}>
            {selected || "The fronts"}
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {live && (live.order || live.stats) ? (
        <div className="absolute z-10 flex flex-col gap-2 overflow-y-auto"
          style={{
            right: GAP_PX,
            top: wide ? GAP_PX : 52,
            width: `min(20rem, calc(100% - ${2 * GAP_PX}px))`,
            maxHeight: `calc(100% - ${2 * GAP_PX + 84}px)`,
          }}>
          <MajorOrder order={live.order} fronts={FRONTS}
            open={orderOpen === null ? wide : orderOpen} onToggle={() => setOrderOpen(!(orderOpen === null ? wide : orderOpen))} />
          <WarTotals stats={live.stats} open={totalsOpen === null ? wide : totalsOpen}
            onToggle={() => setTotalsOpen(!(totalsOpen === null ? wide : totalsOpen))}
            trend={trend.status === "ok" && trend.data.points.length > 1 ? <PlayersOverTime trend={trend.data} /> : null} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The fronts                                                          */
/* ------------------------------------------------------------------ */

function PanelHead({ title, onFold, children }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-base-800 px-3 py-2.5">
      <div className="min-w-0">{children || <p className="text-sm font-bold text-base-100" style={OSWALD}>{title}</p>}</div>
      <button type="button" onClick={onFold} title="Fold away" aria-label="Fold the panel away"
        className="shrink-0 rounded border border-base-800 p-1 text-base-400 hover:border-base-600 hover:text-base-100">
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

/* Every front you can drop on, grouped by who you would fight there,
   busiest first, the way the game lists its campaigns. */
function Fronts({ war, live, query, setQuery, onSelect, onFold }) {
  const groups = useMemo(() => {
    if (!live) return [];
    const all = [...live.planets.entries()].filter(([, w]) => w.campaign && w.front);
    return FACTIONS.map((f) => {
      const rows = all.filter(([, w]) => w.front === f.id).sort((a, b) => b[1].players - a[1].players);
      return { f, rows, players: rows.reduce((n, [, w]) => n + w.players, 0) };
    }).filter((g) => g.rows.length);
  }, [live]);

  return (
    <>
      <PanelHead title="The fronts" onFold={onFold} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        <PlanetSearch query={query} setQuery={setQuery} war={war} chosen={null} onChoose={(name) => { onSelect(name); setQuery(""); }} />
        {groups.length ? groups.map(({ f, rows, players }) => (
          <section key={f.id} className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 border-b pb-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ ...OSWALD, color: f.hex, borderColor: f.hex + "44" }}>
              <f.Icon className="h-4 w-4" />
              {f.label}
              <span className="ml-auto font-normal normal-case tracking-normal text-base-500">
                {rows.length} {rows.length === 1 ? "front" : "fronts"}, {players.toLocaleString("en-GB")} Helldivers
              </span>
            </p>
            {rows.map(([name, w]) => {
              const st = stateOf(w);
              const table = planetByName.get(name);
              return (
                <button key={name} type="button" onClick={() => onSelect(name)}
                  className="flex flex-col gap-1 rounded border border-base-800 px-2.5 py-1.5 text-left transition-colors hover:border-base-600 hover:bg-base-800/50">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-bold text-base-100" style={OSWALD}>
                      {w.defence ? <span className="mr-1.5 text-accent-300">Defend</span> : null}{name}
                    </span>
                    <span className="shrink-0 text-[10px] text-base-500">{w.players ? w.players.toLocaleString("en-GB") : "nobody yet"}</span>
                  </span>
                  <span className="truncate text-[10px] text-base-500">
                    {[table && table.sector ? table.sector + " sector" : null, table ? biomeName(table.biome) : null].filter(Boolean).join(" · ")}
                  </span>
                  {st.share !== null ? <Bar share={st.share} hex={f.hex} /> : null}
                </button>
              );
            })}
          </section>
        )) : (
          <p className="text-xs leading-relaxed text-base-500">
            {war && !war.fresh
              ? "The live war was read too long ago to list its fronts. The map still works: click a sector, then a planet, to read about it."
              : "The fronts come from the tool's own server, and this address does not have one, or it has not read the war yet. The map still works: click a sector, then a planet, to read about it."}
          </p>
        )}
        <WarLine war={war} />
      </div>
    </>
  );
}

function Bar({ share, hex }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: (hex || "#94a3b8") + "40" }}>
        <span className="block h-full rounded-full bg-[#60a5fa]" style={{ width: pct(share) }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-base-400">{pct(share)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* One planet                                                          */
/* ------------------------------------------------------------------ */

const CITY_WORDS = [["megacity", "megacity", "megacities"], ["city", "city", "cities"], ["town", "town", "towns"], ["settlement", "settlement", "settlements"]];

function Intel({ name, war, onBack, onSelect, onDropHere, onFold }) {
  const p = planetByName.get(name);
  const w = war ? war.planets.get(name) : null;
  const st = stateOf(w);
  const art = planetArt(name);
  const history = useWarHistory(name);
  if (!p) return null;
  const biome = p.biome ? biomeInfo[p.biome] : null;
  const hazards = loudHazards(p.hazards);
  const cities = p.cities ? CITY_WORDS.filter(([k]) => p.cities[k]).map(([k, one, many]) => `${p.cities[k]} ${p.cities[k] === 1 ? one : many}`) : [];

  return (
    <>
      <PanelHead onFold={onFold}>
        <button type="button" onClick={onBack}
          className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-base-400 hover:text-base-100" style={OSWALD}>
          <ChevronLeft className="h-3.5 w-3.5" /> All fronts
        </button>
      </PanelHead>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 text-left">
        <div className="flex items-center gap-3">
          {art ? <img src={art} alt="" className="h-20 w-20 shrink-0" /> : null}
          <div className="min-w-0">
            <p className="text-lg font-bold uppercase leading-tight tracking-wide text-base-100" style={OSWALD}>{p.name}</p>
            <p className="text-[11px] text-base-500">
              {[p.sector ? p.sector + " sector" : "No sector", biome ? biome.name : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {/* Now */}
        <div className="flex flex-col gap-1.5 rounded border border-base-800 bg-base-900/60 px-3 py-2"
          style={st.hex ? { boxShadow: `inset 3px 0 0 ${st.hex}` } : undefined}>
          <p className="text-xs leading-relaxed" style={st.hex ? { color: st.hex } : undefined}>
            {war ? st.text : "The live war is not here, so this says what the planet is rather than who holds it."}
          </p>
          {war && st.share !== null ? <Bar share={st.share} hex={st.hex} /> : null}
          {w && w.players ? (
            <p className="flex items-center gap-1.5 text-[11px] text-base-400">
              <Users className="h-3.5 w-3.5" /> {w.players.toLocaleString("en-GB")} Helldivers here now
            </p>
          ) : null}
        </div>

        <button type="button" onClick={onDropHere}
          className="flex items-center justify-center gap-2 rounded border border-brand bg-brand px-3 py-2 text-sm font-bold uppercase tracking-wide text-brand-ink hover:brightness-110"
          style={OSWALD}>
          <MapPin className="h-4 w-4" /> Drop here
        </button>
        <p className="-mt-2.5 text-[10px] text-base-600">
          Sets where you are dropping to {p.name}{w && w.front ? `, against the ${FRONTS[w.front].label}` : ""}, and opens Drop Bay.
        </p>

        {/* Over time */}
        <Section title="Over time">
          <PlanetHistory history={history} hex={st.hex} />
        </Section>

        {/* The planet itself */}
        <Section title="The planet">
          {biome && biome.description ? <p className="text-xs leading-relaxed text-base-400">{biome.description}</p> : null}
          {hazards.length ? hazards.map((h) => (
            <p key={h} className="text-xs leading-relaxed text-base-300">
              <span className="text-accent-300">{hazardName(h)}.</span> {hazardEffect(h)}
            </p>
          )) : <p className="text-xs text-base-500">Nothing permanent here changes what you bring.</p>}
          {cities.length ? <p className="text-[11px] text-base-500">Cities: {cities.join(", ")}.</p> : null}
        </Section>

        {p.links && p.links.length ? (
          <Section title="Supply lines">
            <div className="flex flex-wrap gap-1.5">
              {p.links.map((n) => {
                const lw = war ? war.planets.get(n) : null;
                const lf = lw && lw.front ? FRONTS[lw.front] : null;
                return (
                  <button key={n} type="button" onClick={() => onSelect(n)}
                    className="rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-300 hover:border-base-500 hover:text-base-100"
                    style={lf ? { borderColor: lf.hex + "88" } : undefined}>
                    {n}
                  </button>
                );
              })}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>{title}</p>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/* A thin line over time. `points` are `{ at, v }` with v from 0 to `max`,
   or null where there is nothing to draw; a gap of more than a few hours
   breaks the line too, since an hour missing means nothing was happening. */
function Spark({ points, max = 1, hex = "#60a5fa", height = 44 }) {
  const W = 300;
  if (!points.length) return null;
  const t0 = points[0].at;
  const t1 = points[points.length - 1].at;
  const x = (at) => (t1 === t0 ? W / 2 : ((at - t0) / (t1 - t0)) * W);
  const y = (v) => height - 2 - (Math.min(max, Math.max(0, v)) / (max || 1)) * (height - 4);
  let d = "";
  let prev = null;
  for (const p of points) {
    if (p.v === null) { prev = null; continue; }
    const jump = !prev || p.at - prev.at > 3 * 60 * 60 * 1000;
    d += `${jump ? "M" : "L"}${x(p.at).toFixed(1)} ${y(p.v).toFixed(1)}`;
    prev = p;
  }
  const lone = points.filter((p) => p.v !== null).length === 1;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={W} y1={height - 2} y2={height - 2} style={{ stroke: "rgb(var(--base-700))" }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {lone ? (
        points.filter((p) => p.v !== null).map((p) => <circle key={p.at} cx={x(p.at)} cy={y(p.v)} r="2.5" style={{ fill: hex }} />)
      ) : (
        <path d={d} fill="none" style={{ stroke: hex }} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function PlanetHistory({ history, hex }) {
  if (history.status === "loading") return <p className="text-[11px] text-base-600">Reading the history.</p>;
  if (history.status === "no-server") {
    return <p className="text-[11px] leading-relaxed text-base-500">History is kept by the tool's own server, and this address does not have one.</p>;
  }
  if (history.status !== "ok") {
    return (
      <p className="text-[11px] leading-relaxed text-base-500">
        {history.data
          ? `Nothing has happened here since the server started watching on ${dateText(history.data.from)}.`
          : "Nobody publishes the war's history, so the tool's server keeps its own, one reading an hour for thirty days, from the day it first runs. Nothing is kept yet."}
      </p>
    );
  }
  const { from, points } = history.data;
  const series = points.map((p) => ({ at: p.at, v: progressAt(p) }));
  const known = series.filter((p) => p.v !== null);
  const first = known[0];
  const last = known[known.length - 1];
  const verb = points[points.length - 1].defence ? "defended" : "liberated";
  return (
    <div className="flex flex-col gap-1">
      <Spark points={series} hex={hex || "#60a5fa"} />
      <p className="flex justify-between text-[10px] text-base-600">
        <span>{dateText(points[0].at)}</span>
        <span>{dateText(points[points.length - 1].at)}</span>
      </p>
      <p className="text-[11px] leading-relaxed text-base-400">
        {first && last && known.length > 1
          ? `From ${pct(first.v)} to ${pct(last.v)} ${verb}, over ${points.length} hourly readings.`
          : `${points.length === 1 ? "One reading" : `${points.length} readings`} so far.`}{" "}
        <span className="text-base-600">Watched since {dateText(from)}.</span>
      </p>
    </div>
  );
}

/* How many were fighting, hour by hour, for the war so far panel. */
function PlayersOverTime({ trend }) {
  const points = trend.points;
  const max = Math.max(...points.map((p) => p.players), 1);
  const now = points[points.length - 1];
  const peak = points.reduce((a, b) => (b.players > a.players ? b : a), points[0]);
  return (
    <div className="flex flex-col gap-1 pb-1">
      <p className="text-[10px] text-base-500">Helldivers in the war, hour by hour since {dateText(trend.from)}</p>
      <Spark points={points.map((p) => ({ at: p.at, v: p.players }))} max={max} hex="rgb(var(--brand))" />
      <p className="text-[10px] text-base-500">
        Peak {big(peak.players)} on {dateText(peak.at)}; {big(now.players)} at the last reading, {now.fronts} {now.fronts === 1 ? "front" : "fronts"} open.
      </p>
    </div>
  );
}
