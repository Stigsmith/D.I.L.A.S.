/* ================================================================== */
/* STATIC PAGES                                                       */
/*                                                                    */
/* About, Support, the tool changelog, and the sitewide footer. These  */
/* carry no state and touch no lock data, so they live together and    */
/* out of the shell.                                                   */
/*                                                                    */
/* The split between About and Support is deliberate: About is "what   */
/* this is", Support is "something is wrong". Known issues belong on   */
/* Support only, or the two pages start saying the same thing.         */
/* ================================================================== */

import { useState, useEffect } from "react";
import { AlertTriangle, Bug, ChevronDown } from "lucide-react";
import { artCounts } from "./lib/assets.js";
import { items, warbonds, statsFor, statsSourceFor, gameSource } from "./lib/items.js";
import CHANGELOG from "./data/changelog.json";
import ROADMAP from "./data/roadmap.json";
import { BRAND } from "./lib/brand.js";

/* The patch record moved to src/lib/patch.js in 1.23.0, so the expanded */
/* row can read it too. Re-exported here for anything importing it from  */
/* this file.                                                             */
import { PATCH, PATCH_SHORT } from "./lib/patch.js";
export { PATCH, PATCH_SHORT };

export const VERSION = CHANGELOG[0].version;


export function Panel({ title, note, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
      <div className="border-b border-base-800 px-4 py-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {title}
        </h3>
        {note ? <p className="text-[11px] text-base-500">{note}</p> : null}
      </div>
      <div className="flex flex-col gap-3 p-4 text-sm leading-relaxed text-base-400">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Footer() {
  return (
    <footer className="mt-8 border-t border-base-800 px-4 pb-8 pt-4 text-[11px] leading-relaxed text-base-600 sm:px-6">
      <p className="mb-1.5 text-base-500">
        <span className="text-base-400">{BRAND.name}</span> v{VERSION}, {BRAND.tagline}. {PATCH_SHORT}
      </p>
      <p className="max-w-3xl">
        {BRAND.name} is an unofficial, fan-made community tool. Not affiliated with, endorsed by, or sponsored by
        Arrowhead Game Studios or Sony Interactive Entertainment. HELLDIVERS is a trademark of Sony Interactive
        Entertainment LLC. This tool does not modify, interact with, or connect to the game client or your account.
      </p>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* How the rating works. The explanations the rows used to carry in     */
/* small grey paragraphs live here once, per dilas-writing.md: the row  */
/* shows the answer, this page shows the reasoning. Each part has its   */
/* own address, #/about/<id>, so a row can link straight to it.         */
/* ------------------------------------------------------------------ */

const isWeapon = (i) => i.slot === "primary" || i.slot === "secondary"
  || (i.slot === "stratagem" && i.stratType === "support");

/* Built from the data, so the list cannot fall behind it. The same
   three gaps the expanded row marks Missing data. */
function missingLists() {
  const weapons = items.filter(isWeapon);
  return [
    { what: "No wiki stats", names: weapons.filter((i) => !statsFor(i.id)).map((i) => i.name) },
    { what: "No reload time", names: weapons.filter((i) => statsFor(i.id) && !statsFor(i.id).reload).map((i) => i.name) },
    { what: "Backpack slot unknown", names: items.filter((i) => i.slot === "stratagem" && i.stratType !== "backpack" && i.usesBackpackSlot === null).map((i) => i.name) },
  ].filter((g) => g.names.length);
}

function Part({ id, title, children }) {
  return (
    <div id={`about-${id}`} className="flex scroll-mt-24 flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-base-200" style={{ fontFamily: "'Oswald', sans-serif" }}>{title}</p>
      {children}
    </div>
  );
}

function MissingGroup({ what, names }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-1.5 text-base-300 hover:text-base-100">
        <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")} />
        {what} ({names.length})
      </button>
      {open ? <p className="mt-1 pl-5 text-[13px] text-base-500">{names.join(", ")}</p> : null}
    </div>
  );
}

function HowItWorks() {
  return (
    <Panel title="How the rating works">
      <Part id="columns" title="The two columns">
        <p>
          Left: the community tier, the u.gg vote for that front. Right: the {BRAND.short} tier for where you are
          dropping. It starts from the community tier and changes by the rules on the Rules page.
        </p>
      </Part>
      <Part id="points" title="Points">
        <p>
          About 14 points make a tier. A scenario changes a rating by 2 tiers at most. On the hardest drops for 1
          or 2 players, that limit grows a little.
        </p>
      </Part>
      <Part id="build" title="Gear and Build">
        <p>
          Gear: the average {BRAND.short} tier of a build's items, for where you are dropping. Build: the same, plus
          or minus how well the items fit together. Fitting together changes a build by 2 tiers at most.
        </p>
        <p className="text-base-500">Nobody votes on builds, so a build has no community tier.</p>
      </Part>
      <Part id="peril" title="Peril">
        <p className="text-base-500">Coming soon: how difficulty and squad size combine into one number.</p>
      </Part>
      <Part id="armour" title="How armour is counted">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Armour per body part: helldivers.wiki.gg.</li>
          <li>AP above armour: full damage. AP equal to armour: 65%. AP below: no damage.</li>
          <li>Counted: the enemies a front always has at your difficulty. Event-only strains and brigades are left out.</li>
          <li>Some weak points only open up after armour breaks, like a Charger's legs. The count treats them as always open.</li>
          <li>Armour does not change an item's tier. It counts toward the Build badge, which checks the whole loadout.</li>
        </ul>
      </Part>
      <Part id="ground" title="Ground and megacities">
        <p>
          Footing, slopes and driving per biome are our own reading. A planet with a megacity may not put your
          mission inside it, so megacity rules count half.
        </p>
      </Part>
      <Part id="missing" title="Missing data">
        <p>Fields marked Missing data have no source yet.</p>
        <p className="text-base-500">
          Righteous Revenants, the Killzone crossover, is placed under Legendary by inference: the reference tables
          never give its tier.
        </p>
        {missingLists().map((g) => <MissingGroup key={g.what} {...g} />)}
        <p className="text-base-500">Projectile count: not in any of our sources.</p>
      </Part>
    </Panel>
  );
}

export function About({ section = null }) {
  const rated = items.filter((i) => Object.values(i.ratings).some((r) => r && r.tier)).length;
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(`about-${section}`);
    if (el) el.scrollIntoView({ block: "start" });
  }, [section]);
  return (
    <div className="flex flex-col gap-4">
      <Panel title="What this is" note="A fan-made Helldivers 2 tool">
        <p className="text-base-300">
          A Helldivers 2 tier list and loadout tool: ratings, stats, the live war and your own builds in one place.
        </p>
        <p>
          Every rating shows its source and date. A rating older than a game change is flagged. An unrated item shows
          a question mark.
        </p>
        <p>
          It tracks {items.length} items across 6 slots ({rated} rated), 39 curated builds and {warbonds.length} warbonds.
        </p>
      </Panel>

      <HowItWorks />

      <Panel title="Where the numbers come from">
        <div className="flex flex-col gap-1.5">
          <p><span className="text-base-200">Game version</span> {PATCH.game} {PATCH.gameName}, {PATCH.gameDate}.</p>
          <p><span className="text-base-200">Ratings</span> u.gg community vote aggregates, stamped {PATCH.ratings}, read on {PATCH.readOn}.</p>
        </div>
        <p>
          u.gg dates each list separately, so ratings carry different patch stamps. An item changed after its vote
          carries a caveat.
        </p>
        <p className="text-base-500">
          Armour classes, damage, capacities, demolition force, armour sets and warbond contents come from this
          project's reference tables and helldivers.wiki.gg. Balance changes come from Arrowhead's patch notes.
        </p>
      </Panel>

      <Panel title="Weapon stats come from the game">
        <p>
          Damage, armour penetration, magazines, rate of fire, handling and loudness for{" "}
          {items.filter((i) => statsSourceFor(i.id) === "game").length} weapons come from the game's own files,
          through the snapshot{" "}
          <a href={gameSource.url} target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">filediver</a> publishes
          {gameSource.snapshotDate
            ? `, dated ${new Date(`${gameSource.snapshotDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
            : ""}.
        </p>
        <p className="text-base-500">The tool reads that published snapshot. It never opens your game install.</p>
      </Panel>

      {/* Attribution is a licence condition, not a courtesy. The fetched  */}
      {/* stats are CC BY-NC-SA, which requires credit, requires derived   */}
      {/* data to carry the same licence, and forbids commercial use.      */}
      <Panel title="Everything else comes from the Helldivers Wiki">
        <p>
          Reload times, stratagem data, the weapons the game files do not cover and every enemy's armour per body
          part come from{" "}
          <a href="https://helldivers.wiki.gg" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">helldivers.wiki.gg</a>, which the community
          updates within days of a patch.
        </p>
        <p className="text-base-500">
          That data is published under the{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">Creative Commons BY-NC-SA 4.0</a>{" "}
          licence. This tool credits it, shares anything derived from it under the same terms, and is
          non-commercial.
        </p>
        <p className="text-base-500">
          Planets, their biomes and their environmental hazards come from the{" "}
          <a href="https://github.com/helldivers-2/json" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">helldivers-2/json</a>{" "}
          community dataset, MIT licensed. Thanks also to the people behind{" "}
          <a href="https://github.com/helldivers-2/diveharder_api.py" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">DiveHarder</a>{" "}
          and the wider helldivers-2 community organisation, whose work is why any of this is available at all.
        </p>
      </Panel>

      <Panel title="The galaxy map and the live war">
        <p>
          Planet positions and supply lines come from the{" "}
          <a href="https://api.helldivers2.dev" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">helldivers-2 community API</a> and ship with the
          tool.
        </p>
        <p className="text-base-500">
          Live data comes from the same API: who holds each planet, the fronts and the Major Order. The tool's server
          reads it every 5 minutes. Your browser only talks to the tool's server and sends nothing about you. Data
          older than 30 minutes is not shown.
        </p>
      </Panel>

      <Panel title="Role tags are ours">
        <p>
          Anti-armour, crowd clear and objective are our own judgement. Everything else on a row comes from a
          source.
        </p>
      </Panel>

      <Panel title="Unaffiliated">
        <p>
          Not affiliated with, endorsed by, or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment.
          HELLDIVERS is a trademark of Sony Interactive Entertainment LLC. This tool does not modify, interact with,
          or connect to the game client or your account.
        </p>
        <p className="text-base-500">
          Art is used for identification and reference: {artCounts.items} item illustrations, {artCounts.warbonds} warbond
          covers{artCounts.planets ? ` and ${artCounts.planets} planet renders from helldivers.wiki.gg` : ""}. The tool works
          without any of it.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* Known issues, kept honest. An admitted gap beats a hedged guess, and */
/* a list that is visibly maintained is worth more than a perfect one   */
/* that is not.                                                         */
const KNOWN = [
  {
    what: "The ratings carry three different stamps",
    detail: `u.gg dates its lists separately: primaries 7.1.1; support weapons, backpacks, eagles and sentries 7.0.2; the other six lists read as 7.1.0. The P-33 Missile Pistol left u.gg's list and keeps its 6.3.1 rating.`,
  },
  {
    what: "One item has no rating at all",
    detail: "The P/40-K Bolt Pistol has no community rating yet. It shows a question mark and is never hidden by the tier filter.",
  },
  {
    what: "Twelve items have no art",
    detail: "The 11 added in 1.23.0 and Electrical Conduit show their initials. The Ironclad Democracy warbond has no cover yet.",
  },
  {
    what: "Some stats have no source yet",
    detail: "Rows show Missing data where that happens. The full list is on About.",
  },
  {
    what: "The curated builds lean hard on high tiers",
    detail: "35 of 39 use an S or S+ primary, and only 13 different primaries appear. A new set is planned.",
  },
];

export function Support() {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Known issues" note="What is wrong or missing, as of the current build">
        <div className="flex flex-col gap-3">
          {KNOWN.map((k) => (
            <div key={k.what} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-500" />
              <div>
                <p className="text-base-200">{k.what}</p>
                <p className="text-[13px] text-base-500">{k.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Found something else" note="Bugs and feature requests both welcome">
        <p>
          There is no form yet. When you report a problem, say what you did, what you expected and what happened.
        </p>
        <div className="flex items-start gap-2 rounded border border-base-800 bg-base-950/40 px-3 py-2.5">
          <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-base-500" />
          <p className="text-[13px] text-base-500">
            Useful in a report: the theme, the page, and whether a reload fixed it. For a collection problem, attach the
            file from Export in Settings.
          </p>
        </div>
      </Panel>

      <Panel title="Your data stays yours">
        <p>
          Your collection, favourites, profiles and builds stay in this browser. There are no accounts yet. Clearing
          browser data clears them, so use Export in Settings to keep a copy.
        </p>
        <p className="mt-2">
          Only a party sends anything: your name, your dropped loadout and the host's scenario pass through the tool's
          server to the others in it. A party is deleted 12 hours after it goes quiet. Nothing else about you is sent.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ================================================================== */
/* ROADMAP                                                            */
/*                                                                    */
/* Enodia's shape, the curator's ask of 3 October 2026: the stages     */
/* run left to right on one line, Shipped, Up next, Planned, Later,    */
/* which is the order work moves through, and every milestone is a     */
/* card of one line that folds open. One open at a time across the     */
/* page, so the whole plan fits on a screen. A progress axis, not a    */
/* time axis: nothing unbuilt carries a date. Stacked below 1400 wide, */
/* where four columns beside the sidebar get too narrow to read.      */
/*                                                                    */
/* The data is src/data/roadmap.json, which is the short public        */
/* version. The working backlog is dilas-roadmap.md in the repo root, */
/* and it is the one that moves first.                                */
/* ================================================================== */

/* One scale, from the light that is on to the light not lit yet.      */
/* `node` is the hollow ring on the line, `dot` leads each card: filled */
/* for shipped, half lit for next, hollow for everything further out.   */
const STAGES = [
  { id: "shipped", name: "Shipped", say: "In the tool today, newest first.",
    node: "border-brand", dot: "border-brand bg-brand", head: "text-brand" },
  { id: "next", name: "Up next", say: "Being worked on, roughly in this order.",
    node: "border-base-300", dot: "border-brand bg-brand/35", head: "text-base-100" },
  { id: "planned", name: "Planned", say: "Intended, but not started.",
    node: "border-base-400", dot: "border-base-500 bg-transparent", head: "text-base-300" },
  { id: "later", name: "Later", say: "Further out, and waiting on the server side.",
    node: "border-base-500", dot: "border-base-600 border-dashed bg-transparent", head: "text-base-400" },
];

/* Shipped takes a double track and reads in two sub-columns, because   */
/* it is the stage that only grows, Enodia's reasoning: four equal      */
/* tracks put sixteen cards against two and three. Written out whole so */
/* Tailwind finds them; the count is of the stages after Shipped. Below  */
/* 1400 wide, beside the sidebar, the columns get too narrow for a      */
/* title to sit on one line, and the stack reads better.                */
const PLAN_COLUMNS = {
  0: "",
  1: "min-[1400px]:grid-cols-[2fr_minmax(0,1fr)]",
  2: "min-[1400px]:grid-cols-[2fr_minmax(0,1fr)_minmax(0,1fr)]",
  3: "min-[1400px]:grid-cols-[2fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]",
};

export function Roadmap() {
  const [open, setOpen] = useState(null);
  const inStage = (id) => {
    const list = ROADMAP.milestones.filter((m) => m.status === id);
    return id === "shipped" ? list.reverse() : list;
  };
  const stages = STAGES.map((s) => ({ ...s, items: inStage(s.id) })).filter((s) => s.items.length);

  /* Counted, not asserted: sixteen of nineteen is a fact you can check */
  /* against the cards underneath it.                                   */
  const built = inStage("shipped").length;
  const total = ROADMAP.milestones.length;
  const share = total ? Math.round((built / total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:px-4" data-tour="roadmap">
      <p className="text-[15px] leading-relaxed text-base-200">
        What has shipped, what is next, and what is further out. No dates: this is a two person project built in
        bursts, and a date would be a guess wearing a promise.
      </p>

      {/* The whole thing at a glance, before any of the detail. */}
      <div className="flex flex-col gap-1.5">
        <div className="h-4 overflow-hidden rounded-full border border-base-700 bg-base-950/80"
          role="img" aria-label={`${built} of ${total} shipped`}>
          <span className="block h-full rounded-full bg-brand/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
            style={{ width: `${share}%` }} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="text-brand">{built}</span> of {total} shipped
        </p>
      </div>

      <div className={"relative mt-5 grid items-start gap-10 min-[1400px]:gap-7 " + PLAN_COLUMNS[stages.length - 1]}>
        {/* The line the stages sit on, so they read as one progression    */}
        {/* rather than as lists that happen to be side by side.           */}
        <span aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[0.4rem] hidden h-px bg-gradient-to-r from-brand/60 via-brand/25 to-base-800 min-[1400px]:block" />

        {stages.map((s) => (
          <section key={s.id} className="relative min-w-0 min-[1400px]:pt-6">
            <span aria-hidden="true"
              className={"absolute left-0 top-0 hidden h-3 w-3 rounded-full border-2 bg-base-950 min-[1400px]:block " + s.node} />
            <header className="flex items-center gap-2.5">
              <h3 className={"text-xl font-semibold uppercase tracking-[0.12em] " + s.head} style={{ fontFamily: "'Oswald', sans-serif" }}>
                {s.name}
              </h3>
              <span className="rounded-full bg-base-800 px-2 py-px text-[10px] tabular-nums text-base-400"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {s.items.length}
              </span>
            </header>
            <p className="mb-5 mt-1 text-[13px] text-base-500">{s.say}</p>

            <div className={"grid items-start gap-2 " + (s.id === "shipped" ? "md:grid-cols-2" : "")}>
              {s.items.map((m) => (
                <PlanCard key={m.id} m={m} stage={s} on={open === m.id}
                  toggle={() => setOpen(open === m.id ? null : m.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* A milestone as one line until opened. The dot leads it in its stage's */
/* colour, so skimming the left edge gives the shape without reading.   */
/* Sentence case and the body face, like Enodia's: a title is something */
/* to read, and sixteen of them in condensed capitals was a wall.        */
function PlanCard({ m, stage, on, toggle }) {
  const track = ROADMAP.tracks[m.track] || null;
  const meta = m.version ? "v" + m.version : m.release || null;
  return (
    <div className={"rounded-lg border backdrop-blur-sm transition-colors " +
      (on ? "border-brand/60 bg-base-900/90" : "border-base-700/70 bg-base-900/60 hover:border-base-500")}>
      <button type="button" onClick={toggle} aria-expanded={on}
        className="group flex min-h-[3rem] w-full items-center gap-3 px-4 py-2.5 text-left">
        <span aria-hidden="true" className={"h-2.5 w-2.5 shrink-0 rounded-full border " + stage.dot} />
        <h4 className={"min-w-0 flex-1 text-[15px] font-semibold leading-snug transition-colors " +
            (on ? "text-brand" : "text-base-100 group-hover:text-brand")}>
          {m.title}
        </h4>
        {meta ? (
          <span className="shrink-0 text-[10px] tabular-nums text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {meta}
          </span>
        ) : null}
        <ChevronDown className={"h-4 w-4 shrink-0 transition-transform " + (on ? "rotate-180 text-brand" : "text-base-400")} />
      </button>
      {on ? (
        <div className="px-4 pb-4 pl-[2.4rem]">
          <p className="text-[14px] leading-relaxed text-base-300">{m.say}</p>
          {track ? (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-base-500">
              {track.label}
              <span className="ml-1.5 normal-case tracking-normal text-base-600">{track.note}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* Folded, Enodia's way, the curator's ask of 3 October 2026: one line per
   release with its summary, and opening one closes whichever was open, so
   the page fits on a screen. The newest starts open. Releases hang off one
   spine, grouped by month, with the same cards and dots as the Roadmap so
   the pair read as one place. "Unfold all" is for reading the lot in one go,
   and opening any single release afterwards goes back to one at a time. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

function byMonth(entries) {
  const groups = [];
  for (const entry of entries) {
    const [y, m] = (entry.date || "").split("-");
    const label = MONTHS[Number(m) - 1] ? MONTHS[Number(m) - 1] + " " + y : "Undated";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

/* "3 Oct": the month is already the group's heading. */
function shortDate(iso) {
  const [, m, d] = (iso || "").split("-");
  return MONTHS[Number(m) - 1] ? Number(d) + " " + MONTHS[Number(m) - 1].slice(0, 3) : iso;
}

export function Changelog() {
  const newest = CHANGELOG[0] ? CHANGELOG[0].version : null;
  const [open, setOpen] = useState(() => new Set(newest ? [newest] : []));
  const all = open.size === CHANGELOG.length;
  /* Closing takes only that one away; opening is exclusive again. */
  const toggle = (v) => setOpen((now) => {
    if (!now.has(v)) return new Set([v]);
    const next = new Set(now);
    next.delete(v);
    return next;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4 text-xs leading-relaxed text-base-400">
        What changed in the tool, newest first. One version is one deploy, dated the day it shipped. For what Arrowhead
        changed in the game, read the caveat on any flagged row.
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="text-brand">{CHANGELOG.length}</span> releases, now on v{newest}
        </p>
        <button type="button"
          onClick={() => setOpen(all ? new Set() : new Set(CHANGELOG.map((e) => e.version)))}
          className="flex items-center gap-1.5 rounded-md border border-base-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-base-300 hover:border-brand hover:text-brand"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (all ? "rotate-180" : "")} />
          {all ? "Fold all" : "Unfold all"}
        </button>
      </div>

      {byMonth(CHANGELOG).map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-base-400" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {group.label}
            <span className="ml-2 font-normal tracking-normal text-base-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {group.entries.length}
            </span>
          </h3>

          {/* The spine, with one node per release on it. The newest node is */}
          {/* lit; everything older is settled, so it is quiet.              */}
          <ol className="ml-1 flex flex-col gap-1.5 border-l border-base-800 pl-4">
            {/* Keyed by version, not date: one deploy can share a day with another. */}
            {group.entries.map((entry) => {
              const on = open.has(entry.version);
              const latest = entry.version === newest;
              return (
                <li key={entry.version} className="relative">
                  <span aria-hidden="true"
                    className={"absolute -left-[21px] top-[15px] h-2 w-2 rounded-full ring-4 ring-base-950 " +
                      (latest ? "bg-brand" : on ? "bg-base-400" : "bg-base-700")} />
                  <div className={"rounded-lg border backdrop-blur-sm transition-colors " +
                    (on ? "border-brand/50 bg-base-900" : "border-base-800 bg-base-900/70 hover:border-base-600")}>
                    <button type="button" onClick={() => toggle(entry.version)} aria-expanded={on}
                      className="group flex w-full items-center gap-3 px-3 py-2 text-left sm:px-4">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={"text-sm font-bold uppercase tracking-wide transition-colors " +
                              (on ? "text-brand" : "truncate text-base-100 group-hover:text-brand")}
                            style={{ fontFamily: "'Oswald', sans-serif" }}>
                            {entry.title}
                          </span>
                          {latest ? (
                            <span className="shrink-0 rounded bg-brand px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-base-950">
                              Latest
                            </span>
                          ) : null}
                        </span>
                        {entry.say && !on ? <span className="block truncate text-xs italic text-base-500">{entry.say}</span> : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-[10px] tabular-nums leading-tight text-base-500"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <span className="text-base-300">v{entry.version}</span>
                        <span>{shortDate(entry.date)}</span>
                      </span>
                      <ChevronDown className={"h-4 w-4 shrink-0 transition-transform " + (on ? "rotate-180 text-brand" : "text-base-500")} />
                    </button>
                    {on ? (
                      <div className="border-t border-base-800 px-3 py-3 sm:px-4">
                        {entry.say ? <p className="mb-2 text-[13px] italic leading-relaxed text-base-400">{entry.say}</p> : null}
                        <ul className="flex flex-col gap-1.5">
                          {entry.changes.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-base-300">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                              {c}
                            </li>
                          ))}
                        </ul>
                        {entry.reconstructed ? (
                          <p className="mt-2 text-[10px] text-base-600">
                            Written after the fact from the design notes. The date is inferred.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
