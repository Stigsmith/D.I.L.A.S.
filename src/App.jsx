/* ================================================================== */
/* SHELL                                                              */
/* Two levels of navigation. A persistent left sidebar for            */
/* destinations, and a top tab bar scoped to whichever destination is  */
/* open. Destinations that belong to a later release are shown but not */
/* reachable, so the shape of the tool is visible without pretending   */
/* they work.                                                          */
/* ================================================================== */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers, Library, Wrench, Rocket, Store, Users, User, Settings as SettingsIcon,
  LifeBuoy, Menu, X, Sun, Moon, Zap, Shield, Star, Lock, Download, Upload, AlertTriangle,
  Factory, Bug, PackageOpen, Trees, FileText, Crosshair, Radar, Shovel, Info, ScrollText, Milestone,
} from "lucide-react";

import { TierBrowser, BackupPanel, BLANK_FILTERS, FactionBar, FactionChooser, ScenarioScreen, ScenarioBar } from "./Tiers.jsx";
import { SKULL, themeArt } from "./lib/assets.js";
import Builder from "./Builder.jsx";
import DropBay from "./DropBay.jsx";
import DropScreen, { useDrop } from "./DropScreen.jsx";
import { useParty, usePartySync } from "./lib/party.js";
import Collection, { COLLECTION_TABS } from "./Collection.jsx";
import Ambient, { Grain, Masthead } from "./Ambient.jsx";
import { About, Support, Changelog, Roadmap, Footer } from "./Pages.jsx";
import Account from "./Account.jsx";
import { ACCOUNTS_LIVE } from "./lib/account.js";
import TierBadgePlate, { FINISHES } from "./TierBadgePlate.jsx";
import { useBadgeStyle } from "./lib/badge.js";
import { CATEGORIES, warbonds } from "./lib/items.js";
import { useCollectionState } from "./lib/useCollectionState.js";
import { useTheme, THEMES } from "./lib/theme.js";
import { useRoute } from "./lib/router.js";
import { useScenario, useTierFilters, useTierSort } from "./lib/scenario.js";
import { BRAND } from "./lib/brand.js";
import LOADOUTS from "./data/loadouts.json";

/* ------------------------------------------------------------------ */
/* Destinations                                                        */
/* ------------------------------------------------------------------ */

const NAV = [
  {
    group: "Browse",
    items: [
      { id: "tiers", label: "Tier Lists", Icon: Layers },
      { id: "collection", label: "Collection", Icon: Library },
    ],
  },
  {
    group: "Loadouts",
    items: [
      { id: "builder", label: "Loadout Builder", Icon: Wrench },
      { id: "bay", label: "Drop Bay", Icon: Rocket },
      { id: "exchange", label: "Exchange", Icon: Store, release: "v3" },
    ],
  },
  {
    group: "Squad",
    items: [{ id: "squad", label: "Squad", Icon: Users, release: "v2" }],
  },
];

const NAV_FOOT = [
  /* Tagged, and therefore locked and unroutable, until ACCOUNTS_LIVE in
     src/lib/account.js says otherwise. The tag is the switch's only effect. */
  { id: "account", label: "Account", Icon: User, ...(ACCOUNTS_LIVE ? {} : { release: "v2" }) },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
  { id: "support", label: "Support", Icon: LifeBuoy },
  { id: "about", label: "About", Icon: Info },
  { id: "changelog", label: "Changelog", Icon: ScrollText },
  { id: "roadmap", label: "Roadmap", Icon: Milestone },
];

const ALL_NAV = [...NAV.flatMap((g) => g.items), ...NAV_FOOT];

/* Where the scenario bar belongs: the surfaces that read it. Settings
   and the changelog have no opinion about where you are dropping, and a
   reminder on those is chrome for the sake of chrome. */
/* Drop Bay joined on 22 August 2026, when loadout scoring landed and the
   cards started reading the scenario. A control that changes what is on
   screen has to be on screen: the same rule the folded filter pane keeps. */
