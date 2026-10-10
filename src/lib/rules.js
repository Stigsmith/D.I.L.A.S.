/* ================================================================== */
/* THE RULES, FOR PEOPLE                                              */
/*                                                                    */
/* What the Rules page needs that is not a picture: every rule the    */
/* tool applies, grouped by what it reacts to, described in plain     */
/* words from its own data, and which ones you have switched off.     */
/*                                                                    */
/* The curator's idea, 1 October 2026: see every rule behind the      */
/* tool's own rating, what it does and what it moves, and switch off  */
/* any you think is wrong, to see what changes. Switching one off is  */
/* this browser's view of the rules, never a fact about a drop: it is */
/* carried on the scenario so every surface honours it, and it is      */
/* never saved with the scenario or sent to a party.                  */
/*                                                                    */
/* The groups and the words are derived from each rule's own when and */
/* match, so a new rule files and describes itself with nothing added */
/* here. The validator makes every rule carry a name.                 */
/* ================================================================== */

import { useState, useEffect, useCallback } from "react";
import CONTEXT from "../data/context-rules.json";
import BUILD from "../data/build-rules.json";
import { SETTINGS, readList, writeList } from "./storage.js";
import { hazardName, missionTraits } from "./scenario.js";
import { getItem } from "./items.js";

export const ITEM_RULES = CONTEXT.rules.map((r) => ({ ...r, kind: "item" }));
export const BUILD_RULES = BUILD.rules.map((r) => ({ ...r, kind: "build" }));
export const ALL_RULES = [...ITEM_RULES, ...BUILD_RULES];
const KNOWN = new Set(ALL_RULES.map((r) => r.id));

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

/* Climate is the planet itself and never lets up; weather comes and
   goes. CLAUDE.md, "The weather rules price a risk, not a state". */
const CLIMATE = new Set(["intense_heat", "extreme_cold"]);

export const GROUPS = [
  { id: "front", label: "The front", line: "Rules for each enemy faction." },
  { id: "peril", label: "Difficulty and squad size", line: "These apply once you set both." },
  { id: "climate", label: "Climate", line: "Intense heat and extreme cold. They last the whole mission." },
  { id: "weather", label: "Weather", line: "Storms, fog and tremors come and go, so their effects are smaller." },
  { id: "terrain", label: "The ground", line: "Footing, slopes, driving and megacities." },
  { id: "mission", label: "The mission", line: "Rules for each kind of mission." },
  { id: "pairing", label: "Pairings", line: "One item beside the rest of its build, like True Grit with a long reload. These apply to builds only, so the Tier Lists never show them." },
  { id: "build", label: "How a build fits together", line: "These check a whole build and change its Build badge." },
];

/* A pairing reads the rest of the build, wherever it sits in the match. */
export const isPairing = (rule) => /"(?:alongside|notAlongside)"/.test(JSON.stringify(rule.match || {}));

export function ruleGroup(rule) {
  if (rule.kind === "build") return "build";
  if (isPairing(rule) || (rule.when && rule.when.weight)) return "pairing";
  const w = rule.when || {};
  if (w.mission || w.minutes) return "mission";
  if (w.terrain || w.city !== undefined) return "terrain";
  const scalesOffPeril = rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.");
  if (w.peril || w.difficulty || w.squad || scalesOffPeril) return "peril";
  if (w.hazard) return w.hazard.every((h) => CLIMATE.has(h)) ? "climate" : "weather";
  return "front";
}

/* ------------------------------------------------------------------ */
/* Plain words                                                         */
/* ------------------------------------------------------------------ */

const FRONT = { bots: "Automatons", bugs: "Terminids", squids: "Illuminate" };
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/* A number test in words: "magazine 30 rounds or more". The short form,
   "peril 22+", is the one rule names use, so the two read alike. */
