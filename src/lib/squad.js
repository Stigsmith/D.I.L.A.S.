/* ================================================================== */
/* SQUAD CHECKS                                                       */
/*                                                                    */
/* A gap, plus where you are dropping, said as a sentence. Not a table */
/* of counts. The earlier design rendered six tags with states of      */
/* absent, thin, covered and redundant, which reads "covered" almost   */
/* every time and gets ignored by the second drop.                     */
/*                                                                    */
/* Two rules keep it honest:                                           */
/*                                                                    */
/*  - Silence is the normal state. Nothing worth saying means nothing  */
/*    is said, rather than a panel reporting that everything is fine.  */
/*  - Every warning is conditioned on context. "You have no anti-tank" */
/*    is almost always false and always boring. "No anti-tank and you  */
/*    are dropping on bugs at 8" is a sentence worth reading.          */
/*                                                                    */
/* Advisory only. Nothing here removes a build or blocks a choice. The */
/* biome hard gate is the opposite case by explicit decision: if the   */
/* answer is do not bring this, it should not be on the card. A squad  */
/* knowingly doubling up on mortars is making a choice about how they  */
/* play, not an error.                                                 */
/* ================================================================== */

import { getItem } from "./items.js";
import { loadoutItems } from "./loadouts.js";
import { peril } from "./score.js";

/* Stratagems that put shells, arcs or fire through your own squad. A    */
/* hand listed set, because nothing in the source data records it.       */
/* The EMS and Gas mortars are deliberately absent: they suppress rather */
/* than kill, so they do not belong next to the ones that drop you.      */
export const TEAMKILL_PRONE = [
  "a-arc-3-tesla-tower",
  "a-m-12-mortar-sentry",
  "a-g-16-gatling-sentry",
  "md-i4-incendiary-mines",
  "orbital-380mm-he-barrage",
];

/* All tier data in this project assumes difficulty 7 and above, and     */
/* below roughly 5 none of this matters. An unset band still warns:      */
/* staying silent on "not specified" means the panel never fires by      */
/* default, which is worse than firing on a drop that turned out easy.   */
const QUIET_BANDS = ["low", "mid"];

/* Below this the coverage checks stay quiet. It is peril rather than a    */
/* band because a band cannot see how many of you there are, and that was  */
/* the whole problem: four players on Suicide and one player on Extreme    */
/* are not the same drop, and the band called them both live.              */
/*                                                                        */
/* 12 is four players at 7, which is where these checks were already       */
/* switched on. Reading it as peril keeps that case and adds the ones the  */
/* band could not see: solo at 6 is 16 and now warns, solo at 5 is 10 and  */
/* still does not.                                                         */
const COVERAGE_PERIL = 12;

/* Where one person carrying the only anti-tank stops being a structure    */
/* and starts being a single point of failure. Solo on Impossible and a    */
/* duo on Helldive both sit here.                                          */
const THIN_THREAD_PERIL = 22;

/* Exported because the panel has to say "these are switched off" rather  */
/* than "you are covered". A squad with no anti-tank at difficulty 3 is   */
/* still a squad with no anti-tank; we are choosing not to care, which is */
/* not the same as it being fine. An admitted gap beats a hedged guess.   */
export const isQuietBand = (difficulty) => QUIET_BANDS.includes(difficulty);

/* What the panel asks so it can say "these are switched off" rather than
   "you are covered". Same rule the warnings use, so the two cannot drift. */
export const coverageIsQuiet = (level, size) => {
  const p = peril({ difficulty: level, squad: size });
  return p === null ? null : p < COVERAGE_PERIL;
};

const countMembers = (squad, test) => squad.filter((m) => m.items.some(test)).length;
const countItems = (squad, test) => squad.reduce((n, m) => n + m.items.filter(test).length, 0);

const hasRole = (role) => (item) => item.roles.includes(role);

/* The faction a warning speaks about. Bugs and bots both punish having  */
/* no answer to armor; squids do not, and the tier data already warns    */
/* off most dedicated anti-tank on that front.                           */
const HEAVY_FRONTS = {
  bugs: "At this level Chargers come in pairs, and Bile Titans appear.",
  bots: "At this level Hulks appear, with Factory Striders behind them.",
  any: "At this level you will meet Chargers or Hulks.",
};