const SCENARIO_SURFACES = new Set(["tiers", "bay"]);

/* Routable, deliberately absent from the sidebar. */
const OFF_MENU = new Set(["scenario"]);
/* Off menu routes are not in ALL_NAV, so they need their title here or
   the header falls back to the brand name and stops saying where you are. */
const OFF_MENU_LABEL = { scenario: "Scenario" };
const labelFor = (id) =>
  (ALL_NAV.find((d) => d.id === id) || {}).label || OFF_MENU_LABEL[id] || BRAND.short;

/* The Helldivers skull, painted with the current text colour so it     */
/* takes the brand token and shifts with the theme.                     */
/*                                                                      */
/* Masked by luminance, not by alpha. In the source art the shield and  */
/* the skull are both fully opaque and only the outside is transparent, */
/* so an alpha mask paints the whole shield as one flat blob and the    */
/* skull disappears. Luminance keeps the white skull and drops the      */
/* black shield, which is the mark we actually want.                    */
function Skull({ className = "h-7 w-7", style }) {
  if (!SKULL) return null;
  return (
    <span aria-hidden="true" className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${SKULL})`,
        maskImage: `url(${SKULL})`,
        maskMode: "luminance",
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

/* A skin may carry its own mark, taken from its palette study rather   */
/* than from the loose reference art beside it: the study's copy is     */
/* already cut to transparency, so it masks cleanly and takes the brand */
/* token the same way the skull does. Sizes follow the source aspect,   */
/* wide for the aquila and square for the rest.                         */
const THEME_MARK = {
  "castellans-creed": { file: "study_aq", label: "Imperial Aquila", lg: "h-7 w-[72px]", sm: "h-5 w-[52px]" },
  /* The Creek is where the Automatons are remembered, so the wordmark
     carries their eye rather than the Super Earth skull. The study ships
     its own cut of it, already on transparency, so it masks and takes the
     brand token like every other mark here. */
  "malevelon-creek": { file: "study_auto-mark", label: "Automaton mark", lg: "h-8 w-8", sm: "h-6 w-6" },
  "automaton": { file: "study_glyph", label: "Automaton mark", lg: "h-8 w-8", sm: "h-6 w-6" },
  /* The cutout provided in August 2026 is a clean silhouette on full     */
  /* transparency, so it masks the way the skull does and takes the acid  */
  /* green brand token on its own. It replaced art drawn on an opaque     */
  /* ground, which had to be inverted and screened to be usable at all.   */
  "bile-titan": { file: "emblem", label: "Terminid symbol", lg: "h-8 w-10", sm: "h-6 w-[30px]" },
  "entrenched-division": { file: "emblem", label: "Entrenched Division badge", paint: "image", lg: "h-9 w-[30px]", sm: "h-6 w-[20px]" },
  "hellpod-drop-bay": { file: "study_pod", label: "Hellpod", lg: "h-9 w-[21px]", sm: "h-6 w-[14px]" },
  "viper-commandos": { file: "emblem", label: "Viper Commandos patch", paint: "image", lg: "h-9 w-[31px]", sm: "h-6 w-[21px]" },
  "odst": { file: "study_odst", label: "ODST emblem", lg: "h-9 w-[24px]", sm: "h-6 w-[17px]" },
  "ministry-of-truth": { file: "study_seal", label: "Ministry seal", lg: "h-8 w-8", sm: "h-6 w-6" },
  "super-destroyer": { file: "study_seal", label: "Destroyer seal", lg: "h-8 w-8", sm: "h-6 w-6" },
};

/* Two ways to paint a mark, because the source art comes in two shapes   */
/* and one treatment cannot serve both:                                   */
/*                                                                        */
/*   mask    the default. A single colour silhouette on transparency,     */
/*           painted with the brand token so it follows the theme.        */
/*   image   full colour art, drawn as it is. A warbond badge is already  */
/*           coloured and masking it flattens it into a solid blob.       */
/*                                                                        */
/* Getting this wrong is not subtle: an alpha mask over art with no       */
/* transparency paints the entire rectangle in one flat colour. If a mark */
/* ever arrives as a dark shape on an opaque light ground, the fix is     */
/* filter: invert(1) with mix-blend-mode: screen, which is what the first */
/* Bile Titan emblem needed before it was redrawn on transparency.        */
function BrandMark({ theme, size = "lg" }) {
  const mark = THEME_MARK[theme];
  const art = mark ? themeArt(theme, mark.file) : null;
  if (!art) return <Skull className={(size === "lg" ? "h-9 w-9" : "h-6 w-6") + " shrink-0 text-brand"} />;

  if (mark.paint === "image") {
    return (
      <img src={art} alt="" aria-hidden="true" title={mark.label}
        className={`${mark[size]} shrink-0 object-contain object-left`} />
    );
  }

  return (
    <span aria-hidden="true" title={mark.label} className={`${mark[size]} shrink-0 text-brand`}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${art})`,
        maskImage: `url(${art})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }} />
  );
}

/* ------------------------------------------------------------------ */

function SidebarLink({ item, active, onClick }) {
  const locked = Boolean(item.release);
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      aria-current={active ? "page" : undefined}
      title={locked ? `Planned for ${item.release}` : undefined}
      className={
        "w-full flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors text-left " +
        (locked
          ? "text-base-600 cursor-default"
          : active
            ? "bg-base-800 text-base-100"
            : "text-base-400 hover:bg-base-800/60 hover:text-base-100")
      }
    >
      <item.Icon className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
      {locked ? (
        <span className="shrink-0 rounded border border-base-700 px-1 py-px text-[9px] font-bold uppercase text-base-600">
          {item.release}
        </span>
      ) : null}
    </button>
  );
}

/* A destination with tabs needs one named in the route, or the tab bar   */
/* and the surface disagree about which one is open on a cold link.       */
const LANDING = { tiers: "tiers/primary", collection: "collection/warbonds", bay: "bay/drop" };

/* Drop Bay's two jobs, since 1.24.0. The drop is the moment before you
   go; the builds are the grid it used to be, kept until Exchange has
   somewhere to put other people's. The drop comes first because it is
   what the destination is for. */
const BAY_TABS = [{ id: "drop", label: "Drop" }, { id: "builds", label: "Builds" }];

function Sidebar({ destination, navigate, onNavigated }) {
  const go = (id) => { navigate(LANDING[id] || id); onNavigated(); };
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-base-600"
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            {g.group}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <SidebarLink key={item.id} item={item} active={destination === item.id} onClick={() => go(item.id)} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto border-t border-base-800 pt-3 flex flex-col gap-0.5">
        {NAV_FOOT.map((item) => (
          <SidebarLink key={item.id} item={item} active={destination === item.id} onClick={() => go(item.id)} />
        ))}
      </div>
    </nav>
  );
}

/* Sub navigation inside a destination. Tier Lists has one tab per       */
/* category, Collection has one per ownership axis.                      */
/*                                                                       */
/* On a phone this is not a bar of its own: it sits inside the single     */
/* chrome row next to the menu button, which is what "bare" is for. The   */
/* row carries the bottom rule in that case, so the tabs must not draw a  */
/* second one an eighth of a pixel away from it.                          */
function TopTabs({ tabs, active, onSelect, bare, className = "" }) {
  if (!tabs || tabs.length === 0) return null;
  return (
    <div className={"flex overflow-x-auto " + (bare ? "" : "border-b border-base-800 ") + className}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={
            "shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide sm:text-sm " +
            (t.id === active ? "text-brand border-brand" : "border-transparent text-base-500 hover:text-base-300")
          }
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          {t.label}
          {t.star ? <Star className="ml-1.5 inline-block w-3 h-3 fill-accent-400 text-accent-400 align-[-1px]" /> : null}
          {t.lock ? <Lock className="ml-1.5 inline-block w-3 h-3 opacity-60 align-[-1px]" /> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces that are not built yet. An empty state says what to do     */
/* next, so these say what they will be and what to use instead.        */
/* ------------------------------------------------------------------ */

function Planned({ title, release, children }) {
  return (
    <div className="rounded-lg border border-dashed border-base-700 px-4 py-10 text-center">
      <p className="text-lg font-bold text-base-300" style={{ fontFamily: "'Oswald', sans-serif" }}>{title}</p>
      {release ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-base-600">Planned for {release}</p>
      ) : null}
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-base-400">{children}</p>
    </div>
  );
}


const THEME_ICON = {
  dark: Moon,
  light: Sun,
  neon: Zap,
  "castellans-creed": Shield,
  "automaton": Factory,
  "bile-titan": Bug,
  "entrenched-division": Shovel,
  "odst": Radar,
  "hellpod-drop-bay": PackageOpen,
  "malevelon-creek": Trees,
  "ministry-of-truth": FileText,
  "super-destroyer": Rocket,
  "viper-commandos": Crosshair,
};

/* Four real rows, so the finish is chosen against items rather than
   against a word. Locked to a fixed set: a preview that changes with
   your filters is a preview you cannot compare against itself. */
const PREVIEW_ROWS = [
  { name: "PLAS-101 Purifier", sub: "Polar Patriots", tier: "S+" },
  { name: "R-63 Diligence", sub: "Free of charge", tier: "S" },
  { name: "SG-8 Punisher", sub: "Steeled Veterans", tier: "B" },
  { name: "LAS-7 Dagger", sub: "Cutting Edge", tier: null },
];

function SurfaceToggle({ on, onClick, label, note }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={"flex flex-col items-start rounded border px-2.5 py-1.5 text-left transition-colors " +
        (on
          ? "border-brand bg-brand/10 text-base-100"
          : "border-base-700 bg-base-900 text-base-500 hover:border-base-500 hover:text-base-200")}>
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {label}
      </span>
      <span className="text-[10px] text-base-600">{note}</span>
    </button>
  );
}

function Settings({ theme, setTheme, state }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { finish, setFinish, surface, toggleSurface } = useBadgeStyle();
  const themeNote = (THEMES.find((t) => t.id === theme) || {}).note || "";
  const finishNote = (FINISHES.find((f) => f.id === finish) || {}).note || "";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900 overflow-hidden">
        <div className="border-b border-base-800 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Theme
          </h3>
          <p className="text-[11px] text-base-500">
            Three base themes and eight warbond skins. Each skin comes from a palette study that fixes its colours
            before any of it reaches here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}
            className="min-w-[13rem] rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-200 outline-none focus:border-base-500">
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-base-500">{themeNote}</span>
        </div>
      </div>

      {/* Finish is not theme. Separate panel, separate storage, and a       */}
      {/* theme change never moves it. The design document is emphatic on    */}
      {/* this and the two words must not be used interchangeably.           */}
      <div className="rounded-lg border border-base-800 bg-base-900 overflow-hidden">
        <div className="border-b border-base-800 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Tier badge
          </h3>
          <p className="text-[11px] text-base-500">
            How the badge is finished. Purely cosmetic, and separate from the theme: changing skin does not move it.
          </p>
        </div>
        <div className="flex flex-col gap-4 p-4 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select value={finish} onChange={(e) => setFinish(e.target.value)}
                className="min-w-[13rem] rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-200 outline-none focus:border-base-500">
                {FINISHES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-base-500">{finishNote}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <SurfaceToggle on={surface.sheen} onClick={() => toggleSurface("sheen")}
                label="Sheen" note="A light sweep across the face" />
              <SurfaceToggle on={surface.glow} onClick={() => toggleSurface("glow")}
                label="Glow" note="Bleeds the tier colour outward" />
              <SurfaceToggle on={surface.grain} onClick={() => toggleSurface("grain")}
                label="Grain" note="Film over the interior" />
            </div>
            <p className="text-[10px] leading-relaxed text-base-600">
              Sheen and glow both ramp with the tier, so S+ carries the most and D the least. Neither ever costs a
              badge its legibility: a D reads exactly as clearly as an S+, which is why nothing here shrinks or
              fades a letter.
            </p>
          </div>

          <div className="w-full shrink-0 rounded-lg border border-base-800 bg-base-950/60 p-3 lg:w-[19rem]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-base-500"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              How rows will look
            </p>
            <div className="flex flex-col gap-1.5">
              {PREVIEW_ROWS.map((r) => (
                <div key={r.name} className="flex items-center gap-2.5 rounded border border-base-800 bg-base-900 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-base-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.name}
                    </span>
                    <span className="block truncate text-[10px] text-base-500">{r.sub}</span>
                  </span>
                  <TierBadgePlate tier={r.tier} finish={finish}
                    sheen={surface.sheen} glow={surface.glow} grain={surface.grain} size={36} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BackupPanel onExport={state.exportState} onImport={state.importState} />

      <div className="rounded-lg border border-base-800 bg-base-900 overflow-hidden">
        <div className="border-b border-base-800 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Reset local data
          </h3>
          <p className="text-[11px] text-base-500">
            Clears every lock, warbond and favorite stored in this browser. Export first if you want it back.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          {confirmingReset ? (
            <>
              <button onClick={() => { state.resetLocal(); setConfirmingReset(false); }}
                className="flex items-center gap-1.5 rounded border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs text-red-300 hover:border-red-500">
                <AlertTriangle className="w-3.5 h-3.5" /> Yes, clear everything
              </button>
              <button onClick={() => setConfirmingReset(false)}
                className="rounded border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmingReset(true)}
              className="rounded border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-base-300 hover:border-red-600 hover:text-red-400">
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  const state = useCollectionState();
  const { theme, setTheme } = useTheme();
  const { destination, param, navigate } = useRoute("tiers/primary");
  /* Where you are dropping. Faction today, the rest of the scenario next. */
  const { scenario, setFaction, setPlanet, setBiome, toggleHazard, setMission, setDifficulty, setSquad, clearEnvironment, replaceScenario } = useScenario();
  /* The drop and the party live here rather than on the drop screen: what
     you confirmed has to reach the party, and the host's scenario has to
     reach you, while you are in the builder or on the tier list too. */
  const [drop, updateDrop] = useDrop();
  const party = useParty();
  const partySync = usePartySync({ party, drop, loadouts: state.loadouts, scenario, replaceScenario, setSquad });
  /* Owned here so a trip to Drop Bay does not reset them. */
  const { filters, patchFilters } = useTierFilters(BLANK_FILTERS, CATEGORIES.map((c) => c.id));
  const { sortBy, setSortBy } = useTierSort();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Reachable but not in the menu. The scenario is a sub screen of the   */
  /* surfaces that read it, not a destination of its own: putting it in   */
  /* the sidebar would make it look like somewhere you go rather than     */
  /* something you set.                                                   */
  const known =
    ALL_NAV.some((d) => d.id === destination && !d.release) || OFF_MENU.has(destination);
  const dest = known ? destination : "tiers";


  /* The title and tabs stay put while a long list scrolls under them.    */
  /* Anything inside a surface that wants to stick too, like the faction  */
  /* column header, docks below this rather than at the window top, so    */
  /* its real height is published as a variable instead of guessed at.    */
  const chromeRef = useRef(null);
  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return undefined;
    const apply = () => document.documentElement.style.setProperty("--shell-chrome", `${el.offsetHeight}px`);
    apply();

    /* Three ways in. Crossing the sm breakpoint swaps an 86px header plus   */
    /* a tab bar for a single 44px row, so this value moves by 85px and      */
    /* anything docked below the chrome lands in the wrong place if it is    */
    /* stale. The media query is keyed to the same 640px the layout switches */
    /* at, which is the crossing itself rather than a symptom of it.         */
    /*                                                                       */
    /* Do not try to verify this in the in-editor Browser pane. Its viewport */
    /* resize dispatches no event of any kind to the page: not resize, not   */
    /* the media query change, not a ResizeObserver on the root, even though */
    /* the query itself flips and the layout switches. Measured directly.    */
    /* Resize a real window instead.                                         */
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    if (ro) ro.observe(el);
    const mq = window.matchMedia("(min-width: 640px)");
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      if (ro) ro.disconnect();
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  });

  const favSet = new Set(state.favoriteItems);
  const catId = CATEGORIES.some((c) => c.id === param) ? param : "primary";
  const collectionTab = COLLECTION_TABS.some((t) => t.id === param) ? param : "warbonds";
  const bayTab = BAY_TABS.some((t) => t.id === param) ? param : "drop";

  /* Where "Done" goes back to. Adjusting the scenario from Secondaries  */
  /* and being returned to Primaries is the kind of small wrong that     */
  /* makes a round trip feel like a detour. It remembered only the tier  */
  /* list until 1.24.0, so adjusting from Drop Bay threw you out of the  */
  /* drop and onto a list; it now remembers any surface that reads the   */
  /* scenario, tab included.                                             */
  const lastSurface = useRef("tiers/primary");
  useEffect(() => {
    if (dest === "tiers") lastSurface.current = `tiers/${catId}`;
    if (dest === "bay") lastSurface.current = `bay/${bayTab}`;
  }, [dest, catId, bayTab]);
  const openScenario = useCallback(() => navigate("scenario"), [navigate]);
  const closeScenario = useCallback(() => navigate(lastSurface.current), [navigate]);

  /* Which tab bar the current destination gets, and what the active tab  */
  /* inside it is. Both surfaces put the tab in the route, so a Collection */
  /* tab is linkable and survives a reload the same way a category does.  */
  const [tabs, activeTab] =
    dest === "tiers"
      ? [
          CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            star: c.items.some((it) => favSet.has(it.id)),
            lock: c.items.some((it) => state.lockedSet.has(it.id)),
          })),
          catId,
        ]
      : dest === "collection"
        ? [
            COLLECTION_TABS.map((t) => ({
              ...t,
              lock: t.id === "warbonds" ? state.lockedWarbonds.length > 0 : state.lockedItems.length > 0,
            })),
            collectionTab,
          ]
        : dest === "bay"
          ? [BAY_TABS, bayTab]
          : [null, null];

  const surface = (() => {
    switch (dest) {
      case "tiers":
        return (
          <TierBrowser
            catId={catId}
            faction={scenario.faction}
            setFaction={setFaction}
            scenario={scenario}
            setPlanet={setPlanet}
            setBiome={setBiome}
            toggleHazard={toggleHazard}
            setMission={setMission}
            setDifficulty={setDifficulty}
            setSquad={setSquad}
            clearEnvironment={clearEnvironment}
            filters={filters}
            patchFilters={patchFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            lockedSet={state.lockedSet}
            warbondLockedSet={state.warbondLockedSet}
            toggleLock={state.toggleLock}
            clearItemLocks={state.clearItemLocks}
            itemLockCount={state.lockedItems.length}
            favoriteItems={state.favoriteItems}
            toggleFavItem={state.toggleFavItem}
            clearFavItems={state.clearFavItems}
          />
        );
      case "collection":
        return <Collection tab={collectionTab} state={state} />;
      case "bay":
        return bayTab === "builds"
          ? <DropBay state={state} navigate={navigate} faction={scenario.faction} setFaction={setFaction} scenario={scenario} />
          : <DropScreen state={state} navigate={navigate} scenario={scenario} setFaction={setFaction}
              drop={drop} update={updateDrop} party={party} sync={partySync} />;
      case "builder":
        /* Browsing happens in Drop Bay. The builder edits one build, so  */
        /* landing on it with nothing chosen starts a fresh one.          */
        return <Builder key={param || "new"} state={state} loadoutId={param && param !== "new" ? param : null} navigate={navigate} faction={scenario.faction} scenario={scenario} />;
      case "settings":
        return <Settings theme={theme} setTheme={setTheme} state={state} />;
      case "support":
        return <Support />;
      case "about":
        return <About />;
      case "changelog":
        return <Changelog />;
      case "roadmap":
        return <Roadmap />;
      case "account":
        return <Account />;
      case "scenario":
        return (
          <ScenarioScreen
            scenario={scenario}
            setFaction={setFaction}
            setPlanet={setPlanet}
            setBiome={setBiome}
            toggleHazard={toggleHazard}
            setMission={setMission}
            setDifficulty={setDifficulty}
            setSquad={setSquad}
            clearEnvironment={clearEnvironment}
            onDone={closeScenario}
          />
        );
      default:
        return null;
    }
  })();

  return (
    /* No background of its own. body carries base-950, which lets the      */
    /* ambient layer paint over the ground and under every surface. Give    */
    /* this a colour again and the layer disappears behind it.              */
    <div className="min-h-screen text-base-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <Ambient theme={theme} />
      {/* Above everything, including the sticky chrome, because grain is  */}
      {/* a property of the lens rather than of any one surface.           */}
      <Grain theme={theme} />

      <div className="relative z-10 h-2 w-full fx-stripe" style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgb(var(--brand)) 0px, rgb(var(--brand)) 10px, rgb(var(--base-950)) 10px, rgb(var(--base-950)) 20px)",
      }} />

      <div className="relative z-10 flex">
        {/* Sidebar. Fixed on large screens, a drawer below that. */}
        <aside className="hidden w-56 shrink-0 border-r border-base-800 bg-base-900/40 lg:block"
          style={{ height: "calc(100vh - 0.5rem)", position: "sticky", top: 0 }}>
          {/* Fixed rather than sized by its contents, because the page header */}
          {/* next to it reads the same token and the two rules have to meet.  */}
          <div className="flex items-center gap-3 border-b border-base-800 px-4"
            style={{ height: "var(--brand-box)" }}>
            <BrandMark theme={theme} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-none tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>{BRAND.short}</h1>
              <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wider text-brand">{BRAND.name}</p>
            </div>
          </div>
          {/* The remainder, worked out from the same token. This was a hard  */}
          {/* coded 5.25rem against an 86px box, so the nav overflowed by 2px. */}
          <div style={{ height: "calc(100% - var(--brand-box))" }}>
            <Sidebar destination={dest} navigate={navigate} onNavigated={() => {}} />
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <aside className="relative z-50 flex w-64 flex-col border-r border-base-800 bg-base-950">
              <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
                <span className="flex items-center gap-2">
                  <BrandMark theme={theme} size="sm" />
                  <span className="min-w-0">
                    <h1 className="text-lg font-bold leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>{BRAND.short}</h1>
                    <p className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-brand">{BRAND.name}</p>
                  </span>
                </span>
                <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded p-1 hover:bg-base-800">
                  <X className="h-5 w-5 text-base-400" />
                </button>
              </div>
              <Sidebar destination={dest} navigate={navigate} onNavigated={() => setMenuOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div ref={chromeRef} className="sticky top-0 z-30 bg-base-950">
          {/* Wide enough for a header of its own. The height comes from the  */}
          {/* same token the sidebar brand box uses, because on a large       */}
          {/* screen the two sit side by side and their bottom rules have to  */}
          {/* land on the same line. They used to be 61px and 86px.           */}
          <header className="relative hidden items-end justify-between gap-3 overflow-hidden border-b border-base-800 px-4 pb-3 pt-4 sm:flex sm:px-6"
            style={{ minHeight: "var(--brand-box)" }}>
            <Masthead theme={theme} />
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMenuOpen(true)} aria-label="Open menu"
                className="rounded p-1.5 text-base-400 hover:bg-base-800 hover:text-base-100 lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {labelFor(dest)}
                </h2>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[11px]">
              {/* Which player you are looking at. Always shown, even with */}
              {/* one profile, because every lock on every screen is about */}
              {/* this profile and that should never be a guess.           */}
              <label className="flex items-center gap-1.5 text-base-500">
                <User className="h-3.5 w-3.5" />
                <span className="sr-only">Ownership profile</span>
                <select value={state.activeProfileId} onChange={(e) => state.setActiveProfile(e.target.value)}
                  title="Whose collection every lock on screen refers to"
                  className="rounded border border-base-700 bg-base-900 px-1.5 py-1 text-[11px] text-base-200 outline-none hover:border-base-500 focus:border-base-500">
                  {state.profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              {state.favoriteItems.length > 0 ? (
                <span className="flex items-center gap-1.5 text-accent-400">
                  <Star className="h-3.5 w-3.5 fill-accent-400" />{state.favoriteItems.length} starred
                </span>
              ) : null}
              {state.lockedSet.size > 0 ? (
                <span className="flex items-center gap-1.5 text-accent-500">
                  <Lock className="h-3.5 w-3.5" />{state.lockedSet.size} locked
                </span>
              ) : null}
            </div>
          </header>

          {/* Phone. One row instead of two, which is 48px of an 812px       */}
          {/* screen handed back to the list. The destination name is the    */}
          {/* thing dropped: the drawer already marks which one is open, and */}
          {/* the tabs say where you are inside it. Where a destination has  */}
          {/* no tabs the name takes their place, so the row is never just a */}
          {/* menu button floating on its own.                               */}
          <div className="relative flex min-h-[44px] items-stretch overflow-hidden border-b border-base-800 sm:hidden">
            <Masthead theme={theme} dim={0.6} small />
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu"
              className="shrink-0 px-3 text-base-400 hover:bg-base-800 hover:text-base-100">
              <Menu className="h-5 w-5" />
            </button>
            {tabs ? (
              <TopTabs bare className="min-w-0 flex-1" tabs={tabs} active={activeTab}
                onSelect={(id) => navigate(`${dest}/${id}`)} />
            ) : (
              <span className="flex min-w-0 flex-1 items-center truncate py-2.5 text-sm font-semibold uppercase tracking-wide text-base-200"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                {labelFor(dest)}
              </span>
            )}
          </div>

          <TopTabs className="hidden sm:flex" tabs={tabs} active={activeTab} onSelect={(id) => navigate(`${dest}/${id}`)} />

          {/* One scenario, said once, in the chrome rather than in the      */}
          {/* surface. It lived at the top of every tier list tab before,    */}
          {/* which ate the height the table wanted and told you the choice  */}
          {/* was per tab. It never was: useScenario is called once here.    */}
          {/*                                                                */}
          {/* Sticky with the tabs, so a rating computed from a choice you   */}
          {/* have forgotten making is never on screen without the choice    */}
          {/* next to it.                                                    */}
          {SCENARIO_SURFACES.has(dest) && scenario.faction ? (
            <ScenarioBar scenario={scenario} onAdjust={openScenario} />
          ) : null}
          </div>

          <main className="p-4 sm:p-6">{surface}</main>
          {/* The scenario is a focused sub screen and the footer is the  */}
          {/* only thing keeping it off one desktop screen. Every other    */}
          {/* destination keeps it.                                        */}
          {OFF_MENU.has(dest) ? null : <Footer />}
        </div>
      </div>
    </div>
  );
}
