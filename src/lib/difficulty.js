/* ================================================================== */
/* WHAT A DIFFICULTY LEVEL BRINGS                                     */
/*                                                                    */
/* The wiki's Difficulty table, read by scripts/fetch-difficulty.mjs  */
/* into data/difficulty.json, said as one line per level for the war  */
/* room's difficulty bar: the operation, the medals, the outposts,    */
/* the samples, the modifiers and the reward. Pure, so a script can   */
/* check it.                                                          */
/*                                                                    */
/* What carries up from below is worked out here rather than stored:  */
/* the table says where rare samples or a second operation modifier   */
/* start, and every level above inherits it.                          */
/* ================================================================== */

import doc from "../data/difficulty.json";

export const DIFFICULTY_SOURCE = { name: doc.source, url: doc.sourceUrl, licence: doc.licence };

const byLevel = new Map(doc.levels.map((l) => [l.level, l]));

/* The first level whose notes say this, or never. */
const firstSaying = (re) => {
  const hit = doc.levels.find((l) => l.introduces.some((n) => re.test(n)));
  return hit ? hit.level : Infinity;
};
const RARE_FROM = firstSaying(/Rare Samples/i);
const SUPER_FROM = firstSaying(/Super Samples/i);
const MODIFIER_FROM = firstSaying(/Introduces Operation Modifiers/i);
const SECOND_MODIFIER_FROM = firstSaying(/second Operation Modifier/i);

/** Everything the table says about a level, plus what it inherits. Null for 0, which is not said. */
export function levelFacts(level) {
  const n = Number(level);
  const l = byLevel.get(n);
  if (!l) return null;
  return {
    ...l,
    samples: ["common", ...(n >= RARE_FROM ? ["rare"] : []), ...(n >= SUPER_FROM ? ["super"] : [])],
    modifiers: n >= SECOND_MODIFIER_FROM ? 2 : n >= MODIFIER_FROM ? 1 : 0,
  };
}

/* "2-7" reads "2 to 7"; a single figure stays as it is. */
const range = (r) => String(r).replace("-", " to ");
const most = (r) => Number(String(r).split("-").pop());

/* The outposts, by count and the biggest kind you can meet. */
function outpostText(o) {
  if (!o.total) return "no outposts";
  const sizes = ["giant", "heavy", "medium", "light"].filter((k) => o[k] && most(o[k]) > 0);
  const biggest = sizes[0];
  const count = `${range(o.total)} outpost${o.total === "1" ? "" : "s"}`;
  if (!biggest) return count;
  if (sizes.length === 1) return `${count}, all ${biggest}`;
  if (String(o[biggest]).startsWith("0-")) return `${count}, now and then a ${biggest} one`;
  if (String(o[biggest]) === "1") return `${count}, one of them ${biggest}`;
  return `${count}, up to ${most(o[biggest])} ${biggest}`;
}

const SAMPLE_WORDS = { 1: "common samples", 2: "common and rare samples", 3: "common, rare and super samples" };
const MODIFIER_WORDS = ["no operation modifier", "one operation modifier", "two operation modifiers"];

/**
 * The level in a handful of short phrases, for the bar to join. Each is a
 * fact off the wiki's table, never a judgement. Null for 0.
 */
export function levelParts(level) {
  const f = levelFacts(level);
  if (!f) return null;
  return [
    `${f.missions === 1 ? "One mission" : `${f.missions} missions`} an operation, ${f.medals.total} medal${f.medals.total === 1 ? "" : "s"}`,
    outpostText(f.outposts),
    SAMPLE_WORDS[f.samples.length],
    MODIFIER_WORDS[f.modifiers],
    f.multiplier ? `+${f.multiplier}% requisition and experience` : "no reward bonus",
  ];
}

/* What this level adds that the one below it did not, in the wiki's own
   words, for a tooltip. The map size is its own field and is left out. */
export const levelNew = (level) => (byLevel.get(Number(level)) || { introduces: [] }).introduces;
