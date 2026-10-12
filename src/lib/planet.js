/* ================================================================== */
/* A PLANET, AT A GLANCE                                              */
/*                                                                    */
/* Everything the planet card says about a place, from tables the     */
/* tool ships: the temperature, the weather, the biome, the ground    */
/* and the cities, and which landscape shots to show. Pure, no React  */
/* and no art lookups of its own: the shots come in as two functions, */
/* so npm run map checks this against every planet with none at all.  */
/* ================================================================== */

import PLANETS from "../data/planets.json";
import { terrainOf } from "./place.js";

const byName = new Map(PLANETS.planets.map((p) => [p.name, p]));
const HAZARDS = PLANETS.hazards;
const BIOMES = PLANETS.biomes;

/* The three hazards that are the planet's temperature, in the game's own
   words. Nothing publishes degrees, so the card shows this instead. */
export const TEMPERATURE = {
  normal_temp: "Normal",
  intense_heat: "Intense heat",
  extreme_cold: "Extreme cold",
};

const hazard = (slug) => ({
  slug,
  name: HAZARDS[slug] ? HAZARDS[slug].name : slug,
  effect: HAZARDS[slug] ? HAZARDS[slug].description : "",
});

/* The dataset marks a description it wrote itself, or has none yet. */
const biomeText = (slug) => {
  const d = BIOMES[slug] ? BIOMES[slug].description || "" : "";
  if (!d || /pending/i.test(d)) return null;
  return d.replace(/\s*\(UNOFFICIAL\)\s*$/i, "").trim() || null;
};

const GROUND = { wet: "Wet", snow: "Snow", dry: "Dry", mixed: "Mixed" };
const DRIVING = { easy: "easy driving", normal: "normal driving", rough: "rough driving" };

/* Cities in the order the game sizes them. */
const CITY_KINDS = [["megacity", "megacity", "megacities"], ["city", "city", "cities"], ["town", "town", "towns"], ["settlement", "settlement", "settlements"]];

export function planetFacts(name) {
  const p = name ? byName.get(name) : null;
  if (!p) return null;
  const hazards = p.hazards || [];
  const temp = hazards.find((h) => TEMPERATURE[h]);
  const terrain = terrainOf(p.biome);
  const cities = p.cities
    ? CITY_KINDS.filter(([k]) => p.cities[k] > 0).map(([k, one, many]) => `${p.cities[k]} ${p.cities[k] === 1 ? one : many}`)
    : [];
  return {
    name: p.name,
    sector: p.sector && p.sector !== "TBD" ? p.sector : null,
    biome: p.biome ? { slug: p.biome, name: BIOMES[p.biome] ? BIOMES[p.biome].name : p.biome, text: biomeText(p.biome) } : null,
    temperature: temp ? { ...hazard(temp), label: TEMPERATURE[temp] } : null,
    weather: hazards.filter((h) => !TEMPERATURE[h] && h !== "none").map(hazard),
    ground: terrain
      ? { label: `${GROUND[terrain.ground] || terrain.ground}, ${terrain.relief}`, driving: DRIVING[terrain.driving] || terrain.driving }
      : null,
    cities,
  };
}

/* Which shots to show. The planet's own first. With none, another
   planet's of the same biome, sharp and named, then the biome's own
   typical shot, which the wiki keeps at 460 pixels. Each stand-in says
   whose ground it is. `shotsOf(name)` gives a planet's own shots as
   { url, caption }, `biomeShotOf(biome)` a url or null. */
export function pickShots(name, shotsOf, biomeShotOf) {
  const p = name ? byName.get(name) : null;
  if (!p) return [];
  const own = shotsOf(p.name);
  if (own.length) return own.map((s) => ({ ...s, standIn: null }));
  if (!p.biome) return [];
  for (const other of PLANETS.planets) {
    if (other.name === p.name || other.biome !== p.biome) continue;
    const shots = shotsOf(other.name);
    if (shots.length) return [{ url: shots[0].url, caption: null, standIn: other.name }];
  }
  const typical = biomeShotOf(p.biome);
  return typical ? [{ url: typical, caption: null, standIn: "biome" }] : [];
}
