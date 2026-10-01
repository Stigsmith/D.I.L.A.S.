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

import { AlertTriangle, Bug } from "lucide-react";
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

/* Reverse chronological, straight off the data file. A new entry is a  */
/* new object in src/data/changelog.json and nothing else.              */
/* ================================================================== */
/* ROADMAP                                                            */
/*                                                                    */
/* One spine, one dot per milestone, newest shipped at the top so it   */
/* reads the same direction as the changelog next to it. The pair is   */
/* deliberate: Changelog is what landed, this is what is coming, and   */
/* they sit together in the menu for that reason.                     */
/*                                                                    */
/* The data is src/data/roadmap.json, which is the short public        */
/* version. The working document with the reasoning and the           */
/* dependency chain is dds-roadmap.md in the repo      */
/* root, and it is the one that moves first.                          */
/* ================================================================== */

/* Shipped is settled, so it is quiet. Next is the only thing lit,     */
/* because exactly one thing can be next and a timeline where          */
/* everything glows tells you nothing.                                 */
const STATUS = {
  shipped: { label: "Shipped", dot: "bg-base-600 border-base-600", text: "text-base-500" },
  next: { label: "Up next", dot: "bg-brand border-brand", text: "text-base-200" },
  planned: { label: "Planned", dot: "bg-base-900 border-base-600", text: "text-base-400" },
  later: { label: "Later", dot: "bg-base-900 border-base-800", text: "text-base-500" },
};

export function Roadmap() {
  const shipped = ROADMAP.milestones.filter((m) => m.status === "shipped").reverse();
  const coming = ROADMAP.milestones.filter((m) => m.status !== "shipped");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4 text-xs leading-relaxed text-base-400">
        Where this is going, in order rather than on a schedule. There are no dates on anything unbuilt: this is a two
        person project built in bursts, and a date would be a guess wearing a promise. What has shipped carries a
        version, because that part already happened.
      </div>

      <div className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
        <div className="border-b border-base-800 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Coming
          </h3>
        </div>
        <Spine items={coming} />

        <div className="border-y border-base-800 bg-base-950/40 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-base-300" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Shipped
          </h3>
          <p className="text-[11px] text-base-600">Newest first, same direction as the changelog.</p>
        </div>
        <Spine items={shipped} />
      </div>
    </div>
  );
}

function Spine({ items }) {
  return (
    <ol className="relative flex flex-col">
      {items.map((m, i) => {
        const s = STATUS[m.status] || STATUS.later;
        const last = i === items.length - 1;
        return (
          <li key={m.id} className="relative flex gap-3 px-4 py-3">
            {/* The spine, drawn per row rather than as one absolute line, */}
            {/* so it stops cleanly at the final dot instead of running    */}
            {/* past it into the padding.                                   */}
            {/* Measured, not eyeballed. The row pads 16px, the dot is 10px */}
            {/* wide with a 4px top margin, so its centre is at x 21 and it  */}
            {/* ends at y 26. A 1px line therefore starts at x 20.5, and     */}
            {/* being two pixels out is the difference between a spine and   */}
            {/* a row of unconnected dots.                                    */}
            {!last ? (
              <span aria-hidden="true" className="absolute left-[20.5px] top-[26px] bottom-0 w-px bg-base-700" />
            ) : null}

            <span aria-hidden="true"
              className={"relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 " + s.dot} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h4 className={"text-[13px] font-bold uppercase tracking-wide " +
                    (m.status === "shipped" ? "text-base-300" : "text-base-100")}
                  style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {m.title}
                </h4>
                {m.version ? (
                  <span className="rounded border border-base-800 px-1.5 py-px text-[10px] tabular-nums text-base-500"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    v{m.version}
                  </span>
                ) : null}
                {m.status === "next" ? (
                  <span className="rounded bg-brand px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-base-950">
                    {s.label}
                  </span>
                ) : null}
                {m.release ? (
                  <span className="rounded border border-base-700 px-1.5 py-px text-[10px] uppercase tracking-wider text-base-500">
                    {m.release}
                  </span>
                ) : null}
              </div>
              <p className={"mt-1 text-[12px] leading-relaxed " + s.text}>{m.say}</p>
              {/* Only where it changes. Four rows each saying "needs        */}
              {/* nothing new" is four times the ink for none of the         */}
              {/* information, and printing it once makes the hand-off       */}
              {/* between the two tracks the thing you actually notice.      */}
              {m.status !== "shipped" && m.track !== (items[i - 1] || {}).track ? (
                <p className="mt-1.5 text-[10px] uppercase tracking-wider text-base-600">
                  {(ROADMAP.tracks[m.track] || {}).label}
                  <span className="ml-1.5 normal-case tracking-normal text-base-700">
                    {(ROADMAP.tracks[m.track] || {}).note}
                  </span>
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Changelog() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4 text-xs leading-relaxed text-base-400">
        Changes to the tool and its data, newest first. One version is one deploy, so a version can gather a few days of
        work and the date is when it shipped. This is not the game patch notes: for what Arrowhead changed, read the
        caveat on any flagged row.
      </div>

      {/* Keyed by version, not date. One version is one deploy and a deploy  */}
      {/* can gather several days, so two entries sharing a date is normal    */}
      {/* and two sharing a version is not. 0.3.0 and 0.4.0 both shipped on   */}
      {/* 15 August, which is what React was warning about.                   */}
      {CHANGELOG.map((entry) => (
        <div key={entry.version} className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-800 px-4 py-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-base-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {entry.title}
            </h3>
            <span className="flex items-center gap-2 text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span className="rounded border border-base-700 px-1.5 py-px text-base-300">v{entry.version}</span>
              <span className="text-base-500">{entry.date}</span>
              {entry.estimated ? (
                <span title="The date is an estimate. Nothing in the repo dates this one."
                  className="rounded border border-base-800 px-1.5 py-px text-base-600">approx</span>
              ) : null}
              {entry.reconstructed ? (
                <span title="Written after the fact from the design notes, not as the work happened. The date is inferred."
                  className="rounded border border-base-800 px-1.5 py-px text-base-600">reconstructed</span>
              ) : null}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5 p-4">
            {entry.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-base-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-base-600" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
