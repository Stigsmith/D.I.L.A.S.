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
import LANDMARKS from "../data/landmarks.json";
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
  if (!p) {
    /* A landmark the war does not list: Mars. Its words and nothing else. */
    const l = name ? LANDMARKS.landmarks.find((x) => x.name === name) : null;
    return l ? { name: l.name, sector: l.sector, biome: null, temperature: null, weather: [], ground: null, cities: [], landmark: l.say } : null;
  }
  const hazards = p.hazards || [];
  const temp = hazards.find((h) => TEMPERATURE[h]);
  const terrain = terrainOf(p.biome);
  const cities = p.cities
    ? CITY_KINDS.filter(([k]) => p.cities[k] > 0).map(([k, one, many]) => `${p.cities[k]} ${p.cities[k] === 1 ? one : many}`)
    : [];
  return {
    name: p.name,
    type: p.type || null,
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

/* The light a place's banner is seen in on this planet. The game's
   banners for a place are one picture for every planet that has it, so the
   card lays the planet over it: a tint for its kind of world, then its
   weather. Literal colours, like the fronts': a desert is warm in every
   theme. Each layer is a CSS background and a blend mode. */
const TYPE_TINT = {
  desert: "#E0A458", oasis: "#D9B36A", arctic: "#9CC3E6", swamp: "#6E8F4E", forest: "#6F9A4F",
  grassland: "#8DB062", moor: "#8E927C", primordial: "#C2A23A", magma: "#D9542B", bug: "#B5A642",
};
const WEATHER_LAYER = {
  thick_fog: { background: "linear-gradient(to top, rgb(220 224 230 / 0.55), rgb(220 224 230 / 0.2))", mix: "screen" },
  rainstorms: { background: "repeating-linear-gradient(105deg, rgb(200 215 235 / 0.22) 0 1px, transparent 1px 7px)", mix: "screen" },
  blizzards: { background: "radial-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1.5px) 0 0 / 9px 9px, linear-gradient(rgb(230 240 255 / 0.25), rgb(230 240 255 / 0.1))", mix: "screen" },
  sandstorms: { background: "linear-gradient(100deg, rgb(214 160 90 / 0.5), rgb(214 160 90 / 0.15))", mix: "soft-light" },
  acid_storms: { background: "linear-gradient(to top, rgb(140 200 60 / 0.45), rgb(140 200 60 / 0.1))", mix: "soft-light" },
  ion_storms: { background: "radial-gradient(ellipse at 70% 10%, rgb(120 170 255 / 0.5), transparent 60%)", mix: "screen" },
  volcanic_activity: { background: "linear-gradient(to top, rgb(230 80 30 / 0.5), transparent 70%)", mix: "screen" },
  fire_tornadoes: { background: "linear-gradient(to top, rgb(240 110 30 / 0.45), transparent 70%)", mix: "screen" },
  intense_heat: { background: "linear-gradient(to top, rgb(255 150 60 / 0.3), transparent)", mix: "soft-light" },
  extreme_cold: { background: "linear-gradient(rgb(170 210 255 / 0.3), transparent)", mix: "soft-light" },
};
export function bannerLayers(facts, cloud = null) {
  if (!facts) return [];
  const out = [];
  const tint = facts.type ? TYPE_TINT[facts.type] : null;
  /* Kept light on purpose: the picture is the game's, the planet a hint over it. */
  if (tint) out.push({ key: "type", background: tint, mix: "color", opacity: 0.15 });
  const hazards = [facts.temperature && facts.temperature.slug, ...facts.weather.map((w) => w.slug)].filter(Boolean);
  for (const h of hazards) if (WEATHER_LAYER[h]) out.push({ key: h, ...WEATHER_LAYER[h], opacity: 0.5 });
  /* The Gloom lies over everything under it. */
  if (cloud) out.push({ key: "cloud", background: `linear-gradient(to top, ${cloud}88, ${cloud}22)`, mix: "soft-light", opacity: 0.5 });
  return out;
}

/* Which shots to show. The planet's own first. With none, another
   planet's of the same biome, sharp and named, then the biome's own
   typical shot, which the wiki keeps at 460 pixels. Each stand-in says
   whose ground it is. `shotsOf(name)` gives a planet's own shots as
   { url, caption }, `biomeShotOf(biome)` a url or null. */
export function pickShots(name, shotsOf, biomeShotOf) {
  const p = name ? byName.get(name) : null;
  /* A landmark has only its own shots. */
  if (!p) return name && LANDMARKS.landmarks.some((l) => l.name === name) ? shotsOf(name).map((s) => ({ ...s, standIn: null })) : [];
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
