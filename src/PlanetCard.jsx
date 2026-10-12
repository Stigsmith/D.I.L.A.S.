/* ================================================================== */
/* THE PLANET CARD                                                    */
/*                                                                    */
/* A planet before you drop on it: what the ground looks like, the    */
/* temperature, the weather, the ground underfoot and the cities.     */
/* One component in two sizes, so the map's hover card and the card   */
/* for the planet you chose never say different things.               */
/*                                                                    */
/*   compact   the hover card on the map: names only, no description, */
/*             nothing to click, because it follows the mouse         */
/*   full      the war room's planner panel, with the effects spelled */
/*             out and their meanings on hover                        */
/*                                                                    */
/* The shots are the wiki's, cut by npm run planet-art --             */
/* --landscapes, and optional like all art: with none on disk the     */
/* card starts at the name.                                           */
/* ================================================================== */

import { planetFacts, pickShots } from "./lib/planet.js";
import { planetLandscapes, biomeLandscape, planetArt, markArt, hazardIcon } from "./lib/assets.js";
import { Tip, MissingData, HAS_TIP } from "./Tip.jsx";
import { planetEffects } from "./lib/effects.js";
import { SUBFACTIONS, subfactionsOn } from "./lib/subfaction.js";
import { scorchedOf } from "./lib/galaxy.js";

/* A scorched world's ground, the way the game's own card shows it: burnt red. */
const SCORCHED_TINT = { filter: "sepia(0.75) saturate(2.4) hue-rotate(-22deg) brightness(0.85)" };

/* The fronts' own colours, literal in every theme like everywhere else. */
const FRONT_HEX = { bots: "#EF4444", bugs: "#F97316", squids: "#A855F7" };

const OSWALD = { fontFamily: "'Oswald', sans-serif" };
const WIKI = "https://helldivers.wiki.gg/wiki/";

/* "EAGLE STORM" as "Eagle storm". */
const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/* Whose ground a stand-in shows. */
const standInLine = (shot, facts) => {
  const biome = facts.biome ? facts.biome.name : "Same biome";
  return shot.standIn === "biome" ? `${biome}, typical ground` : `${biome}, as seen on ${shot.standIn}`;
};

/* The planet's hazards as the game draws them over its picture: the
   temperature when it is hot or cold, then the weather. */
function HazardRow({ facts, compact }) {
  const list = [
    ...(facts.temperature && facts.temperature.slug !== "normal_temp" ? [facts.temperature] : []),
    ...facts.weather,
  ].filter((h) => hazardIcon(h.slug));
  if (!list.length) return null;
  return (
    <div className="pointer-events-auto absolute bottom-1.5 right-1.5 flex gap-1">
      {list.map((h) => {
        const icon = <img src={hazardIcon(h.slug)} alt={h.name} className={(compact ? "h-5 w-5" : "h-6 w-6") + " drop-shadow"} />;
        return compact ? <span key={h.slug}>{icon}</span> : <Tip key={h.slug} title={h.name} text={h.effect}>{icon}</Tip>;
      })}
    </div>
  );
}