function numberWords(label, t, unit = "", short = false) {
  /* "1 round", "2 rounds": a unit word loses its s on exactly one. */
  const u = (n) => `${n}${Math.abs(n) === 1 ? unit.replace(/s$/, "") : unit}`;
  const parts = [];
  if (t.gte !== undefined) parts.push(short ? `${u(t.gte)}+` : `${u(t.gte)} or more`);
  if (t.gt !== undefined) parts.push(`over ${u(t.gt)}`);
  if (t.lte !== undefined) parts.push(`${u(t.lte)} or less`);
  if (t.lt !== undefined) parts.push(`under ${u(t.lt)}`);
  if (t.eq !== undefined) parts.push(`exactly ${u(t.eq)}`);
  return `${label} ${parts.join(" and ")}`.trim();
}

/* Squad size the way rule names say it: "1 or 2 players". */
function playerWords(t) {
  if (t.eq !== undefined) return t.eq === 1 ? "1 player" : `${t.eq} players`;
  if (t.lte !== undefined && t.gte === undefined) return t.lte === 1 ? "1 player" : t.lte === 2 ? "1 or 2 players" : `1 to ${t.lte} players`;
  if (t.gte !== undefined && t.lte === undefined) return `${t.gte}+ players`;
  return numberWords("players", t);
}

/* The terrain table's three fields, in words. */
const TERRAIN_WORDS = {
  ground: (v) => `${list(v.map((g) => (g === "snow" ? "snowy" : g)))} ground`,
  relief: (v) => `${list(v)} land`,
  driving: (v) => `${list(v)} driving`,
};

/* When a rule applies, as a short list of conditions, in the words its
   name uses. */
export function describeWhen(rule) {
  const w = rule.when || {};
  const out = [];
  if (w.faction) out.push(list(w.faction.map((f) => FRONT[f] || f)));
  if (w.hazard) out.push(list(w.hazard.map((h) => hazardName(h).toLowerCase())));
  if (w.notHazard) out.push(`no ${list(w.notHazard.map((h) => hazardName(h).toLowerCase()))}`);
  if (w.terrain) {
    for (const [field, values] of Object.entries(w.terrain)) out.push(TERRAIN_WORDS[field] ? TERRAIN_WORDS[field]([].concat(values)) : `${field} ${list([].concat(values))}`);
  }
  if (w.weight) out.push(`${list([].concat(w.weight))} armour`);
  if (w.city !== undefined) out.push(w.city ? "megacity planet" : "no megacity");
  if (w.mission) out.push(`${list(w.mission.map((t) => (missionTraits[t] ? missionTraits[t].name : t)))} missions`);
  if (w.minutes) out.push(numberWords("missions of", w.minutes, " minutes"));
  if (w.difficulty) out.push(numberWords("difficulty", w.difficulty, "", true));
  if (w.squad) out.push(playerWords(w.squad));
  if (w.peril) out.push(numberWords("peril", w.peril, "", true));
  if (rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.peril")) {
    /* A rule held below zero peril grows the other way. */
    out.push(w.peril && w.peril.lte !== undefined ? "grows as peril falls" : "grows with peril");
  }
  if (isPairing(rule) || w.weight) out.push("builds only");
  return out.length ? out : ["always"];
}

/* The fields a rule reads: a label, a unit, and a scale for the ones
   stored as a share. Anything unlisted shows its path, which is honest
   and still beats nothing. */
