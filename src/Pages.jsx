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

import { useState } from "react";
import { AlertTriangle, Bug, ChevronDown } from "lucide-react";
import { artCounts } from "./lib/assets.js";
import { items, warbonds } from "./lib/items.js";
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

export function About() {
  const rated = items.filter((i) => Object.values(i.ratings).some((r) => r && r.tier)).length;
  return (
    <div className="flex flex-col gap-4">
      <Panel title="What this is" note="A fan-made reference, built for two people and a Tuesday night">
        <p className="text-base-300">
          A Helldivers 2 tier browser and loadout tool. It exists because deciding what to bring should not mean
          holding six browser tabs open, and because a rating with no date on it is worth very little.
        </p>
        <p>
          Every rating says where it came from and when. Anything the source has not caught up on is flagged rather
          than quietly presented as current. An item nobody has rated shows a question mark instead of a guess.
        </p>
        <p>
          It tracks {items.length} items across six slots, {rated} of them rated, 39 curated builds, and {warbonds.length} warbonds
          with both ownership axes: owning the warbond and unlocking the item are separate purchases, so they are
          separate switches.
        </p>
      </Panel>

      <Panel title="Where the numbers come from">
        <div className="flex flex-col gap-1.5">
          <p><span className="text-base-200">Game version</span> {PATCH.game} {PATCH.gameName}, {PATCH.gameDate}.</p>
          <p><span className="text-base-200">Ratings</span> u.gg community vote aggregates, stamped {PATCH.ratings}, read on {PATCH.readOn}.</p>
        </div>
        <p>
          u.gg dates each of its lists separately, so the ratings carry more than one stamp and every expanded row
          says which one it has. Where a confirmed change touches an item after the vote was cast, that row carries a
          caveat you can expand and read. None does right now.
        </p>
        <p className="text-base-500">
          Facts rather than opinions, the armor classes, damage figures, capacities, demolition force, armor set
          numbers and warbond contents, come from the reference tables in this project and helldivers.wiki.gg.
          Balance changes come from Arrowhead patch notes.
        </p>
      </Panel>

      {/* Attribution is a licence condition, not a courtesy. The fetched  */}
      {/* stats are CC BY-NC-SA, which requires credit, requires derived   */}
      {/* data to carry the same licence, and forbids commercial use.      */}
      <Panel title="Weapon stats come from the Helldivers Wiki">
        <p>
          Magazine size, spare magazines, fire rate, recoil, ergonomics, sway, projectile drag, durable damage,
          stagger and pushback are not in this project's own tables, and neither is the armor value of every body
          part of every enemy, which is what makes a penetration number mean anything. They are fetched from{" "}
          <a href="https://helldivers.wiki.gg" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">helldivers.wiki.gg</a>, which the community
          maintains and restamps within days of a patch.
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
          Where every planet sits and the supply lines between them come from the{" "}
          <a href="https://api.helldivers2.dev" target="_blank" rel="noreferrer noopener"
            className="text-base-200 underline hover:text-base-100">helldivers-2 community API</a>, read once and
          shipped with the tool, so the map draws with nothing fetched.
        </p>
        <p className="text-base-500">
          Who holds each planet, where the fronts are, how they are going and the Major Order come from the same
          API, live. This
          tool's own server asks it every five minutes and keeps the answer, and your browser only ever asks this
          tool's server, never anybody else. Nothing about you goes with the question. An answer more than half an
          hour old is not drawn, because an out of date map looks exactly like a current one.
        </p>
      </Panel>

      <Panel title="Role tags are ours">
        <p>
          Anti-armor, chaff clear and objective are our own judgment, not a community vote. Everything else on a row
          is sourced; those three are us. Expanded rows say so next to the claim.
        </p>
      </Panel>

      <Panel title="Unaffiliated">
        <p>
          Not affiliated with, endorsed by, or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment.
          HELLDIVERS is a trademark of Sony Interactive Entertainment LLC. This tool does not modify, interact with,
          or connect to the game client or your account.
        </p>
        <p className="text-base-500">
          Art is used for identification and reference. {artCounts.items} item illustrations and {artCounts.warbonds}{" "}
          warbond covers
          {artCounts.planets ? `, and ${artCounts.planets} planet renders from helldivers.wiki.gg, shown inside a sector on the map` : ""}.
          Every one of them is optional: with the art removed, every item still reads through its text and every planet is
          drawn as a point of light.
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
    detail: `u.gg dates its lists separately. Primaries are stamped 7.1.1; support weapons, backpacks, eagles and sentries 7.0.2; the other six lists print no stamp but already include the 7.1.0 warbond, so they are read as 7.1.0. The P-33 Missile Pistol has dropped off u.gg's list while staying in the game, so it keeps its 6.3.1 rating.`,
  },
  {
    what: "One item has no rating at all",
    detail: "The P/40-K Bolt Pistol is in the game with no community data yet. It renders a dashed question mark and survives every tier floor, because being seen is the only way it ever gets tried.",
  },
  {
    what: "Twelve items have no art",
    detail: "The eleven added in 1.23.0, eight of them from the Ironclad Democracy warbond, and Electrical Conduit. They fall back to their initials until art for them is added. The Ironclad Democracy warbond has no cover yet either, so its tile in Collection shows the name alone.",
  },
  {
    what: "Some weapon stats are absent, not zero",
    detail: "Reload time and projectile count are in no source this project has, and the TD-110 Maelstrom has no data on the wiki yet. Rows say so, rather than showing a blank and letting you read it as nothing.",
  },
  {
    what: "The curated builds lean hard on high tiers",
    detail: "35 of 39 use an S or S+ primary, and only 13 distinct primaries appear across all of them. Known, and being reworked: a high rating is not the same as a good fit.",
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
          There is no form here yet. Until there is, the fastest route is to say what you were doing, what you
          expected, and what happened instead.
        </p>
        <div className="flex items-start gap-2 rounded border border-base-800 bg-base-950/40 px-3 py-2.5">
          <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-base-500" />
          <p className="text-[13px] text-base-500">
            Useful in a report: which theme you were on, which page, and whether a reload fixed it. If it involves
            your collection, Settings has an Export that produces a file describing exactly what the tool thinks you
            own.
          </p>
        </div>
      </Panel>

      <Panel title="Your data stays yours">
        <p>
          Locks, favorites, profiles and your own builds live in this browser and nowhere else, and there are no
          accounts yet. Clearing your browser data clears them, which is what Export in Settings is for.
        </p>
        <p className="mt-2">
          The one thing that leaves is a party, and only while you are in one. The name you give, the loadout you
          confirm and the host's scenario pass through the tool's server to the others in that party, and the party is
          deleted twelve hours after it goes quiet. Nothing else about you goes with it.
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
/* time axis: nothing unbuilt carries a date. Stacked below xl, where  */
/* four columns beside the sidebar get too narrow to read.            */
/*                                                                    */
/* The data is src/data/roadmap.json, which is the short public        */
/* version. The working document with the reasoning and the           */
/* dependency chain is dilas-roadmap.md in the repo root, and it is    */
/* the one that moves first.                                          */
/* ================================================================== */

/* One scale, from the light that is on to the light not lit yet.      */
const STAGES = [
  { id: "shipped", name: "Shipped", say: "In the tool today, newest first.",
    node: "bg-brand", ring: "border-brand bg-brand", head: "text-brand" },
  { id: "next", name: "Up next", say: "Being worked on, roughly in this order.",
    node: "bg-brand/40", ring: "border-brand bg-brand/30", head: "text-base-100" },
  { id: "planned", name: "Planned", say: "Intended, not started.",
    node: "bg-base-500", ring: "border-base-500 bg-base-950", head: "text-base-300" },
  { id: "later", name: "Later", say: "Further out, and waiting on the server side.",
    node: "bg-base-700", ring: "border-base-600 border-dashed bg-base-950", head: "text-base-500" },
];

/* Shipped takes a double track and reads in two sub-columns, because   */
/* it is the stage that only grows, Enodia's reasoning: four equal      */
/* tracks put sixteen cards against two and three. Written out whole so */
/* Tailwind finds them; the count is of the stages after Shipped.       */
const PLAN_COLUMNS = {
  0: "",
  1: "xl:grid-cols-[2fr_minmax(0,1fr)]",
  2: "xl:grid-cols-[2fr_minmax(0,1fr)_minmax(0,1fr)]",
  3: "xl:grid-cols-[2fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]",
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
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4 text-xs leading-relaxed text-base-400">
        Where this is going, in order rather than on a schedule. There are no dates on anything unbuilt: this is a two
        person project built in bursts, and a date would be a guess wearing a promise. What has shipped carries a
        version, because that part already happened.
      </div>

      {/* The whole thing at a glance, before any of the detail. */}
      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full border border-base-800 bg-base-900"
          role="img" aria-label={`${built} of ${total} shipped`}>
          <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="text-brand">{built}</span> of {total} shipped
        </p>
      </div>

      <div className={"relative grid items-start gap-8 xl:gap-5 " + PLAN_COLUMNS[stages.length - 1]}>
        {/* The line the stages sit on, so they read as one progression    */}
        {/* rather than as lists that happen to be side by side.           */}
        <span aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[0.55rem] hidden h-px bg-gradient-to-r from-brand/70 via-brand/25 to-transparent xl:block" />

        {stages.map((s) => (
          <section key={s.id} className="relative min-w-0 xl:pt-6">
            <span aria-hidden="true"
              className={"absolute left-0 top-1 hidden h-2.5 w-2.5 rounded-full ring-4 ring-base-950 xl:block " + s.node} />
            <header className="flex items-baseline gap-2">
              <h3 className={"text-base font-bold uppercase tracking-wide " + s.head} style={{ fontFamily: "'Oswald', sans-serif" }}>
                {s.name}
              </h3>
              <span className="rounded-full bg-base-800 px-1.5 py-px text-[10px] tabular-nums text-base-400"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {s.items.length}
              </span>
            </header>
            <p className="mb-3 mt-0.5 text-[11px] text-base-500">{s.say}</p>

            <div className={"grid items-start gap-1.5 " + (s.id === "shipped" ? "xl:grid-cols-2" : "")}>
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
function PlanCard({ m, stage, on, toggle }) {
  const track = ROADMAP.tracks[m.track] || null;
  const meta = m.version ? "v" + m.version : m.release || null;
  return (
    <div className={"rounded-lg border backdrop-blur-sm transition-colors " +
      (on ? "border-brand/50 bg-base-900" : "border-base-800 bg-base-900/70 hover:border-base-600")}>
      <button type="button" onClick={toggle} aria-expanded={on}
        className="group flex min-h-[2.4rem] w-full items-center gap-2.5 px-3 py-2 text-left">
        <span aria-hidden="true" className={"h-2 w-2 shrink-0 rounded-full border " + stage.ring} />
        <h4 className={"min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug tracking-wide transition-colors " +
            (on ? "text-brand" : "text-base-200 group-hover:text-brand")}
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          {m.title}
        </h4>
        {meta ? (
          <span className="shrink-0 text-[10px] tabular-nums text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {meta}
          </span>
        ) : null}
        <ChevronDown className={"h-3.5 w-3.5 shrink-0 transition-transform " + (on ? "rotate-180 text-brand" : "text-base-500")} />
      </button>
      {on ? (
        <div className="px-3 pb-3 pl-[1.85rem]">
          <p className="text-[12.5px] leading-relaxed text-base-300">{m.say}</p>
          {track ? (
            <p className="mt-2 text-[10px] uppercase tracking-wider text-base-500">
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
