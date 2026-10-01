/* ================================================================== */
/* THE DROP                                                           */
/*                                                                    */
/* The moment before the drop: who is bringing what, where you are    */
/* going, and what is going to hurt. Drop Bay itself since 1 October  */
/* 2026; the grid of every build moved to the Armoury that day.       */
/*                                                                    */
/* Two stages, because picking a loadout and reading the squad are    */
/* different activities and doing both in one view is what made the  */
/* old screen busy. The main screen says nothing about choosing.      */
/* Tapping your slot opens a picker over it, the pattern the builder  */
/* already uses, and you confirm what you chose.                      */
/*                                                                    */
/* Confirm is the point, not ceremony. A slot that silently mirrors   */
/* whatever you last touched cannot tell "still deciding" from "this  */
/* is what I am dropping with", and the squad checks are only worth   */
/* reading once the answer is the second one. So they count confirmed */
/* loadouts and nothing else. The curator's call, 27 September 2026.  */
/*                                                                    */
/* The squadmate slots are filled by hand, or by a live party from a  */
/* code since 1.25.0. squad.js is a pure function over a list of      */
/* builds and has never cared where they came from.                   */
/*                                                                    */
/* It opens onto the galaxy map while nothing says where you are      */
/* dropping: click the planet where you clicked it in the game and    */
/* the brief fills itself. The map folds away once you have chosen.   */
/*                                                                    */
/* Since 1 October 2026 this is the front door, the curator's call:   */
/* the page the tool opens on. It suggests from your own builds,      */
/* ranked for the drop. Adjusting a build opens the Armoury's editor  */
/* over this screen rather than taking you away, and the editor's     */
/* item list is the tier list, already ranked for where you are       */
/* going. How many of you are dropping is asked here, as seats, and   */
/* every Confirm is written to your drop history.                     */
/* ================================================================== */

import { useState, useEffect, useMemo, useCallback } from "react";
import Builder from "./Builder.jsx";
import {
  Users, Check, ChevronLeft, X, Search, Plus, Lock, Star, Snowflake, FilterX, AlertTriangle, Info,
  Pencil, Rocket, UserPlus, RotateCcw, Flag, MapPin, Copy, LogOut, Crown, Radio, Loader2, Sparkles, ArrowUp,
} from "lucide-react";

import { FACTIONS, FACTION_THEME, TierBadge, StratChip, difficultyAt, DropPlanner } from "./Tiers.jsx";
import { presets, heldGear } from "./lib/loadouts.js";
import { readBuild } from "./lib/build.js";
import { itemName } from "./lib/items.js";
import { squadWarnings, isQuietBand, coverageIsQuiet } from "./lib/squad.js";
import { missionByName, missionTraits, hazardName, hazardEffect, biomeName, loudHazards, usePlannerPrefs } from "./lib/scenario.js";
import { SETTINGS, readDoc, writeDoc } from "./lib/storage.js";
import {
  EMPTY_DROP, cleanDrop, readDrop, stampOf, dropPool, dropContext, withHeat, gateOf, unpackBuild,
  rankByReading, suggestBuilds, whyFor, forAChange, untriedHere,
} from "./lib/drop.js";
import { SQUAD_CAP } from "./lib/party.js";
import { entryFor, TAKE_BACK_MS, daysSince } from "./lib/history.js";
import { agoText } from "./lib/war.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

/* Read after mount rather than in the initialiser, the same shape the
   scenario uses, so nothing touches localStorage during render. Owned by
   the shell rather than this screen since the party arrived: what you
   confirmed has to reach the party even while you are in the builder. */
export function useDrop() {
  const [drop, setDrop] = useState(EMPTY_DROP);
  useEffect(() => { setDrop(cleanDrop(readDoc(SETTINGS.drop))); }, []);
  const update = useCallback((change) => {
    setDrop((d) => {
      const next = change(d);
      writeDoc(SETTINGS.drop, next);
      return next;
    });
  }, []);
  return [drop, update];
}

/* ------------------------------------------------------------------ */
/* The brief                                                           */
/*                                                                     */
/* What the mission asks for and what the planet does, from the tables */
/* the tool already ships. Every line here is sourced: the mission     */
/* lines are the ones the scenario screen shows, and the hazard lines   */
/* are the dataset's own descriptions. Nothing is invented for flavour. */
/* ------------------------------------------------------------------ */

/* `onMap` opens the galaxy map, and is null when you may not choose:
   in a party the host sets the scenario, so a squadmate's brief says so
   instead. */
