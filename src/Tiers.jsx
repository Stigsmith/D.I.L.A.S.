import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Star, Bot, Bug, Eye, Flame, Info, Crosshair, Backpack, Plane, Satellite, Car,
  RadioTower, Users, Bomb, CircleDot, FilterX, Thermometer, Zap, Wind, Sword,
  Search, Lock, Unlock, HelpCircle, ChevronDown, AlertTriangle, Download, Upload,
  Pencil, Trash2, Globe2, ArrowUp, ArrowDown, SlidersHorizontal,
} from "lucide-react";

/* ================================================================== */
/* DATA                                                               */
/* One flat item list with stable ids, plus the lookups derived from  */
/* it in lib/items.js. The display name is an ordinary field now:     */
/* every stored reference is an id, so a rename costs nothing and     */
/* cannot orphan saved state. The conventions are in CLAUDE.md.       */
/* ================================================================== */

/* All 107 sets, keyed by armor passive id, grouped by weight class.  */
import ARMOR_SETS from "./data/armor-sets.json";

/* The 39 curated builds. Every slot holds an item id.                */
import LOADOUTS from "./data/loadouts.json";

import { itemArt, uiArt, FACTION_GLYPH } from "./lib/assets.js";
import { SETTINGS, readSetting, writeSetting } from "./lib/storage.js";
import { BRAND } from "./lib/brand.js";
import { PATCH } from "./lib/patch.js";
import {
  hazardInfo, biomeName, hazardName, hazardEffect, QUIET_HAZARDS, loudHazards,
  missionsFor, missionTraits, traitsOf, planetByName,
} from "./lib/scenario.js";
import { scoreItem, scenarioIsSet } from "./lib/score.js";
import { readBuild, explainScore } from "./lib/build.js";
import { describeArmour, EXPOSURE_GAP, enemySource } from "./lib/enemies.js";
import TierBadgePlate from "./TierBadgePlate.jsx";
import { agoText } from "./lib/war.js";
import { useBadgeStyle } from "./lib/badge.js";
import {
  CATEGORIES, vocabulary, acquisitionLabels,
  getItem, itemName, warbondById, ventsHeat, statsFor,
  TIER_RANK, TIER_ORDER, judgedTier, averageRank, rank, eatsBackpack,
} from "./lib/items.js";


/* ================================================================== */
/* THEME                                                              */
/* ================================================================== */

/* The in-game faction marks, painted with the current text colour so   */
/* they take the locked faction hexes. They fall back to the lucide     */
/* glyph if the art is not there, which keeps the tool readable with    */
/* the asset folder removed.                                            */
const factionIcon = (art, Fallback) =>
  function FactionIcon({ className, style }) {
    if (!art) return <Fallback className={className} style={style} />;
    return <MaskIcon url={art} className={className} style={style} />;
  };

const FACTIONS = [
  { id: "bots", label: "Automatons", short: "Bots", Icon: factionIcon(FACTION_GLYPH.bots, Bot), hex: "#EF4444" },
  { id: "bugs", label: "Terminids", short: "Bugs", Icon: factionIcon(FACTION_GLYPH.bugs, Bug), hex: "#F97316" },
  { id: "squids", label: "Illuminate", short: "Squids", Icon: factionIcon(FACTION_GLYPH.squids, Eye), hex: "#A855F7" },
];

const FACTION_THEME = {
  bugs: { hex: "#F97316", text: "text-orange-400", chip: "bg-orange-500 text-orange-950 border-orange-500", cardBorder: "border-orange-500/40" },
  bots: { hex: "#EF4444", text: "text-red-400", chip: "bg-red-500 text-red-950 border-red-500", cardBorder: "border-red-500/40" },
  squids: { hex: "#A855F7", text: "text-purple-400", chip: "bg-purple-500 text-purple-950 border-purple-500", cardBorder: "border-purple-500/40" },
  all: { hex: "#EAB308", text: "text-yellow-400", chip: "bg-yellow-500 text-yellow-950 border-yellow-500", cardBorder: "border-yellow-500/40" },
};

/* The badge encodes the rating, so the ramp is shared and fixed across  */
/* Dark, Light and Neon. A warbond skin may restyle it, but only all six */
/* at once: see the tier ramp note in index.css.                        */
const TIER_KEY = { "S+": "splus", S: "s", A: "a", B: "b", C: "c", D: "d" };
const tierStyle = (tier) => {
  const k = TIER_KEY[tier];
  return {
    backgroundColor: `var(--tier-${k}-bg)`,
    color: `var(--tier-${k}-fg)`,
    borderColor: `var(--tier-${k}-border)`,
    /* Lighter at the top, darker at the bottom, both of the tier's own  */
    /* colour because they are transparent over it. The break just past  */
    /* the middle is what reads as a curved face catching the light      */
    /* rather than as a flat wash.                                       */
    backgroundImage:
      "linear-gradient(180deg, rgb(255 255 255 / 0.26) 0%, rgb(255 255 255 / 0.06) 46%, rgb(0 0 0 / 0.04) 54%, rgb(0 0 0 / 0.20) 100%)",
    /* A hairline on the top edge and a shadow under the bottom one,     */
    /* both inside the shape, which is what gives it a thickness.        */
    boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.34), inset 0 -1px 0 rgb(0 0 0 / 0.22)",
  };
};
/* Icon is null for ballistic and utility on purpose. Those two are the    */
/* "nothing special happens" defaults, so a glyph there is decoration      */
/* rather than information. The kinds that keep an icon are the ones that  */
/* change how the item behaves, including the two the biome gating uses.   */
const KIND_META = {
  heat: { Icon: Thermometer, label: "Vents heat", note: "Better in cold, worse in hot" },
  arc: { Icon: Zap, label: "Arc", note: "Vents heat, chains between targets" },
  fire: { Icon: Flame, label: "Fire", note: "Fire resist armor recommended" },
  explosive: { Icon: Bomb, label: "Explosive", note: "" },
  ballistic: { Icon: null, label: "Ballistic", note: "" },
  gas: { Icon: Wind, label: "Gas", note: "" },
  melee: { Icon: Sword, label: "Melee", note: "" },
  utility: { Icon: null, label: "Utility", note: "" },
};

/* ================================================================== */
/* UNRATED ITEMS                                                      */
/* Shown on a row flagged "new": in the game, no rating cast yet.     */
/* ================================================================== */

const UNRATED_NOTE =
  "Released 12 August 2026 in Castellan's Creed. No community rating exists yet. Re-check u.gg around early September 2026.";

/* ================================================================== */
/* ARMOR PASSIVE TRAITS                                               */
/* Damage type is meaningless on armor, so the kind chips are replaced */
/* by what the passive actually does for you. A passive can sit in     */
/* several buckets. Selecting more than one is an OR.                  */
/* ================================================================== */

const ARMOR_TRAIT_FILTERS = vocabulary.armorTraits;

/* ================================================================== */
/* LOADOUT FILTER VOCABULARY                                          */
/* What the curated builds are filtered by. Biome and difficulty are  */
/* hard gates, not soft scoring: a build the scenario excludes does not  */
/* appear at all.                                                     */
/* ================================================================== */

const BIOMES = [
  { id: "any", label: "Temperate" }, { id: "hot", label: "Hot / Arid" },
  { id: "cold", label: "Cold / Icy" }, { id: "foggy", label: "Foggy / Wet" },
  { id: "urban", label: "Urban" }, { id: "cave", label: "Cave" },
];

const BIOME_THEME = {
  /* The panel is tinted from the biome's own colour at low alpha rather */
  /* than a fixed dark wash, so it reads as a tint in either theme.      */
  any: { dot: "#71717A", note: null },
  hot: { dot: "#F59E0B", note: "Intense heat speeds up weapon heat buildup. Heat-venting weapons are filtered out. Fire resist armor earns its slot." },
  cold: { dot: "#38BDF8", note: "Cold slows heat buildup, so laser and plasma fire longer before venting. Snow drains stamina." },
  foggy: { dot: "#2DD4BF", note: "Low visibility cuts both ways. Stealth passives and close-range tools beat marksman weapons." },
  urban: { dot: "#94A3B8", note: "Verticality and tight corridors. Climb for a sightline instead of fighting street level." },
  cave: { dot: "#C084FC", note: "Enclosed and ambush heavy. Close range and stagger beat long-range precision." },
};

const MISSION_TYPES = [
  { id: "standard", label: "Standard" }, { id: "nest", label: "Nest / Fab" },
  { id: "wave", label: "Eradicate" }, { id: "defend", label: "Defend" }, { id: "blitz", label: "Blitz" },
];

/* The four bands a build declares. The numbers are the label because a  */
/* band is a range, and the names it spans ride along as the tooltip:     */
/* nobody thinks "difficulty 7", they think "Suicide Mission".            */
const bandNames = (band) => {
  const inBand = vocabulary.difficulties.filter((d) => d.band === band);
  if (!inBand.length) return "";
  return inBand.length === 1 ? inBand[0].name : `${inBand[0].name} to ${inBand[inBand.length - 1].name}`;
};

const DIFFICULTIES = [
  { id: "low", label: "1-4" }, { id: "mid", label: "5-6" },
  { id: "high", label: "7-9" }, { id: "extreme", label: "10" },
].map((d) => ({ ...d, title: bandNames(d.id) }));

/* Three colour groups, same split the in-game stratagem menu uses:   */
/* blue for what you are handed, red for what falls from the sky,     */
/* green for what you plant and leave. Icon separates subtypes inside */
/* a colour. Blue is support weapons, backpacks and, since the wiki    */
/* fetch landed the data for them, the eight vehicles and exosuits.    */
const STRAT_GROUP = {
  supply: { label: "Support and supply", hex: "#3B82F6" },
  offensive: { label: "Offensive", hex: "#EF4444" },
  defensive: { label: "Defensive", hex: "#22C55E" },
};

const CAT_META = {
  support: { Icon: Crosshair, label: "Support weapon", group: "supply" },
  backpack: { Icon: Backpack, label: "Backpack", group: "supply" },
  /* Exosuits, the three FRVs and the Bastion. One type rather than a    */
  /* mech type and a vehicle type, because splitting eight rows into two */
  /* buckets makes the filter worse, not better.                         */
  vehicle: { Icon: Car, label: "Vehicle", group: "supply" },
  eagle: { Icon: Plane, label: "Eagle", group: "offensive" },
  orbital: { Icon: Satellite, label: "Orbital", group: "offensive" },
  sentry: { Icon: RadioTower, label: "Sentry", group: "defensive" },
  emplacement: { Icon: Users, label: "Emplacement", group: "defensive" },
  mines: { Icon: CircleDot, label: "Mines", group: "defensive" },
};

const STRAT_TYPE_FILTERS = ["support", "backpack", "vehicle", "eagle", "orbital", "sentry", "emplacement", "mines"]
  .map((id) => ({ id, label: CAT_META[id].label, Icon: CAT_META[id].Icon }));

/* The runtime integrity banner the artifact carried is gone. It was a */
/* workaround for having no build step. npm run validate does the same */
/* job and more, before anything ships. See scripts/validate.mjs.      */

function loadoutItems(l) {
  return [l.primary, l.secondary, l.grenade, l.armor, l.booster, ...l.strats];
}


/* ================================================================== */
/* SHARED UI                                                          */
/* ================================================================== */