const PATHS = {
  "wiki.callIn.cooldown": ["cooldown", " seconds"],
  "wiki.heat.coldMultiplier": ["how much longer it fires in the cold"],
  "wiki.heat.hotMultiplier": ["how much sooner it overheats in the heat"],
  "wiki.handling.rpm": ["rate of fire", " rpm"],
  "wiki.handling.ergonomics": ["ergonomics"],
  "wiki.primary.durableRatio": ["durable damage", "%", 100],
  "wiki.ammo.magazine": ["magazine", " rounds"],
  "wiki.ammo.feed": ["ammo type"],
  "wiki.noise": ["loudness"],
  "stats.demoForce": ["demolition force"],
  "stats.ap": ["armour penetration"],
  "reach.openShare": ["the share of the front your weapons open", "%", 100],
  "scenario.peril": ["peril"],
  "wiki.reload.seconds": ["reload time", " seconds"],
  "passive.fireResist": ["fire resistance", "%"],
  "passive.gasResist": ["gas resistance", "%"],
  "passive.arcResist": ["arc resistance", "%"],
  "passive.meleeDamage": ["melee damage bonus", "%"],
  "passive.supportReload": ["support weapon reload bonus", "%"],
  "passive.sidearmReload": ["sidearm reload bonus", "%"],
  "passive.throwRange": ["throw range bonus", "%"],
  "passive.detectionRange": ["shorter detection range", "%"],
  "passive.movementNoise": ["quieter movement", "%"],
  "passive.explosiveResist": ["explosion resistance", "%"],
  "passive.primaryReload": ["primary reload bonus", "%"],
  "passive.crouchRecoil": ["recoil cut when crouched", "%"],
  "passive.stimDuration": ["extra stim time", " seconds"],
  "passive.stims": ["extra stims"],
  "passive.throwables": ["extra throwables"],
  "passive.ammoCapacity": ["extra ammo capacity", "%"],
  "passive.armourRating": ["armour rating bonus"],
  "wiki.primary.dmg": ["damage"],
};
/* A partner's passive is always its armour's, the one thing in a build
   that carries a passive. */
const pathInfo = (p) => {
  if (PATHS[p]) return PATHS[p];
  if (String(p).startsWith("alongside.") && PATHS[p.slice(10)]) {
    const [label, unit, scale] = PATHS[p.slice(10)];
    return [`your armour's ${label}`, unit, scale];
  }
  return [p];
};
const pathWords = (p) => pathInfo(p)[0];

/* "1% or more" of a passive only asks whether there is any. */
/* The game's loudness classes by name, as game-stats.json numbers them. */
const NOISE_WORDS = ["suppressed", "small", "medium", "large", "huge"];

function numberClause(t) {
  if (t.path === "wiki.noise") {
    const fits = (n) => (t.eq === undefined || n === t.eq) && (t.gte === undefined || n >= t.gte)
      && (t.gt === undefined || n > t.gt) && (t.lte === undefined || n <= t.lte) && (t.lt === undefined || n < t.lt);
    const cls = NOISE_WORDS.filter((w, n) => fits(n));
    return `${list(cls)} loudness`;
  }
  const [label, unit = "", scale = 1] = pathInfo(t.path);
  const keys = ["gte", "gt", "lte", "lt", "eq"].filter((k) => t[k] !== undefined);
  if (String(t.path).includes("passive.") && keys.length === 1 && t.gte === 1) return `any ${label}`;
  const scaled = Object.fromEntries(keys.map((k) => [k, Math.round(t[k] * scale * 100) / 100]));
  return numberWords(label, scaled, unit);
}

const SLOT_WORDS = { armor: "armour passive" };
/* The stratagem kinds by the game's words for them. */
const STRAT_WORDS = {
  support: "support weapons", backpack: "backpacks", eagle: "Eagles", orbital: "orbitals",
  sentry: "sentries", emplacement: "emplacements", mines: "mines", vehicle: "vehicles",
};
const ROLE_WORDS = { "anti-armor": "anti-armour", chaff: "crowd clear", objective: "objective" };
const article = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const names = (ids) => list([].concat(ids).map((id) => (getItem(id) || { name: id }).name));

const MATCH_WORDS = {
  held: (v) => (v ? "a weapon you aim" : "anything you do not aim"),
  ventsHeat: (v) => (v ? "a weapon that overheats" : "a weapon that never overheats"),
  stratType: (v) => list([].concat(v).map((t) => STRAT_WORDS[t] || t)),
  slot: (v) => article(list([].concat(v).map((x) => SLOT_WORDS[x] || x))),
  category: (v) => `${list([].concat(v))} weapons`,
  damageType: (v) => `${list([].concat(v))} damage`,
  notDamageType: (v) => `except ${list([].concat(v))} weapons`,
  tags: (v) => `our ${list([].concat(v))} tag`,
  notTags: (v) => `without our ${list([].concat(v))} tag`,
  gameTags: (v) => `game tag ${list([].concat(v).map((t) => t.toLowerCase()))}`,
  notGameTags: (v) => `no game tag ${list([].concat(v).map((t) => t.toLowerCase()))}`,
  roles: (v) => `our ${list([].concat(v).map((r) => ROLE_WORDS[r] || r))} role`,
  traits: (v) => `armour with a ${list([].concat(v))} passive`,
  idIn: (v) => `only ${names(v)}`,
  notIdIn: (v) => `except ${names(v)}`,
  hasWiki: (v) => (v ? "with published stats" : "with no published stats"),
  "wiki.reload.stationary": (v) => (v ? "a stationary reload" : "a reload you can move during"),
  "wiki.reload.perRound": (v) => (v ? "loaded a round at a time" : "loaded a magazine at a time"),
  "wiki.oneHanded": (v) => (v ? "one handed" : "two handed"),
};