/* ------------------------------------------------------------------ */

/**
 * builds  the loadouts being compared
 * context { faction, biome, mission, difficulty, level, traits }. The first
 *         four are the old grid's filter words. traits is how the drop
 *         screen's real mission name arrives, through dropContext in
 *         drop.js, since "Destroy Command Bunkers" is not a word these
 *         checks know and "nest" is
 * returns [{ id, severity, text }], most severe first, empty when there is
 *         nothing worth saying
 */
export function squadWarnings(builds, context = {}) {
  const squad = builds
    .filter(Boolean)
    .map((l) => ({ loadout: l, items: loadoutItems(l) }));

  /* One build is a loadout, not a squad. The builder already warns on    */
  /* what one person is carrying.                                         */
  if (squad.length < 2) return [];

  const { faction = "any", biome = "any", mission = "any", difficulty = "any", level = 0, traits = [] } = context;
  const nestMission = mission === "nest" || traits.includes("nest");
  const out = [];
  const add = (id, severity, text) => out.push({ id, severity, text });

  const size = squad.length;
  /* The squad is however many builds are being compared, so peril can be
     read straight off the panel without asking for it separately. With no
     level set peril is null and the band is all there is to go on, which
     is the old behaviour and the right fallback. */
  const p = peril({ difficulty: level, squad: size });
  const quiet = p === null ? QUIET_BANDS.includes(difficulty) : p < COVERAGE_PERIL;
  const heavyFront = faction === "bugs" || faction === "bots" || faction === "any";

  /* ---------------------------------------------------------------- */
  /* Coverage. Needs the role tags.                                    */
  /* ---------------------------------------------------------------- */

  const armorMembers = countMembers(squad, hasRole("anti-armor"));
  const chaffMembers = countMembers(squad, hasRole("chaff"));
  const objectiveMembers = countMembers(squad, hasRole("objective"));
  const objectiveItems = countItems(squad, hasRole("objective"));

  /* The bot mirror of the chaff problem. Bugs punish having no volume;   */
  /* bots punish having no penetration, because a Devastator's armor      */
  /* eats light fire all day and the only answers are its head or a       */
  /* bigger gun. Derived from sourced AP rather than a fourth editorial   */
  /* tag, and limited to what you hold: a sentry cannot pick a weakpoint. */
  /*                                                                      */
  /* The threshold is AP 4, the Heavy class, and it was measured rather   */
  /* than picked. AP 3 is carried by something in all 39 curated builds,  */
  /* so a check at that level can never fire. AP 5 is missing from 30 of  */
  /* them and would fire on more than half of all bot pairs, which is     */
  /* noise. AP 4 is absent from 14 and fires on 6 of 78. That is a real   */
  /* signal, and it is also the class that actually beats Devastators.    */
  /*                                                                      */
  /* Re-measured against enemy armor when that landed, and it holds for   */
  /* a second and better reason. A Devastator's plate is AV 3, and        */
  /* penetration equal to an armor value is 65% damage rather than full,  */
  /* so AP 3 only ties a Devastator and AP 4 is the first clean answer to */
  /* one. It is not a clean answer to everything: at AP 4 five of the 22  */
  /* Automaton enemies still take damage in one spot only, and the        */
  /* Dropship at AV 5 all over takes none at all. AP 5 is where the front */
  /* stops needing a weak point entirely, and nothing in the curated set  */
  /* would fire a check there. See src/lib/enemies.js.                    */
  const PENETRATION_AP = 4;
  const held = (i) => i.slot === "primary" || i.slot === "secondary"
    || (i.slot === "stratagem" && i.stratType === "support");
  const penetrators = countMembers(squad, (i) => held(i) && (i.stats.ap ?? 0) >= PENETRATION_AP);

  if (!quiet && armorMembers === 0) {
    if (heavyFront) {
      add("armor-absent", "red", `No anti-tank in the squad. ${HEAVY_FRONTS[faction]}`);
    } else if (faction === "squids") {
      add("armor-absent-squids", "grey",
        "No anti-tank in the squad. Usually fine against the Illuminate: most anti-tank rates poorly on this front.");
    }
  } else if (!quiet && armorMembers === 1 && size >= 2 && faction !== "squids"
             && (p === null ? difficulty === "extreme" : p >= THIN_THREAD_PERIL)) {
    add("armor-thin", "amber",
      `Only 1 of ${size === 2 ? "you" : size} carries anti-tank. If they go down, nobody can open heavy armour.`);
  }

  /* Bugs come at you in numbers. A squad of slow precise guns kills every */
  /* single thing it points at and still gets eaten, because the problem   */
  /* was never whether you could kill one hunter.                          */
  if (!quiet && chaffMembers === 0 && (faction === "bugs" || faction === "squids")) {
    add("chaff-absent", "red",
      faction === "bugs"
        ? "No crowd clear in the squad. Terminids come in swarms."
        : "No crowd clear in the squad. Voteless come in crowds.");
  } else if (!quiet && chaffMembers === 0 && faction === "bots") {
    add("chaff-absent-bots", "amber",
      "No crowd clear in the squad. Automatons come in smaller groups, but trooper patrols still need it.");
  } else if (!quiet && chaffMembers === 1 && size >= 3 && faction === "bugs") {
    add("chaff-thin", "amber",
      `Only 1 of ${size} carries crowd clear, against a front that comes in swarms.`);
  }

  if (!quiet && faction === "bots" && penetrators === 0) {
    add("no-penetration", "amber",
      "Nothing in the squad is AP 4 or more, so Devastators take reduced damage everywhere but the head. An Autocannon, Anti-Materiel Rifle, Laser Cannon or Senator fixes that.");
  }

  if (!quiet && objectiveMembers === 0 && nestMission) {
    add("objective-absent-nest", "red",
      "Nothing in the squad closes bug holes or fabricators without spending a stratagem, and this mission is about destroying them.");
  } else if (!quiet && objectiveItems <= size && biome === "cave") {
    /* Demo 40 closes a hole from outside. Demo 30 needs the throw to go  */
    /* in, and a cave rarely gives you that angle.                        */
    const outside = countItems(squad, (i) => i.roles.includes("objective") && (i.stats.demoForce ?? 0) >= 40);
    add("objective-thin-cave", "amber",
      outside === 0
        ? "Few hole closers for a cave map, and none closes a hole from outside. Caves rarely give the angle to throw inside."
        : "Few hole closers for a cave map. Most need a throw inside the hole.");
  }

  /* ---------------------------------------------------------------- */
  /* Overlap. Needs no new data.                                       */
  /* ---------------------------------------------------------------- */

  const boosters = squad.map((m) => m.loadout.booster).filter(Boolean);
  const dupeBooster = boosters.find((b, i) => boosters.indexOf(b) !== i);
  if (dupeBooster) {
    const name = (getItem(dupeBooster) || {}).name || dupeBooster;
    add("booster-duplicate", "red", `Two of you brought ${name}. Boosters do not stack, so one of those slots does nothing.`);
  }

  const teamkillers = [
    ...new Set(squad.flatMap((m) => m.items.filter((i) => TEAMKILL_PRONE.includes(i.id)).map((i) => i.name))),
  ];
  if (teamkillers.length >= 2 && size <= 3) {
    add("teamkill", "amber",
      `${teamkillers.join(" and ")} in a squad of ${size}. A small squad shares more firing lines, so friendly fire is more likely.`);
  }

  /* Each of you has your own back, so this is never a conflict. It is a  */
  /* note about what the squad gave up: no supply pack, no shield, no dog. */
  const eatsBack = (i) => i.slot === "stratagem" && i.stratType === "support" && i.usesBackpackSlot === true;
  const isBackpack = (i) => i.stratType === "backpack";
  if (countMembers(squad, isBackpack) === 0 && countMembers(squad, eatsBack) === size) {
    add("no-backpack", "grey",
      "Every support weapon in the squad takes the backpack slot, so nobody brings a supply pack, a shield or a guard dog.");
  }

  const order = { red: 0, amber: 1, grey: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
