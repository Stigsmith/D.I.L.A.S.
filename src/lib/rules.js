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
  { id: "front", label: "The front", line: "What each enemy is, whatever the planet." },
  { id: "peril", label: "How hard, and how many of you", line: "Difficulty and squad size, read together. None of these fire until you have said both." },
  { id: "climate", label: "Climate", line: "A hot or frozen planet, all mission long." },
  { id: "weather", label: "Weather and terrain", line: "Storms, fog and tremors. They come and go, so these price a risk rather than a state." },
  { id: "mission", label: "The mission", line: "What the objective asks of you." },
  { id: "pairing", label: "What it is paired with", line: "Rules that read one item beside the rest of its build: True Grit beside a long reload, a Cremator beside fire resistance. They fire in the builder and on every build, never on the tier list, where there is no build." },
  { id: "build", label: "How a build fits together", line: "Rules that read a whole build rather than one item. They move the build's own badge." },
];

/* A pairing reads the rest of the build, wherever it sits in the match. */
export const isPairing = (rule) => /"(?:alongside|notAlongside)"/.test(JSON.stringify(rule.match || {}));

export function ruleGroup(rule) {
  if (rule.kind === "build") return "build";
  if (isPairing(rule)) return "pairing";
  const w = rule.when || {};
  if (w.mission) return "mission";
  const scalesOffPeril = rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.");
  if (w.peril || w.difficulty || w.squad || scalesOffPeril) return "peril";
  if (w.hazard) return w.hazard.every((h) => CLIMATE.has(h)) ? "climate" : "weather";
  return "front";
}

/* ------------------------------------------------------------------ */
/* Plain words                                                         */
/* ------------------------------------------------------------------ */

const FRONT = { bots: "the Automatons", bugs: "the Terminids", squids: "the Illuminate" };
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

function numberWords(name, t) {
  const parts = [];
  if (t.gte !== undefined) parts.push(`${t.gte} or more`);
  if (t.gt !== undefined) parts.push(`above ${t.gt}`);
  if (t.lte !== undefined) parts.push(`${t.lte} or less`);
  if (t.lt !== undefined) parts.push(`below ${t.lt}`);
  if (t.eq !== undefined) parts.push(`exactly ${t.eq}`);
  return `${name} ${parts.join(" and ")}`;
}

/* When a rule applies, as a short list of conditions. */
export function describeWhen(rule) {
  const w = rule.when || {};
  const out = [];
  if (w.faction) out.push(`against ${list(w.faction.map((f) => FRONT[f] || f))}`);
  if (w.hazard) out.push(`on a planet with ${list(w.hazard.map((h) => hazardName(h).toLowerCase()))}`);
  if (w.mission) out.push(`on ${list(w.mission.map((t) => (missionTraits[t] ? missionTraits[t].name : t)))} missions`);
  if (w.difficulty) out.push(numberWords("at difficulty", w.difficulty));
  if (w.squad) out.push(numberWords("with a squad of", w.squad));
  if (w.peril) out.push(numberWords("at peril", w.peril));
  if (rule.scaleBy && String(rule.scaleBy.path).startsWith("scenario.peril")) {
    /* A rule held below zero peril grows the other way. */
    out.push(w.peril && w.peril.lte !== undefined
      ? "growing the easier the drop and the more of you there are"
      : "growing with difficulty and how few of you there are");
  }
  if (isPairing(rule)) out.push("inside a build");
  return out.length ? out : ["everywhere"];
}

/* The fields a rule reads, in words. Anything unlisted shows its path,
   which is honest and still beats nothing. */