function Banner({ shots, facts, compact, scorched = false, hazards = true }) {
  if (!shots.length) return null;
  return (
    <div className={"relative grid gap-px bg-base-950 " + (shots.length > 1 ? "grid-cols-2 " : "") + (compact ? "h-24" : "h-32")}>
      {shots.map((s, i) => (
        <div key={s.url} className="relative min-w-0 overflow-hidden">
          <img src={s.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover"
            style={scorched ? SCORCHED_TINT : undefined} />
          {s.caption || s.standIn ? (
            <span className="absolute bottom-1 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-sm bg-base-950/75 px-1 text-[9px] leading-4 text-base-200">
              {s.standIn ? standInLine(s, facts) : s.caption}
            </span>
          ) : null}
          {i === shots.length - 1 ? (
            compact ? (
              <span className="absolute right-1.5 top-1 text-[8px] uppercase tracking-wider text-base-100/70">wiki</span>
            ) : (
              <a href={WIKI + encodeURIComponent(facts.name.replace(/ /g, "_"))} target="_blank" rel="noreferrer"
                className="absolute right-1.5 top-1 rounded-sm bg-base-950/60 px-1 text-[8px] uppercase tracking-wider text-base-200 hover:text-base-100"
                title="Shot from helldivers.wiki.gg, CC BY-NC-SA 4.0">
                wiki
              </a>
            )
          ) : null}
        </div>
      ))}
      {hazards ? <HazardRow facts={facts} compact={compact} /> : null}
    </div>
  );
}

function Tile({ label, tip, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {tip ? (
        <Tip text={tip}>
          <span className={"text-[9px] font-semibold uppercase tracking-wider text-base-500 " + HAS_TIP} style={OSWALD}>{label}</span>
        </Tip>
      ) : (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>{label}</span>
      )}
      <span className="text-xs font-semibold leading-tight text-base-100">{children}</span>
    </div>
  );
}

/* `children` goes under the facts: the map puts the live war there.
   `war` is the live war, for what the game has marked on the planet.
   `titled` false leaves the name to a page that already shows it.
   A planet the war destroyed shows what destroyed it and nothing of the
   world it was: the game's own banner for what is left, no temperature,
   no ground. A landmark (Mars) is not in the war: it says what it is. */
export default function PlanetCard({ name, compact = false, war = null, titled = true, children = null }) {
  const facts = planetFacts(name);
  if (!facts) return null;
  const marked = planetEffects(war, facts.name);
  const gone = marked.gone;
  /* Who holds it, set apart from the other marks because it changes the
     ratings. Their own effect lines are left out below. */
  const forces = gone ? [] : subfactionsOn(war, facts.name);
  const forceEffects = new Set(forces.flatMap((k) => SUBFACTIONS[k].effects));
  const others = marked.named.filter((e) => !forceEffects.has(e.id));
  const wreck = gone ? markArt(marked.art) : null;
  const shots = gone ? (wreck.banner ? [{ url: wreck.banner, caption: null }] : []) : pickShots(name, planetLandscapes, biomeLandscape);
  const render = shots.length ? null : gone ? wreck.render : planetArt(name);
  const plain = gone || facts.landmark;
  /* Razed by the enemy: the game's own scarring figure, from a fresh war. */
  const scorched = !gone && scorchedOf(war, facts.name);
  const scar = scorched ? war.scars.get(facts.name) : 0;
  const t = facts.temperature;
  const hot = t && t.slug !== "normal_temp";
  const station = war && war.fresh && war.station && war.station.planet === facts.name ? war.station : null;

  return (
    <div className="flex flex-col text-left">
      <Banner shots={shots} facts={facts} compact={compact} scorched={scorched} hazards={!gone} />
      <div className={"flex flex-col gap-2 " + (compact ? "px-3 py-2" : "p-3")}>
        {titled ? <div className="flex items-center gap-2.5">
          {render ? <img src={render} alt="" className={(compact ? "h-10 w-10" : "h-12 w-12") + " shrink-0"} /> : null}
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-base-100" style={OSWALD}>{facts.name}</p>
            <p className="text-[10px] text-base-500">
              {[facts.sector ? facts.sector + " sector" : null, facts.biome ? facts.biome.name : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div> : null}

        {facts.landmark ? (
          <p className="border-t border-base-800 pt-2 text-[11px] leading-relaxed text-base-300">{facts.landmark}</p>
        ) : null}

        {plain ? null : <div className="grid grid-cols-3 gap-2 border-t border-base-800 pt-2">
          <Tile label="Temperature" tip={compact || !t ? null : t.effect}>
            {t ? <span className={hot ? "text-accent-300" : ""}>{t.label}</span> : compact ? "Missing data" : <MissingData why="The planet table lists no temperature for this planet." />}
          </Tile>
          <Tile label="Ground" tip={compact ? null : "What is underfoot, how steep it is, and how an FRV drives. Our reading of the biome."}>
            {facts.ground ? (
              <>
                {facts.ground.label}
                <span className="block text-[10px] font-normal text-base-400">{facts.ground.driving}</span>
              </>
            ) : compact ? "Missing data" : <MissingData why="Nobody has read the ground of this biome yet." />}
          </Tile>
          <Tile label="Cities">
            {facts.cities.length ? (
              facts.cities.map((c) => <span key={c} className="block">{c}</span>)
            ) : (
              <span className="text-base-400">None</span>
            )}
          </Tile>
        </div>}

        {marked.gone ? (
          <p className="rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] font-semibold text-base-200">
            Destroyed. No missions here.
            {compact ? null : <span className="block font-normal text-base-400">A Super Destroyer can still travel there.</span>}
          </p>
        ) : null}

        {scorched ? (
          <p className="rounded border px-2 py-1 text-[11px] font-semibold text-base-100"
            style={{ borderColor: "#B4451FB3", backgroundColor: "#B4451F26" }}>
            {compact ? "Scorched world" : (
              <Tip text={`Scarring ${scar} of 100, from the game's own data. 10 or more is a scorched world.`}>
                <span className={HAS_TIP}>Scorched world</span>
              </Tip>
            )}
            {compact ? null : <span className="block font-normal text-base-300">Razed to the ground by the enemies of Liberty.</span>}
          </p>
        ) : null}

        {marked.evacuated ? (
          <p className="rounded border border-base-700 bg-base-900 px-2 py-1 text-[11px] font-semibold text-base-200">
            Evacuated. No missions here.
          </p>
        ) : null}

        {forces.length ? (
          <div className="flex flex-col gap-1 border-t border-base-800 pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-base-500" style={OSWALD}>Enemy forces</p>
            {forces.map((k) => (
              <p key={k} className="text-[11px] leading-relaxed text-base-400">
                <span className="font-semibold" style={{ color: FRONT_HEX[SUBFACTIONS[k].front] }}>{SUBFACTIONS[k].name}</span>
                {compact ? null : <> {SUBFACTIONS[k].say}</>}
              </p>
            ))}
          </div>
        ) : null}

        {others.length || marked.unnamed || station ? (
          <div className="flex flex-col gap-1 border-t border-base-800 pt-2">
            {others.map((e) => {
              /* A place with the game's own banner shows it, its name on
                 the picture, the way the game's card does. */
              const banner = e.banner ? markArt(e.banner).banner : null;
              return banner ? (
                <div key={e.id} className="flex flex-col gap-1">
                  <div className={"relative overflow-hidden rounded-sm " + (compact ? "h-14" : "h-20")}>
                    <img src={banner} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    <span className="absolute left-1.5 top-1 rounded-sm bg-base-950/75 px-1 text-[10px] font-bold uppercase tracking-wider text-base-100"
                      style={OSWALD}>
                      {e.name}
                    </span>
                  </div>
                  {!compact && e.say ? <p className="text-[11px] leading-relaxed text-base-400">{e.say}</p> : null}
                </div>
              ) : (
                <p key={e.id} className="text-[11px] leading-relaxed text-base-400">
                  <span className="font-semibold text-base-100">{e.name}</span>
                  {!compact && e.say ? <> {e.say}</> : null}
                </p>
              );
            })}
            {station ? (
              <p className="text-[11px] leading-relaxed text-base-400">
                {compact || !station.actions.length ? (
                  <span className="font-semibold text-base-100">DSS in orbit</span>
                ) : (
                  <Tip title="Tactical actions" text={station.actions.map((a) => `${titleCase(a.name)}: ${a.description}`).join(" ")}>
                    <span className={"font-semibold text-base-100 " + HAS_TIP}>DSS in orbit</span>
                  </Tip>
                )}
                {station.actions.length ? <> · {station.actions.map((a) => titleCase(a.name)).join(", ")}</> : null}
              </p>
            ) : null}
            {marked.unnamed ? (
              compact ? (
                <p className="text-[10px] text-base-500">{marked.unnamed} more {marked.unnamed === 1 ? "effect" : "effects"} with no name yet</p>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-base-500">
                  <MissingData why="The game marks this planet with effects that have no name here yet." />
                  {marked.unnamed} {marked.unnamed === 1 ? "effect" : "effects"}
                </span>
              )
            ) : null}
          </div>
        ) : null}

        {plain ? null : facts.weather.length ? (
          <div className="flex flex-col gap-1 border-t border-base-800 pt-2">
            {compact ? (
              <p className="text-[11px] text-accent-300">{facts.weather.map((w) => w.name).join(" · ")}</p>
            ) : facts.weather.map((w) => (
              <p key={w.slug} className="text-[11px] leading-relaxed text-base-400">
                <span className="text-accent-300">{w.name}.</span> {w.effect}
              </p>
            ))}
          </div>
        ) : (
          <p className="border-t border-base-800 pt-2 text-[11px] text-base-500">No weather hazards.</p>
        )}

        {!gone && !compact && facts.biome && facts.biome.text ? (
          <p className="text-[11px] italic leading-relaxed text-base-500">{facts.biome.text}</p>
        ) : null}

        {children}
      </div>
    </div>
  );
}