function Brief({ scenario, onMap, hostPicks }) {
  const mission = scenario.mission ? missionByName.get(scenario.mission) : null;
  const lines = mission ? mission.traits.map((t) => missionTraits[t]).filter(Boolean) : [];
  const hazards = loudHazards(scenario.hazards);
  const place = scenario.planet || (scenario.biome ? biomeName(scenario.biome) : null);

  if (!mission && !place) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-base-700 px-4 py-3 text-xs text-base-500">
        <span className="flex-1">
          {hostPicks
            ? "No mission and no planet yet. The host sets those, and this says what they will ask of you once they do."
            : "No mission and no planet yet. Choose them and this says what the mission asks for and what the planet does to you."}
        </span>
        {onMap ? <SlotButton onClick={onMap} Icon={MapPin}>Choose the planet on the map</SlotButton> : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-base-800 bg-base-900/60 p-4 md:grid-cols-2">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>
          <Flag className="h-3.5 w-3.5" /> {mission ? mission.name : "Any mission"}
        </p>
        {lines.length ? (
          <div className="flex flex-col gap-1.5">
            {lines.map((t) => (
              <p key={t.name} className="text-xs leading-relaxed text-base-300">
                <span className="text-base-500">{t.name}. </span>{t.line}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-base-500">No mission chosen, so nothing here is keyed to one.</p>
        )}
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>
          <MapPin className="h-3.5 w-3.5" /> {place || "Any planet"}
          {onMap ? (
            <button onClick={onMap}
              className="ml-auto text-[10px] font-normal normal-case tracking-normal text-base-500 underline hover:text-base-200">
              {scenario.planet ? "change on the map" : "choose on the map"}
            </button>
          ) : null}
        </p>
        {hazards.length ? (
          <div className="flex flex-col gap-1.5">
            {hazards.map((h) => (
              <p key={h} className="text-xs leading-relaxed text-base-300">
                <span className="text-base-500">{hazardName(h)}. </span>{hazardEffect(h)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-base-500">
            {place ? "Nothing permanent on this planet changes what you should bring." : "No planet chosen."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A slot                                                              */
/* ------------------------------------------------------------------ */

/* A squadmate's slot never shows your locks: your collection says nothing
   about what they own. One empty set, rather than a new one per render. */
const NO_LOCKS = new Set();

const GEAR_ROWS = [["Primary", "primary"], ["Secondary", "secondary"], ["Grenade", "grenade"], ["Armor", "armor"], ["Booster", "booster"]];

function Status({ state }) {
  if (state === "confirmed") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded border border-emerald-700/60 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400" style={OSWALD}>
        <Check className="h-3 w-3" strokeWidth={3} /> Confirmed
      </span>
    );
  }
  if (state === "deciding") {
    return (
      <span className="shrink-0 rounded border border-dashed border-base-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
        Still deciding
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded border border-base-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-base-500" style={OSWALD}>
      Filled by hand
    </span>
  );
}

function SlotButton({ onClick, Icon, children, primary, danger }) {
  return (
    <button onClick={onClick}
      className={"flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors " +
        (primary ? "border-base-200 bg-base-200 text-base-900 hover:bg-base-100"
          : danger ? "border-base-700 text-base-400 hover:border-red-600 hover:text-red-400"
            : "border-base-700 text-base-300 hover:border-base-500 hover:text-base-100")}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

/* `onStart` is set when you have no builds of your own yet: the first
   thing you see is then the list itself, already ranked for this drop,
   rather than an empty picker. `seated` means the seat is part of the
   squad you said, build known or not. */
function EmptySlot({ mine, label, onChoose, onStart, seated }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-base-700 px-4 py-5 text-center sm:min-h-[18rem] sm:py-6">
      {mine ? <Rocket className="h-6 w-6 text-base-600" /> : <UserPlus className="h-6 w-6 text-base-600" />}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>{label}</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-base-500">
          {mine
            ? onStart
              ? "You have no builds yet. Start one here: pick a primary, and the list is already ranked for this drop."
              : "Choose what you are dropping with, then confirm it."
            : seated
              ? "Coming, build not known. Add theirs if they told you, or open a party above and they fill it in themselves."
              : "Pick the build they told you they are bringing, or open a party above and they fill this in themselves."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {mine && onStart ? <SlotButton onClick={onStart} Icon={Plus} primary>Pick a primary</SlotButton> : null}
        <SlotButton onClick={onChoose} Icon={mine ? Rocket : Plus} primary={mine && !onStart}>
          {mine ? (onStart ? "Choose a preset" : "Choose a loadout") : "Add their build"}
        </SlotButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How many of you                                                     */
/*                                                                     */
/* Asked here as seats, the curator's point of 1 October 2026: the     */
/* drop screen is where you know. A seat with no build in it is still  */
/* a squadmate, somebody whose kit you do not know, which is how a      */
/* game with three randoms reads. Not said is a real answer too, and    */
/* the rules that depend on squad size stay quiet for it rather than    */
/* assuming you are alone. One value with the scenario screen's, so     */
/* the tier list and the readings follow.                               */
/* ------------------------------------------------------------------ */

function Seats({ value, onChange }) {
  const n = Number(value) || 0;
  const options = [[0, "Not said"], [1, "Solo"], [2, "2"], [3, "3"], [4, "4"]];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>
        Dropping with
      </span>
      <div className="flex gap-1">
        {options.map(([k, label]) => (
          <button key={k} onClick={() => onChange(k)} aria-pressed={n === k}
            className={"rounded border px-2.5 py-1 text-[11px] transition-colors " +
              (n === k
                ? k ? "border-brand bg-brand/10 text-base-100" : "border-base-500 bg-base-800 text-base-100"
                : "border-base-700 bg-base-900 text-base-500 hover:border-base-500 hover:text-base-200")}>
            {label}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-base-600">
        {n === 1
          ? "Just you. Nobody covers your reload."
          : n
            ? `${n} of you. An empty seat is a squadmate whose build you do not know.`
            : "Say how many of you are going and every reading here scales to it."}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Suggested for this drop                                             */
/*                                                                     */
/* The curator's call, 1 October 2026: Drop Bay suggests from your own  */
/* builds. Three, ranked by the same reading every badge shows, each    */
/* with why in a rule's own words. Nothing is hidden by it: the picker  */
/* still lists everything that fits, ranked the same way.              */
/* ------------------------------------------------------------------ */

function usageLine(usage) {
  if (!usage || !usage.count) return null;
  const when = agoText(Date.now() - Date.parse(usage.last));
  return `Dropped with ${usage.count === 1 ? "once" : `${usage.count} times`}, last ${when}`;
}

/* Why nothing was suggested, from what the gates took out. */
function nothingFits(cut) {
  const c = cut || {};
  const bits = [
    c.band ? `${c.band} built for other difficulties` : null,
    c.heat ? `${c.heat} vent${c.heat === 1 ? "s" : ""} heat on a hot planet` : null,
    c.biome ? `${c.biome} built for other terrain` : null,
    c.locked ? `${c.locked} need${c.locked === 1 ? "s" : ""} gear you have not unlocked` : null,
  ].filter(Boolean);
  return bits.length ? `Ruled out for this drop: ${bits.join(", ")}.` : "Nothing is built for this front yet.";
}

/* How long since, the way a person says it, for "for a change". */
function sinceLine(usage) {
  const days = daysSince(usage);
  if (days === null) return "Never dropped with";
  if (days < 60) return `Not dropped with in ${Math.max(1, Math.round(days / 7))} weeks`;
  return `Not dropped with in ${Math.round(days / 30)} months`;
}

function SuggestionCard({ build, reading, usage, fromPresets, on, onTake, change }) {
  const why = whyFor(reading);
  const held = heldGear(build).map((it) => it.name);
  return (
    <div className={"flex flex-col gap-2 rounded border p-3 " +
      (on ? "border-base-500 bg-base-800/60" : change ? "border-dashed border-brand/50 bg-base-900" : "border-base-800 bg-base-900")}>
      {change ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand" style={OSWALD}>For a change</p>
      ) : null}
      <div className="flex items-start gap-2">
        {reading.tier ? <TierBadge tier={reading.tier} className="h-auto w-8 shrink-0" /> : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-base-100" style={OSWALD}>{build.name}</p>
          <p className="truncate text-[11px] text-base-500" style={MONO}>{held.join(" · ")}</p>
        </div>
      </div>
      {why ? (
        <p className={"flex items-start gap-1.5 text-[11px] leading-relaxed " + (why.tone === "up" ? "text-emerald-300" : "text-accent-300")}>
          {why.tone === "up" ? <ArrowUp className="mt-px h-3 w-3 shrink-0" /> : <AlertTriangle className="mt-px h-3 w-3 shrink-0" />}
          <span>{why.item ? <span className="text-base-300">{why.item}. </span> : null}{why.text}</span>
        </p>
      ) : (
        <p className="text-[11px] text-base-500">Nothing about this drop moves it. It is what its gear is worth anywhere.</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="min-w-0 text-[10px] leading-snug text-base-600">
          {change ? sinceLine(usage) : usageLine(usage) || (fromPresets ? "Curated preset" : "Not dropped with yet")}
        </span>
        {on ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-base-400" style={OSWALD}>In your slot</span>
        ) : (
          <span className="shrink-0"><SlotButton onClick={() => onTake(build.id)} Icon={Rocket}>Take it</SlotButton></span>
        )}
      </div>
    </div>
  );
}

function Suggestions({ picks, fromPresets, current, onTake, cut, onStart, change, untried, frontLabel, onBuildAround }) {
  /* Nothing to suggest is an answer too, and it says what to do next
     rather than leaving a gap where the panel was. */
  if (!picks.length) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-base-700 bg-base-900/40 px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-base-600" />
        <div className="min-w-[14rem] flex-1">
          <p className="text-xs text-base-300">Nothing to suggest for this drop.</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-500">{nothingFits(cut)} The picker can still show them.</p>
        </div>
        <SlotButton onClick={onStart} Icon={Plus} primary>Start a build for this drop</SlotButton>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
        <Sparkles className="h-3.5 w-3.5 text-brand" /> Suggested for this drop
      </p>
      <p className="mb-3 text-[11px] text-base-500">
        {fromPresets
          ? "From the curated presets, until you have builds of your own that fit. Ranked by what each is worth here."
          : "From your builds, ranked by what each is worth here. Everything that fits is in the picker too."}
      </p>
      <div className={"grid grid-cols-1 gap-2 " + (change ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {picks.map(({ build, reading, usage }) => (
          <SuggestionCard key={build.id} build={build} reading={reading} usage={usage} fromPresets={fromPresets}
            on={build.id === current} onTake={onTake} />
        ))}
        {change ? (
          <SuggestionCard build={change.build} reading={change.reading} usage={change.usage}
            on={change.build.id === current} onTake={onTake} change />
        ) : null}
      </div>
      {/* The curator's "you never dropped with a Railgun against bots":
          gear that is good here, that you own, and that your history says
          you have never brought against this front. */}
      {untried && untried.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-base-800 pt-3">
          <span className="text-[11px] text-base-400">Never brought against {frontLabel}, and good here:</span>
          {untried.map(({ item, read }) => (
            <span key={item.id} className="flex items-center gap-1.5 rounded border border-base-700 bg-base-900 py-1 pl-1.5 pr-1">
              <TierBadge tier={read.tier} className="h-auto w-5" />
              <span className="text-[11px] text-base-200" style={MONO}>{item.name}</span>
              <button onClick={() => onBuildAround(item.id)}
                className="rounded px-1.5 py-0.5 text-[10px] text-base-400 hover:bg-base-800 hover:text-base-100">
                Build around it
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* What a slot says when the scenario has moved under it. The picker would
   not offer this build now; the slot keeps it, because it is still what
   somebody chose, and says why rather than quietly holding it. Heat is
   the loud one, since a hot planet ruling out a heat build is a locked
   decision rather than a nudge. */
const GATE_NOTE = {
  heat: { tone: "amber", text: "Vents heat, and this planet is hot. The picker would not offer it for this drop." },
  band: { tone: "grey", text: "Built for a different difficulty than this drop." },
  biome: { tone: "grey", text: "Built for different terrain than this planet." },
};

function FilledSlot({ label, build, state, scenario, lockedSet, actions, source }) {
  const theme = FACTION_THEME[build.faction] || FACTION_THEME.all;
  const reading = useMemo(() => readBuild(build, scenario), [build, scenario]);
  const gate = build.faction === scenario.faction ? gateOf(build, scenario) : null;

  return (
    <div className={"flex flex-col overflow-hidden rounded-lg border bg-base-900 " +
      (state === "deciding" ? "border-dashed border-base-600" : "border-base-800")}>
      <div className="h-1 w-full" style={{ backgroundColor: theme.hex, opacity: state === "deciding" ? 0.4 : 1 }} />
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-base-500">{label}</p>
            <h3 className={`text-base font-bold leading-tight ${theme.text}`} style={OSWALD}>{build.name}</h3>
            <p className="text-[10px] text-base-600">{build.preset ? "Curated preset" : source || "Yours"}</p>
          </div>
          <Status state={state} />
        </div>

        {reading && reading.score !== null ? (
          <div className="flex items-center gap-2 text-[11px] text-base-500">
            <TierBadge tier={reading.tier} className="h-auto w-7" />
            <span>
              as a build for this drop
              {reading.tier !== reading.partsTier ? <>, from gear worth {reading.partsTier}</> : null}
            </span>
          </div>
        ) : null}

        {gate ? (
          <div className={"flex items-start gap-1.5 rounded border px-2 py-1.5 text-[11px] leading-relaxed " +
            (GATE_NOTE[gate].tone === "amber" ? "border-accent-800/60 bg-accent-950/40 text-accent-300" : "border-base-700 bg-base-800/60 text-base-400")}>
            <FilterX className="mt-px h-3.5 w-3.5 shrink-0" /><span>{GATE_NOTE[gate].text}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1 border-t border-base-800 pt-2.5">
          {GEAR_ROWS.map(([rowLabel, key]) => {
            const id = build[key];
            const locked = Boolean(id) && lockedSet.has(id);
            return (
              <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="shrink-0 text-base-500">{rowLabel}</span>
                {id ? (
                  <span className={"truncate text-right " + (locked ? "text-base-500 line-through" : "text-base-200")} style={MONO}>
                    {itemName(id)}
                  </span>
                ) : <span className="text-base-600">empty</span>}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {build.strats.map((s, i) =>
            s ? <StratChip key={`${i}-${s}`} id={s} isLocked={lockedSet.has(s)} />
              : <div key={`${i}-empty`} className="rounded bg-base-800/40 px-1.5 py-1.5 text-[10px] text-base-600">empty</div>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-base-800 pt-2.5">{actions}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Party slots                                                         */
/* ------------------------------------------------------------------ */

function MemberLabel({ member, isHost }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (member.online ? "bg-emerald-400" : "bg-base-600")}
        title={member.online ? "Connected" : "Not connected right now"} />
      <span className="truncate">{member.name}</span>
      {isHost ? <Crown className="h-3 w-3 shrink-0 text-brand" aria-label="Host" /> : null}
      {member.online ? null : <span className="normal-case tracking-normal text-base-600">offline</span>}
    </span>
  );
}

/* Somebody in the party who has not confirmed. "Still deciding" and
   nothing else: the curator's call, and the server never even holds what
   they are looking at, so there is nothing else to show. */
function DecidingSlot({ member, isHost, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-base-600 px-4 py-5 text-center sm:min-h-[18rem] sm:py-6">
      <Loader2 className="h-6 w-6 animate-spin text-base-600 motion-reduce:animate-none" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
        <MemberLabel member={member} isHost={isHost} />
      </div>
      <Status state="deciding" />
      {action}
    </div>
  );
}

/* An empty seat in a party. The code is right there, because the next
   thing anybody does with an empty seat is read the code out. */
function WaitingSlot({ code }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-base-800 px-4 py-5 text-center sm:min-h-[18rem] sm:py-6">
      <UserPlus className="h-6 w-6 text-base-700" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-600" style={OSWALD}>Open seat</p>
      <p className="max-w-[14rem] text-xs leading-relaxed text-base-600">
        Waiting for a squadmate. The code is <span className="text-base-300" style={MONO}>{code}</span>.
      </p>
    </div>
  );
}

/* Removing somebody takes two presses. One would be a misclick away from
   throwing a friend out of the room mid planning. */
function RemoveButton({ name, onRemove }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <span className="flex flex-wrap gap-1.5">
      <SlotButton danger onClick={onRemove} Icon={X}>Remove {name}</SlotButton>
      <SlotButton onClick={() => setSure(false)}>Keep</SlotButton>
    </span>
  ) : (
    <SlotButton danger onClick={() => setSure(true)} Icon={X}>Remove from party</SlotButton>
  );
}

/* ------------------------------------------------------------------ */
/* The party panel                                                     */
/*                                                                     */
/* Squad up with a code. No account, by the curator's call: open a     */
/* party, read the six characters out, and whoever types them in is   */
/* in. The host sets the scenario and everybody else follows it.       */
/* ------------------------------------------------------------------ */

const STATUS_LINE = {
  opening: "Opening a party",
  connecting: "Joining",
  reconnecting: "Connection lost. Reconnecting",
};

function PartyPanel({ party, sync }) {
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const inParty = Boolean(party.code);
  const busy = party.status === "opening" || party.status === "connecting";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(party.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* No clipboard here. The code is on screen to read out anyway. */
    }
  };

  if (!inParty) {
    return (
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
              <Radio className="h-3.5 w-3.5" /> Squad up
            </p>
            <p className="mt-1 text-xs leading-relaxed text-base-500">
              Open a party and read its code out, or type the code a friend gave you. Everybody's confirmed loadout lands
              in their slot here. No account needed.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-base-500">Your name</span>
            <input value={party.name} onChange={(e) => party.setName(e.target.value)} placeholder="Helldiver" maxLength={24}
              className="w-36 rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
          </label>
          <SlotButton primary onClick={party.open} Icon={busy ? Loader2 : Radio}>
            {party.status === "opening" ? "Opening" : "Open a party"}
          </SlotButton>
          <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); party.join(typed); }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="CODE" maxLength={9} aria-label="Party code"
              autoCapitalize="characters" spellCheck={false}
              className="w-24 rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs uppercase tracking-widest text-base-100 placeholder-base-600 outline-none focus:border-base-500"
              style={MONO} />
            <button type="submit"
              className="rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
              Join
            </button>
          </form>
        </div>
        {party.problem ? (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-accent-400">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /><span className="flex-1">{party.problem}</span>
            <button onClick={party.dismiss} aria-label="Dismiss" className="text-base-500 hover:text-base-200"><X className="h-3.5 w-3.5" /></button>
          </p>
        ) : null}
      </div>
    );
  }

  const count = party.state ? party.state.members.length : 0;
  const line = party.status === "live"
    ? `${count} of ${SQUAD_CAP}. ` + (party.isHost
      ? "You are the host, so the scenario is yours to set."
      : party.host ? `Following ${party.host.name}'s scenario.` : "")
    : `${STATUS_LINE[party.status] || "Connecting"}...`;

  return (
    <div className="rounded-lg border border-base-700 bg-base-900/80 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
          <Radio className={"h-3.5 w-3.5 " + (party.status === "live" ? "text-emerald-400" : "text-accent-400")} /> Party
        </span>
        <span className="text-2xl font-bold tracking-[0.25em] text-base-100" style={MONO}>{party.code}</span>
        <SlotButton onClick={copy} Icon={copied ? Check : Copy}>{copied ? "Copied" : "Copy code"}</SlotButton>
        <span className="text-xs text-base-500">{line}</span>
        <span className="ml-auto">
          <SlotButton danger onClick={party.leave} Icon={LogOut}>Leave</SlotButton>
        </span>
      </div>
      {sync.drifted ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-accent-400">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Your scenario differs from the host's, so what you see here may not match their screen.
          <button onClick={sync.follow} className="underline hover:text-accent-300">Follow the party</button>
        </p>
      ) : null}
      {party.notice ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-base-400">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" /><span className="flex-1">{party.notice}</span>
          <button onClick={party.dismiss} aria-label="Dismiss" className="text-base-500 hover:text-base-200"><X className="h-3.5 w-3.5" /></button>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The picker                                                          */
/*                                                                     */
/* Over the whole screen, like the builder's. Offers only what the     */
/* scenario allows, with the reason anything was left out said in one  */
/* line, because a list that silently shrinks reads as a bug.          */
/* ------------------------------------------------------------------ */

function BuildPicker({ title, forMine, everything, scenario, state, current, onPick, onClose, onNew }) {
  const [query, setQuery] = useState("");
  /* Hidden by default in your own slot, the builder's precedent: you are
     choosing what to actually drop with. Never applied to a squadmate's
     slot, because your lock list says nothing about what they own. */
  const [showLocked, setShowLocked] = useState(!forMine);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { shown, cut, cold } = useMemo(
    () => dropPool(everything, scenario, {
      lockedSet: forMine ? state.lockedSet : new Set(),
      favorites: state.favorites,
      showLocked,
      query,
    }),
    [everything, scenario, forMine, state.lockedSet, state.favorites, showLocked, query]
  );

  /* Ranked by the reading, favourites first: the order the suggestions
     use, so the top of this list and the suggestions above it agree. */
  const ranked = useMemo(
    () => rankByReading(shown, scenario, state.favorites),
    [shown, scenario, state.favorites]
  );
  const readings = useMemo(() => new Map(ranked.map((r) => [r.build.id, r.reading])), [ranked]);

  const faction = FACTIONS.find((f) => f.id === scenario.faction) || FACTIONS[0];
  const d = difficultyAt(scenario.difficulty);
  const favSet = new Set(state.favorites);
  const reasons = [
    cut.heat ? `${cut.heat} heat venting build${cut.heat === 1 ? "" : "s"} left out, hot planet` : null,
    cut.band ? `${cut.band} built for other difficulties` : null,
    cut.biome ? `${cut.biome} built for other terrain` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-950">
      <div className="flex items-center gap-3 border-b border-base-800 px-4 py-3">
        <button onClick={onClose} aria-label="Close picker"
          className="rounded p-1.5 text-base-400 hover:bg-base-800 hover:text-base-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight" style={OSWALD}>{title}</h2>
          <p className="text-[11px]" style={{ color: faction.hex }}>
            For {faction.label}{d ? `, ${d.name}` : ""}{scenario.planet ? `, on ${scenario.planet}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {forMine ? (
            <button onClick={onNew}
              className="flex items-center gap-1.5 rounded border border-base-700 px-2.5 py-1 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
              <Plus className="h-3.5 w-3.5" /> New loadout
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
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your builds and the presets"
            className="w-full rounded border border-base-700 bg-base-900 py-1.5 pl-7 pr-2 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
        </div>
        {forMine && (cut.locked > 0 || showLocked) ? (
          <button onClick={() => setShowLocked((v) => !v)} aria-pressed={showLocked}
            className={"rounded border px-2.5 py-1.5 text-xs transition-colors " +
              (showLocked
                ? "border-accent-500 bg-accent-500 text-accent-950"
                : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
            <Lock className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" />
            {showLocked ? "Showing builds that need locked gear" : `${cut.locked} need gear you have not unlocked`}
          </button>
        ) : null}
        <span className="text-[11px] text-base-500">{shown.length} to choose from</span>
      </div>

      {reasons.length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-base-800 px-4 py-2 text-[11px] text-accent-500">
          <FilterX className="h-3.5 w-3.5" />{reasons.join(". ")}.
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4">
        {shown.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-dashed border-base-700 px-4 py-10 text-center">
            <p className="text-sm text-base-400">Nothing fits this drop.</p>
            <p className="mt-1 text-xs text-base-600">
              {query
                ? "Nothing matches that search. Clear it to see everything that fits."
                : cut.locked > 0 && !showLocked
                  ? "Everything that fits needs gear you have not unlocked. Show those builds, or open Collection to fix what you own."
                  : forMine
                    ? "No build for this front survives the scenario. Start one for it, or loosen the scenario above."
                    : "No build for this front survives the scenario. Loosen the scenario above, or build theirs in the Armoury first."}
            </p>
            {forMine && !query ? (
              <button onClick={onNew}
                className="mx-auto mt-3 flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-1.5 text-xs text-base-900 hover:bg-base-100">
                <Plus className="h-3.5 w-3.5" /> New loadout
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {ranked.map(({ build: l }) => {
              const reading = readings.get(l.id);
              /* What you carry: both guns, the support weapon and the pack.
                 The call-ins are in the slot once chosen; here they would
                 push the part that defines a build off the end of the line. */
              const held = heldGear(l).map((it) => it.name);
              return (
                <button key={l.id} onClick={() => onPick(l.id)}
                  className={"flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors " +
                    (l.id === current ? "border-base-400 bg-base-800" : "border-base-800 bg-base-900 hover:border-base-600")}>
                  {reading && reading.tier ? <TierBadge tier={reading.tier} className="h-auto w-8" /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {favSet.has(l.id) ? <Star className="h-3.5 w-3.5 shrink-0 fill-accent-400 text-accent-400" /> : null}
                      <span className="truncate text-sm font-bold text-base-100" style={OSWALD}>{l.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-base-500">{l.preset ? "Preset" : "Yours"}</span>
                    </div>
                    <p className="truncate text-[11px] text-base-500" style={MONO}>{held.join(" · ")}</p>
                  </div>
                  {l.needsLocked ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-accent-500">
                      <Lock className="h-3 w-3" /> locked gear
                    </span>
                  ) : null}
                  {cold && l.heat ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-sky-400">
                      <Snowflake className="h-3 w-3" /> runs longer here
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The squad, read                                                     */
/* ------------------------------------------------------------------ */

/* Three words for three levels of "this is going to hurt", with their
   plurals written out rather than guessed at, because "2 criticals" is
   not a phrase. Moved here from the grid, which no longer compares. */
const SEVERITY = {
  red: { Icon: AlertTriangle, box: "border-red-800/70 bg-red-950/40", text: "text-red-300" },
  amber: { Icon: AlertTriangle, box: "border-accent-800/60 bg-accent-950/40", text: "text-accent-300" },
  grey: { Icon: Info, box: "border-base-700 bg-base-900", text: "text-base-400" },
};

function SquadReadout({ counted, context, waitingOnYou, mineUncounted, inParty }) {
  const size = counted.length;
  const warnings = useMemo(() => squadWarnings(counted, context), [counted, context]);

  let body;
  if (size < 2) {
    body = (
      <p className="text-xs text-base-500">
        {waitingOnYou
          ? "Confirm your loadout and this starts reading the squad. It only counts what somebody has committed to, so a half picked kit never sets off a false alarm."
          : size === 1
            ? inParty
              ? "One loadout is a loadout, not a squad. This starts reading the squad once somebody else confirms."
              : "One loadout is a loadout, not a squad. Add a squadmate's build and this starts checking what the two of you are missing."
            : inParty
              ? "Nobody has confirmed anything yet. It fills in as each of you confirms."
              : "Nobody has confirmed anything yet. Choose yours, confirm it, and add your squad."}
      </p>
    );
  } else if (coverageIsQuiet(context.level, size) ?? isQuietBand(context.difficulty)) {
    /* Never claim coverage here. The checks are switched off, which is
       not the same as the squad being fine. */
    body = (
      <p className="text-xs text-base-500">
        Coverage checks are off for a drop this easy. Everything behind them assumes real pressure, and under it the
        gaps stop mattering.{warnings.length ? " What is left below is about overlap, which matters at any level." : ""}
      </p>
    );
  } else if (warnings.length === 0) {
    body = <p className="text-xs text-base-500">Nothing worth flagging. Anti-tank and hole closing are covered for this drop.</p>;
  }

  return (
    <div className="rounded-lg border border-base-700 bg-base-900/95 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400" style={OSWALD}>
        <Users className="h-3.5 w-3.5" /> {size < 2 ? "The squad" : `Squad of ${size}`}
      </p>
      {body}
      {size >= 2 && mineUncounted ? (
        <p className="mt-2 text-xs text-base-500">Yours is not in this yet. It counts once you confirm it.</p>
      ) : null}
      {size >= 2 && warnings.length ? (
        <div className={"flex flex-col gap-1.5 " + (body ? "mt-2" : "")}>
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
      ) : null}
      <p className="mt-3 text-[10px] leading-relaxed text-base-600">
        {inParty
          ? "Advisory only. Counts confirmed loadouts only, the same on every screen in the party. Role tags are our own call, not a community vote."
          : "Advisory only. Counts confirmed loadouts and the ones you filled in by hand. Role tags are our own call, not a community vote."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function DropScreen({ state, navigate, scenario, setFaction, setPlanet, setSquad, drop, update, party, sync }) {
  /* Which slot the picker is open for: "mine", a squadmate index, or null. */
  const [picking, setPicking] = useState(null);
  /* The editor over this screen: { key, id, startWith }, or null. id is
     the build being adjusted, null for a new one. */
  const [editing, setEditing] = useState(null);
  const openEditor = useCallback((id, startWith = null, seedItem = null) => {
    setPicking(null);
    setEditing({ key: `${id || "new"}-${Date.now()}`, id, startWith, seedItem });
  }, []);

  /* The page behind stays where it was while the editor covers it. */
  useEffect(() => {
    if (!editing) return undefined;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = before; };
  }, [editing]);

  /* The galaxy map. Null means decide for me: open while nothing says
     where you are dropping, which is what makes Drop Bay open onto the
     map. Choosing a planet folds it away; the brief can open it again. */
  const [mapOpen, setMapOpen] = useState(null);
  const [prefs, setPrefs] = usePlannerPrefs();

  /* Every build that exists, yours and the presets, with heat derived the
     same way the grid derives it. Resolved against all of it rather than
     against what the scenario allows, so tightening the scenario never
     silently drops somebody out of the squad. */
  const everything = useMemo(
    () => withHeat([
      ...state.loadouts.map((l) => ({ ...l, preset: false })),
      ...presets.map((p) => ({ ...p, preset: true })),
    ]),
    [state.loadouts]
  );
  const byId = useMemo(() => new Map(everything.map((l) => [l.id, l])), [everything]);
  const { mine, mates, confirmed } = useMemo(
    () => readDrop(drop, (id) => byId.get(id)),
    [drop, byId]
  );
  const context = useMemo(() => dropContext(scenario), [scenario]);

  /* In a party the other three slots are the party's, in the order people
     joined. What arrives is cleaned against this browser's own tables
     before it is drawn or counted, because the server never checks it. */
  const inParty = Boolean(party.code);
  const others = useMemo(() => {
    if (!party.state) return [];
    return party.state.members
      .filter((m) => m.id !== party.state.you)
      .map((m) => {
        const build = unpackBuild(m.build);
        return { ...m, build: build ? withHeat([build])[0] : null };
      });
  }, [party.state]);
  /* Outside a party the seats you said decide how many squadmate slots
     there are. A build filled into a seat you then took away is kept,
     but it is not in the squad and is not counted. */
  const seats = inParty ? SQUAD_CAP : Math.max(1, Number(scenario.squad) || SQUAD_CAP);
  const seatedMates = mates.slice(0, seats - 1);
  const parked = mates.slice(seats - 1).filter(Boolean).length;
  const counted = inParty
    ? [...(confirmed ? [mine] : []), ...others.filter((m) => m.build).map((m) => m.build)]
    : [...(confirmed ? [mine] : []), ...seatedMates.filter(Boolean)];

  /* Your own builds first: a suggestion you made yourself beats a preset.
     The presets only stand in while nothing of yours fits. */
  const own = useMemo(() => everything.filter((l) => !l.preset), [everything]);
  const suggestions = useMemo(() => {
    if (!scenario.faction) return { picks: [], fromPresets: false, cut: null };
    const opts = { lockedSet: state.lockedSet, history: state.history, limit: 3 };
    const mineFirst = suggestBuilds(own, scenario, opts);
    if (mineFirst.length) {
      const change = forAChange(own, scenario, { ...opts, exclude: mineFirst.map((p) => p.build.id) });
      return { picks: mineFirst, fromPresets: false, cut: null, change };
    }
    const presetPicks = suggestBuilds(everything.filter((l) => l.preset), scenario, opts);
    if (presetPicks.length) return { picks: presetPicks, fromPresets: true, cut: null };
    return { picks: [], fromPresets: false, cut: dropPool(everything, scenario, { lockedSet: state.lockedSet, showLocked: false }).cut };
  }, [own, everything, scenario, state.lockedSet, state.history]);
  const untried = useMemo(
    () => untriedHere(scenario, { lockedSet: state.lockedSet, history: state.history }),
    [scenario, state.lockedSet, state.history]
  );
  const frontName = (FACTIONS.find((f) => f.id === scenario.faction) || {}).label;
  const frontLabel = frontName ? `the ${frontName}` : "this front";

  const closePicker = useCallback(() => setPicking(null), []);

  /* A planet with fighting on it brings its front along, and choosing one
     folds the map away. Answering the planner's questions does not: you
     are still choosing. */
  const choosePlanet = (name, front) => {
    setPlanet(name);
    if (front && front !== scenario.faction) setFaction(front);
    setMapOpen(false);
  };

  const mapPanel = (closable) => (
    <div className="rounded-lg border border-base-800 bg-base-900/60 p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-base-200" style={OSWALD}>Where are you dropping</p>
          <p className="mt-0.5 text-xs leading-relaxed text-base-500">
            Click the planet where you clicked it in the game, and its front, biome and hazards come with it. Or say
            what you are after and the planner marks where to go.
          </p>
        </div>
        {closable ? (
          <button onClick={() => setMapOpen(false)} title="Put the map away" aria-label="Put the map away"
            className="shrink-0 rounded border border-base-800 p-1.5 text-base-400 hover:border-base-600 hover:text-base-100">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <DropPlanner scenario={scenario} setFaction={setFaction} onChoose={choosePlanet} prefs={prefs} setPrefs={setPrefs} />
    </div>
  );

  /* No front yet: the planner is the way in, the way the three banners
     used to be. Its first question is the front. */
  if (!scenario.faction) {
    return mapPanel(false);
  }

  /* A slot from another front says so rather than vanishing. It still
     counts: it is what that person is bringing, whatever the scenario says. */
  const offFront = (b) => b && b.faction !== scenario.faction;

  /* Confirming writes the drop to your history. Changing your mind soon
     after takes it back again: that was a change of mind, not a drop. */
  const confirm = () => {
    const entry = entryFor(mine, scenario);
    state.logDrop(entry);
    update((d) => ({ ...d, confirmed: stampOf(mine), logged: { id: entry.id, at: entry.at } }));
  };
  const unconfirm = () => {
    const logged = drop.logged;
    if (logged && Date.now() - Date.parse(logged.at) < TAKE_BACK_MS) state.unlogDrop(logged.id);
    update((d) => ({ ...d, confirmed: null, logged: null }));
  };
  const takeMine = (id) => update((d) => ({ ...d, mine: id, confirmed: null }));

  const pick = (id) => {
    if (picking === "mine") {
      /* Choosing is not confirming. Picking again after confirming puts you
         back to still deciding, because what you confirmed has changed. */
      update((d) => ({ ...d, mine: id, confirmed: null }));
    } else if (typeof picking === "number") {
      update((d) => ({ ...d, mates: d.mates.map((m, i) => (i === picking ? id : m)) }));
    }
    setPicking(null);
  };

  const mineState = mine ? (confirmed ? "confirmed" : "deciding") : null;

  /* In a party the host sets the scenario, so only the host gets the map. */
  const canChoose = !inParty || party.isHost;
  const nowhere = !scenario.planet && !scenario.biome && !(scenario.hazards || []).length;
  const showMap = canChoose && (mapOpen === null ? nowhere : mapOpen);

  return (
    <div className="flex flex-col gap-4">
      <PartyPanel party={party} sync={sync} />
      {showMap ? mapPanel(true) : null}
      {showMap && nowhere && !scenario.mission ? null : (
        <Brief scenario={scenario} onMap={canChoose && !showMap ? () => setMapOpen(true) : null}
          hostPicks={inParty && !party.isHost} />
      )}

      {inParty ? null : (
        <div className="rounded-lg border border-base-800 bg-base-900/40 px-4 py-2.5">
          <Seats value={scenario.squad} onChange={setSquad} />
          {parked ? (
            <p className="mt-1.5 text-[11px] text-base-600">
              {parked === 1 ? "One build you filled in sits" : `${parked} builds you filled in sit`} in a seat you took away.
              Kept, not counted. Add the seat back and it returns.
            </p>
          ) : null}
        </div>
      )}

      {confirmed ? null : (
        <Suggestions picks={suggestions.picks} fromPresets={suggestions.fromPresets}
          current={drop.mine} onTake={takeMine} cut={suggestions.cut} onStart={() => openEditor(null, "primary")}
          change={suggestions.change} untried={untried} frontLabel={frontLabel}
          onBuildAround={(id) => openEditor(null, null, id)} />
      )}

      <div className={"grid grid-cols-1 gap-3 sm:grid-cols-2 " + (seats >= 4 ? "xl:grid-cols-4" : seats === 3 ? "xl:grid-cols-3" : "")}>
        {mine ? (
          <FilledSlot label="You" build={mine} state={mineState} scenario={scenario} lockedSet={state.lockedSet}
            actions={confirmed ? (
              <SlotButton onClick={unconfirm} Icon={RotateCcw}>Change my mind</SlotButton>
            ) : (
              <>
                <SlotButton primary onClick={confirm} Icon={Check}>Confirm</SlotButton>
                <SlotButton onClick={() => setPicking("mine")}>Choose another</SlotButton>
                <SlotButton onClick={() => openEditor(mine.id)} Icon={Pencil}>{mine.preset ? "Adjust a copy" : "Adjust"}</SlotButton>
              </>
            )} />
        ) : (
          <EmptySlot mine label="You" onChoose={() => setPicking("mine")}
            onStart={own.length ? null : () => openEditor(null, "primary")} />
        )}

        {inParty ? (
          <>
            {others.map((m) =>
              m.build ? (
                <FilledSlot key={m.id} label={<MemberLabel member={m} isHost={Boolean(party.state) && m.id === party.state.host} />}
                  build={m.build} state="confirmed" scenario={scenario} lockedSet={NO_LOCKS} source="Their build"
                  actions={party.isHost ? <RemoveButton name={m.name} onRemove={() => party.kick(m.id)} /> : null} />
              ) : (
                <DecidingSlot key={m.id} member={m} isHost={Boolean(party.state) && m.id === party.state.host}
                  action={party.isHost ? <RemoveButton name={m.name} onRemove={() => party.kick(m.id)} /> : null} />
              )
            )}
            {Array.from({ length: Math.max(0, SQUAD_CAP - 1 - others.length) }, (_, i) => (
              <WaitingSlot key={`seat-${i}`} code={party.code} />
            ))}
          </>
        ) : seatedMates.map((b, i) =>
          b ? (
            <FilledSlot key={i} label={`Squadmate ${i + 2}`} build={b} state="manual" scenario={scenario} lockedSet={NO_LOCKS}
              actions={
                <>
                  <SlotButton onClick={() => setPicking(i)}>Swap</SlotButton>
                  <SlotButton danger onClick={() => update((d) => ({ ...d, mates: d.mates.map((m, j) => (j === i ? null : m)) }))} Icon={X}>Remove</SlotButton>
                </>
              } />
          ) : (
            <EmptySlot key={i} label={`Squadmate ${i + 2}`} onChoose={() => setPicking(i)} seated={Boolean(scenario.squad)} />
          )
        )}
      </div>

      {[mine, ...(inParty ? others.map((m) => m.build) : seatedMates)].some(offFront) ? (
        <p className="flex items-start gap-1.5 text-[11px] text-base-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          A build here was made for another front. It still counts, because it is what that person is bringing, but its
          reading is against this one.
        </p>
      ) : null}

      <SquadReadout counted={counted} context={context} inParty={inParty}
        waitingOnYou={Boolean(mine) && !confirmed && counted.length < 2}
        mineUncounted={Boolean(mine) && !confirmed} />

      {picking !== null ? (
        <BuildPicker
          title={picking === "mine" ? "Your loadout" : `Squadmate ${picking + 2}`}
          forMine={picking === "mine"}
          everything={everything}
          scenario={scenario}
          state={state}
          current={picking === "mine" ? drop.mine : drop.mates[picking]}
          onPick={pick}
          onClose={closePicker}
          onNew={() => openEditor(null)} />
      ) : null}

      {/* The Armoury's editor, over this screen. Saving puts the build in
          your slot, still to confirm, and brings you back here. */}
      {editing ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-base-950" role="dialog" aria-modal="true" aria-label="Adjust a build">
          <div className="mx-auto max-w-6xl p-4 sm:p-6">
            <Builder key={editing.key} state={state} loadoutId={editing.id} navigate={navigate}
              faction={scenario.faction} scenario={scenario} startWith={editing.startWith} seedItem={editing.seedItem}
              overlay={{
                onClose: () => setEditing(null),
                onSaved: (id) => { if (id) takeMine(id); setEditing(null); },
              }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