const PATHS = {
  "wiki.callIn.cooldown": "call-in cooldown, in seconds",
  "wiki.heat.coldMultiplier": "how much longer it fires in the cold",
  "wiki.heat.hotMultiplier": "how much sooner it overheats in the heat",
  "wiki.handling.rpm": "rate of fire",
  "wiki.handling.ergonomics": "ergonomics",
  "wiki.primary.durableRatio": "share of its damage that is durable",
  "wiki.ammo.magazine": "magazine size",
  "wiki.ammo.feed": "what it feeds on",
  "stats.demoForce": "demolition force",
  "stats.ap": "armor penetration",
  "reach.openShare": "share of this front it gets through",
  "scenario.peril": "peril",
  "wiki.reload.seconds": "reload time, in seconds",
  "passive.fireResist": "fire resistance, in percent",
  "passive.gasResist": "gas resistance, in percent",
  "passive.arcResist": "arc resistance, in percent",
  "passive.meleeDamage": "melee damage bonus, in percent",
  "passive.supportReload": "support weapon reload bonus, in percent",
  "passive.sidearmReload": "sidearm reload bonus, in percent",
  "passive.throwRange": "throw range bonus, in percent",
  "passive.detectionRange": "how much shorter enemies see you from, in percent",
  "passive.movementNoise": "how much quieter you move, in percent",
};
const pathWords = (p) => {
  if (PATHS[p]) return PATHS[p];
  if (String(p).startsWith("alongside.") && PATHS[p.slice(10)]) return `the partner's ${PATHS[p.slice(10)]}`;
  return p;
};

const MATCH_WORDS = {
  held: (v) => (v ? "a weapon you carry and aim" : "anything you do not aim yourself"),
  ventsHeat: (v) => (v ? "a weapon that overheats" : "a weapon that never overheats"),
  stratType: (v) => `${list([].concat(v))} stratagems`,
  slot: (v) => `a ${list([].concat(v))}`,
  category: (v) => `${list([].concat(v))} weapons`,
  damageType: (v) => `${list([].concat(v))} damage`,
  tags: (v) => `tagged ${list([].concat(v))}, our tag`,
  notTags: (v) => `not tagged ${list([].concat(v))}`,
  gameTags: (v) => `that the game tags ${list([].concat(v).map((t) => t.toLowerCase()))}`,
  notGameTags: (v) => `that the game does not tag ${list([].concat(v).map((t) => t.toLowerCase()))}`,
  roles: (v) => `doing the ${list([].concat(v))} job, our call`,
  traits: (v) => `armour with a ${list([].concat(v))} passive`,
  idIn: (v) => `named by hand: ${list([].concat(v).map((id) => (getItem(id) || { name: id }).name))}`,
  notIdIn: (v) => `except ${list([].concat(v).map((id) => (getItem(id) || { name: id }).name))}`,
  hasWiki: (v) => (v ? "with published stats" : "with no published stats"),
  "wiki.reload.stationary": (v) => (v ? "a reload that roots you to the spot" : "a reload you can walk through"),
};

/* What a rule looks at. Build rules read a whole build and say so. */
function clauseWords(m) {
  const out = [];
  for (const [key, v] of Object.entries(m || {})) {
    if (key === "number") {
      for (const t of [].concat(v)) out.push(numberWords(pathWords(t.path), t));
      continue;
    }
    /* Either-or, and pairings, read their own clauses in the same words. */
    if (key === "anyOf") {
      out.push(`any of: ${[].concat(v).map((c) => clauseWords(c).join(", ")).join("; or ")}`);
      continue;
    }
    if (key === "alongside") { out.push(`in a build that also carries ${clauseWords(v).join(", ")}`); continue; }
    if (key === "notAlongside") { out.push(`in a build with nothing that is ${clauseWords(v).join(", ")}`); continue; }
    if (MATCH_WORDS[key]) { out.push(MATCH_WORDS[key](v)); continue; }
    out.push(`${pathWords(key)}: ${list([].concat(v).map(String))}`);
  }
  return out;
}

export function describeMatch(rule) {
  if (rule.kind === "build") return ["the build as a whole: what it carries, what it covers, and how it is held"];
  const out = clauseWords(rule.match);
  return out.length ? out : ["every item"];
}

/* How big a rule is, in the units the tool uses: a tier is about 14
   points. Build rules may only flag, carrying a severity and no points. */
export function describeSize(rule) {
  if (rule.scaleBy) {
    const cap = rule.scaleBy.clamp ? `, never more than ${rule.scaleBy.clamp} points either way` : "";
    return `Scales with ${pathWords(rule.scaleBy.path)}${cap}. A tier is about 14 points.`;
  }
  if (rule.delta) {
    const tiers = Math.abs(rule.delta) / 14;
    const size = tiers >= 1.9 ? "two tiers" : tiers >= 0.95 ? "a tier" : tiers >= 0.45 ? "half a tier" : "a nudge";
    return `${rule.delta > 0 ? "+" : ""}${rule.delta} points, about ${size}.`;
  }
  if (rule.severity) return "No points: it flags a hole in the build without moving its badge.";
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