/* What a rule checks. Build rules check a whole build and say so. */
function clauseWords(m) {
  const out = [];
  for (const [key, v] of Object.entries(m || {})) {
    if (key === "number") {
      for (const t of [].concat(v)) out.push(numberClause(t));
      continue;
    }
    if (key === "noNumber") {
      out.push(`no ${list([].concat(v).map(pathWords))} in the game file`);
      continue;
    }
    /* Either-or, and pairings, read their own clauses in the same words. */
    if (key === "anyOf") {
      const branches = [].concat(v).map((c) => clauseWords(c).join(", "));
      out.push(branches.every((b) => !b.includes(",")) ? branches.join(" or ") : `one of: ${branches.join("; or ")}`);
      continue;
    }
    if (key === "not") { out.push(`not ${clauseWords(v).join(", ")}`); continue; }
    if (key === "alongside") { out.push(`with ${clauseWords(v).join(", ")} in the build`); continue; }
    if (key === "notAlongside") { out.push(`with nothing in the build that is ${clauseWords(v).join(", ")}`); continue; }
    if (MATCH_WORDS[key]) { out.push(MATCH_WORDS[key](v)); continue; }
    out.push(`${pathWords(key)}: ${list([].concat(v).map(String))}`);
  }
  return out;
}

export function describeMatch(rule) {
  if (rule.kind === "build") return ["the whole build"];
  const out = clauseWords(rule.match);
  return out.length ? out : ["every item"];
}

/* How big a rule is, in tiers as well as points. How many points make a
   tier is on About, How the rating works, rather than repeated here. */
const sizeWords = (points) => {
  const tiers = Math.abs(points) / 14;
  if (tiers < 0.4) return "less than half a tier";
  if (tiers < 0.75) return "about half a tier";
  if (tiers < 1.25) return "about a tier";
  return tiers < 1.75 ? "about a tier and a half" : "about 2 tiers";
};

export function describeSize(rule) {
  if (rule.scaleBy) {
    const cap = rule.scaleBy.clamp ? `, up to ${rule.scaleBy.clamp} points, ${sizeWords(rule.scaleBy.clamp)} at most` : "";
    /* A rule scaling off its own passive is about an armour, so it says whose. */
    const path = String(rule.scaleBy.path);
    const what = path.startsWith("passive.") ? `this armour's ${pathWords(path)}` : pathWords(path);
    return `Depends on ${what}${cap}.`;
  }
  if (rule.delta) return `${rule.delta > 0 ? "+" : ""}${rule.delta} points, ${sizeWords(rule.delta)}.`;
  if (rule.severity) return "No points. A warning only.";
  return "No points.";
}

/* ------------------------------------------------------------------ */
/* Which ones are off                                                  */
/* ------------------------------------------------------------------ */

export const cleanRulesOff = (raw) =>
  new Set((Array.isArray(raw) ? raw : []).filter((id) => typeof id === "string" && KNOWN.has(id)));

export function useRulesOff() {
  const [off, setOff] = useState(() => new Set());
  useEffect(() => { setOff(cleanRulesOff(readList(SETTINGS.rulesOff))); }, []);
  const save = (next) => {
    writeList(SETTINGS.rulesOff, [...next]);
    return next;
  };
  const toggle = useCallback((id) => {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return save(next);
    });
  }, []);
  const clear = useCallback(() => setOff(save(new Set())), []);
  return [off, toggle, clear];
}
