/* ================================================================== */
/* THE DROP                                                           */
/*                                                                    */
/* The moment before the drop: who is bringing what, where you are    */
/* going, and what is going to hurt. Drop Bay's first tab. The grid   */
/* of every build is its second, until Exchange inherits it.          */
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
/* ================================================================== */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, Check, ChevronLeft, X, Search, Plus, Lock, Star, Snowflake, FilterX, AlertTriangle, Info,
  Pencil, Rocket, UserPlus, RotateCcw, Flag, MapPin, Copy, LogOut, Crown, Radio, Loader2,
} from "lucide-react";

import { FACTIONS, FACTION_THEME, TierBadge, StratChip, FactionChooser, difficultyAt, PlanetChooser } from "./Tiers.jsx";
import { presets, heldGear } from "./lib/loadouts.js";
import { readBuild } from "./lib/build.js";
import { itemName } from "./lib/items.js";
import { squadWarnings, isQuietBand, coverageIsQuiet } from "./lib/squad.js";
import { missionByName, missionTraits, hazardName, hazardEffect, biomeName, loudHazards } from "./lib/scenario.js";
import { SETTINGS, readDoc, writeDoc } from "./lib/storage.js";
import {
  EMPTY_DROP, cleanDrop, readDrop, stampOf, dropPool, dropContext, withHeat, gateOf, unpackBuild,
} from "./lib/drop.js";
import { SQUAD_CAP } from "./lib/party.js";

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

function EmptySlot({ mine, label, onChoose }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-base-700 px-4 py-5 text-center sm:min-h-[18rem] sm:py-6">
      {mine ? <Rocket className="h-6 w-6 text-base-600" /> : <UserPlus className="h-6 w-6 text-base-600" />}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>{label}</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-base-500">
          {mine
            ? "Choose what you are dropping with, then confirm it."
            : "Pick the build they told you they are bringing, or open a party above and they fill this in themselves."}
        </p>
      </div>
      <SlotButton onClick={onChoose} Icon={mine ? Rocket : Plus} primary={mine}>
        {mine ? "Choose a loadout" : "Add their build"}
      </SlotButton>
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

function BuildPicker({ title, forMine, everything, scenario, state, current, onPick, onClose, navigate }) {
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

  const readings = useMemo(
    () => new Map(shown.map((l) => [l.id, readBuild(l, scenario)])),
    [shown, scenario]
  );

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
            <button onClick={() => navigate("builder/new")}
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
                    : "No build for this front survives the scenario. Loosen the scenario above, or build theirs in the builder first."}
            </p>
            {forMine && !query ? (
              <button onClick={() => navigate("builder/new")}
                className="mx-auto mt-3 flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-1.5 text-xs text-base-900 hover:bg-base-100">
                <Plus className="h-3.5 w-3.5" /> New loadout
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {shown.map((l) => {
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

export default function DropScreen({ state, navigate, scenario, setFaction, setPlanet, drop, update, party, sync }) {
  /* Which slot the picker is open for: "mine", a squadmate index, or null. */
  const [picking, setPicking] = useState(null);

  /* The galaxy map. Null means decide for me: open while nothing says
     where you are dropping, which is what makes Drop Bay open onto the
     map. Choosing a planet folds it away; the brief can open it again. */
  const [mapOpen, setMapOpen] = useState(null);

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
  const { mine, mates, confirmed, counted: handCounted } = useMemo(
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
  const counted = inParty
    ? [...(confirmed ? [mine] : []), ...others.filter((m) => m.build).map((m) => m.build)]
    : handCounted;

  const closePicker = useCallback(() => setPicking(null), []);

  if (!scenario.faction) {
    return <FactionChooser onChoose={setFaction} />;
  }

  /* A slot from another front says so rather than vanishing. It still
     counts: it is what that person is bringing, whatever the scenario says. */
  const offFront = (b) => b && b.faction !== scenario.faction;

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
      {showMap ? (
        <div className="rounded-lg border border-base-800 bg-base-900/60 p-3 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-base-200" style={OSWALD}>Where are you dropping</p>
              <p className="mt-0.5 text-xs leading-relaxed text-base-500">
                Click the planet where you clicked it in the game. Its biome and hazards come with it.
              </p>
            </div>
            <button onClick={() => setMapOpen(false)} title="Put the map away" aria-label="Put the map away"
              className="shrink-0 rounded border border-base-800 p-1.5 text-base-400 hover:border-base-600 hover:text-base-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <PlanetChooser chosen={scenario.planet} autoFocus={false}
            onChoose={(name) => { setPlanet(name); setMapOpen(false); }} />
        </div>
      ) : null}
      {showMap && nowhere && !scenario.mission ? null : (
        <Brief scenario={scenario} onMap={canChoose && !showMap ? () => setMapOpen(true) : null}
          hostPicks={inParty && !party.isHost} />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mine ? (
          <FilledSlot label="You" build={mine} state={mineState} scenario={scenario} lockedSet={state.lockedSet}
            actions={confirmed ? (
              <SlotButton onClick={() => update((d) => ({ ...d, confirmed: null }))} Icon={RotateCcw}>Change my mind</SlotButton>
            ) : (
              <>
                <SlotButton primary onClick={() => update((d) => ({ ...d, confirmed: stampOf(mine) }))} Icon={Check}>Confirm</SlotButton>
                <SlotButton onClick={() => setPicking("mine")}>Choose another</SlotButton>
                <SlotButton onClick={() => navigate(`builder/${mine.id}`)} Icon={Pencil}>{mine.preset ? "Edit a copy" : "Edit"}</SlotButton>
              </>
            )} />
        ) : (
          <EmptySlot mine label="You" onChoose={() => setPicking("mine")} />
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
        ) : mates.map((b, i) =>
          b ? (
            <FilledSlot key={i} label={`Squadmate ${i + 2}`} build={b} state="manual" scenario={scenario} lockedSet={NO_LOCKS}
              actions={
                <>
                  <SlotButton onClick={() => setPicking(i)}>Swap</SlotButton>
                  <SlotButton danger onClick={() => update((d) => ({ ...d, mates: d.mates.map((m, j) => (j === i ? null : m)) }))} Icon={X}>Remove</SlotButton>
                </>
              } />
          ) : (
            <EmptySlot key={i} label={`Squadmate ${i + 2}`} onChoose={() => setPicking(i)} />
          )
        )}
      </div>

      {[mine, ...(inParty ? others.map((m) => m.build) : mates)].some(offFront) ? (
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
          navigate={navigate} />
      ) : null}
    </div>
  );
}