function Chips({ label, options, value, onChange, activeClass }) {
  return (
    <div>
      {label ? (
        <span className="mb-1.5 block font-semibold uppercase tracking-wider text-[10px] text-base-500" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {label}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button key={o.id} onClick={() => onChange(o.id)}
              className={"px-2.5 py-1.5 text-xs font-medium rounded border transition-colors " +
                (active ? activeClass : "bg-base-900 text-base-400 border-base-700 hover:border-base-500 hover:text-base-100")}>
              {o.Icon ? <o.Icon className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Multi select chips. Two modes because the two use cases are opposite. */
/* "exclude" starts with everything on and each click hides a bucket,     */
/* which is two clicks to drop SMGs and shotguns. "include" starts empty  */
/* and each click narrows, which is one click for "just orbitals".        */
function MultiChips({ label, hint, options, value, onChange, mode }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const isOn = (id) => (mode === "exclude" ? !value.includes(id) : value.includes(id));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-base-500" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {label}
        </span>
        {hint ? <span className="text-[9px] text-base-600 lowercase">{hint}</span> : null}
        {value.length > 0 ? (
          <button onClick={() => onChange([])} className="text-[9px] text-base-500 underline hover:text-base-200">reset</button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = isOn(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)} aria-pressed={on}
              className={"px-2.5 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1 " +
                (on
                  ? "bg-base-200 text-base-900 border-base-200"
                  : "bg-base-900 text-base-600 border-base-800 hover:border-base-600 hover:text-base-300 " +
                    (mode === "exclude" ? "line-through" : ""))}>
              {o.Icon ? <o.Icon className="w-3.5 h-3.5" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/* ART                                                                */
/* Every item reads without its picture. Art is a garnish on a text    */
/* row, never the thing carrying the meaning.                          */
/* ================================================================== */

/* A single colour glyph painted with the current text colour, so it   */
/* behaves like a lucide icon and picks up faction colours and theme   */
/* tokens without a second copy of the file per colour.                */
function MaskIcon({ url, className, style, title }) {
  if (!url) return null;
  return (
    <span role="img" aria-hidden="true" title={title} className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }} />
  );
}

/* Two initials, for the rows with no art. Reads better than an empty  */
/* box and keeps the row height stable either way.                     */
function initials(name) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
}

function ItemArt({ item, className = "h-9 w-9", dim }) {
  const url = itemArt(item.id);
  if (!url) {
    return (
      <span
        className={`${className} shrink-0 flex items-center justify-center rounded border border-dashed border-base-700 text-[9px] font-bold text-base-600 ` + (dim ? "opacity-40" : "")}
        style={{ fontFamily: "'Oswald', sans-serif" }}
        title={`No art for ${item.name}`}>
        {initials(item.name)}
      </span>
    );
  }
  return (
    <img src={url} alt="" loading="lazy" decoding="async"
      className={`${className} shrink-0 object-contain ` + (dim ? "opacity-30" : "")} />
  );
}

export { TierBadge, TierRow, sourceLabelFor, statSummary as itemStatSummary, ItemArt, Chips, KIND_META, FACTIONS, FACTION_THEME, BIOMES, BIOME_THEME, MISSION_TYPES, DIFFICULTIES, CAT_META, STRAT_GROUP, tierStyle, FactionBar, FactionChooser, StratChip };

/**
 * quiet steps a badge back because its column is not the one the list
 * is sorted by. It is not a disabled state and it says nothing about
 * the rating itself: the solid column is simply the one you are
 * reading, and the other is still there to compare against.
 */
/* The badge itself lives in src/TierBadgePlate.jsx, ported from the      */
/* design document. This wrapper is only here to hand it the finish and   */
/* the surface toggles, so no call site has to know they exist: they are  */
/* chosen once in Settings, not decided per row.                          */
function TierBadge({ tier, quiet, size, className }) {
  const { finish, surface } = useBadgeStyle();
  return (
    <TierBadgePlate tier={tier} quiet={quiet} size={size} className={className}
      finish={finish} sheen={surface.sheen} glow={surface.glow} grain={surface.grain} />
  );
}

/* The badge in a table row. Smaller than the 44px the design document   */
/* ships at, and deliberately: at full size it filled the row edge to    */
/* edge, which left the delta marker nowhere to sit and got it clipped   */
/* by the row's own overflow-hidden. 32 on a phone, 36 from sm up, with  */
/* the cell padding giving it air above and below.                       */
const ROW_BADGE = "w-8 h-auto sm:w-9";

/* The tier floor chips wear the same colours as the badges they filter */
/* against, so the ladder reads at a glance and there is only one       */
/* colour language for tiers in the whole tool. The chosen floor is at  */
/* full strength and everything else is dimmed, which keeps the         */
/* selection obvious without inventing a second highlight style.        */
function TierChips({ label, value, onChange }) {
  const { finish, surface } = useBadgeStyle();
  return (
    <div>
      <span className="mb-1.5 block font-semibold uppercase tracking-wider text-[10px] text-base-500"
        style={{ fontFamily: "'Oswald', sans-serif" }}>
        {label}
      </span>
      {/* The floor chips wear the badge itself rather than a flat copy of  */}
      {/* its colour. One shape for a tier everywhere, including whatever   */}
      {/* finish is set, so the thing you are filtering to looks like the   */}
      {/* thing you will see in the list.                                    */}
      {/*                                                                    */}
      {/* Selection is a ring around the plate, never a change to the plate  */}
      {/* itself: the badge already spends its rim, its glow and its fill on */}
      {/* saying which tier this is, and there is nothing left to spend on   */}
      {/* saying which one is chosen.                                        */}
      <div className="flex flex-wrap gap-2">
        {TIER_ORDER.map((t) => {
          const active = t === value;
          return (
            <button key={t} onClick={() => onChange(t)} aria-pressed={active}
              title={active ? `Showing ${t} and above` : `Drop the floor to ${t}`}
              className={"rounded p-0.5 transition-all " +
                (active
                  ? "opacity-100 ring-2 ring-base-100"
                  : "opacity-45 hover:opacity-90")}>
              <TierBadgePlate tier={t} size={30} finish={finish}
                sheen={surface.sheen} glow={surface.glow} grain={surface.grain} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/* WHERE YOU ARE DROPPING                                             */
/*                                                                    */
/* A planet, or the environment set by hand. Picking a planet fills    */
/* the biome and the hazards in one move, which is the whole point:    */
/* the holo select in game shows you one image of a surface and even   */
/* a veteran cannot always tell a canyon from a mesa from it, let      */
/* alone whether the place has ion storms.                            */
/*                                                                    */
/* Everything stays editable afterwards. Setting a biome or a hazard   */
/* by hand drops the planet, because the scenario would otherwise claim   */
/* to be somewhere it is not.                                         */
/*                                                                    */
/* 281 planets ship as a table. Biome and permanent hazards do not     */
/* change, so this needs no network at runtime.                       */
/*                                                                    */
/* The planet is picked on the galaxy map since 1.25.0, where you      */
/* clicked it in the game. The search stays: it lights the matches up  */
/* on the map and lists them underneath, which is also the way in for  */
/* a keyboard and for the nine planets with no place on the map.       */
/* ================================================================== */

/* Planet and mission sit side by side and share one fold out pane, so
   only one is ever open. Two stacked rows each with their own pane cost
   the height twice and let you open both, which made the screen taller
   than the thing it was picking. */
/* `kind` is the drop planner's mission kind, which narrows the mission
   list here; `onClearKind` lets you see every mission again.

   The place half only says where you are. It used to open a biome and a
   set of hazards to set by hand, for a planet the map did not have or a
   what if; the curator retired it on 30 September 2026, once the map and
   the planner covered both, and the search reaches the planets with no
   place on the map. A scenario saved with a biome set by hand still reads
   here and still clears. */
function PlanetBar({ scenario, setMission, clearEnvironment, kind = null, onClearKind, stack = false }) {
  /* null or "mission". */
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState("");

  const show = (which) => {
    setQuery("");
    setOpen((cur) => (cur === which ? null : which));
  };


  const onFront = useMemo(
    () => missionsFor(scenario.faction).filter((m) => !kind || m.traits.includes(kind)),
    [scenario.faction, kind]
  );
  const missionHits = useMemo(() => {
    const all = onFront;
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.traits.some((t) => ((missionTraits[t] || {}).name || t).toLowerCase().includes(q))
    );
  }, [query, onFront]);

  const byHand = scenario.biome || scenario.hazards.length;
  const placeLabel = scenario.planet || (byHand ? biomeName(scenario.biome) || "Set by hand" : "Choose a planet");
  const placeSub = scenario.planet
    ? [biomeName(scenario.biome), loudHazards(scenario.hazards).length ? loudHazards(scenario.hazards).length + (loudHazards(scenario.hazards).length === 1 ? " hazard" : " hazards") : null]
        .filter(Boolean).join(" · ")
    : byHand ? "set by hand" : "pick it on the map";
  const missionSub = scenario.mission
    ? traitsOf(scenario.mission).map((t) => (missionTraits[t] || {}).name || t).join(" · ") || "no special demands"
    : onFront.length + (kind ? " " + missionTraits[kind].name.toLowerCase() + " missions" : "") + " on this front";

  return (
    <div className="rounded-lg border border-base-800 bg-base-900/60 p-3">
      <div className={"grid grid-cols-1 gap-2 " + (stack ? "" : "sm:grid-cols-2")}>
        <Placed label="Dropping on" icon={Globe2} value={placeLabel} sub={placeSub}
          chosen={Boolean(scenario.planet || byHand)} />
        <Picker label="Mission" icon={Crosshair} open={open === "mission"}
          value={scenario.mission || "Not set"} sub={missionSub} chosen={Boolean(scenario.mission)}
          onToggle={() => show("mission")} />
      </div>

      {/* What the place and the mission actually do to you. The half worth
          reading, and the half the scoring engine reads too. Hidden while
          a pane is open, because the pane is what you are looking at. */}
      {!open && (loudHazards(scenario.hazards).length || scenario.mission || scenario.planet || byHand) ? (
        <div className="mt-2.5 flex flex-col gap-1 border-t border-base-800 pt-2.5 text-left">
          {scenario.mission ? traitsOf(scenario.mission).map((t) => (
            <p key={t} className="text-[11px] leading-relaxed text-base-400">
              <span className="text-base-200">{(missionTraits[t] || {}).name || t}.</span>{" "}
              {(missionTraits[t] || {}).line}
            </p>
          )) : null}
          {loudHazards(scenario.hazards).map((h) => (
            <p key={h} className="text-[11px] leading-relaxed text-base-400">
              <span className="text-accent-300">{hazardName(h)}</span> {hazardEffect(h)}
            </p>
          ))}
          {scenario.planet || byHand ? (
            <button onClick={clearEnvironment}
              className="self-start text-[10px] text-base-600 underline hover:text-base-300">
              clear the planet
            </button>
          ) : null}
        </div>
      ) : null}

      {open === "mission" ? (
        <Pane placeholder={"Search " + onFront.length + " missions on this front"}
          query={query} setQuery={setQuery}>
          {kind ? (
            <p className="flex flex-wrap items-center gap-x-2 px-2 pb-1 text-[11px] text-base-500">
              Only {missionTraits[kind].name.toLowerCase()} missions, as the planner asked.
              {onClearKind ? (
                <button onClick={onClearKind} className="text-base-400 underline hover:text-base-100">show every mission</button>
              ) : null}
            </p>
          ) : null}
          <PickRow on={!scenario.mission} onClick={() => { setMission(""); setOpen(null); }}
            title="Not set" sub="judge everything without a mission in mind" tags={[]} />
          {missionHits.length === 0 ? (
            <Empty>No mission by that name on this front. The list genuinely differs per war.</Empty>
          ) : missionHits.map((m) => (
            <PickRow key={m.name} on={m.name === scenario.mission}
              onClick={() => { setMission(m.name); setOpen(null); }}
              title={m.name}
              sub={((missionTraits[m.traits[0]] || {}).line || "").slice(0, 88)}
              tags={m.traits.map((t) => ({ key: t, label: (missionTraits[t] || {}).name || t }))} />
          ))}
        </Pane>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* THE DROP PLANNER                                                   */
/*                                                                    */
/* "Where would you like to play?" The curator's idea, 30 September   */
/* 2026: against what, what kind of mission, what kind of planet, and */
/* the answer is a planet to go to, marked on the map beside it.      */
/*                                                                    */
/* The first question is the scenario's own front, which is where the */
/* three banners went. Choosing a planet with fighting on it answers  */
/* it for you, so it is the way to browse a front with no planet in   */
/* mind, and the only way when the live war is not here. The rest is  */
/* in usePlannerPrefs and keeps between visits. What it suggests is   */
/* suggestFronts in galaxy.js, where the rules for it are written.    */
/* ================================================================== */

/* The kinds in the order the mission table lists them. */
const MISSION_KINDS = Object.keys(missionTraits);

/* The hazards worth avoiding, by name. */
const AVOIDABLE = Object.entries(hazardInfo)
  .filter(([slug]) => !QUIET_HAZARDS.has(slug))
  .map(([slug, v]) => ({ slug, ...v }))
  .sort((a, b) => a.name.localeCompare(b.name));

function PlanStep({ n, label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-base-500"
        style={{ fontFamily: "'Oswald', sans-serif" }}>
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-base-600 text-[9px] text-base-300">{n}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

/* A choice in three, where the middle one means it makes no difference.
   One row, so avoid, any and want read as one question. */
function ThreeWay({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-base-400">{label}</span>
      <div className="flex overflow-hidden rounded border border-base-700" role="group" aria-label={label}>
        {options.map(([id, name, title]) => (
          <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id} title={title}
            className={"border-l border-base-700 px-2.5 py-1 text-[11px] transition-colors first:border-l-0 " +
              (value === id ? "bg-base-200 text-base-900" : "bg-base-900 text-base-400 hover:text-base-100")}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrefChip({ on, onClick, disabled, title, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} title={title}
      className={"rounded border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 " +
        (on ? "border-base-200 bg-base-200 text-base-900"
            : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
      {children}
    </button>
  );
}

/* `bare` drops the card and the title, for the war room's panel, which
   carries both itself. */
function Planner({ scenario, setFaction, prefs, setPrefs, war, plan, onChoose, bare = false }) {
  const front = scenario.faction;
  const f = FACTIONS.find((x) => x.id === front);
  const onFront = missionsFor(front);
  const offered = (kind) => onFront.some((m) => m.traits.includes(kind));
  const kindCount = prefs.kind ? onFront.filter((m) => m.traits.includes(prefs.kind)).length : 0;
  const toggleHazard = (slug) => setPrefs({
    avoidHazards: prefs.avoidHazards.includes(slug)
      ? prefs.avoidHazards.filter((h) => h !== slug)
      : [...prefs.avoidHazards, slug],
  });

  return (
    <div className={"flex flex-col gap-3.5 text-left " + (bare ? "" : "rounded-lg border border-base-800 bg-base-900/60 p-3 sm:p-4")}>
      {bare ? null : (
        <p className="text-sm font-bold text-base-200" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Where would you like to play?
        </p>
      )}

      <PlanStep n={1} label="Against">
        <div className="flex gap-2">
          {FACTIONS.map((x) => (
            <FactionPick key={x.id} faction={x} compact on={x.id === front} dimmed={Boolean(front) && x.id !== front}
              onChoose={(id) => setFaction(id)} />
          ))}
        </div>
      </PlanStep>

      <PlanStep n={2} label="Kind of mission">
        <div className="flex flex-wrap gap-1.5">
          <PrefChip on={!prefs.kind} onClick={() => setPrefs({ kind: null })}>Any</PrefChip>
          {MISSION_KINDS.map((k) => (
            <PrefChip key={k} on={prefs.kind === k} disabled={!offered(k)}
              title={offered(k) ? missionTraits[k].line : `The ${f ? f.label : "enemy"} have no ${missionTraits[k].name.toLowerCase()} missions`}
              onClick={() => setPrefs({ kind: prefs.kind === k ? null : k })}>
              {missionTraits[k].name}
            </PrefChip>
          ))}
        </div>
        {prefs.kind ? (
          <p className="text-[11px] leading-relaxed text-base-500">
            {kindCount
              ? `${kindCount} ${missionTraits[prefs.kind].name.toLowerCase()} mission${kindCount === 1 ? "" : "s"} against the ${f ? f.label : "enemy"}, and the mission list below narrows to them.`
              : `The ${f ? f.label : "enemy"} have none of these.`}{" "}
            Every front offers nearly every kind, so this does not choose the planet.
          </p>
        ) : null}
      </PlanStep>

      <PlanStep n={3} label="Kind of planet">
        <div className="flex flex-col gap-1.5">
          <ThreeWay label="Caves" value={prefs.caves} onChange={(caves) => setPrefs({ caves })}
            options={[
              ["avoid", "Avoid", "Hides the Hive Worlds, where the caves are"],
              ["any", "Any", "Caves or not, it makes no difference"],
              ["only", "Only", "Only the Hive Worlds, for when the caves are what you came for"],
            ]} />
          <ThreeWay label="Megacities" value={prefs.megacities} onChange={(megacities) => setPrefs({ megacities })}
            options={[
              ["fewer", "Fewer", "Planets with a megacity come after every planet without one"],
              ["any", "Any", "Megacities make no difference to the order"],
              ["more", "More", "Planets with a megacity come before every planet without one"],
            ]} />
        </div>
        <span className="text-[10px] text-base-600">Rather not have</span>
        <div className="flex flex-wrap gap-1.5">
          {AVOIDABLE.map((h) => (
            <PrefChip key={h.slug} on={prefs.avoidHazards.includes(h.slug)} title={h.description}
              onClick={() => toggleHazard(h.slug)}>
              {h.name}
            </PrefChip>
          ))}
        </div>
      </PlanStep>

      <GoHere war={war} plan={plan} front={f} chosen={scenario.planet} onChoose={onChoose} />
    </div>
  );
}

/* The answer: the planets to go to, in order, each one a button that
   chooses it. Says plainly when there is nothing to suggest and why. */
function GoHere({ war, plan, front, chosen, onChoose }) {
  const say = (text) => <p className="text-[11px] leading-relaxed text-base-500">{text}</p>;
  return (
    <div className="flex flex-col gap-1.5 border-t border-base-800 pt-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand" style={{ fontFamily: "'Oswald', sans-serif" }}>
        Go here
      </span>
      {!war ? say("The live war is not here, so there are no fronts to point you at. Every planet on the map still works.")
        : !war.fresh ? say(`The live war was last read ${agoText(war.age)}, too long ago to point you anywhere.`)
        : !plan || plan.count === 0 ? say(
            (front ? `No front against the ${front.label} fits right now.` : "No front fits right now.") +
            (plan && plan.caves === "only" ? " None of its fronts is on a Hive World, where the caves are."
              : plan && plan.hiddenForCaves ? ` The only ${plan.hiddenForCaves === 1 ? "one has" : "ones have"} caves.` : "")
          )
        : (
          <>
            <ol className="flex flex-col gap-1.5">
              {plan.picks.map((p, i) => {
                const fx = FACTIONS.find((x) => x.id === p.front);
                const table = planetByName.get(p.name);
                const state = p.defence
                  ? `under attack${p.defence.progress !== null ? ", " + Math.round(p.defence.progress * 100) + "% defended" : ""}`
                  : p.liberation !== null ? Math.round(p.liberation * 100) + "% liberated" : null;
                const warns = [
                  ...(p.megacity ? [p.megacity === 1 ? "a megacity" : p.megacity + " megacities"] : []),
                  ...p.clashes.map(hazardName),
                ];
                return (
                  <li key={p.name}>
                    <button onClick={() => onChoose(p.name, p.front)}
                      className={"flex w-full items-start gap-2.5 rounded border px-2.5 py-2 text-left transition-colors " +
                        (p.name === chosen ? "border-brand bg-base-800/70" : "border-base-800 hover:border-base-600 hover:bg-base-800/50")}
                      style={fx ? { borderLeftColor: fx.hex, borderLeftWidth: 3 } : undefined}>
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-ink">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-bold text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>{p.name}</span>
                          <span className="shrink-0 text-[10px] text-base-500">
                            {p.players ? p.players.toLocaleString("en-GB") + " Helldivers" : "nobody there yet"}
                          </span>
                        </span>
                        <span className="block truncate text-[10px] text-base-500">
                          {[table && table.sector ? table.sector + " sector" : null, table ? biomeName(table.biome) : null, state]
                            .filter(Boolean).join(" · ")}
                        </span>
                        {warns.length ? (
                          <span className="mt-0.5 block text-[10px] text-accent-300">Has {warns.join(", ")}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {plan.count > plan.picks.length
              ? say(`${plan.count - plan.picks.length} more ${plan.count - plan.picks.length === 1 ? "front fits" : "fronts fit"}, lit on the map.`)
              : null}
            {plan.hiddenForCaves
              ? say(plan.caves === "only"
                ? `Only Hive Worlds, where the caves are: ${plan.hiddenForCaves} other ${plan.hiddenForCaves === 1 ? "front" : "fronts"} left out.`
                : `${plan.hiddenForCaves} hidden for caves.`)
              : null}
          </>
        )}
    </div>
  );
}

/* The place, as a card that says rather than opens: the map above is
   where it is chosen. Same shape as the mission picker beside it. */
function Placed({ label, icon: Icon, value, sub, chosen }) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded border border-base-800 bg-base-900 px-3 py-2 text-left">
      <Icon className={"h-4 w-4 shrink-0 " + (chosen ? "text-base-300" : "text-base-600")} />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
        <span className={"block truncate text-xs " + (chosen ? "text-base-100" : "text-base-500")}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        <span className="block truncate text-[10px] text-base-600">{sub}</span>
      </span>
    </div>
  );
}

/* One of the two side by side buttons. */
function Picker({ label, icon: Icon, value, sub, open, chosen, onToggle }) {
  return (
    <button onClick={onToggle} aria-expanded={open}
      className={"flex w-full items-center gap-2.5 rounded border px-3 py-2 text-left transition-colors " +
        (open ? "border-base-500 bg-base-800/60" : "border-base-700 bg-base-900 hover:border-base-500")}>
      <Icon className={"h-4 w-4 shrink-0 " + (chosen ? "text-base-300" : "text-base-600")} />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
        <span className={"block truncate text-xs " + (chosen ? "text-base-100" : "text-base-500")}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        <span className="block truncate text-[10px] text-base-600">{sub}</span>
      </span>
      <ChevronDown className={"h-3.5 w-3.5 shrink-0 text-base-500 transition-transform " + (open ? "rotate-180" : "")} />
    </button>
  );
}

/* The shared fold out. Same search box and the same scroll box whichever
   of the two opened it, so the two cannot drift into different shapes. */
function Pane({ placeholder, query, setQuery, children }) {
  return (
    <div className="mt-2.5 flex flex-col gap-2.5 border-t border-base-800 pt-2.5">
      <SearchField placeholder={placeholder} query={query} setQuery={setQuery} />
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto text-left">{children}</div>
    </div>
  );
}

function SearchField({ placeholder, query, setQuery, autoFocus = true }) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-500" />
      <input autoFocus={autoFocus} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}
        className="w-full rounded border border-base-700 bg-base-900 py-1.5 pl-7 pr-2 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
    </div>
  );
}

function Empty({ children }) {
  return <p className="py-4 text-center text-xs text-base-500">{children}</p>;
}

function PickRow({ on, onClick, title, sub, tags }) {
  return (
    <button onClick={onClick}
      className={"flex items-center justify-between gap-3 rounded border px-2 py-1.5 text-left transition-colors " +
        (on ? "border-base-600 bg-base-800/70" : "border-transparent hover:border-base-700 hover:bg-base-800/60")}>
      <span className="min-w-0">
        <span className="block truncate text-xs text-base-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {title}
        </span>
        <span className="block truncate text-[10px] text-base-500">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        {tags.map((t) => (
          <span key={t.key}
            className={"rounded px-1.5 py-px text-[9px] " +
              (t.warn ? "bg-accent-950/60 text-accent-300" : "bg-base-800 text-base-400")}>
            {t.label}
          </span>
        ))}
      </span>
    </button>
  );
}

export { PlanetBar, SearchField, PickRow, Planner, Empty };

/* ================================================================== */
/* DIFFICULTY                                                         */
/*                                                                    */
/* Ten levels with the names the game uses, and the game's own icons.  */
/* The four bands survive underneath because that is what a build      */
/* declares and what the loadout gate reads; the slider derives one    */
/* rather than replacing it, so nothing stored has to migrate.         */
/*                                                                    */
/* Level 0 is Any. A slider that cannot express "I have not decided"   */
/* forces a choice the filter never used to demand.                    */
/* ================================================================== */

export const DIFFICULTY_LEVELS = vocabulary.difficulties;

export const difficultyAt = (level) =>
  DIFFICULTY_LEVELS.find((d) => d.level === Number(level)) || null;

export const bandForLevel = (level) => {
  const d = difficultyAt(level);
  return d ? d.band : "any";
};

/* The icons are single colour art with no fill of their own, so they   */
/* are painted through a mask the same way the faction marks and the    */
/* skull are. Loaded as an img they would come out flat black.          */
function DifficultyIcon({ level, className, style }) {
  const art = uiArt(`ui_difficulty_${level}`);
  if (!art) return null;
  /* Drawn, not masked. These are the only UI marks in the project that  */
  /* carry more than one colour, and the colours are the game's own      */
  /* difficulty ramp: grey, bronze, red, near black, with white over the */
  /* top. Painting them through the theme collapsed ten marks into one.  */
  /* The white sits on a coloured backing, so they read on a light       */
  /* ground as well as a dark one.                                       */
  return <img src={art} alt="" aria-hidden="true" className={className} style={{ objectFit: "contain", ...style }} />;
}

export { DifficultyIcon };

/* A slider rather than ten chips. Difficulty is the one axis in this   */
/* tool that is genuinely ordered, and ten of anything in a row is a    */
/* wall. The name is the point: nobody thinks "difficulty 7", they      */
/* think "Suicide Mission".                                             */
function DifficultySlider({ value, onChange, label = "Difficulty", hint }) {
  const level = Number(value) || 0;
  const d = difficultyAt(level);
  const pct = (level / 10) * 100;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500"
          style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
        {hint ? <span className="text-[9px] lowercase text-base-600">{hint}</span> : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input type="range" min="0" max="10" step="1" value={level}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={label}
            aria-valuetext={d ? `${d.level}, ${d.name}` : "Any difficulty"}
            className="dilas-range w-full"
            style={{ "--fill": `${pct}%` }} />
          {/* Ends only. Ten numbers under a ten step slider is the wall   */}
          {/* the slider was replacing.                                     */}
          <div className="flex justify-between text-[9px] uppercase tracking-wider text-base-600">
            <span>Any</span>
            <span>Super Helldive</span>
          </div>
        </div>

        {/* The readout carries the weight, so it is fixed width and does  */}
        {/* not jump as the name length changes.                           */}
        <div className="flex w-[8.5rem] shrink-0 items-center gap-2 rounded border border-base-800 bg-base-900 px-2 py-1.5">
          {d ? (
            <DifficultyIcon level={d.level} className="h-4 w-8 shrink-0" />
          ) : (
            <span className="h-4 w-8 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block text-[11px] font-bold leading-none text-base-100"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              {d ? d.name : "Any"}
            </span>
            <span className="block text-[9px] leading-none text-base-500">
              {d ? `Level ${d.level}` : "not set"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export { DifficultySlider };

/* ================================================================== */
/* TIER BROWSER                                                       */
/* ================================================================== */

const KIND_FILTERS = [
  { id: "all", label: "All" }, { id: "thermal", label: "Heat-venting" },
  { id: "fire", label: "Fire" }, { id: "arc", label: "Arc" },
  { id: "ballistic", label: "Ballistic" }, { id: "explosive", label: "Explosive" },
];

/* Lock and favorite are facts about your collection, not facts about the */
/* gear. They sit in their own group below the rule for that reason, and  */
/* they carry the same padlock and star the rows do, so the two           */
/* vocabularies stay separate at a glance.                                */
const LOCK_FILTERS = [
  { id: "bottom", label: "Show at bottom", Icon: Lock },
  { id: "hide", label: "Hide", Icon: Lock },
  { id: "only", label: "Only locked", Icon: Lock },
];

const FAV_FILTERS = [
  { id: "inline", label: "In normal order", Icon: Star },
  { id: "top", label: "Pin to top", Icon: Star },
  { id: "only", label: "Only favorites", Icon: Star },
];

/* The two role tags, in plain language. The stored values are slugs;   */
/* nothing in the UI should show a slug to a reader.                    */
const ROLE_FILTERS = [
  { id: "anti-armor", label: "Opens armor" },
  { id: "objective", label: "Closes objectives" },
];

const ROLE_LABEL = {
  "anti-armor": "Opens armor. Kills Chargers, Hulks, Bile Titans and Factory Striders",
  objective: "Closes bug holes and fabricators from your carried kit, without spending a call-in",
};

/* Roles are ours, not a sourced vote. Every rating on a row comes from  */
/* u.gg with a patch stamp. This line does not, and the UI says so       */
/* rather than letting the two sit together looking equally weighed.     */
const ROLE_PROVENANCE =
  "Our call, not a community vote. Every tier on this row is a u.gg aggregate; this line is a judgment we made.";

/* Which filters make sense per category. Damage type is dropped on    */
/* armor and boosters because kind is a data convenience there, not a  */
/* real property: Servo-Assisted is not a ballistic passive. Role is   */
/* dropped on the same two, where no item carries one.                 */
const FILTER_SHAPE = {
  primary: { kind: true, weaponCat: true, role: true },
  secondary: { kind: true, weaponCat: true, role: true },
  throwable: { kind: true, role: true },
  strat: { kind: true, stratType: true, role: true },
  armor: { armorTrait: true },
  booster: {},
};

/* A labelled fact. Kept flat rather than a table so it reflows on a     */
/* phone without turning into a scrolling grid.                          */
function Fact({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="w-[104px] shrink-0 uppercase tracking-wide text-base-500">{label}</span>
      <span className="min-w-0 text-base-300">{children}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-500">{title}</p>
      {children}
    </div>
  );
}

/* What the source tables do not carry. Saying so is the point: an       */
/* admitted gap beats a hedged guess, and it stops anyone assuming the   */
/* absence means zero.                                                   */
/* This used to name seven fields as missing from every source. The wiki  */
/* fetch filled all but two of them and the line kept apologising for     */
/* their absence anyway, which is worse than never claiming the gap: it   */
/* tells you the tool does not know something it is holding.              */
/*                                                                        */
/* What is genuinely still absent is two fields, and saying so keeps the  */
/* admission honest rather than deleting it wholesale.                    */
const STILL_MISSING =
  "Reload time and projectile count are still not in any source this project has. Everything above is fetched from helldivers.wiki.gg.";

/* A weapon the wiki has no data page for gets the admission rather than  */
/* an empty section. This was six of the nine melee weapons until 26     */
/* September 2026, when the wiki published them; it is kept for the next  */
/* item that arrives before its page does.                                */
const NO_FETCHED_STATS =
  "No handling or ammo figures for this one. The wiki has no data page for it yet, so magazine, rate of fire, recoil and ergonomics are genuinely unknown rather than merely unlisted.";

function RowDetail({ item, faction, scored, difficulty }) {
  const sets = item.slot === "armor" ? ARMOR_SETS[item.id] : null;
  const art = itemArt(item.id);
  const s = item.stats;
  const kind = KIND_META[item.damageType] || KIND_META.ballistic;
  const strat = item.slot === "stratagem" ? CAT_META[item.stratType] : null;
  const isWeapon = item.slot === "primary" || item.slot === "secondary"
    || (item.slot === "stratagem" && item.stratType === "support");
  /* The fetched half, joined on read by id. Null for armor passives and */
  /* boosters, which the fetch does not cover, and for anything the wiki  */
  /* has no data page for yet.                                            */
  const wiki = statsFor(item.id);
  /* Null for anything with no penetration recorded, which is every armor */
  /* passive and every booster, so the section simply does not appear     */
  /* rather than rendering an empty one.                                  */
  const armour = describeArmour(s.ap, faction, difficulty);

  /* Provenance, which the build spec calls the product rather than an   */
  /* implementation detail. Every rating says where it came from and     */
  /* when. Collapsed to one line while the three agree, which they do    */
  /* today, and split per faction the moment they stop agreeing.         */
  const rated = FACTIONS.map((f) => ({ f, r: item.ratings[f.id] })).filter((x) => x.r.tier);
  const stamps = [...new Set(rated.map((x) => `${x.r.source}|${x.r.patch}`))];
  const sourceName = { ugg: "u.gg community votes", curator: "curator", community: "community votes" };

  return (
    <div className="flex flex-col gap-3 border-t border-base-800 bg-base-950/60 px-3 py-3">
      {item.flag === "new" ? (
        <p className="text-[11px] leading-relaxed text-base-400">{UNRATED_NOTE}</p>
      ) : null}
      {item.flag === "stale" && item.patchNote ? (
        <div className="text-[11px] leading-relaxed text-base-400">
          <span className="font-semibold text-accent-500">Changed after the vote. </span>
          {item.patchNote}
          <span className="text-base-600"> The tiers above were voted before this change and have not absorbed it.</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {art ? (
          <img src={art} alt="" loading="lazy" decoding="async"
            className="h-24 w-full shrink-0 object-contain sm:w-48" />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Section title={strat ? "Call in" : "Numbers"}>
            <Fact label="Armor pen">
              {s.ap !== null ? `AP${s.ap}${s.apClass ? ` ${s.apClass}` : ""}` : null}
            </Fact>
            <Fact label="Damage">{s.dps !== null ? `${s.dps} DPS` : null}</Fact>
            <Fact label="Carried">{s.capacity !== null ? `${s.capacity}` : null}</Fact>
            <Fact label="Demolition">{s.demoForce !== null ? `${s.demoForce}` : null}</Fact>
            <Fact label="Cooldown">{s.cooldown !== null ? `${s.cooldown}s` : null}</Fact>
            <Fact label="Uses">
              {/* The hangar upgrade applies to Eagles. A vehicle has uses and  */}
              {/* no upgraded figure, and reading "null with the hangar upgrade" */}
              {/* is worse than reading nothing.                                 */}
              {s.uses === null
                ? null
                : s.usesUpgraded === null
                  ? `${s.uses}`
                  : `${s.uses}, ${s.usesUpgraded} with the hangar upgrade`}
            </Fact>
            <Fact label="Medals">{s.medals !== null ? `${s.medals}` : null}</Fact>
            <Fact label="Damage type">
              {kind.label}{kind.note ? <span className="text-base-500"> · {kind.note}</span> : null}
            </Fact>
            {strat ? (
              <Fact label="Menu">
                <span style={{ color: STRAT_GROUP[strat.group].hex }}>{strat.label}</span>
                <span className="text-base-500"> · {STRAT_GROUP[strat.group].label}</span>
              </Fact>
            ) : null}
            {item.slot === "stratagem" ? (
              <Fact label="Backpack">
                {item.usesBackpackSlot === null
                  ? <span className="text-base-500">not recorded in the source yet</span>
                  : item.stratType === "backpack"
                    ? "This is the backpack"
                    : item.usesBackpackSlot
                      ? <span className="text-accent-400">Takes your backpack slot</span>
                      : "Leaves your backpack free"}
              </Fact>
            ) : null}
            {item.effect ? <Fact label="Effect">{item.effect}</Fact> : null}
            <Fact label="Unlocked by">
              {sourceLabelFor(item)}
              {item.acquisition.type === "warbond" ? <span className="text-base-500"> warbond</span> : null}
            </Fact>
          </Section>

          {/* The numbers the source tables never had, fetched from the    */}
          {/* wiki and joined on read. This row apologised for their        */}
          {/* absence for a week after the fetch had already filled them.   */}
          {wiki ? (
            <Section title="Handling and ammo">
              <Fact label="Magazine">
                {wiki.ammo && wiki.ammo.magazine !== undefined
                  ? `${wiki.ammo.magazine}${wiki.ammo.spareMagazines !== undefined ? `, ${wiki.ammo.spareMagazines} spare` : ""}`
                  : null}
              </Fact>
              <Fact label="From a resupply">
                {wiki.ammo && wiki.ammo.fromSupply !== undefined ? `${wiki.ammo.fromSupply} magazines` : null}
              </Fact>
              <Fact label="Rate of fire">
                {wiki.handling && wiki.handling.rpm !== undefined ? `${wiki.handling.rpm} rpm` : null}
              </Fact>
              <Fact label="Ergonomics">
                {wiki.handling && wiki.handling.ergonomics !== undefined
                  ? <>{wiki.handling.ergonomics}<span className="text-base-500"> · how fast the barrel follows the camera</span></>
                  : null}
              </Fact>
              <Fact label="Recoil">
                {wiki.handling && wiki.handling.recoilClimb !== undefined ? `${wiki.handling.recoilClimb} climb` : null}
              </Fact>
              <Fact label="Sway">
                {wiki.handling && wiki.handling.sway !== undefined ? `${wiki.handling.sway}` : null}
              </Fact>
              <Fact label="Durable damage">
                {wiki.primary && wiki.primary.durableRatio !== undefined
                  ? <>{Math.round(wiki.primary.durableRatio * 100)}%<span className="text-base-500"> of its damage survives against the big fleshy parts</span></>
                  : null}
              </Fact>
              <Fact label="Stagger">
                {wiki.primary && wiki.primary.stun !== undefined
                  ? `${wiki.primary.stun}${wiki.primary.push !== undefined ? `, ${wiki.primary.push} pushback` : ""}`
                  : null}
              </Fact>
              <Fact label="Pellets">
                {wiki.projectile && wiki.projectile.pellets !== undefined && wiki.projectile.pellets > 1
                  ? `${wiki.projectile.pellets}` : null}
              </Fact>
              <p className="text-[10px] leading-relaxed text-base-600">{STILL_MISSING}</p>
            </Section>
          ) : isWeapon ? (
            <p className="text-[10px] leading-relaxed text-base-600">{NO_FETCHED_STATS}</p>
          ) : null}

          {/* What the penetration number in Numbers is actually up        */}
          {/* against. On its own AP is a figure with nothing to measure   */}
          {/* it by, which is what this row showed from the day it first   */}
          {/* had an armor pen line. Now it has the other half.            */}
          {armour ? (
            <Section title={armour.title}>
              {armour.lines.map((l) => (
                <p key={l.say}
                  className={"text-[11px] leading-relaxed " +
                    (l.tone === "good" ? "text-emerald-400" : l.tone === "bad" ? "text-red-400" : "text-base-300")}>
                  {l.say}
                </p>
              ))}
              <p className="text-[10px] leading-relaxed text-base-600">
                <span className="text-base-500">This does not move the rating.</span> Almost every primary reads the
                same here, so charging one for it would be charging it for being a primary, which the community tier
                has already accounted for. You bring an assault rifle knowing something else in your kit opens armor.
                Whether your kit actually does is a question about the whole loadout, and that is where this comes
                back.
              </p>
              <p className="text-[10px] leading-relaxed text-base-600">
                Armor values per body part come from {enemySource.source}, counted over the {armour.reading.total}{" "}
                enemies that front always fields. The special strains and brigades are left out: they only exist while
                a galactic effect is running, and the tool has no way to know whether one is. {EXPOSURE_GAP}
              </p>
            </Section>
          ) : null}

          {/* The editorial layer, kept in its own block with its own      */}
          {/* provenance line rather than mixed into Numbers, so it never  */}
          {/* reads as something the source tables recorded.               */}
          {item.roles.length ? (
            <Section title="Role">
              {item.roles.map((r) => (
                <Fact key={r} label={(ROLE_FILTERS.find((x) => x.id === r) || {}).label || r}>
                  {ROLE_LABEL[r]}
                </Fact>
              ))}
              <p className="text-[10px] leading-relaxed text-base-600">{ROLE_PROVENANCE}</p>
            </Section>
          ) : null}

          {/* Why the second column disagrees with the first, in full. A     */}
          {/* score that cannot explain itself is a score nobody should       */}
          {/* trust, so this is the product rather than a detail.             */}
          {scored && scored.reasons.length ? (
            <Section title={scored.delta === 0 ? "Why this scenario does not move it" : "Why this scenario moves it"}>
              {scored.reasons.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                  <span className={"mt-px shrink-0 rounded px-1 py-px text-[10px] font-bold tabular-nums " +
                    (r.delta > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                    {r.delta > 0 ? "+" : ""}{r.delta}
                  </span>
                  <span className="text-base-300">{r.say}</span>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed text-base-600">
                Ours, not a community vote. The first column is the u.gg tier and this is what we make of it for your
                scenario, meaning the front, planet, biome, hazards and mission you picked above. Roughly 14 points is
                one tier, and no scenario can move a rating by more than two.
              </p>
            </Section>
          ) : null}

          {/* The two fronts the table no longer shows. They left the scan  */}
          {/* path, they did not leave the tool.                            */}
          <Section title="The other fronts">
            {FACTIONS.filter((f) => f.id !== faction).map((f) => (
              <Fact key={f.id} label={f.label}>
                <span style={{ color: f.hex }}>{item.ratings[f.id].tier || "no rating yet"}</span>
              </Fact>
            ))}
          </Section>

          <Section title="Where the ratings come from">
            {rated.length === 0 ? (
              <p className="text-[11px] text-base-500">Nothing rated yet, on any front.</p>
            ) : stamps.length === 1 ? (
              <p className="text-[11px] text-base-400">
                {sourceName[rated[0].r.source] || rated[0].r.source}, patch{" "}
                <span className="text-base-200">{rated[0].r.patch}</span>
                {rated[0].r.patch !== PATCH.game ? (
                  <span className="text-base-600"> · the game is on {PATCH.game}</span>
                ) : null}
              </p>
            ) : (
              rated.map(({ f, r }) => (
                <Fact key={f.id} label={f.short}>
                  {sourceName[r.source] || r.source}, patch {r.patch}
                </Fact>
              ))
            )}
            {rated.length > 0 && rated.length < 3 ? (
              <p className="text-[11px] text-base-500">
                Unrated against {FACTIONS.filter((f) => !item.ratings[f.id].tier).map((f) => f.label).join(" and ")}.
              </p>
            ) : null}
          </Section>

          {sets ? (
            <Section title="Armor sets with this passive">
              {["light", "medium", "heavy"].map((wt) => (
                <Fact key={wt} label={wt}>
                  {sets[wt].length === 0 ? (
                    <span className="text-base-600">not available</span>
                  ) : (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{sets[wt].join(", ")}</span>
                  )}
                </Fact>
              ))}
              <p className="text-[10px] leading-relaxed text-base-600">
                Weight vs medium: heavy is 10% slower with 25% less damage taken, light is 10% faster with 25% more.
                Numbers in brackets are armor/speed/stamina where the set differs from the standard for its class.
                Helmets and capes do nothing.
              </p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* Two rating columns, not three faction columns.                       */
/*                                                                     */
/* The faction is chosen above the table and is a constant while you    */
/* read it, so ranking the same row against all three fronts at once    */
/* is showing you two answers you did not ask for. What goes in the     */
/* freed width is the more useful comparison: what the community voted, */
/* against what this tool works out for where you are actually going.   */
/* The other two fronts are not lost, they move into the expanded row.  */
/*                                                                     */
/* Opaque, and deliberately not backdrop-blurred. A backdrop-filter on  */
/* a sticky element inside a long scrolling page made Chromium drop the */
/* paint for the whole document: layout stayed correct and the screen   */
/* went blank on scroll. It docks below the shell chrome, which is what */
/* --shell-chrome carries.                                              */
const RATING_COLUMNS = [
  { id: "ugg", label: "u.gg", title: "u.gg community vote" },
  { id: "ours", label: BRAND.short, title: "Our rating for the scenario you set" },
];

function RatingHeader({ faction, left, sortBy, setSortBy }) {
  const f = FACTIONS.find((x) => x.id === faction) || FACTIONS[0];
  return (
    <div className="sticky z-10 flex items-stretch border border-transparent bg-base-950"
      style={{ top: "var(--shell-chrome, 0px)" }}>
      <div className="flex-1 min-w-0 flex items-end px-3 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-base-600 font-semibold" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {left}
        </span>
      </div>
      <div className="flex items-stretch shrink-0">
        {/* Both columns are the sort control. The lit one is the one   */}
        {/* the list is ordered by, which used to be hardcoded to the     */}
        {/* vote and is now whichever you picked.                          */}
        {RATING_COLUMNS.map((c) => {
          const on = c.id === sortBy;
          return (
            <button key={c.id} onClick={() => setSortBy(c.id)} aria-pressed={on}
              title={on ? `Sorted by ${c.label}` : `Sort by ${c.label}. ${c.title}`}
              className="w-11 sm:w-16 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-t border-l transition-colors"
              style={{
                backgroundColor: on ? f.hex + "26" : "transparent",
                borderColor: f.hex + "33",
              }}>
              <span className="text-[9px] uppercase tracking-wider font-bold"
                style={{ fontFamily: "'Oswald', sans-serif", color: on ? f.hex : "rgb(var(--base-600))" }}>
                {c.label}
              </span>
              {/* A rule under the lit one, so which is active survives a  */}
              {/* theme where the tint is subtle.                          */}
              <span aria-hidden="true" className="h-[2px] w-4 rounded-full transition-opacity"
                style={{ backgroundColor: f.hex, opacity: on ? 1 : 0 }} />
            </button>
          );
        })}
      </div>
      <span className="w-6 shrink-0 sm:w-9" />
    </div>
  );
}

/* The second column, until the engine fills it. Deliberately not a "?"  */
/* badge: that already means "nobody has rated this" on the first        */
/* column, and two different absences wearing one glyph is worse than    */
/* an empty box that says what it is waiting for.                        */
/* Not the same thing as an unrated item. This is the second column      */
/* waiting for a scenario, so it is a dash rather than a question mark,   */
/* and it takes the plate's proportions so the column does not change     */
/* shape the moment you set a front.                                      */
function PendingBadge() {
  return (
    <span className="flex w-8 items-center justify-center rounded border border-dashed border-base-800 sm:w-9"
      style={{ aspectRatio: "44 / 58" }}
      title="Say where you are dropping and this fills in">
      <span className="h-1 w-3 rounded-full bg-base-800" />
    </span>
  );
}

/* Where an item comes from, as one readable label: a warbond by name,   */
/* or the acquisition path for everything that is not warbond gated.     */
function sourceLabelFor(item) {
  if (item.acquisition.type !== "warbond") return acquisitionLabels[item.acquisition.type];
  const w = warbondById.get(item.acquisition.warbond);
  return w ? w.name : item.acquisition.warbond;
}

/* The stats used to live inside the note as free text. They are fields  */
/* now, so the one line summary is rebuilt from them in the same order   */
/* it always read. Backpack use is left out because the amber dot        */
/* already says it and said it more clearly.                             */
export function statSummary(item) {
  const s = item.stats;
  const parts = [];
  if (s.ap !== null) parts.push(`AP${s.ap}${s.apClass ? ` ${s.apClass}` : ""}`);
  if (s.dps !== null) parts.push(`${s.dps} DPS`);
  if (s.capacity !== null) parts.push(`${s.capacity} carried`);
  if (s.demoForce !== null) parts.push(`demo ${s.demoForce}`);
  if (s.cooldown !== null) parts.push(`${s.cooldown}s cooldown`);
  if (s.uses !== null) {
    parts.push(s.usesUpgraded === null ? `${s.uses} uses` : `${s.uses} uses, ${s.usesUpgraded} upgraded`);
  }
  if (s.medals !== null) parts.push(`${s.medals} medals`);
  return parts;
}

/* onSelect turns the row into a picker entry. The lock, favorite and    */
/* expand controls inside it stop propagation so tapping them does not   */
/* also choose the item.                                                 */
function TierRow({ item, factionFilter, scenario, sortBy = "ours", isLocked, lockedByWarbond, toggleLock, isFav, toggleFav, open, onToggleOpen, onSelect }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const { id, name, flag } = item;
  /* factionFilter is a real front now, never "all": the table does not   */
  /* render at all until one is chosen.                                   */
  const factionMeta = FACTIONS.find((x) => x.id === factionFilter) || FACTIONS[0];
  const tier = item.ratings[factionMeta.id].tier;
  /* Null until the scenario says enough for a rule to have anything to work */
  /* with. A column of unchanged badges is worse than an empty one that   */
  /* says what it wants.                                                  */
  const scored = scenario && scenarioIsSet(scenario) ? scoreItem(item, scenario) : null;
  const meta = KIND_META[item.damageType] || KIND_META.ballistic;
  const KindIcon = meta.Icon;
  const isArmor = item.slot === "armor";
  /* Every item expands now, not just armor and flagged rows. There is    */
  /* always something worth saying: the numbers, and where the rating     */
  /* came from.                                                           */
  const flagged = flag === "new" || (flag === "stale" && item.patchNote);

  const stratMeta = item.slot === "stratagem" ? CAT_META[item.stratType] : null;
  const groupHex = stratMeta ? STRAT_GROUP[stratMeta.group].hex : null;
  /* The amber dot means "this eats your own backpack slot". Pointless on */
  /* the backpack subtype, where that is the entire item.                 */
  const takesBackpack = eatsBackpack(item);
  const weaponCat = item.category;
  const sourceLabel = sourceLabelFor(item);
  /* Armor and boosters carry an effect where a weapon carries a note.   */
  const subtitle = [sourceLabel, ...statSummary(item), item.effect || item.note]
    .filter(Boolean)
    .join(" · ");

  return (
    /* fx-row lights the leading edge and bleeds inward on skins that glow, */
    /* and collapses to nothing on the ones that do not. Both the Foundry   */
    /* and the Creek studies do exactly this on row hover.                  */
    <div className={"fx-row rounded-lg border overflow-hidden " + (isLocked ? "border-base-800 bg-base-900/40" : "border-base-800 bg-base-900")}>
      {/* The whole row is the target, not just the chevron. In the picker */}
      {/* that means choose, in the tier list it means expand.             */}
      <div className="flex items-stretch cursor-pointer hover:bg-base-800/50"
        onClick={() => (onSelect ? onSelect(item) : onToggleOpen(id))}
        role="button"
        aria-expanded={onSelect ? undefined : open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onSelect) onSelect(item); else onToggleOpen(id);
          }
        }}>
        <div className="flex items-center gap-1.5 px-2 py-1.5 flex-1 min-w-0 sm:gap-2 sm:px-2.5 sm:py-2.5">
          {/* Stacked on a phone, side by side from sm. Two 24px buttons in */}
          {/* a row cost a whole button width out of a 343px line, and the  */}
          {/* row is already tall enough to hold them one above the other.  */}
          <span className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:gap-2">
            <button onClick={stop(() => toggleLock(id))} disabled={lockedByWarbond}
              aria-label={isLocked ? `Mark ${name} as unlocked` : `Mark ${name} as not unlocked`}
              title={lockedByWarbond ? `Locked by the ${sourceLabel} warbond. Change it in the Warbonds tab.` : "Tap to mark as not unlocked"}
              className={"shrink-0 rounded p-1 " + (lockedByWarbond ? "cursor-default" : "hover:bg-base-800")}>
              {isLocked ? <Lock className={"w-4 h-4 " + (lockedByWarbond ? "text-accent-700" : "text-accent-500")} />
                : <Unlock className="w-4 h-4 text-base-700 hover:text-base-400" />}
            </button>

            <button onClick={stop(() => toggleFav(id))}
              aria-label={isFav ? `Remove ${name} from favorites` : `Add ${name} to favorites`} aria-pressed={isFav}
              title={isFav ? "Favorite" : "Mark as a favorite"}
              className="shrink-0 rounded p-1 hover:bg-base-800">
              <Star className={"w-4 h-4 " + (isFav ? "fill-accent-400 text-accent-400" : "text-base-700 hover:text-base-400")} />
            </button>
          </span>

          <div className={"flex items-center gap-2 flex-1 min-w-0 sm:gap-2.5 " + (isLocked ? "opacity-40" : "")}>
            <ItemArt item={item} className="h-8 w-8 sm:h-10 sm:w-10" />
            {stratMeta ? (
              <span className="hidden sm:flex items-center gap-1.5 shrink-0 w-[108px]" title={STRAT_GROUP[stratMeta.group].label}>
                <stratMeta.Icon className="w-4 h-4 shrink-0" style={{ color: groupHex }} />
                <span className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ fontFamily: "'Oswald', sans-serif", color: groupHex }}>
                  {stratMeta.label}
                </span>
              </span>
            ) : weaponCat ? (
              <span className="hidden sm:inline-block shrink-0 w-[86px] text-[10px] uppercase tracking-wider font-semibold text-base-500 truncate"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                {weaponCat}
              </span>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {KindIcon ? (
                  <KindIcon className="w-3.5 h-3.5 shrink-0 text-base-500" title={meta.label + (meta.note ? ` · ${meta.note}` : "")} />
                ) : null}
                <span className={"text-sm truncate " + (isLocked ? "text-base-400 line-through" : "text-base-100")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {name}
                </span>
                {takesBackpack ? (
                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent-500" title="Uses your backpack slot" />
                ) : null}
                {flag === "new" ? (
                  <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide bg-base-800 text-base-400 border border-base-700">new</span>
                ) : null}
              </div>
              <p className="text-[11px] text-base-500 truncate">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-stretch shrink-0">
          {/* What the crowd said, then what we say about where you are    */}
          {/* going. The faction tint marks the column the list is sorted   */}
          {/* by, so it follows the lit header rather than sitting on the   */}
          {/* vote whatever you picked.                                     */}
          <div title={`${factionMeta.label}: ${tier || "no rating yet"}`}
            className="w-12 sm:w-16 flex items-center justify-center border-l px-1 py-1.5"
            style={{
              backgroundColor: sortBy === "ugg" ? factionMeta.hex + "14" : "transparent",
              borderColor: factionMeta.hex + "33",
            }}>
            <TierBadge tier={tier} quiet={sortBy !== "ugg"} className={ROW_BADGE} />
          </div>
          <div className="w-12 sm:w-16 flex items-center justify-center border-l px-1 py-1.5"
            style={{
              backgroundColor: sortBy === "ours" ? factionMeta.hex + "14" : "transparent",
              borderColor: factionMeta.hex + "33",
            }}
            title={scored && scored.reasons.length
              ? scored.reasons.map((r) => r.say).join(" ")
              : scored ? "Nothing about where you are dropping changes where this sits" : undefined}>
            {!scored || !scored.tier ? (
              <PendingBadge />
            ) : (
              <span className="relative flex items-center">
                <TierBadge tier={scored.tier} quiet={sortBy !== "ours"} className={ROW_BADGE} />
                {/* Top left, because that corner of the plate is square  */}
                {/* and the top right is the chamfer. A round marker over  */}
                {/* a cut corner reads as damage rather than as a badge.   */}
                {scored.delta !== 0 ? (
                  <span className={"absolute -left-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-base-900 " +
                    (scored.delta > 0 ? "bg-emerald-500 text-emerald-950" : "bg-red-500 text-red-950")}>
                    {scored.delta > 0
                      ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} />
                      : <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>

        <div className="w-6 shrink-0 flex items-center justify-center gap-0.5 sm:w-9">
          {flagged ? (
            <HelpCircle className="w-4 h-4 shrink-0 text-accent-500" title="Read the rating caveat" />
          ) : null}
          {onSelect ? null : (
            <ChevronDown className={"w-4 h-4 shrink-0 text-base-600 transition-transform " + (open ? "rotate-180" : "")} />
          )}
        </div>
      </div>
      {open && !onSelect ? <RowDetail item={item} faction={factionMeta.id} scored={scored}
          difficulty={scenario ? scenario.difficulty : 0} /> : null}
    </div>
  );
}

/* The filter pane is most of a screen with everything on show, and most  */
/* sessions only touch faction and tier. Folded it keeps those two, and   */
/* the arrow at the bottom of the pane unfolds the rest. The choice is    */
/* remembered per browser.                                                */
const FILTER_VIEW_IDS = ["simple", "advanced"];

export const BLANK_FILTERS = {
  kind: "all", minTier: "D", lock: "bottom", fav: "inline",
  query: "", hiddenCats: [], types: [], traits: [], roles: [],
};

/* ================================================================== */
/* CHOOSING A FRONT                                                   */
/*                                                                    */
/* One button, two sizes. The bar above the table and the chooser     */
/* that stands in for the table are the same decision at different    */
/* weights, so they are one control rather than two that have to be   */
/* kept looking alike by hand.                                        */
/*                                                                    */
/* Each wears its own front's key art, muted hard and darkened toward */
/* the label so the text sits on ground rather than on a bug. Tall    */
/* crops for the chooser, wide bands for the bar.                     */
/*                                                                    */
/* Art is optional here as everywhere. With src/assets empty the      */
/* buttons keep their border, their mark and their colour, and simply */
/* have no picture behind them.                                       */
/*                                                                    */
/* Faction hexes stay literal. They are a locked decision and never   */
/* become theme tokens, so a warbond skin cannot repaint bots away    */
/* from red. Everything else on the button reads from the ramp.       */
/* ================================================================== */

const factionArt = (id, shape) => uiArt(`faction_picker_${shape}_${id}`);

/* `compact` is the planner's size: icon over name at every width, because
   three of them share a narrow column there. */
function FactionPick({ faction: f, on, hero, dimmed, onChoose, compact = false }) {
  /* The chooser has no chosen one, so dimming all three there would be  */
  /* three greyed out buttons asking to be pressed. Hero is always lit;  */
  /* the bar lights only the front you are on.                           */
  /*                                                                     */
  /* dimmed is the third state and it only exists once something is      */
  /* picked: the two you did not pick step back so the one you did reads */
  /* at a glance. With nothing picked none of them dim, which is what    */
  /* keeps the first visit an invitation rather than a rejection.        */
  const lit = on || hero;
  const art = factionArt(f.id, hero ? "tall" : "wide");

  return (
    <button onClick={() => onChoose(f.id)} aria-pressed={hero ? undefined : on}
      title={`Rank everything against ${f.label}`}
      className={
        "group relative flex flex-1 overflow-hidden rounded-lg border-2 transition-all duration-200 " +
        (hero
          ? "aspect-[1/2] max-w-[9rem] flex-col items-center justify-end gap-1.5 px-3 pb-4 hover:-translate-y-1 sm:max-w-[clamp(7rem,calc((100vh-34rem)/2),13rem)] sm:gap-2"
          : compact
            ? "min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2"
            : "min-h-[3.25rem] flex-col items-center justify-center gap-1 px-2 py-2 sm:min-h-[3.5rem] sm:flex-row sm:gap-2.5") +
        (on ? " -translate-y-0.5" : "") +
        (dimmed ? " opacity-60 saturate-50 hover:opacity-100 hover:saturate-100" : "") +
        (lit ? "" : " border-base-800 hover:-translate-y-0.5 hover:border-base-600")
      }
      style={lit
        ? {
            borderColor: on ? f.hex : dimmed ? f.hex + "2b" : f.hex + "66",
            /* Picked glows harder and sits on a wider, softer pool. The  */
            /* two numbers are the same shape as the unpicked shadow, so  */
            /* the difference reads as more of the same thing rather      */
            /* than as a different treatment.                             */
            boxShadow: on
              ? `0 0 34px ${f.hex}4a, 0 0 12px ${f.hex}33, 0 6px 18px rgb(0 0 0 / 0.35)`
              : undefined,
          }
        : undefined}>

      {/* The art, well behind everything and muted to a texture rather   */}
      {/* than a picture competing with the label.                        */}
      {art ? (
        <span aria-hidden="true"
          className={"pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-300 " +
            (hero
              ? (on ? "opacity-65 group-hover:opacity-80" : dimmed ? "opacity-25 group-hover:opacity-60" : "opacity-45 group-hover:opacity-75")
              : on ? "opacity-40" : "opacity-[0.16] group-hover:opacity-35")}
          style={{ backgroundImage: `url(${art})` }} />
      ) : null}

      {/* A wash in the front's own colour, then a darkening toward the   */}
      {/* label so it always has ground under it.                         */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: lit ? f.hex + "1a" : "rgb(var(--base-950) / 0.5)" }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: hero
            ? "linear-gradient(to top, rgb(var(--base-950) / 0.94) 14%, rgb(var(--base-950) / 0.4) 58%, transparent)"
            : "linear-gradient(to right, rgb(var(--base-950) / 0.86), rgb(var(--base-950) / 0.5))",
        }} />

      {/* The accent bar, the same language the loadout cards use. Full   */}
      {/* strength when chosen, a hint on hover so the button says which  */}
      {/* colour it is about to become.                                   */}
      <span className={"absolute inset-x-0 top-0 h-[3px] transition-opacity duration-200 " +
          (on ? "opacity-100" : hero ? "opacity-70 group-hover:opacity-100" : "opacity-0 group-hover:opacity-60")}
        style={{ backgroundColor: f.hex }} />

      <f.Icon
        className={"relative shrink-0 transition-all duration-200 " +
          (hero ? "h-9 w-9 sm:h-12 sm:w-12" : compact ? "h-5 w-5" : "h-5 w-5 sm:h-6 sm:w-6") +
          (lit ? "" : " opacity-45 group-hover:opacity-80")}
        style={{ color: lit ? f.hex : "rgb(var(--base-400))" }} />

      <span className={"relative font-bold uppercase leading-none tracking-wider transition-colors " +
          (hero ? "text-xs sm:text-base" : compact ? "text-[10px]" : "text-[11px] sm:text-sm")}
        style={{ fontFamily: "'Oswald', sans-serif", color: lit ? f.hex : "rgb(var(--base-500))" }}>
        {f.label}
      </span>

      {hero ? (
        <span className="relative text-[9px] uppercase tracking-widest text-base-400 sm:text-[10px]">{f.short}</span>
      ) : null}
    </button>
  );
}

/* No faction chosen means no table. The front is a given before you open */
/* this tool, and everything downstream reads differently per front: the  */
/* mission list, the biomes, and eventually the whole contextual rating.  */
/* Guessing one for you would be inventing the most important input.      */
/* Since 2 October 2026 App.jsx sends you to the war room until one is    */
/* chosen, and Done brings you back. See WarRoom.jsx.                      */

/**
 * The one line reminder. Always on screen wherever the scenario is
 * being read, because a rating computed from a choice you have
 * forgotten making is worse than no rating at all.
 */
export function ScenarioBar({ scenario, onAdjust, rulesOff = 0, onRules }) {
  const f = FACTIONS.find((x) => x.id === scenario.faction);
  if (!f) return null;
  const d = difficultyAt(scenario.difficulty);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 sm:px-6"
      style={{ backgroundColor: f.hex + "0f", borderColor: f.hex + "33" }}>
      <span className="flex items-center gap-1.5">
        <f.Icon className="h-4 w-4 shrink-0" style={{ color: f.hex }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: "'Oswald', sans-serif", color: f.hex }}>
          {f.label}
        </span>
      </span>

      <Chip>{scenario.planet || (scenario.biome ? biomeName(scenario.biome) : "any planet")}</Chip>
      <Chip>{scenario.mission || "any mission"}</Chip>
      <Chip icon={d ? <DifficultyIcon level={d.level} className="h-3.5 w-6" /> : null}>
        {d ? d.name : "any difficulty"}
      </Chip>
      <Chip>{scenario.squad === 1 ? "solo" : scenario.squad ? `${scenario.squad} of you` : "squad not said"}</Chip>

      {/* A switched off rule changes every rating on screen, so it is never
          out of sight: the same rule the folded filter pane keeps. */}
      {rulesOff ? (
        <button onClick={onRules}
          className="ml-auto shrink-0 rounded border border-accent-700/70 bg-accent-950/40 px-2 py-1 text-[11px] text-accent-300 hover:border-accent-500">
          {rulesOff} {rulesOff === 1 ? "rule" : "rules"} off
        </button>
      ) : null}

      <button onClick={onAdjust}
        className={(rulesOff ? "" : "ml-auto ") + "flex shrink-0 items-center gap-1.5 rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-300 hover:border-base-500 hover:text-base-100"}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Adjust scenario
      </button>
    </div>
  );
}

function Chip({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-base-400">
      {icon}
      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{children}</span>
    </span>
  );
}

function FactionChooser({ onChoose }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-dashed border-base-700 px-4 py-10">
      <div className="text-center">
        <p className="text-lg font-bold text-base-200" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Which front are you dropping on
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-base-500">
          Every rating here is per front, and so is everything that comes after it. Pick one and the list ranks for
          that war. You can change it at any time from the buttons at the top.
        </p>
      </div>
      <div className="flex w-full max-w-3xl items-stretch justify-center gap-3 sm:gap-6">
        {FACTIONS.map((f) => (
          <FactionPick key={f.id} faction={f} hero on={false} onChoose={onChoose} />
        ))}
      </div>
    </div>
  );
}

/* Full width above the filter pane rather than inside it, because it is  */
/* not a filter. A filter narrows a list you can already see; this        */
/* decides whether there is a list at all.                                */
function FactionBar({ faction, onChoose }) {
  return (
    <div className="flex items-stretch gap-2 sm:gap-3">
      {FACTIONS.map((f) => (
        <FactionPick key={f.id} faction={f} on={f.id === faction} onChoose={onChoose} />
      ))}
    </div>
  );
}

export function TierBrowser({ catId, faction, scenario, sortBy, setSortBy, filters, patchFilters, lockedSet, warbondLockedSet, toggleLock, clearItemLocks, itemLockCount, favoriteItems, toggleFavItem, clearFavItems }) {
  const [openRow, setOpenRow] = useState(null);
  /* Switching category is a route change now, so the open row is closed  */
  /* when the category under it changes rather than by the tab handler.   */
  useEffect(() => { setOpenRow(null); }, [catId]);

  const [view, setViewState] = useState(() => readSetting(SETTINGS.filterView, FILTER_VIEW_IDS, "simple"));
  const advanced = view === "advanced";
  const setView = useCallback((next) => {
    setViewState(next);
    writeSetting(SETTINGS.filterView, next);
  }, []);
  /* Filters are per category, and they are owned by the shell rather than */
  /* by this component. Held here they were discarded every time you       */
  /* glanced at Drop Bay, which threw away real work for nothing.          */
  const f = filters[catId] || BLANK_FILTERS;
  const setF = useCallback((patch) => patchFilters(catId, patch), [catId, patchFilters]);

  const category = CATEGORIES.find((c) => c.id === catId);
  const shape = FILTER_SHAPE[catId] || {};
  const fTheme = FACTION_THEME[faction] || FACTION_THEME.all;
  const isArmor = catId === "armor";
  const favSet = useMemo(() => new Set(favoriteItems), [favoriteItems]);
  const toggleOpen = useCallback((n) => setOpenRow((p) => (p === n ? null : n)), []);

  const catOptions = useMemo(() => {
    const seen = [];
    for (const it of category.items) {
      if (it.category && !seen.includes(it.category)) seen.push(it.category);
    }
    return seen.sort().map((c) => ({ id: c, label: c }));
  }, [category]);

  const rows = useMemo(() => {
    const sortFaction = faction;
    const judged = (it) => judgedTier(it, sortFaction);

    return category.items
      .filter((it) => {
        const locked = lockedSet.has(it.id);
        if (f.lock === "hide" && locked) return false;
        if (f.lock === "only" && !locked) return false;
        if (f.fav === "only" && !favSet.has(it.id)) return false;
        if (f.query && !it.name.toLowerCase().includes(f.query.toLowerCase())) return false;

        if (shape.kind) {
          /* The real answer, not the damage type. A Purifier reads as heat */
          /* and cannot overheat; the LAS family and the Quasar can.        */
          const thermal = ventsHeat(it);
          if (f.kind === "thermal" && !thermal) return false;
          if (f.kind !== "all" && f.kind !== "thermal" && it.damageType !== f.kind) return false;
        }
        if (shape.weaponCat && f.hiddenCats.length && f.hiddenCats.includes(it.category)) return false;
        if (shape.stratType && f.types.length && !f.types.includes(it.stratType)) return false;
        if (shape.armorTrait && f.traits.length && !it.traits.some((x) => f.traits.includes(x))) return false;
        if (shape.role && f.roles.length && !it.roles.some((x) => f.roles.includes(x))) return false;

        /* The tier floor judges whatever value is being ranked. An       */
        /* unrated item has no value to judge, so the floor cannot        */
        /* exclude it. That is the only way a Castellan's Creed weapon    */
        /* ever gets seen and tried.                                      */
        const j = judged(it);
        if (!j) return true;
        return TIER_RANK[j] >= TIER_RANK[f.minTier];
      })
      .slice()
      .sort((a, b) => {
        const aLock = lockedSet.has(a.id) ? 1 : 0;
        const bLock = lockedSet.has(b.id) ? 1 : 0;
        if (aLock !== bLock) return aLock - bLock;
        if (f.fav === "top") {
          const aFav = favSet.has(a.id) ? 0 : 1;
          const bFav = favSet.has(b.id) ? 0 : 1;
          if (aFav !== bFav) return aFav - bFav;
        }
        const aNew = judged(a) ? 0 : 1;
        const bNew = judged(b) ? 0 : 1;
        if (aNew !== bNew) return aNew - bNew;
        /* Whichever column the header says it is ordered by. Ours is  */
        /* the default. With no scenario set the engine returns the base */
        /* untouched, so sorting by ours quietly becomes sorting by the  */
        /* vote rather than sorting by nothing.                          */
        const value = (it) =>
          sortBy === "ugg"
            ? (sortFaction ? rank(it.ratings[sortFaction].tier) : averageRank(it))
            : rank(scoreItem(it, scenario || {}).tier);
        const av = value(a);
        const bv = value(b);
        if (bv !== av) return bv - av;
        return a.name.localeCompare(b.name);
      });
  }, [category, shape, f, faction, lockedSet, favSet, sortBy, scenario]);

  /* Anything narrowing the list that Simple view does not show. Hiding a */
  /* control while it is still filtering is how you end up staring at an  */
  /* empty list wondering what happened, so Simple names what it hid and  */
  /* offers one click to drop it.                                         */
  const hiddenFilters = [];
  if (shape.kind && f.kind !== "all") {
    hiddenFilters.push((KIND_FILTERS.find((k) => k.id === f.kind) || {}).label || f.kind);
  }
  if (shape.weaponCat && f.hiddenCats.length) hiddenFilters.push(`${f.hiddenCats.length} category hidden`);
  if (shape.stratType && f.types.length) hiddenFilters.push(`${f.types.length} stratagem type`);
  if (shape.armorTrait && f.traits.length) hiddenFilters.push(`${f.traits.length} trait`);
  if (shape.role && f.roles.length) {
    hiddenFilters.push(f.roles.map((r) => (ROLE_FILTERS.find((x) => x.id === r) || {}).label).join(" or "));
  }
  if (f.lock !== "bottom") hiddenFilters.push((LOCK_FILTERS.find((l) => l.id === f.lock) || {}).label);
  if (f.fav !== "inline") hiddenFilters.push((FAV_FILTERS.find((x) => x.id === f.fav) || {}).label);
  if (f.query) hiddenFilters.push(`search "${f.query}"`);

  const clearAdvanced = () =>
    setF({ kind: "all", hiddenCats: [], types: [], traits: [], roles: [], lock: "bottom", fav: "inline", query: "" });

  const lockedInCategory = category.items.filter((it) => lockedSet.has(it.id)).length;
  const favInCategory = category.items.filter((it) => favSet.has(it.id)).length;
  const flaggedInCategory = category.items.filter((it) => it.flag).length;
  const unratedInCategory = category.items.filter((it) => judgedTier(it, null) === null).length;
  const backpackHere = catId === "strat" ? category.items.filter(eatsBackpack).length : 0;

  /* No front, no table. App.jsx sends you to the war room, so this is
     only ever drawn for the moment before that. */
  if (!faction) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="fx-panel rounded-lg border border-base-800 bg-base-900/60">
        <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TierChips label="Minimum tier" value={f.minTier} onChange={(v) => setF({ minTier: v })} />
          {advanced && shape.kind ? (
            <Chips label="Damage type" options={KIND_FILTERS} value={f.kind}
              onChange={(v) => setF({ kind: v })} activeClass="bg-base-200 text-base-900 border-base-200" />
          ) : null}
          {advanced && shape.weaponCat ? (
            <MultiChips label="Weapon category" hint="click to hide" mode="exclude" options={catOptions}
              value={f.hiddenCats} onChange={(v) => setF({ hiddenCats: v })} />
          ) : null}
          {advanced && shape.stratType ? (
            <MultiChips label="Stratagem type" hint="click to narrow" mode="include" options={STRAT_TYPE_FILTERS}
              value={f.types} onChange={(v) => setF({ types: v })} />
          ) : null}
          {advanced && shape.armorTrait ? (
            <MultiChips label="What it does" hint="click to narrow" mode="include" options={ARMOR_TRAIT_FILTERS}
              value={f.traits} onChange={(v) => setF({ traits: v })} />
          ) : null}
          {advanced && shape.role ? (
            <MultiChips label="Role" hint="our call, not a vote" mode="include" options={ROLE_FILTERS}
              value={f.roles} onChange={(v) => setF({ roles: v })} />
          ) : null}
        </div>

        {/* Your collection, not the gear. Kept behind its own rule and its  */}
        {/* own heading, because a padlock is a fact about what you own and  */}
        {/* everything above is a fact about the item.                       */}
        {advanced ? (
          <div className="flex flex-col gap-3 border-t border-base-800 pt-3">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-base-600" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Yours
            </span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Chips label="Locked items" options={LOCK_FILTERS} value={f.lock}
                onChange={(v) => setF({ lock: v })} activeClass="bg-accent-500 text-accent-950 border-accent-500" />
              <Chips label="Favorites" options={FAV_FILTERS} value={f.fav}
                onChange={(v) => setF({ fav: v })} activeClass="bg-accent-400 text-accent-950 border-accent-400" />
              <div>
                <span className="mb-1.5 block font-semibold uppercase tracking-wider text-[10px] text-base-500" style={{ fontFamily: "'Oswald', sans-serif" }}>Search</span>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-500" />
                  <input value={f.query} onChange={(e) => setF({ query: e.target.value })} placeholder="Search"
                    className="w-full bg-base-900 border border-base-700 rounded pl-7 pr-2 py-1.5 text-xs text-base-100 placeholder-base-600 focus:border-base-500 outline-none" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!advanced && hiddenFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-accent-800/60 bg-accent-950/40 px-2.5 py-1.5 text-[11px] text-accent-300">
            <FilterX className="w-3.5 h-3.5 shrink-0" />
            <span>Still filtering by {hiddenFilters.join(", ")}, folded away below.</span>
            <button onClick={clearAdvanced} className="underline hover:text-accent-200">clear</button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-base-500 border-t border-base-800 pt-3">
          <span>{rows.length} of {category.items.length} shown</span>
          {lockedInCategory > 0 ? <span className="text-accent-500">{lockedInCategory} locked here</span> : null}
          {favInCategory > 0 ? (
            <span className="flex items-center gap-1 text-accent-400"><Star className="w-3.5 h-3.5 fill-accent-400" /> {favInCategory} favorited here</span>
          ) : null}
          {shape.kind ? <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> vents heat: better in cold, worse in hot</span> : null}
          {backpackHere > 0 ? (
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> {backpackHere} eat your backpack slot</span>
          ) : null}
          {unratedInCategory > 0 ? (
            <span>{unratedInCategory} unrated, always shown at the bottom whatever the tier floor</span>
          ) : null}
          {flaggedInCategory > 0 ? (
            <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5 text-accent-500" /> {flaggedInCategory} with a rating caveat, tap to read it</span>
          ) : null}
          <span className="flex items-center gap-1">
            <ChevronDown className="w-3.5 h-3.5" />
            {isArmor ? "tap a row for its numbers, provenance and the sets that carry it" : "tap a row for its numbers and where the rating came from"}
          </span>
          {itemLockCount > 0 ? (
            <button onClick={clearItemLocks} className="text-base-400 underline hover:text-base-100">clear {itemLockCount} item locks</button>
          ) : null}
          {favoriteItems.length > 0 ? (
            <button onClick={clearFavItems} className="text-base-400 underline hover:text-base-100">clear {favoriteItems.length} favorites</button>
          ) : null}
        </div>
        </div>

        <button onClick={() => setView(advanced ? "simple" : "advanced")}
          aria-expanded={advanced}
          title={advanced ? "Fold the filters away" : "Damage type, categories, locks, favorites and search"}
          className="flex w-full items-center justify-center gap-1.5 border-t border-base-800 py-1.5 text-[11px] text-base-500 transition-colors hover:bg-base-800/60 hover:text-base-200">
          <ChevronDown className={"w-4 h-4 transition-transform " + (advanced ? "rotate-180" : "")} />
          {advanced ? "Fewer filters" : "More filters"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <RatingHeader faction={faction} left={category.label} sortBy={sortBy} setSortBy={setSortBy} />
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-base-700 py-8 text-center text-sm text-base-400">
            {f.fav === "only" && favInCategory === 0
              ? "Nothing favorited in this list yet. Tap a star on any row to keep it here."
              : "Nothing matches those filters. Drop the minimum tier, clear the search, or reset the category chips."}
          </div>
        ) : (
          rows.map((it) => (
            <TierRow key={it.id} item={it} factionFilter={faction} scenario={scenario} sortBy={sortBy}
              isLocked={lockedSet.has(it.id)} lockedByWarbond={warbondLockedSet.has(it.id)}
              toggleLock={toggleLock} isFav={favSet.has(it.id)} toggleFav={toggleFavItem}
              open={openRow === it.id} onToggleOpen={toggleOpen} />
          ))
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* WARBONDS                                                           */
/* ================================================================== */

/* Export and import. Added during the move off the artifact, because a   */
/* browser's storage is not a backup, and because a filled in ownership   */
/* file needs a way into a browser that already has state.                */
export function BackupPanel({ onExport, onImport }) {
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let doc;
      try {
        doc = JSON.parse(String(reader.result));
      } catch (e) {
        setStatus({ ok: false, text: "That file is not valid JSON." });
        return;
      }
      setStatus(onImport(doc));
    };
    reader.onerror = () => setStatus({ ok: false, text: "That file could not be read." });
    reader.readAsText(file);
  };

  return (
    <div className="rounded-lg border border-base-800 bg-base-900 overflow-hidden">
      <div className="border-b border-base-800 px-4 py-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Backup and transfer
        </h3>
        <p className="text-[11px] text-base-500">
          Export writes one file holding your warbonds, item locks and favorites. Import takes that file back, or an
          ownership list in the same shape as src/data/ownership.json.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button onClick={onExport}
          className="flex items-center gap-1.5 rounded border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button onClick={() => inputRef.current && inputRef.current.click()}
          className="flex items-center gap-1.5 rounded border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
          <Upload className="w-3.5 h-3.5" /> Import
        </button>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { handleFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
        {status ? (
          <span className={"text-[11px] " + (status.ok ? "text-base-400" : "text-red-400")}>{status.text}</span>
        ) : null}
      </div>
    </div>
  );
}

/* The Warbonds and Items tabs that used to live here now sit in         */
/* Collection.jsx, next to each other, because they are two views of one  */
/* thing: what you own.                                                   */

/* ================================================================== */
/* PICKER                                                             */
/* ================================================================== */

function StratChip({ id, isLocked }) {
  const item = getItem(id);
  const meta = CAT_META[item && item.stratType] || CAT_META.support;
  const { Icon } = meta;
  /* Same rule as the tier list: the dot warns that a support weapon eats */
  /* your backpack slot. On a backpack it would be stating the obvious.   */
  const takesBackpack = item ? eatsBackpack(item) : false;
  return (
    <div className={"relative flex items-start gap-1.5 rounded px-1.5 py-1.5 pr-3 " + (isLocked ? "bg-base-800/40" : "bg-base-800/80")}
      title={meta.label + (takesBackpack ? " (uses backpack slot)" : "") + (isLocked ? " · not unlocked" : "")}>
      {isLocked ? <Lock className="w-3.5 h-3.5 shrink-0 mt-px text-accent-500" />
        : <Icon className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: STRAT_GROUP[meta.group].hex }} />}
      <span className={"text-[10px] leading-tight " + (isLocked ? "text-base-500 line-through" : "text-base-300")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {itemName(id)}
      </span>
      {takesBackpack ? <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent-500" /> : null}
    </div>
  );
}

/* ================================================================== */
/* THE LOADOUT READING                                                */
/*                                                                    */
/* Two badges, deliberately the same two column pattern the tier list */
/* uses, and for the same reason: the difference between them is the  */
/* thing worth putting on screen.                                     */
/*                                                                    */
/* On a tier row the pair is a community vote and what we make of it. */
/* There is no community vote on a loadout, so here it is what the    */
/* gear is worth where you are dropping, and what the nine pieces are */
/* worth together. A kit whose parts average an A and which fits      */
/* together like a B is the interesting case, and showing only the B  */
/* makes it a verdict you cannot argue with.                          */
/*                                                                    */
/* Every point of movement carries its sentence, same contract the    */
/* expanded tier row keeps. A build that moved and will not say why   */
/* is worse than a build with no reading at all.                      */
/* ================================================================== */

/* The severity words and colours the squad panel already uses, because a
   critical on a card and a critical in the squad panel are the same claim
   about the same kind of gap. */
const NOTE_TONE = {
  red: "bg-red-500/15 text-red-400",
  amber: "bg-accent-500/15 text-accent-400",
  grey: "bg-base-700/50 text-base-400",
};

function ReadingBadge({ label, tier, quiet, delta }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-base-500"
        style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
      <span className="relative flex items-center">
        <TierBadge tier={tier} quiet={quiet} className="w-8 h-auto" />
        {/* Top left, the same corner the tier row puts it on: that corner
            of the plate is square and the top right is the chamfer. */}
        {delta ? (
          <span className={"absolute -left-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-base-900 " +
            (delta > 0 ? "bg-emerald-500 text-emerald-950" : "bg-red-500 text-red-950")}>
            {delta > 0 ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} />
              : <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * reading  what readBuild returned, or null when no front is chosen
 * compact  the card wants the badges and the sentences and nothing else.
 *          The builder has room for the arithmetic underneath.
 */
export function LoadoutReading({ reading, compact }) {
  if (!reading || reading.score === null) return null;

  const moved = TIER_RANK[reading.tier] - TIER_RANK[reading.partsTier];

  return (
    <div className="border-t border-base-800 pt-2.5">
      <div className="flex items-start gap-4">
        <ReadingBadge label="Gear" tier={reading.partsTier} quiet={Boolean(moved)} />
        <ReadingBadge label="Build" tier={reading.tier} delta={moved} />
        <p className="flex-1 pt-3 text-[10px] leading-relaxed text-base-500">
          {reading.adjust === 0
            /* Agreeing is a real answer, the same call the second tier
               column makes. An empty box would read as a rendering fault.
               It keys on the points rather than on the badge: a build can
               gain eight without crossing a band, and saying nothing
               changed directly above a green +8 is the tool contradicting
               itself in two lines. */
            ? "Nothing about how this fits together changes what the gear is worth."
            : explainScore(reading)}
        </p>
      </div>

      {reading.notes.length ? (
        <div className="mt-2 flex flex-col gap-1">
          {reading.notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className={"mt-px shrink-0 rounded px-1 py-px text-[10px] font-bold tabular-nums " +
                (n.delta > 0 ? "bg-emerald-500/15 text-emerald-400"
                  : n.delta < 0 ? "bg-red-500/15 text-red-400"
                    : NOTE_TONE[n.severity] || NOTE_TONE.grey)}>
                {n.delta > 0 ? "+" : ""}{Math.round(n.delta)}
              </span>
              <span className="text-base-300">{n.say}</span>
            </div>
          ))}
        </div>
      ) : null}

      {compact ? null : (
        <p className="mt-2 text-[10px] leading-relaxed text-base-600">
          Ours, and there is no community vote on a loadout to set it against. The left badge is what these nine items
          are worth where you are dropping, each scored by the same rules the tier list shows. The right one is what
          they are worth together. Roughly 14 points is one tier, and nothing about the combination can move it by more
          than two.
        </p>
      )}
    </div>
  );
}

export function LoadoutCard({ loadout, isFavorite, onToggleFavorite, rankLabel, biome, scenario, lockedSet, onOpen, onDelete, inCompare, onToggleCompare, compareFull }) {
  const theme = FACTION_THEME[loadout.faction];
  /* Scored against the front the build is for rather than the one the
     scenario names. A bugs build never appears on a bot screen, and
     reading it against bots would be answering a question nobody asked. */
  const reading = useMemo(
    () => (scenario && scenario.faction ? readBuild(loadout, { ...scenario, faction: loadout.faction }) : null),
    [loadout, scenario]
  );
  const biomeMatch = biome !== "any" && loadout.biomes.includes(biome);
  const fireNote = biome === "hot" && loadout.fire;
  const lockedHere = loadoutItems(loadout).filter((id) => lockedSet.has(id));
  const staleHere = loadoutItems(loadout)
    .map(getItem)
    /* The flag, not the note. Keyed on the note, this kept warning about  */
    /* items whose caveat had been retired, for as long as a note survived. */
    .filter((it) => it && it.flag === "stale" && it.patchNote)
    .map((it) => it.name);
  const rows = [["Primary", loadout.primary], ["Secondary", loadout.secondary], ["Grenade", loadout.grenade], ["Armor", loadout.armor], ["Booster", loadout.booster]];

  return (
    <div className={`flex flex-col rounded-lg border bg-base-900 overflow-hidden ${biomeMatch ? theme.cardBorder : "border-base-800"}`}>
      <div className="h-1 w-full" style={{ backgroundColor: theme.hex }} />
      <div className="p-3.5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-base-500 font-semibold">{rankLabel}</p>
            <h3 className={`text-lg font-bold leading-tight ${theme.text}`} style={{ fontFamily: "'Oswald', sans-serif" }}>{loadout.name}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {/* Four is the in game squad cap, so a fifth is refused rather */}
            {/* than silently dropping one already chosen.                  */}
            {onToggleCompare ? (
              <button onClick={() => onToggleCompare(loadout.id)} aria-pressed={inCompare}
                disabled={!inCompare && compareFull}
                title={inCompare ? "Remove from the comparison"
                  : compareFull ? "Four is the squad cap. Drop one first." : "Add to the comparison"}
                aria-label={inCompare ? `Remove ${loadout.name} from the comparison` : `Add ${loadout.name} to the comparison`}
                className={"rounded p-1.5 " + (inCompare
                  ? "text-brand hover:bg-base-800"
                  : compareFull ? "cursor-default text-base-800" : "text-base-500 hover:bg-base-800 hover:text-base-100")}>
                <Users className="w-4 h-4" />
              </button>
            ) : null}
            {onToggleFavorite ? (
              <button onClick={() => onToggleFavorite(loadout.id)} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} className="rounded p-1.5 hover:bg-base-800">
                <Star className={"w-5 h-5 " + (isFavorite ? "fill-accent-400 text-accent-400" : "text-base-600")} />
              </button>
            ) : null}
            {onOpen ? (
              <button onClick={() => onOpen(loadout)} title="Open in the Armoury" aria-label={`Open ${loadout.name} in the Armoury`}
                className="rounded p-1.5 text-base-500 hover:bg-base-800 hover:text-base-100">
                <Pencil className="w-4 h-4" />
              </button>
            ) : null}
            {onDelete ? (
              <button onClick={() => onDelete(loadout)} title="Delete" aria-label={`Delete ${loadout.name}`}
                className="rounded p-1.5 text-base-500 hover:bg-base-800 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-base-400 leading-relaxed">{loadout.blurb}</p>

        {lockedHere.length > 0 ? (
          <div className="flex items-start gap-1.5 rounded border border-accent-800/60 bg-accent-950/40 px-2 py-1.5 text-[11px] text-accent-300">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{lockedHere.length} {lockedHere.length === 1 ? "item" : "items"} marked as not unlocked.</span>
          </div>
        ) : null}

        {staleHere.length > 0 ? (
          <div className="flex items-start gap-1.5 rounded border border-base-700 bg-base-800/60 px-2 py-1.5 text-[11px] text-base-400">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-px text-accent-500" />
            <span>{staleHere.join(", ")} changed after the vote. The tier list has not caught up.</span>
          </div>
        ) : null}

        {biomeMatch ? (
          <div className="flex items-start gap-1.5 rounded border border-base-700 bg-base-800/60 px-2 py-1.5 text-[11px] text-base-300">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" /><span>Built for this terrain.</span>
          </div>
        ) : null}

        {fireNote ? (
          <div className="flex items-start gap-1.5 rounded border border-accent-800/60 bg-accent-950/40 px-2 py-1.5 text-[11px] text-accent-300">
            <Flame className="w-3.5 h-3.5 shrink-0 mt-px" /><span>Fire-based kit. Watch out on fire tornado planets.</span>
          </div>
        ) : null}

        <LoadoutReading reading={reading} compact />

        <div className="border-t border-base-800 pt-2.5 flex flex-col gap-1.5">
          {rows.map(([label, value]) => {
            const isLocked = lockedSet.has(value);
            return (
              <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-base-500 shrink-0">{label}</span>
                {value ? (
                  <span className={"text-right flex items-center gap-1 " + (isLocked ? "text-base-500 line-through" : "text-base-200")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {isLocked ? <Lock className="w-3 h-3 text-accent-500 shrink-0" /> : null}
                    {itemName(value)}
                  </span>
                ) : (
                  <span className="text-right text-base-600">empty</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-base-800 pt-2.5">
          <p className="text-[10px] uppercase tracking-wider text-base-500 font-semibold mb-1.5">Stratagems</p>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Keyed by slot, not by id. A build can hold an empty slot   */}
            {/* and, until the builder stopped it, the same stratagem twice. */}
            {loadout.strats.map((s, i) =>
              s ? <StratChip key={`${i}-${s}`} id={s} isLocked={lockedSet.has(s)} />
                : <div key={`${i}-empty`} className="rounded bg-base-800/40 px-1.5 py-1.5 text-[10px] text-base-600">empty</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
