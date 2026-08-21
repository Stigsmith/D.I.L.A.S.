import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Star, Bot, Bug, Eye, Flame, Info, Crosshair, Backpack, Plane, Satellite,
  RadioTower, Users, Bomb, CircleDot, FilterX, Thermometer, Zap, Wind, Sword,
  Search, Lock, Unlock, HelpCircle, ChevronDown, AlertTriangle,
} from "lucide-react";

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');";

/* ================================================================== */
/* THEME                                                              */
/* ================================================================== */

const FACTIONS = [
  { id: "bots", label: "Automatons", short: "Bots", Icon: Bot, hex: "#EF4444" },
  { id: "bugs", label: "Terminids", short: "Bugs", Icon: Bug, hex: "#F97316" },
  { id: "squids", label: "Illuminate", short: "Squids", Icon: Eye, hex: "#A855F7" },
];

const FACTION_THEME = {
  bugs: { hex: "#F97316", text: "text-orange-400", chip: "bg-orange-500 text-orange-950 border-orange-500", cardBorder: "border-orange-500/40" },
  bots: { hex: "#EF4444", text: "text-red-400", chip: "bg-red-500 text-red-950 border-red-500", cardBorder: "border-red-500/40" },
  squids: { hex: "#A855F7", text: "text-purple-400", chip: "bg-purple-500 text-purple-950 border-purple-500", cardBorder: "border-purple-500/40" },
  all: { hex: "#EAB308", text: "text-yellow-400", chip: "bg-yellow-500 text-yellow-950 border-yellow-500", cardBorder: "border-yellow-500/40" },
};

const TIER_STYLE = {
  "S+": "bg-amber-400 text-amber-950",
  S: "bg-emerald-400 text-emerald-950",
  A: "bg-sky-400 text-sky-950",
  B: "bg-zinc-500 text-zinc-950",
  C: "bg-stone-600 text-stone-200",
  D: "bg-red-600 text-red-50",
};
const TIER_RANK = { "S+": 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
const TIER_ORDER = ["S+", "S", "A", "B", "C", "D"];

/* Icon is null for ballistic and utility on purpose. Those two are the    */
/* "nothing special happens" defaults, so a glyph there is decoration      */
/* rather than information. The kinds that keep an icon are the ones that  */
/* change how the item behaves, including the two the biome gating uses.   */
const KIND_META = {
  heat: { Icon: Thermometer, label: "Vents heat", note: "Better in cold, worse in hot" },
  arc: { Icon: Zap, label: "Arc", note: "Vents heat, chains between targets" },
  fire: { Icon: Flame, label: "Fire", note: "Fire resist armor recommended" },
  explosive: { Icon: Bomb, label: "Explosive", note: "" },
  ballistic: { Icon: null, label: "Ballistic", note: "" },
  gas: { Icon: Wind, label: "Gas", note: "" },
  melee: { Icon: Sword, label: "Melee", note: "" },
  utility: { Icon: null, label: "Utility", note: "" },
};

/* ================================================================== */
/* WARBONDS                                                           */
/* Source strings below must match the source field on tier rows.     */
/* 24 warbonds as of 12 Aug 2026: 1 standard, 20 premium, 3 legendary.*/
/* "Requisition", "Starter", "Superstore", "Campaign Reward" and      */
/* "Super Citizen Edition" are not warbonds and are never gated.      */
/* ================================================================== */

const WARBOND_GROUPS = [
  {
    id: "standard", label: "Standard",
    note: "Free. Everyone has this.",
    names: ["Mobilize (free)"],
  },
  {
    id: "premium", label: "Premium",
    note: "1,000 Super Credits each, or a Premium Warbond Token.",
    names: [
      "Steeled Veterans", "Cutting Edge", "Democratic Detonation", "Polar Patriots",
      "Viper Commandos", "Freedom's Flame", "Chemical Agents", "Truth Enforcers",
      "Servants of Freedom", "Borderline Justice", "Urban Legends", "Masters of Ceremony",
      "Force of Law", "Control Group", "Dust Devils", "Redacted Regiment",
      "Entrenched Division", "Exo Experts", "Python Commandos", "Siege Breakers",
    ],
  },
  {
    id: "legendary", label: "Legendary",
    note: "1,500 Super Credits. No reclaimable Super Credits inside, no token unlock.",
    names: ["Halo: ODST", "Righteous Revenants", "Castellan's Creed"],
  },
  {
    id: "other", label: "Not warbond gated",
    note: "Requisition slips, starter kit, rotating store or event. Never locked here.",
    names: ["Requisition", "Starter", "Superstore", "Campaign Reward", "Super Citizen Edition", "Armor sets"],
  },
];

const GATEABLE = new Set(
  WARBOND_GROUPS.filter((g) => g.id !== "other").flatMap((g) => g.names)
);

/* ================================================================== */
/* PATCH 7.0.0 NOTES                                                  */
/* Keyed by item name. "stale" rows carry one of these; the rating is */
/* u.gg community consensus from 6.3.1 and predates the change below. */
/* ================================================================== */

const PATCH_NOTES = {
  "SMG/FLAM-34 Stoker": "Short mag spare 10 to 13, starting 6 to 7, reload 2.8s down to 2.3s.",
  "AR-23 Liberator": "Short mag spare 12 to 16, starting 7 to 9.",
  "AR-23A Liberator Carbine": "Short mag spare 12 to 16, starting 7 to 9.",
  "AR-23P Liberator Penetrator": "Short mag spare 12 to 16, starting 7 to 9.",
  "AR-59 Suppressor": "Short mag spare 12 to 16, starting 7 to 9.",
  "SG-225IE Breaker Incendiary": "Short mag spare 9 to 11, starting 6 to 7.",
  "SG-225 Breaker": "Short mag spare 9 to 11, starting 6 to 7.",
  "SMG-37 Defender": "Short mag spare 9 to 12, starting 6 to 8.",
  "SG-225SP Breaker Spray & Pray": "Short mag spare 16 to 20, starting 11 to 12.",
  "SMG-72 Pummeler": "Short mag spare 9 to 12, starting 6 to 8.",
  "AR-23C Liberator Concussive": "Short mag spare 12 to 16, starting 7 to 9.",
  "R-2124 Constitution": "Full stripper clip reload when the magazine is empty. Expect this D/D/D to move.",
  "P-113 Verdict": "Max spare mags 8 to 10, starting 4 to 6.",
  "P-69 Veto": "Bug fix removed an extra round the Siege-Ready passive was granting. Slight nerf in that pairing.",
  "P-19 Redeemer": "Spare mags 4 to 6.",
  "M6C-SOCOM": "Max spare mags 8 to 10, starting 5 to 6.",
  "Eagle Napalm Airstrike": "Explosion radius 8m to 10m and a wider bomb pattern. Rating is pre-buff.",
  "SH-20 Ballistic Shield": "Illuminate Veracitor melee force 25 to 40 and conformed to Anti-Tank. Blocking ragdolls you, shield breaks after roughly 15 direct hits.",
  "MD-17 Anti-Tank Mines": "Demolition 30 to 40. Now closes bug holes and fabricators from outside, and qualifies for Bile Titan holes. Most likely rating to move up.",
};

const UNRATED_NOTE =
  "Released 12 August 2026 in Castellan's Creed. No community rating exists yet. Re-check u.gg around early September 2026.";

/* ================================================================== */
/* TIER DATA                                                          */
/* row = [name, bots, bugs, squids, kind, source, note, flag]         */
/* tiers are null when no community rating exists yet                 */
/* flag = "stale" (rating predates a 7.0.0 change, see PATCH_NOTES)   */
/*        or "new" (in the game, not yet rated), otherwise absent     */
/* ================================================================== */

const RAW_CATEGORIES = [
  {
    id: "primary", label: "Primaries",
    rows: [
      ["PLAS-101 Purifier", "S+", "S+", "S+", "heat", "Polar Patriots", "AP3 · 2916 DPS · charge for AOE, best chaff clear on every front"],
      ["R-36 Eruptor", "S+", "S+", "S+", "explosive", "Democratic Detonation", "AP4 Heavy · 853 DPS · closes holes and fabricators"],
      ["CB-9 Explosive Crossbow", "S+", "S+", "S", "explosive", "Democratic Detonation", "AP3 · 516 DPS · closes holes"],
      ["SG-8 Punisher Plasma", "S+", "S", "S+", "heat", "Cutting Edge", "AP3 · 300 DPS · staggers, see the source split note"],
      ["PLAS-1 Scorcher", "S", "S", "S", "heat", "Mobilize (free)", "AP3 · 1166 DPS · best free primary"],
      ["AR-2 Coyote", "A", "S+", "S+", "ballistic", "Dust Devils", "AP3 · 750 DPS · assault rifle"],
      ["SG-97 Sweeper", "A", "S", "S", "ballistic", "Superstore", "AP3 · 1260 DPS · shotgun"],
      ["SMG-203 Gallant", "B", "S", "S", "ballistic", "Exo Experts", "AP3 · 1495 DPS · SMG, hipfires at full sprint"],
      ["DBS-2 Double Freedom", "A", "S", "A", "ballistic", "Superstore", "AP3 · 1680 DPS · double barrel shotgun"],
      ["SMG/FLAM-34 Stoker", "B", "A", "S", "fire", "Entrenched Division", "AP2 · 910 DPS · SMG with underbarrel flamethrower", "stale"],
      ["VG-70 Variable", "A", "A", "S", "ballistic", "Control Group", "AP2 · 1062 DPS · rocket jump tech"],
      ["R-72 Censor", "S", "C", "A", "ballistic", "Redacted Regiment", "AP2 · 1100 DPS · marksman"],
      ["R-63 Diligence", "S", "C", "A", "ballistic", "Mobilize (free)", "AP2 · 962 DPS · marksman"],
      ["R-2 Amendment", "A", "C", "A", "ballistic", "Masters of Ceremony", "AP2 · 1600 DPS · marksman"],
      ["LAS-13 Trident", "A", "A", "A", "heat", "Siege Breakers", "AP2 · 1800 DPS · energy, vents heat"],
      ["LAS-17 Double-Edge Sickle", "A", "A", "A", "heat", "Servants of Freedom", "AP4 Heavy · 816 DPS · damages you while venting"],
      ["JAR-5 Dominator", "A", "A", "A", "explosive", "Steeled Veterans", "AP3 · 1145 DPS · heavy explosive rifle"],
      ["LAS-5 Scythe", "A", "A", "A", "heat", "Mobilize (free)", "AP2 · 350 DPS · continuous beam"],
      ["PLAS-39 Accelerator Rifle", "A", "B", "A", "heat", "Righteous Revenants", "AP3 · 3208 DPS · Killzone crossover, highest listed DPS in the game"],
      ["R-63CS Diligence Counter Sniper", "A", "C", "B", "ballistic", "Mobilize (free)", "AP3 · 1166 DPS · marksman"],
      ["R-4 Hyena", "A", "B", "B", "ballistic", "Campaign Reward", "AP3 · 712 DPS · marksman, campaign reward"],
      ["SMG-32 Reprimand", "B", "A", "A", "ballistic", "Truth Enforcers", "AP3 · 1143 DPS · SMG"],
      ["AR-61 Tenderizer", "B", "A", "A", "ballistic", "Polar Patriots", "AP2 · 1487 DPS · assault rifle"],
      ["AR-23 Liberator", "B", "A", "A", "ballistic", "Starter", "AP2 · 960 DPS · starter rifle, A against bugs and squids", "stale"],
      ["AR-23A Liberator Carbine", "B", "A", "A", "ballistic", "Viper Commandos", "AP2 · 1380 DPS · assault rifle", "stale"],
      ["MP-98 Knight", "B", "A", "A", "ballistic", "Super Citizen Edition", "AP2 · 2070 DPS · SMG"],
      ["BR-14 Adjudicator", "B", "A", "B", "ballistic", "Democratic Detonation", "AP3 · 870 DPS · assault rifle, A against bugs"],
      ["AR-23P Liberator Penetrator", "B", "A", "B", "ballistic", "Mobilize (free)", "AP3 · 693 DPS · A against bugs", "stale"],
      ["AR/GL-21 One-Two", "B", "A", "B", "ballistic", "Python Commandos", "AP2 · 1029 DPS · assault rifle with underbarrel grenade launcher"],
      ["SG-20 Halt", "B", "A", "B", "ballistic", "Truth Enforcers", "AP3 · 513 DPS · shotgun, A against bugs"],
      ["AR-32 Pacifier", "B", "A", "C", "ballistic", "Force of Law", "AP3 · 640 DPS · SMG"],
      ["AR-59 Suppressor", "B", "B", "B", "ballistic", "Redacted Regiment", "AP2 · 1133 DPS · assault rifle", "stale"],
      ["LAS-16 Sickle", "B", "B", "B", "heat", "Cutting Edge", "AP2 · 750 DPS · topped every list through 2025, now B across the board"],
      ["SG-225IE Breaker Incendiary", "C", "A", "A", "fire", "Steeled Veterans", "AP2 · 1200 DPS · applies fire, A against bugs", "stale"],
      ["SG-225 Breaker", "C", "A", "A", "ballistic", "Mobilize (free)", "AP2 · 1650 DPS · free shotgun, A against bugs and squids", "stale"],
      ["MA5C Assault Rifle", "C", "A", "A", "ballistic", "Halo: ODST", "AP3 · 960 DPS · Halo crossover, no weapon customization"],
      ["SG-451 Cookout", "C", "A", "B", "fire", "Freedom's Flame", "AP2 · 426 DPS · incendiary shotgun"],
      ["SG-8 Punisher", "C", "A", "C", "ballistic", "Mobilize (free)", "AP2 · 540 DPS · pump shotgun"],
      ["StA-52 Assault Rifle", "C", "B", "A", "ballistic", "Righteous Revenants", "AP2 · 1185 DPS · Killzone crossover"],
      ["StA-11 SMG", "C", "B", "A", "ballistic", "Righteous Revenants", "AP2 · 1575 DPS · Killzone crossover"],
      ["FLAM-66 Torcher", "C", "B", "S+", "fire", "Freedom's Flame", "AP4 Heavy · 250 DPS · hard squid specialist"],
      ["M7S SMG", "C", "B", "B", "ballistic", "Halo: ODST", "AP2 · 1308 DPS · Halo crossover, no weapon customization"],
      ["SMG-37 Defender", "C", "C", "B", "ballistic", "Mobilize (free)", "AP2 · 953 DPS · SMG", "stale"],
      ["SG-225SP Breaker Spray & Pray", "C", "C", "B", "ballistic", "Mobilize (free)", "AP2 · 1320 DPS · shotgun", "stale"],
      ["R-6 Deadeye", "C", "C", "B", "ballistic", "Borderline Justice", "AP3 · 500 DPS · marksman"],
      ["ARC-12 Blitzer", "D", "S", "A", "arc", "Cutting Edge", "AP3 · 333 DPS · infinite ammo, unusable against bots"],
      ["M90A Shotgun", "D", "B", "C", "ballistic", "Halo: ODST", "AP2 · 806 DPS · Halo crossover"],
      ["SG-8S Slugger", "D", "B", "D", "ballistic", "Mobilize (free)", "AP3 · 440 DPS · shotgun"],
      ["SMG-72 Pummeler", "D", "C", "C", "ballistic", "Polar Patriots", "AP2 · 672 DPS · SMG", "stale"],
      ["AR-23C Liberator Concussive", "D", "D", "D", "ballistic", "Steeled Veterans", "AP2 · 500 DPS · bottom of the list", "stale"],
      ["R-2124 Constitution", "D", "D", "D", "ballistic", "Starter", "AP3 · 180 DPS · bolt action, stripper clip reload added in 7.0.0", "stale"],
      ["R/40-K Hot-Shot Marksman Rifle", null, null, null, "heat", "Castellan's Creed", "AP3 · Hot-Shot Lasgun, energy semi-auto, 35 medals", "new"],
    ],
  },
  {
    id: "secondary", label: "Secondaries",
    rows: [
      ["GP-20 Ultimatum", "S+", "S+", "A", "explosive", "Servants of Freedom", "AP6 AT · anti-tank in a sidearm slot"],
      ["GP-31 Grenade Pistol", "S", "S+", "S+", "explosive", "Democratic Detonation", "AP3 · pocket objective clear"],
      ["P-4 Senator", "S+", "S", "A", "ballistic", "Steeled Veterans", "AP4 Heavy · revolver"],
      ["LAS-58 Talon", "S", "S", "S+", "heat", "Borderline Justice", "AP3 · laser"],
      ["PLAS-15 Loyalist", "A", "S", "S+", "heat", "Truth Enforcers", "AP3 · plasma"],
      ["P-35 Re-Educator", "A", "S", "S", "ballistic", "Redacted Regiment", "AP4 Heavy"],
      ["P-72 Crisper", "B", "A", "S+", "fire", "Freedom's Flame", "AP4 Heavy · flame pistol"],
      ["P-92 Warrant", "B", "A", "S", "ballistic", "Superstore", "AP3"],
      ["P-113 Verdict", "A", "A", "A", "ballistic", "Polar Patriots", "AP3", "stale"],
      ["P-69 Veto", "A", "A", "A", "ballistic", "Entrenched Division", "AP3", "stale"],
      ["P-11 Stim Pistol", "A", "A", "A", "utility", "Chemical Agents", "zero damage, heals teammates"],
      ["P-33 Missile Pistol", "A", "A", "B", "explosive", "Exo Experts", "AP5 AT"],
      ["P-19 Redeemer", "B", "A", "A", "ballistic", "Mobilize (free)", "AP2 · machine pistol", "stale"],
      ["M6C-SOCOM", "B", "B", "B", "ballistic", "Halo: ODST", "AP2 · Halo crossover", "stale"],
      ["CQC-42 Machete", "B", "B", "B", "melee", "Superstore", "AP3"],
      ["CQC-2 Saber", "C", "B", "B", "melee", "Masters of Ceremony", "AP3"],
      ["CQC-5 Combat Hatchet", "C", "B", "B", "melee", "Superstore", "AP3"],
      ["SG-22 Bushwhacker", "C", "B", "C", "ballistic", "Viper Commandos", "AP2"],
      ["LAS-7 Dagger", "C", "C", "B", "heat", "Cutting Edge", "AP2"],
      ["P-2 Peacemaker", "D", "C", "C", "ballistic", "Starter", "AP2 · starter sidearm"],
      ["CQC-19 Stun Lance", "D", "C", "C", "melee", "Urban Legends", "AP3"],
      ["CQC-30 Stun Baton", "D", "C", "C", "melee", "Superstore", "AP3"],
      ["CQC-73 Entrenchment Tool", "D", "C", "C", "melee", "Entrenched Division", "AP3"],
      ["P/40-K Bolt Pistol", null, null, null, "ballistic", "Castellan's Creed", "versatile sidearm, high stopping power, 50 medals", "new"],
    ],
  },
  {
    id: "support", label: "Support weapons",
    rows: [
      ["AC-8 Autocannon", "S+", "S+", "S+", "ballistic", "Requisition", "AP4 Heavy · takes backpack · the answer when you do not know what you are facing"],
      ["GR-8 Recoilless Rifle", "S+", "S+", "C", "explosive", "Requisition", "AP6 AT · takes backpack · craters against squids"],
      ["B/FLAM-80 Cremator", "A", "S+", "S+", "fire", "Entrenched Division", "AP4 Heavy · takes backpack"],
      ["B/MD C4 Pack", "S+", "S", "A", "explosive", "Redacted Regiment", "AP7 AT · takes backpack"],
      ["EAT-411 Leveller", "S+", "B", "A", "explosive", "Siege Breakers", "AP6 AT · no backpack"],
      ["S-11 Speargun", "S", "S", "S", "ballistic", "Dust Devils", "AP5 AT · no backpack"],
      ["GL-21 Grenade Launcher", "S", "S", "S", "explosive", "Requisition", "AP3 · no backpack"],
      ["MS-11 Solo Silo", "S", "S", "A", "explosive", "Dust Devils", "AP9 AT · no backpack"],
      ["CQC-20 Breaching Hammer", "S", "S", "A", "melee", "Siege Breakers", "AP5 AT · no backpack"],
      ["EAT-17 Expendable Anti-Tank", "S", "S+", "C", "explosive", "Requisition", "AP6 AT · no backpack · free of the backpack slot"],
      ["LAS-99 Quasar Cannon", "S", "S", "C", "heat", "Requisition", "AP6 AT · no backpack · cycle multiple copies"],
      ["FLAM-40 Flamethrower", "B", "S", "S+", "fire", "Requisition", "AP4 Heavy · no backpack"],
      ["M-105 Stalwart", "B", "A", "S+", "ballistic", "Requisition", "AP2 · no backpack · never stops firing"],
      ["RL-77 Airburst Rocket Launcher", "A", "B", "S+", "explosive", "Requisition", "AP3 · takes backpack"],
      ["StA-X3 W.A.S.P. Launcher", "B", "B", "S+", "explosive", "Requisition", "AP3 · takes backpack · dedicated squid tool"],
      ["MGX-42 Bullet Storm", "B", "A", "S+", "ballistic", "Exo Experts", "AP2 · no backpack"],
      ["EAT-700 Expendable Napalm", "B", "S", "S", "fire", "Dust Devils", "AP6 AT · no backpack"],
      ["MLS-4X Commando", "S", "B", "B", "explosive", "Requisition", "AP6 AT · no backpack"],
      ["PLAS-45 Epoch", "S", "A", "B", "heat", "Control Group", "AP5 AT · no backpack"],
      ["RS-422 Railgun", "S", "B", "C", "ballistic", "Requisition", "AP5 AT · no backpack · charge up, unsafe mode"],
      ["FAF-14 Spear", "S", "A", "C", "explosive", "Requisition", "AP7 AT · takes backpack"],
      ["APW-1 Anti-Materiel Rifle", "A", "B", "C", "ballistic", "Requisition", "AP4 Heavy · no backpack"],
      ["GL-28 Belt-Fed Grenade Launcher", "A", "A", "A", "explosive", "Siege Breakers", "AP4 Heavy · takes backpack"],
      ["ARC-3 Arc Thrower", "C", "A", "A", "arc", "Requisition", "AP7 AT · no backpack · chains, infinite ammo"],
      ["GL-52 De-Escalator", "B", "A", "A", "utility", "Force of Law", "AP4 Heavy · no backpack · non-lethal"],
      ["M-1000 Maxigun", "B", "B", "A", "ballistic", "Python Commandos", "AP3 · takes backpack"],
      ["MG-43 Machine Gun", "B", "B", "S", "ballistic", "Requisition", "AP3 · no backpack"],
      ["MG-206 Heavy Machine Gun", "B", "B", "B", "ballistic", "Requisition", "AP4 Heavy · no backpack"],
      ["LAS-98 Laser Cannon", "B", "B", "B", "heat", "Requisition", "AP4 Heavy · no backpack · infinite ammo"],
      ["TX-41 Sterilizer", "D", "D", "C", "gas", "Chemical Agents", "AP5 AT · no backpack · only handheld gas gun"],
      ["CQC-9 Defoliation Tool", "D", "C", "C", "fire", "Python Commandos", "AP5 AT · no backpack"],
      ["CQC-1 One True Flag", "D", "D", "D", "melee", "Masters of Ceremony", "AP3 · no backpack · it is a flag"],
      ["40-K Meltagun", null, null, null, "fire", "Castellan's Creed", "anti-armor focus", "new"],
    ],
  },
  {
    id: "throwable", label: "Throwables",
    rows: [
      ["G-123 Thermite", "S+", "S+", "S+", "fire", "Democratic Detonation", "AP7 AT · 3 carried · demo 30"],
      ["G-13 Incendiary Impact", "B", "S+", "S+", "fire", "Polar Patriots", "AP4 Heavy · 5 carried · demo 30 · AP3 blast, AP4 fire effect"],
      ["G-10 Incendiary", "B", "S+", "S+", "fire", "Steeled Veterans", "AP4 Heavy · 5 carried · demo 30 · AP3 blast, AP4 fire effect"],
      ["G-4 Gas", "A", "S", "S+", "gas", "Chemical Agents", "AP6 AT · 4 carried · demo 30 · panics enemies"],
      ["G-23 Stun", "S", "S", "C", "utility", "Cutting Edge", "AP6 AT · 5 carried · demo 0 · sets up every anti-tank shot"],
      ["G/SH-39 Shield", "S", "S", "A", "utility", "Siege Breakers", "4 carried · demo 20"],
      ["TED-63 Dynamite", "S", "S", "A", "explosive", "Borderline Justice", "AP4 Heavy · 4 carried · demo 40 · closes holes from outside"],
      ["G-142 Pyrotech", "S", "A", "A", "fire", "Masters of Ceremony", "AP7 AT · 6 carried · demo 30"],
      ["TM-1 Lure Mine", "A", "S", "A", "explosive", "Redacted Regiment", "AP5 AT · 4 carried · demo 30"],
      ["G-16 Impact", "A", "S", "S", "explosive", "Mobilize (free)", "AP4 Heavy · 5 carried · demo 30"],
      ["G-12 High Explosive", "A", "A", "A", "explosive", "Starter", "AP4 Heavy · 5 carried · demo 30"],
      ["G-7 Pineapple", "A", "A", "A", "explosive", "Dust Devils", "AP3 · 5 carried · demo 30"],
      ["G-48 Giga Grenade", "A", "A", "A", "explosive", "Entrenched Division", "AP5 AT · 2 carried · demo 40"],
      ["G-50 Seeker", "A", "B", "A", "explosive", "Servants of Freedom", "AP4 Heavy · 5 carried · demo 30"],
      ["G-6 Frag", "B", "A", "A", "explosive", "Mobilize (free)", "AP3 · 6 carried · demo 20"],
      ["G-89 Smokescreen", "B", "D", "D", "utility", "Superstore", "5 carried · demo 0 · superstore smoke"],
      ["G-3 Smoke", "B", "D", "D", "utility", "Mobilize (free)", "5 carried · demo 0 · key for hostage rescue"],
      ["G-31 Arc", "C", "C", "C", "arc", "Control Group", "AP4 Heavy · 5 carried · demo 0"],
      ["G-109 Urchin", "D", "D", "C", "explosive", "Force of Law", "AP6 AT · 5 carried · demo 0"],
      ["K-2 Throwing Knife", "D", "D", "D", "melee", "Viper Commandos", "AP3 · 20 carried · demo 10"],
      ["G/40-K Meltamine", null, null, null, "fire", "Castellan's Creed", "anti-armor focus", "new"],
    ],
  },
  {
    id: "eagle", label: "Eagles",
    rows: [
      ["Eagle Strafing Run", "S+", "S", "S+", "explosive", "Requisition", "4 uses, 5 upgraded"],
      ["Eagle Airstrike", "S+", "S+", "A", "explosive", "Requisition", "2 uses, 3 upgraded"],
      ["Eagle 500kg Bomb", "S+", "S+", "B", "explosive", "Requisition", "1 uses, 2 upgraded"],
      ["Eagle Cluster Bomb", "A", "S", "A", "explosive", "Requisition", "4 uses, 5 upgraded"],
      ["Eagle Napalm Airstrike", "B", "A", "S", "fire", "Requisition", "2 uses, 3 upgraded", "stale"],
      ["Eagle 110mm Rocket Pods", "A", "A", "D", "explosive", "Requisition", "3 uses, 4 upgraded"],
      ["Eagle Smoke Strike", "B", "D", "D", "utility", "Requisition", "2 uses, 3 upgraded"],
    ],
  },
  {
    id: "orbital", label: "Orbitals",
    rows: [
      ["Orbital Laser", "S+", "S+", "S+", "heat", "Requisition", "300s cooldown"],
      ["Orbital Gas Strike", "S+", "S+", "S", "gas", "Requisition", "75s cooldown · sleeper pick"],
      ["Orbital Gatling Barrage", "S+", "S+", "A", "ballistic", "Requisition", "70s cooldown · sleeper pick"],
      ["Orbital Precision Strike", "S", "S", "S", "explosive", "Requisition", "90s cooldown"],
      ["Orbital Airburst Strike", "A", "S+", "A", "explosive", "Requisition", "100s cooldown"],
      ["Orbital Napalm Barrage", "A", "S", "S", "fire", "Requisition", "240s cooldown"],
      ["Orbital 120mm HE Barrage", "S", "B", "A", "explosive", "Requisition", "180s cooldown"],
      ["Orbital Walking Barrage", "S", "B", "A", "explosive", "Requisition", "240s cooldown"],
      ["Orbital Railcannon Strike", "A", "A", "D", "ballistic", "Requisition", "180s cooldown"],
      ["Orbital EMS Strike", "D", "B", "B", "utility", "Requisition", "75s cooldown"],
      ["Orbital 380mm HE Barrage", "B", "B", "C", "explosive", "Requisition", "240s cooldown · trap pick"],
      ["Orbital Smoke Strike", "B", "D", "D", "utility", "Requisition", "75s cooldown"],
    ],
  },
  {
    id: "backpack", label: "Backpacks",
    rows: [
      ["AX/FLAM-75 Hot Dog", "S+", "S+", "S+", "fire", "Python Commandos", ""],
      ["LIFT-182 Warp Pack", "S+", "S+", "S+", "utility", "Control Group", "purple orb safe, orange hurts, red kills"],
      ["B-1 Supply Pack", "S+", "S+", "S+", "utility", "Requisition", "feeds both of you"],
      ["B-100 Portable Hellbomb", "S+", "S", "S", "explosive", "Servants of Freedom", "shoot it from range"],
      ["LIFT-850 Jump Pack", "S", "S", "S", "utility", "Requisition", "15s recharge, sprint first"],
      ["SH-32 Shield Generator Pack", "S", "S", "S", "utility", "Requisition", ""],
      ["AX/AR-23 Guard Dog", "A", "A", "S", "ballistic", "Requisition", "recall to force reload"],
      ["LIFT-860 Hover Pack", "A", "S", "A", "utility", "Borderline Justice", "6s hover, cannot cancel early"],
      ["AX/LAS-5 Rover", "B", "S", "A", "heat", "Requisition", "laser drone"],
      ["AX/TX-13 Dog Breath", "B", "A", "B", "gas", "Chemical Agents", ""],
      ["AX/ARC-3 K-9", "C", "B", "B", "arc", "Force of Law", ""],
      ["SH-20 Ballistic Shield", "B", "C", "C", "utility", "Requisition", "weakest of the shields", "stale"],
      ["SH-51 Directional Shield", "D", "D", "D", "utility", "Urban Legends", "bottom of every front"],
    ],
  },
  {
    id: "sentry", label: "Sentries and mines",
    rows: [
      ["A/AC-8 Autocannon Sentry", "S+", "S+", "S+", "ballistic", "Requisition", "AP5 AT"],
      ["E/MG-101 HMG Emplacement", "S+", "S+", "S+", "ballistic", "Requisition", "AP4 Heavy · you man it"],
      ["E/AT-12 Anti-Tank Emplacement", "S+", "S", "S+", "explosive", "Requisition", "AP6 AT"],
      ["A/MLS-4X Rocket Sentry", "S+", "S", "S", "explosive", "Requisition", "AP5 AT"],
      ["A/MG-43 Machine Gun Sentry", "S", "S+", "S+", "ballistic", "Requisition", "AP3"],
      ["MD-8 Gas Mines", "S", "S", "S", "gas", "Chemical Agents", "AP6 AT"],
      ["A/ARC-3 Tesla Tower", "B", "S+", "S+", "arc", "Requisition", "AP4 Heavy · notorious teamkiller"],
      ["A/G-16 Gatling Sentry", "A", "S", "S+", "ballistic", "Requisition", "AP3 · teamkiller"],
      ["A/FLAM-40 Flame Sentry", "B", "S", "S", "fire", "Requisition", "AP4 Heavy"],
      ["MD-I4 Incendiary Mines", "B", "S", "S", "fire", "Requisition", "AP3 · teamkiller"],
      ["A/M-12 Mortar Sentry", "S", "D", "D", "explosive", "Requisition", "AP3 · notorious teamkiller"],
      ["MD-17 Anti-Tank Mines", "S", "A", "D", "explosive", "Requisition", "AP5 AT · demo 40 as of 7.0.0, closes holes from outside", "stale"],
      ["A/M-23 EMS Mortar Sentry", "A", "A", "A", "utility", "Requisition", "AP6 AT · non-lethal"],
      ["E/GL-21 Grenadier Battlement", "A", "A", "A", "explosive", "Requisition", "AP3"],
      ["MD-6 Anti-Personnel Minefield", "B", "A", "A", "explosive", "Requisition", "AP3"],
      ["A/GM-17 Gas Mortar Sentry", "A", "B", "B", "gas", "Chemical Agents", "AP6 AT"],
      ["A/LAS-98 Laser Sentry", "C", "B", "A", "heat", "Requisition", "AP4 Heavy"],
      ["FX-12 Shield Generator Relay", "B", "D", "B", "utility", "Requisition", ""],
    ],
  },
  {
    id: "armor", label: "Armor passives",
    rows: [
      ["Med-Kit", "S+", "S+", "S+", "utility", "Armor sets", "+2 stim capacity, +2.0s stim duration"],
      ["True Grit", "S+", "S+", "S+", "utility", "Armor sets", "+20 weapon handling, +30% support weapon reload speed"],
      ["Reduced Signature", "S+", "B", "S", "utility", "Armor sets", "-50% movement noise, -40% enemy detection range"],
      ["Concussive Padding, Reinforced", "S+", "B", "A", "utility", "Armor sets", "+50% explosive resist, +30 armor rating"],
      ["Concussive Padding, Hazmat", "S+", "B", "B", "utility", "Armor sets", "+50% explosive resist, +25% gas resist, -30% sidearm recoil"],
      ["Concussive Padding, Grenadier", "S+", "B", "B", "utility", "Armor sets", "+50% explosive resist, +2 throwables capacity"],
      ["Fortified", "S+", "C", "B", "utility", "Armor sets", "+50% explosive resist, -30% recoil crouched or prone"],
      ["Siege-Ready", "S", "S", "S", "utility", "Armor sets", "+30% primary reload, +20% ammo capacity (excludes backpacks)"],
      ["Engineering Kit", "S", "S", "S", "utility", "Armor sets", "-30% recoil crouched or prone, +2 throwables capacity"],
      ["Oxygenator", "S", "S", "S", "utility", "Armor sets", "+10% walk and run speed, +160ms slide duration"],
      ["Ballistic Padding", "S", "A", "A", "utility", "Armor sets", "+25% chest resist, +25% explosive resist, no bleed damage"],
      ["Desert Stormer", "A", "S+", "A", "fire", "Armor sets", "+40% fire, gas, acid and electrical resist, +20% throw range"],
      ["Acclimated", "A", "S+", "A", "fire", "Armor sets", "+50% fire, gas, acid and electrical resist"],
      ["Democracy Protects", "A", "A", "A", "utility", "Armor sets", "50% chance to survive lethal damage, no bleed damage"],
      ["Unflinching", "A", "A", "A", "utility", "Armor sets", "Reduced flinch, +25 armor rating, map marker radar"],
      ["Peak Physique", "A", "A", "A", "melee", "Armor sets", "+40% melee damage, +30 ergonomics"],
      ["Kinetic Displacement Mitigation", "A", "A", "B", "fire", "Armor sets", "+50% fire resist, 50% limb injury avoidance, -30% impact and collision damage"],
      ["Scout", "A", "C", "B", "utility", "Armor sets", "Map marker radar, -40% enemy detection range"],
      ["Inflammable", "B", "S+", "C", "fire", "Armor sets", "+75% fire resist"],
      ["Adreno-Defibrillator", "B", "B", "A", "utility", "Armor sets", "Revive on death if body intact then timed death, +2.0s stim duration, +50% electrical resist"],
      ["Rock Solid", "B", "B", "B", "utility", "Armor sets", "Reduced ragdolling, +40% melee damage"],
      ["Reinforced Epaulettes", "B", "B", "B", "utility", "Armor sets", "+30% primary reload, 50% limb injury avoidance, +20% melee damage"],
      ["Gunslinger", "B", "B", "B", "utility", "Armor sets", "+40% sidearm reload, +50% draw and holster speed, -70% sidearm recoil"],
      ["Extra Padding", "B", "B", "B", "utility", "Armor sets", "+50 armor rating"],
      ["Supplementary Adrenaline", "B", "B", "B", "utility", "Armor sets", "Gain stamina when taking damage, +25 armor rating"],
      ["Feet First", "B", "D", "C", "utility", "Armor sets", "-50% movement noise, +30% POI detection range, leg injury immunity"],
      ["Integrated Explosives", "C", "C", "C", "explosive", "Armor sets", "Armor explodes 1.5s after death, +2 throwables capacity"],
      ["Advanced Filtration", "C", "C", "C", "gas", "Armor sets", "+80% gas resist"],
      ["Servo-Assisted", "C", "B", "C", "ballistic", "Armor sets", "+30% throw range, +50% limb health"],
      ["Electrical Conduit", "D", "D", "A", "arc", "Armor sets", "+95% electrical damage resist"],
    ],
  },
  {
    id: "booster", label: "Boosters",
    rows: [
      ["Hellpod Space Optimization", "S+", "S+", "S+", "utility", "Mobilize (free)", "20 medals · Drop with full ammo, grenades and stims"],
      ["Experimental Infusion", "S+", "S+", "S+", "utility", "Viper Commandos", "80 medals · +10% move speed and +10% damage resist while stimmed"],
      ["Stamina Enhancement", "S+", "S+", "S+", "utility", "Mobilize (free)", "75 medals · Stamina buff, critical with Heavy armor"],
      ["Vitality Enhancement", "S", "S", "S", "utility", "Mobilize (free)", "20 medals · -10% damage taken, not extra health"],
      ["Increased Reinforcement Budget", "S", "S", "S", "utility", "Mobilize (free)", "150 medals · +1 reinforcement per player (5 to 6 solo, 20 to 24 in a full squad)"],
      ["Sample Extricator", "A", "A", "A", "utility", "Borderline Justice", "65 medals · Heavies can drop samples, capped at 10 per mission"],
      ["Sample Scanner", "A", "A", "A", "utility", "Masters of Ceremony", "65 medals · 15% chance to pick up double samples"],
      ["Armed Resupply Pods", "C", "A", "A", "ballistic", "Urban Legends", "55 medals · Resupply pods mount a med-pen Liberator that acts as a sentry"],
      ["Muscle Enhancement", "B", "S", "B", "utility", "Mobilize (free)", "75 medals · Reduces terrain movement debuffs (foliage, water, mud, snow, wire)"],
      ["Flexible Reinforcement Budget", "B", "B", "B", "utility", "Steeled Veterans", "75 medals · Reinforcement cooldown reduced 25%, 2:00 down to 1:30"],
      ["Localization Confusion", "B", "B", "B", "utility", "Cutting Edge", "18 medals · +15% time between reinforcement calls only, not patrols or objectives"],
      ["Concealed Insertion", "A", "D", "D", "utility", "Redacted Regiment", "40 medals · Smoke screen where hellpods land"],
      ["Dead Sprint", "C", "B", "B", "utility", "Truth Enforcers", "35 medals · Sprint past zero stamina at the cost of health"],
      ["Expert Extraction Pilot", "C", "C", "C", "utility", "Democratic Detonation", "55 medals · Extraction timer reduced 30%"],
      ["Firebomb Hellpods", "D", "C", "C", "fire", "Freedom's Flame", "60 medals · Every hellpod explodes on landing with a 4m radius, including reinforcements"],
      ["Motivational Shocks", "D", "C", "D", "arc", "Polar Patriots", "15 medals · Slow-effect recovery time reduced 25%"],
      ["UAV Recon Booster", "D", "D", "D", "utility", "Mobilize (free)", "40 medals · Increased radar distance with the map open"],
      ["Stun Pods", "D", "D", "D", "arc", "Force of Law", "55 medals · Hellpods stun nearby enemies on landing, can kill low-health teammates"],
    ],
  },
];

/* ================================================================== */
/* CATEGORY VIEW                                                      */
/* Support, backpack, eagle, orbital and sentry rows are one browsable */
/* list. You pick a stratagem by faction and tier, not by which call-in */
/* menu it sits under, so the split into five tabs was doing no work.  */
/* The five source arrays above are untouched; the merge is derived,   */
/* which keeps row data in one place.                                  */
/* ================================================================== */

const STRAT_SOURCE_IDS = ["support", "backpack", "eagle", "orbital", "sentry"];

const CATEGORIES = (() => {
  const byId = {};
  for (const c of RAW_CATEGORIES) byId[c.id] = c;
  const stratRows = STRAT_SOURCE_IDS.flatMap((id) => byId[id].rows);
  return [
    byId.primary,
    byId.secondary,
    byId.throwable,
    { id: "strat", label: "Stratagems", rows: stratRows },
    byId.armor,
    byId.booster,
  ];
})();

/* ================================================================== */
/* WEAPON CATEGORY                                                    */
/* Kept as a lookup rather than a ninth field on the row so the 76    */
/* row arrays stay untouched. Same pattern as STRAT_CATEGORY. The     */
/* self check below fails loudly if a name here stops matching a row. */
/*                                                                    */
/* Primaries follow the Type column in helldivers-2_tables.md, which  */
/* matches the seven in-game subcategories. It does not follow the    */
/* designation prefix: AR-32 Pacifier is an SMG, SMG/FLAM-34 Stoker   */
/* is an SMG, BR-14 Adjudicator is an assault rifle.                  */
/*                                                                    */
/* Secondaries have no Type column in the tables. These are the       */
/* game's own three buckets: Pistols, Melee, Special Secondaries.     */
/* Coarse on purpose. The damage type chips do the finer work there.  */
/* ================================================================== */

const WEAPON_CATEGORY = {
  /* primaries */
  "PLAS-101 Purifier": "Energy", "SG-8 Punisher Plasma": "Energy", "PLAS-1 Scorcher": "Energy",
  "LAS-13 Trident": "Energy", "LAS-17 Double-Edge Sickle": "Energy", "LAS-5 Scythe": "Energy",
  "PLAS-39 Accelerator Rifle": "Energy", "LAS-16 Sickle": "Energy", "ARC-12 Blitzer": "Energy",
  "R-36 Eruptor": "Explosive", "CB-9 Explosive Crossbow": "Explosive",
  "AR-2 Coyote": "Assault Rifle", "AR-61 Tenderizer": "Assault Rifle", "AR-23 Liberator": "Assault Rifle",
  "AR-23A Liberator Carbine": "Assault Rifle", "BR-14 Adjudicator": "Assault Rifle",
  "AR-23P Liberator Penetrator": "Assault Rifle", "AR/GL-21 One-Two": "Assault Rifle",
  "AR-59 Suppressor": "Assault Rifle", "MA5C Assault Rifle": "Assault Rifle",
  "StA-52 Assault Rifle": "Assault Rifle", "AR-23C Liberator Concussive": "Assault Rifle",
  "R-72 Censor": "Marksman", "R-63 Diligence": "Marksman", "R-2 Amendment": "Marksman",
  "R-63CS Diligence Counter Sniper": "Marksman", "R-4 Hyena": "Marksman", "R-6 Deadeye": "Marksman",
  "R-2124 Constitution": "Marksman", "R/40-K Hot-Shot Marksman Rifle": "Marksman",
  "SMG-203 Gallant": "SMG", "SMG/FLAM-34 Stoker": "SMG", "SMG-32 Reprimand": "SMG",
  "MP-98 Knight": "SMG", "AR-32 Pacifier": "SMG", "StA-11 SMG": "SMG", "M7S SMG": "SMG",
  "SMG-37 Defender": "SMG", "SMG-72 Pummeler": "SMG",
  "SG-97 Sweeper": "Shotgun", "DBS-2 Double Freedom": "Shotgun", "SG-20 Halt": "Shotgun",
  "SG-225IE Breaker Incendiary": "Shotgun", "SG-225 Breaker": "Shotgun", "SG-451 Cookout": "Shotgun",
  "SG-8 Punisher": "Shotgun", "SG-225SP Breaker Spray & Pray": "Shotgun", "M90A Shotgun": "Shotgun",
  "SG-8S Slugger": "Shotgun",
  "VG-70 Variable": "Special", "JAR-5 Dominator": "Special", "FLAM-66 Torcher": "Special",

  /* secondaries */
  "M6C-SOCOM": "Pistol", "P-2 Peacemaker": "Pistol", "P-4 Senator": "Pistol",
  "P-19 Redeemer": "Pistol", "P-69 Veto": "Pistol", "P-92 Warrant": "Pistol",
  "P-113 Verdict": "Pistol", "P/40-K Bolt Pistol": "Pistol",
  "CQC-2 Saber": "Melee", "CQC-5 Combat Hatchet": "Melee", "CQC-19 Stun Lance": "Melee",
  "CQC-30 Stun Baton": "Melee", "CQC-42 Machete": "Melee", "CQC-73 Entrenchment Tool": "Melee",
  "GP-20 Ultimatum": "Special", "GP-31 Grenade Pistol": "Special", "LAS-7 Dagger": "Special",
  "LAS-58 Talon": "Special", "P-11 Stim Pistol": "Special", "P-33 Missile Pistol": "Special",
  "P-35 Re-Educator": "Special", "P-72 Crisper": "Special", "PLAS-15 Loyalist": "Special",
  "SG-22 Bushwhacker": "Special",
};

/* ================================================================== */
/* ARMOR PASSIVE TRAITS                                               */
/* Damage type is meaningless on armor, so the kind chips are replaced */
/* by what the passive actually does for you. A passive can sit in     */
/* several buckets. Selecting more than one is an OR.                  */
/* ================================================================== */

const ARMOR_TRAIT_FILTERS = [
  { id: "survive", label: "Survivability" },
  { id: "elem", label: "Elemental resist" },
  { id: "blast", label: "Explosive resist" },
  { id: "handling", label: "Weapon handling" },
  { id: "throwing", label: "Throwables" },
  { id: "stealth", label: "Stealth and recon" },
  { id: "melee", label: "Melee" },
  { id: "mobility", label: "Mobility" },
];

const ARMOR_TRAITS = {
  "Med-Kit": ["survive"],
  "True Grit": ["handling"],
  "Reduced Signature": ["stealth"],
  "Concussive Padding, Reinforced": ["blast", "survive"],
  "Concussive Padding, Hazmat": ["blast", "elem", "handling"],
  "Concussive Padding, Grenadier": ["blast", "throwing"],
  "Fortified": ["blast", "handling"],
  "Siege-Ready": ["handling"],
  "Engineering Kit": ["handling", "throwing"],
  "Oxygenator": ["mobility"],
  "Ballistic Padding": ["survive", "blast"],
  "Desert Stormer": ["elem", "throwing"],
  "Acclimated": ["elem"],
  "Democracy Protects": ["survive"],
  "Unflinching": ["survive", "stealth"],
  "Peak Physique": ["melee", "handling"],
  "Kinetic Displacement Mitigation": ["elem", "survive"],
  "Scout": ["stealth"],
  "Inflammable": ["elem"],
  "Adreno-Defibrillator": ["survive", "elem"],
  "Rock Solid": ["survive", "melee"],
  "Reinforced Epaulettes": ["handling", "melee"],
  "Gunslinger": ["handling"],
  "Extra Padding": ["survive"],
  "Supplementary Adrenaline": ["survive", "mobility"],
  "Feet First": ["stealth"],
  "Integrated Explosives": ["throwing"],
  "Advanced Filtration": ["elem"],
  "Servo-Assisted": ["throwing", "survive"],
  "Electrical Conduit": ["elem"],
};

/* ================================================================== */
/* ARMOR SET LOOKUP                                                   */
/* All 107 sets, keyed by passive, grouped by weight class.           */
/* Bracketed numbers are armor/speed/stamina where the set differs    */
/* from the standard for its class (light 50/550/125, medium          */
/* 100/500/100, heavy 150/450/50).                                    */
/* ================================================================== */

const ARMOR_SETS = {
  "Med-Kit": { light: ["CM-21 Trench Paramedic · 64/536/118"], medium: ["TR-117 Alpha Commander", "CM-09 Bonesnapper", "CM-14 Physician", "CM-10 Clinician"], heavy: ["CM-17 Butcher"] },
  "True Grit": { light: [], medium: ["TG-8 Sharpshooter"], heavy: ["TG-122 Demo-Trooper"] },
  "Reduced Signature": { light: ["RS-100 Sanctioner", "RS-89 Shadow Paragon"], medium: ["RS-67 Null Cipher"], heavy: [] },
  "Concussive Padding, Reinforced": { light: [], medium: [], heavy: ["CPR-80 Bulwark · 180/450/50"] },
  "Concussive Padding, Hazmat": { light: ["CPH-26 Commandant"], medium: [], heavy: [] },
  "Concussive Padding, Grenadier": { light: [], medium: ["CPG-48 Sapper"], heavy: [] },
  "Fortified": { light: ["FS-38 Eradicator"], medium: ["B-24 Enforcer · 129/471/71", "FS-34 Exterminator"], heavy: ["FS-05 Marksman", "FS-23 Battle Master", "FS-11 Executioner", "FS-55 Devastator", "CW-22 Kodiak"] },
  "Siege-Ready": { light: ["SR-24 Street Scout"], medium: ["DP-8 Mountain-Scaled"], heavy: ["SR-64 Cinderblock", "SR-18 Roadblock"] },
  "Engineering Kit": { light: ["CE-74 Breaker", "CE-67 Titan · 79/521/111", "CE-07 Demolition Specialist · 64/536/118", "FS-37 Ravager"], medium: ["SC-15 Drone Master", "CE-35 Trench Engineer", "CE-81 Juggernaut", "CE-27 Ground Breaker"], heavy: ["CE-64 Grenadier", "CE-101 Guerilla Gorilla"] },
  "Oxygenator": { light: ["O-3 Free Spirit"], medium: ["O-44 Bonded Pilot"], heavy: ["O-2 Heavy Operator"] },
  "Ballistic Padding": { light: ["BP-32 Jackboot"], medium: ["BP-20 Correct Officer"], heavy: ["BP-77 Grand Juror"] },
  "Desert Stormer": { light: ["DS-10 Big Game Hunter"], medium: ["DS-191 Scorpion"], heavy: ["DS-42 Federation's Blade"] },
  "Acclimated": { light: ["AC-2 Obedient"], medium: ["AC-1 Dutiful"], heavy: [] },
  "Democracy Protects": { light: [], medium: ["TR-9 Cavalier of Democracy", "DP-53 Savior of the Free", "DP-40 Hero of the Federation", "DP-11 Champion of the People", "DP-00 Tactical", "B-22 Model Citizen"], heavy: [] },
  "Unflinching": { light: ["UF-16 Inspector · 75/550/125"], medium: ["UF-84 Doubt Killer · 125/500/100", "UF-50 Bloodhound · 125/500/100"], heavy: [] },
  "Peak Physique": { light: ["PH-9 Predator"], medium: ["PH-56 Jaguar"], heavy: ["PH-202 Twigsnapper"] },
  "Kinetic Displacement Mitigation": { light: [], medium: [], heavy: ["KDM-500 Outrider"] },
  "Scout": { light: ["SC-34 Infiltrator · 70/530/115", "SC-30 Trailblazer Scout", "CW-4 Arctic Ranger"], medium: ["SA-04 Combat Technician"], heavy: [] },
  "Inflammable": { light: ["I-09 Heatseeker"], medium: ["I-92 Fire Fighter", "I-102 Draconaught"], heavy: ["I-44 Salamander"] },
  "Adreno-Defibrillator": { light: ["AD-11 Livewire"], medium: ["AD-26 Bleeding Edge"], heavy: ["AD-49 Apollonian"] },
  "Rock Solid": { light: ["RS-20 Constrictor"], medium: ["RS-6 Fiend Destroyer"], heavy: ["RS-40 Beast of Prey"] },
  "Reinforced Epaulettes": { light: ["RE-1861 Parade Commander"], medium: ["RE-2310 Honorary Guard"], heavy: ["RE-824 Bearer of the Standard"] },
  "Gunslinger": { light: ["GS-11 Democracy's Deputy"], medium: ["GS-17 Frontier Marshal"], heavy: ["GS-66 Lawmaker"] },
  "Extra Padding": { light: ["B-08 Light Gunner · 100/550/125"], medium: ["B-01 Tactical · 150/500/100", "TR-7 Ambassador of the Brand · 150/500/100", "CW-9 White Wolf · 150/500/100", "TR-40 Gold Eagle · 150/500/100"], heavy: ["B-27 Fortified Commando · 200/450/50"] },
  "Supplementary Adrenaline": { light: [], medium: ["SA-7 Headfirst · 125/500/100"], heavy: ["SA-8 Ram · 175/450/50"] },
  "Feet First": { light: [], medium: ["A-9 Helljumper", "A-35 Recon"], heavy: [] },
  "Integrated Explosives": { light: ["IE-57 Hell-Bent"], medium: ["IE-3 Martyr", "IE-12 Righteous"], heavy: [] },
  "Advanced Filtration": { light: ["AF-50 Noxious Ranger"], medium: ["AF-91 Field Chemist", "AF-02 Haz-Master"], heavy: ["AF-52 Lockdown"] },
  "Servo-Assisted": { light: ["SC-37 Legionnaire"], medium: ["SA-25 Steel Trooper", "SA-12 Servo Assisted"], heavy: ["TR-62 Knight", "SA-32 Dynamo", "FS-61 Dreadnought", "CW-36 Winter Warrior"] },
  "Electrical Conduit": { light: ["EX-00 Prototype X"], medium: ["EX-03 Prototype 3", "EX-16 Prototype 16"], heavy: [] },
};
/* ================================================================== */
/* LOADOUTS                                                           */
/* Item names match the tier list exactly so lock state carries over  */
/* ================================================================== */

const BIOMES = [
  { id: "any", label: "Temperate" }, { id: "hot", label: "Hot / Arid" },
  { id: "cold", label: "Cold / Icy" }, { id: "foggy", label: "Foggy / Wet" },
  { id: "urban", label: "Urban" }, { id: "cave", label: "Cave" },
];

const BIOME_THEME = {
  any: { panel: "bg-zinc-900/60", border: "border-zinc-700", dot: "#71717A", note: null },
  hot: { panel: "bg-amber-950/40", border: "border-amber-800/60", dot: "#F59E0B", note: "Intense heat speeds up weapon heat buildup. Heat-venting weapons are filtered out. Fire resist armor earns its slot." },
  cold: { panel: "bg-sky-950/40", border: "border-sky-800/60", dot: "#38BDF8", note: "Cold slows heat buildup, so laser and plasma fire longer before venting. Snow drains stamina." },
  foggy: { panel: "bg-teal-950/40", border: "border-teal-800/60", dot: "#2DD4BF", note: "Low visibility cuts both ways. Stealth passives and close-range tools beat marksman weapons." },
  urban: { panel: "bg-slate-800/50", border: "border-slate-600/60", dot: "#94A3B8", note: "Verticality and tight corridors. Climb for a sightline instead of fighting street level." },
  cave: { panel: "bg-purple-950/40", border: "border-purple-800/60", dot: "#C084FC", note: "Enclosed and ambush heavy. Close range and stagger beat long-range precision." },
};

const MISSION_TYPES = [
  { id: "standard", label: "Standard" }, { id: "nest", label: "Nest / Fab" },
  { id: "wave", label: "Eradicate" }, { id: "defend", label: "Defend" }, { id: "blitz", label: "Blitz" },
];

const DIFFICULTIES = [
  { id: "low", label: "1-4" }, { id: "mid", label: "5-6" },
  { id: "high", label: "7-9" }, { id: "extreme", label: "10" },
];

/* ================================================================== */
/* STRATAGEM TYPE                                                     */
/* name: [subtype, takesYourBackpackSlot]                             */
/* Covers all 83 stratagem rows, not just the ones a curated loadout  */
/* happens to name. The old partial map flagged 4 of the 9 backpack   */
/* taking support weapons, which is why the count read as low.        */
/* backpack is null where the source data does not say yet.           */
/* ================================================================== */

const STRAT_CATEGORY = {
  /* support weapons, 33. Nine of these eat your backpack slot. */
  "AC-8 Autocannon": ["support", true], "GR-8 Recoilless Rifle": ["support", true],
  "B/FLAM-80 Cremator": ["support", true], "B/MD C4 Pack": ["support", true],
  "RL-77 Airburst Rocket Launcher": ["support", true], "StA-X3 W.A.S.P. Launcher": ["support", true],
  "FAF-14 Spear": ["support", true], "GL-28 Belt-Fed Grenade Launcher": ["support", true],
  "M-1000 Maxigun": ["support", true],
  "EAT-411 Leveller": ["support", false], "S-11 Speargun": ["support", false],
  "GL-21 Grenade Launcher": ["support", false], "MS-11 Solo Silo": ["support", false],
  "CQC-20 Breaching Hammer": ["support", false], "EAT-17 Expendable Anti-Tank": ["support", false],
  "LAS-99 Quasar Cannon": ["support", false], "FLAM-40 Flamethrower": ["support", false],
  "M-105 Stalwart": ["support", false], "MGX-42 Bullet Storm": ["support", false],
  "EAT-700 Expendable Napalm": ["support", false], "MLS-4X Commando": ["support", false],
  "PLAS-45 Epoch": ["support", false], "RS-422 Railgun": ["support", false],
  "APW-1 Anti-Materiel Rifle": ["support", false], "ARC-3 Arc Thrower": ["support", false],
  "GL-52 De-Escalator": ["support", false], "MG-43 Machine Gun": ["support", false],
  "MG-206 Heavy Machine Gun": ["support", false], "LAS-98 Laser Cannon": ["support", false],
  "TX-41 Sterilizer": ["support", false], "CQC-9 Defoliation Tool": ["support", false],
  "CQC-1 One True Flag": ["support", false],
  "40-K Meltagun": ["support", null],

  /* backpacks, 13. The slot is the whole point, so no amber dot here. */
  "AX/FLAM-75 Hot Dog": ["backpack", true], "LIFT-182 Warp Pack": ["backpack", true],
  "B-1 Supply Pack": ["backpack", true], "B-100 Portable Hellbomb": ["backpack", true],
  "LIFT-850 Jump Pack": ["backpack", true], "SH-32 Shield Generator Pack": ["backpack", true],
  "AX/AR-23 Guard Dog": ["backpack", true], "LIFT-860 Hover Pack": ["backpack", true],
  "AX/LAS-5 Rover": ["backpack", true], "AX/TX-13 Dog Breath": ["backpack", true],
  "AX/ARC-3 K-9": ["backpack", true], "SH-20 Ballistic Shield": ["backpack", true],
  "SH-51 Directional Shield": ["backpack", true],

  /* eagles, 7 */
  "Eagle Strafing Run": ["eagle", false], "Eagle Airstrike": ["eagle", false],
  "Eagle 500kg Bomb": ["eagle", false], "Eagle Cluster Bomb": ["eagle", false],
  "Eagle Napalm Airstrike": ["eagle", false], "Eagle 110mm Rocket Pods": ["eagle", false],
  "Eagle Smoke Strike": ["eagle", false],

  /* orbitals, 12 */
  "Orbital Laser": ["orbital", false], "Orbital Gas Strike": ["orbital", false],
  "Orbital Gatling Barrage": ["orbital", false], "Orbital Precision Strike": ["orbital", false],
  "Orbital Airburst Strike": ["orbital", false], "Orbital Napalm Barrage": ["orbital", false],
  "Orbital 120mm HE Barrage": ["orbital", false], "Orbital Walking Barrage": ["orbital", false],
  "Orbital Railcannon Strike": ["orbital", false], "Orbital EMS Strike": ["orbital", false],
  "Orbital 380mm HE Barrage": ["orbital", false], "Orbital Smoke Strike": ["orbital", false],

  /* sentries, emplacements and mines, 18. Tesla Tower is an           */
  /* emplacement, not a sentry: Arrowhead's Rapid Launch System module */
  /* note lists it with the emplacements.                              */
  "A/AC-8 Autocannon Sentry": ["sentry", false], "A/MLS-4X Rocket Sentry": ["sentry", false],
  "A/MG-43 Machine Gun Sentry": ["sentry", false], "A/G-16 Gatling Sentry": ["sentry", false],
  "A/FLAM-40 Flame Sentry": ["sentry", false], "A/M-12 Mortar Sentry": ["sentry", false],
  "A/M-23 EMS Mortar Sentry": ["sentry", false], "A/GM-17 Gas Mortar Sentry": ["sentry", false],
  "A/LAS-98 Laser Sentry": ["sentry", false],
  "E/MG-101 HMG Emplacement": ["emplacement", false], "E/AT-12 Anti-Tank Emplacement": ["emplacement", false],
  "A/ARC-3 Tesla Tower": ["emplacement", false], "E/GL-21 Grenadier Battlement": ["emplacement", false],
  "FX-12 Shield Generator Relay": ["emplacement", false],
  "MD-8 Gas Mines": ["mines", false], "MD-I4 Incendiary Mines": ["mines", false],
  "MD-17 Anti-Tank Mines": ["mines", false], "MD-6 Anti-Personnel Minefield": ["mines", false],
};

/* Three colour groups, same split the in-game stratagem menu uses:   */
/* blue for what you are handed, red for what falls from the sky,     */
/* green for what you plant and leave. Icon separates subtypes inside */
/* a colour. There are no vehicle or mech rows in the source tables,  */
/* so blue is support weapons and backpacks only.                     */
const STRAT_GROUP = {
  supply: { label: "Support and supply", hex: "#3B82F6" },
  offensive: { label: "Offensive", hex: "#EF4444" },
  defensive: { label: "Defensive", hex: "#22C55E" },
};

const CAT_META = {
  support: { Icon: Crosshair, label: "Support weapon", group: "supply" },
  backpack: { Icon: Backpack, label: "Backpack", group: "supply" },
  eagle: { Icon: Plane, label: "Eagle", group: "offensive" },
  orbital: { Icon: Satellite, label: "Orbital", group: "offensive" },
  sentry: { Icon: RadioTower, label: "Sentry", group: "defensive" },
  emplacement: { Icon: Users, label: "Emplacement", group: "defensive" },
  mines: { Icon: CircleDot, label: "Mines", group: "defensive" },
};

const STRAT_TYPE_FILTERS = ["support", "backpack", "eagle", "orbital", "sentry", "emplacement", "mines"]
  .map((id) => ({ id, label: CAT_META[id].label, Icon: CAT_META[id].Icon }));

const LOADOUTS = [
  /* TERMINIDS */
  { id: "bugs-recruit-sweep", faction: "bugs", name: "Recruit Sweep", mission: "standard", alt: ["blitz"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "AR-2 Coyote", secondary: "P-19 Redeemer", grenade: "G-16 Impact", armor: "Med-Kit", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "A/MG-43 Machine Gun Sentry", "Eagle Strafing Run", "Orbital Gatling Barrage"],
    blurb: "No anti-tank, because nothing at this tier needs it." },
  { id: "bugs-swarm-stomp", faction: "bugs", name: "Swarm and Stomp", mission: "standard", alt: ["wave"], diff: ["mid", "high"], biomes: [], heat: true,
    primary: "PLAS-101 Purifier", secondary: "GP-31 Grenade Pistol", grenade: "G-123 Thermite", armor: "Acclimated", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle 500kg Bomb", "Orbital Laser", "A/MG-43 Machine Gun Sentry"],
    blurb: "Grenade Pistol closes holes so Thermite stays reserved for heavies." },
  { id: "bugs-ballistic-sweep", faction: "bugs", name: "Ballistic Sweep", mission: "standard", alt: ["wave", "nest"], diff: ["mid", "high", "extreme"], biomes: ["hot"], heat: false,
    primary: "R-36 Eruptor", secondary: "P-4 Senator", grenade: "G-123 Thermite", armor: "Ballistic Padding", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle Airstrike", "Orbital Gas Strike", "A/MG-43 Machine Gun Sentry"],
    blurb: "Zero heat mechanics anywhere in the kit." },
  { id: "bugs-cryo-beam", faction: "bugs", name: "Cryo Beam", mission: "standard", alt: ["wave", "blitz"], diff: ["mid", "high"], biomes: ["cold"], heat: true,
    primary: "LAS-5 Scythe", secondary: "LAS-58 Talon", grenade: "G-16 Impact", armor: "Oxygenator", booster: "Stamina Enhancement",
    strats: ["LAS-99 Quasar Cannon", "AX/LAS-5 Rover", "Eagle Strafing Run", "Orbital Laser"],
    blurb: "Cold slows heat buildup, so the whole laser kit fires far longer than usual." },
  { id: "bugs-hole-puncher", faction: "bugs", name: "Hole Puncher", mission: "nest", alt: ["standard"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "CB-9 Explosive Crossbow", secondary: "GP-31 Grenade Pistol", grenade: "G-16 Impact", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Cluster Bomb", "Orbital Gatling Barrage"],
    blurb: "Crossbow closes holes on its own. Engineering Kit adds two grenades." },
  { id: "bugs-deep-nest", faction: "bugs", name: "Deep Nest Demolition", mission: "nest", alt: ["standard"], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-31 Grenade Pistol", grenade: "TED-63 Dynamite", armor: "Concussive Padding, Grenadier", booster: "Stamina Enhancement",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Airstrike", "Orbital Napalm Barrage"],
    blurb: "Dynamite carries 40 demo force, closes holes from outside." },
  { id: "bugs-titan-removal", faction: "bugs", name: "Titan Removal", mission: "wave", alt: ["defend"], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-20 Ultimatum", grenade: "G-123 Thermite", armor: "Ballistic Padding", booster: "Stamina Enhancement",
    strats: ["EAT-17 Expendable Anti-Tank", "B-1 Supply Pack", "Orbital Airburst Strike", "Orbital Gas Strike"],
    blurb: "EAT-17 is free of the backpack slot, so Supply Pack rides along." },
  { id: "bugs-meat-grinder", faction: "bugs", name: "Meat Grinder", mission: "wave", alt: ["defend"], diff: ["low", "mid"], biomes: ["hot"], heat: false, fire: true,
    primary: "SG-97 Sweeper", secondary: "P-19 Redeemer", grenade: "G-10 Incendiary", armor: "Inflammable", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "B-1 Supply Pack", "A/G-16 Gatling Sentry", "Orbital Gatling Barrage"],
    blurb: "Pure chaff volume. Stalwart never stops while your primary reloads." },
  { id: "bugs-blender", faction: "bugs", name: "Blender", mission: "blitz", alt: ["wave"], diff: ["low", "mid"], biomes: ["cave", "foggy"], heat: true,
    primary: "ARC-12 Blitzer", secondary: "GP-31 Grenade Pistol", grenade: "G-13 Incendiary Impact", armor: "Inflammable", booster: "Muscle Enhancement",
    strats: ["B/FLAM-80 Cremator", "A/ARC-3 Tesla Tower", "Orbital Gatling Barrage", "MD-I4 Incendiary Mines"],
    blurb: "Blitzer has infinite ammo and staggers everything short of a Charger." },
  { id: "bugs-smash-run", faction: "bugs", name: "Smash and Run", mission: "blitz", alt: ["standard"], diff: ["mid", "high", "extreme"], biomes: ["cold"], heat: false,
    primary: "CB-9 Explosive Crossbow", secondary: "GP-20 Ultimatum", grenade: "G-123 Thermite", armor: "Oxygenator", booster: "Stamina Enhancement",
    strats: ["EAT-17 Expendable Anti-Tank", "LIFT-850 Jump Pack", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Objectives, not kills. Beats the stamina drain on snow maps." },
  { id: "bugs-bug-wall", faction: "bugs", name: "Bug Wall", mission: "defend", alt: ["wave"], diff: ["mid", "high"], biomes: ["urban", "hot"], heat: false, fire: true,
    primary: "SG-97 Sweeper", secondary: "GP-31 Grenade Pistol", grenade: "G-13 Incendiary Impact", armor: "Desert Stormer", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "A/FLAM-40 Flame Sentry", "A/MG-43 Machine Gun Sentry", "MD-I4 Incendiary Mines"],
    blurb: "Two sentries plus mines. Needs a real chokepoint." },
  { id: "bugs-last-line", faction: "bugs", name: "Last Line", mission: "defend", alt: [], diff: ["high", "extreme"], biomes: ["urban"], heat: false,
    primary: "R-36 Eruptor", secondary: "P-4 Senator", grenade: "G/SH-39 Shield", armor: "Siege-Ready", booster: "Increased Reinforcement Budget",
    strats: ["E/MG-101 HMG Emplacement", "A/AC-8 Autocannon Sentry", "A/MLS-4X Rocket Sentry", "Orbital Laser"],
    blurb: "Extra reinforcement matters more than damage when the wave math breaks." },
  { id: "bugs-tunnel-rat", faction: "bugs", name: "Tunnel Rat", mission: "standard", alt: ["blitz", "nest"], diff: ["mid", "high"], biomes: ["cave", "urban", "foggy"], heat: false,
    primary: "SMG-203 Gallant", secondary: "GP-31 Grenade Pistol", grenade: "G-23 Stun", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["MGX-42 Bullet Storm", "SH-32 Shield Generator Pack", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Built for corridors. SMG hipfires at full sprint." },

  /* AUTOMATONS */
  { id: "bots-recruit-line", faction: "bots", name: "Recruit Line", mission: "standard", alt: ["nest"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "R-63 Diligence", secondary: "P-19 Redeemer", grenade: "G-16 Impact", armor: "Fortified", booster: "Hellpod Space Optimization",
    strats: ["MG-43 Machine Gun", "A/MG-43 Machine Gun Sentry", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Marksman rifle teaches range discipline. Fortified covers the rockets." },
  { id: "bots-line-infantry", faction: "bots", name: "Line Infantry", mission: "standard", alt: ["wave", "defend"], diff: ["mid", "high"], biomes: [], heat: true,
    primary: "PLAS-101 Purifier", secondary: "P-4 Senator", grenade: "G-123 Thermite", armor: "Concussive Padding, Reinforced", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle Airstrike", "Orbital Laser", "A/AC-8 Autocannon Sentry"],
    blurb: "The default. Autocannon handles Devastators, gunships, and fabricators." },
  { id: "bots-ballistic-line", faction: "bots", name: "Ballistic Line", mission: "standard", alt: ["wave"], diff: ["mid", "high", "extreme"], biomes: ["hot"], heat: false,
    primary: "R-36 Eruptor", secondary: "P-4 Senator", grenade: "G-123 Thermite", armor: "Concussive Padding, Reinforced", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle Airstrike", "Orbital Gatling Barrage", "A/AC-8 Autocannon Sentry"],
    blurb: "Line Infantry with the plasma swapped out. No vent management." },
  { id: "bots-frostline", faction: "bots", name: "Frostline", mission: "standard", alt: ["defend", "wave"], diff: ["mid", "high"], biomes: ["cold"], heat: true,
    primary: "LAS-17 Double-Edge Sickle", secondary: "P-4 Senator", grenade: "G-23 Stun", armor: "Concussive Padding, Reinforced", booster: "Stamina Enhancement",
    strats: ["LAS-98 Laser Cannon", "SH-32 Shield Generator Pack", "Eagle Airstrike", "Orbital Laser"],
    blurb: "Laser Cannon is unremarkable most places. On ice it holds a beam long enough to melt Hulk vents." },
  { id: "bots-fab-breaker", faction: "bots", name: "Fabricator Breaker", mission: "nest", alt: ["standard"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "CB-9 Explosive Crossbow", secondary: "GP-31 Grenade Pistol", grenade: "G-16 Impact", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Cluster Bomb", "Orbital Gatling Barrage"],
    blurb: "Fabricators have a roof vent. One grenade through it drops the structure." },
  { id: "bots-foundry", faction: "bots", name: "Foundry Demolition", mission: "nest", alt: [], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-31 Grenade Pistol", grenade: "TED-63 Dynamite", armor: "Concussive Padding, Grenadier", booster: "Stamina Enhancement",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Airstrike", "Orbital 120mm HE Barrage"],
    blurb: "Heavy outposts at range, without walking into the fire." },
  { id: "bots-heavy-breaker", faction: "bots", name: "Heavy Breaker", mission: "wave", alt: ["defend"], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-20 Ultimatum", grenade: "G-23 Stun", armor: "Fortified", booster: "Stamina Enhancement",
    strats: ["GR-8 Recoilless Rifle", "Eagle 500kg Bomb", "Orbital Precision Strike", "E/AT-12 Anti-Tank Emplacement"],
    blurb: "Stun grenade into Recoilless shot is the loop." },
  { id: "bots-suppression", faction: "bots", name: "Suppression", mission: "wave", alt: ["defend"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "R-63 Diligence", secondary: "P-4 Senator", grenade: "G-6 Frag", armor: "Ballistic Padding", booster: "Hellpod Space Optimization",
    strats: ["MG-43 Machine Gun", "B-1 Supply Pack", "A/G-16 Gatling Sentry", "Orbital Airburst Strike"],
    blurb: "Volume of fire, before Hulks make anti-tank mandatory." },
  { id: "bots-ghost", faction: "bots", name: "Ghost", mission: "blitz", alt: ["nest"], diff: ["mid", "high"], biomes: ["foggy", "cave"], heat: false,
    primary: "R-72 Censor", secondary: "P-4 Senator", grenade: "G-123 Thermite", armor: "Reduced Signature", booster: "Concealed Insertion",
    strats: ["EAT-411 Leveller", "LIFT-850 Jump Pack", "Eagle Strafing Run", "Orbital Gatling Barrage"],
    blurb: "Reduced Signature is the most underrated bot passive. Fog makes it unfair." },
  { id: "bots-fast-strike", faction: "bots", name: "Fast Strike", mission: "blitz", alt: ["standard"], diff: ["low", "mid"], biomes: ["cold"], heat: false,
    primary: "AR-2 Coyote", secondary: "GP-31 Grenade Pistol", grenade: "G-16 Impact", armor: "Oxygenator", booster: "Stamina Enhancement",
    strats: ["EAT-17 Expendable Anti-Tank", "LIFT-850 Jump Pack", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Move fast, hit objectives, leave." },
  { id: "bots-bulwark", faction: "bots", name: "Bulwark", mission: "defend", alt: ["wave"], diff: ["mid", "high"], biomes: ["urban"], heat: true,
    primary: "PLAS-101 Purifier", secondary: "GP-31 Grenade Pistol", grenade: "G/SH-39 Shield", armor: "Siege-Ready", booster: "Hellpod Space Optimization",
    strats: ["E/MG-101 HMG Emplacement", "A/MG-43 Machine Gun Sentry", "A/MLS-4X Rocket Sentry", "Orbital Gatling Barrage"],
    blurb: "Deploy and hold. Shield grenade buys placement time." },
  { id: "bots-fortress-line", faction: "bots", name: "Fortress Line", mission: "defend", alt: [], diff: ["high", "extreme"], biomes: ["urban"], heat: false,
    primary: "R-36 Eruptor", secondary: "P-4 Senator", grenade: "G-23 Stun", armor: "Siege-Ready", booster: "Increased Reinforcement Budget",
    strats: ["A/AC-8 Autocannon Sentry", "A/MLS-4X Rocket Sentry", "E/AT-12 Anti-Tank Emplacement", "Orbital Laser"],
    blurb: "Three fixed positions plus a panic button. Needs the sentry ship modules." },
  { id: "bots-street-sweeper", faction: "bots", name: "Street Sweeper", mission: "standard", alt: ["blitz", "defend"], diff: ["mid", "high"], biomes: ["urban", "cave", "foggy"], heat: false,
    primary: "SMG-203 Gallant", secondary: "GP-31 Grenade Pistol", grenade: "G-23 Stun", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["MGX-42 Bullet Storm", "SH-32 Shield Generator Pack", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Bot fire in corridors is unavoidable. Shield Pack does the real work." },

  /* ILLUMINATE */
  { id: "squids-recruit-patrol", faction: "squids", name: "Recruit Patrol", mission: "standard", alt: ["wave"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "AR-2 Coyote", secondary: "P-19 Redeemer", grenade: "G-16 Impact", armor: "Med-Kit", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "A/MG-43 Machine Gun Sentry", "Eagle Strafing Run", "Orbital Gatling Barrage"],
    blurb: "Voteless die to volume, not penetration." },
  { id: "squids-standard-issue", faction: "squids", name: "Standard Issue", mission: "standard", alt: ["wave", "defend"], diff: ["mid", "high"], biomes: [], heat: true,
    primary: "PLAS-101 Purifier", secondary: "LAS-58 Talon", grenade: "G-123 Thermite", armor: "Med-Kit", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle Strafing Run", "Orbital Laser", "E/MG-101 HMG Emplacement"],
    blurb: "Strafing Run over 500kg. The big bomb drops off hard against squids." },
  { id: "squids-ballistic-patrol", faction: "squids", name: "Ballistic Patrol", mission: "standard", alt: ["nest"], diff: ["mid", "high", "extreme"], biomes: ["hot"], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-31 Grenade Pistol", grenade: "G-123 Thermite", armor: "Med-Kit", booster: "Hellpod Space Optimization",
    strats: ["AC-8 Autocannon", "Eagle Strafing Run", "Orbital Gas Strike", "A/MG-43 Machine Gun Sentry"],
    blurb: "No plasma, no laser. Gas Strike covers the crowd control." },
  { id: "squids-frost-lance", faction: "squids", name: "Frost Lance", mission: "standard", alt: ["blitz", "defend"], diff: ["mid", "high"], biomes: ["cold"], heat: true,
    primary: "SG-8 Punisher Plasma", secondary: "LAS-58 Talon", grenade: "G-4 Gas", armor: "Med-Kit", booster: "Stamina Enhancement",
    strats: ["LAS-99 Quasar Cannon", "AX/LAS-5 Rover", "Eagle Strafing Run", "Orbital Laser"],
    blurb: "Talon is already top tier vs squids. Cold lets it run almost without a vent break." },
  { id: "squids-breach-point", faction: "squids", name: "Breach Point", mission: "nest", alt: ["standard"], diff: ["low", "mid"], biomes: [], heat: false,
    primary: "CB-9 Explosive Crossbow", secondary: "GP-31 Grenade Pistol", grenade: "G-16 Impact", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Cluster Bomb", "Orbital Gatling Barrage"],
    blurb: "Grounded warp ships need the same demo force a bug hole does." },
  { id: "squids-warpship", faction: "squids", name: "Warp Ship Demolition", mission: "nest", alt: [], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-31 Grenade Pistol", grenade: "TED-63 Dynamite", armor: "Concussive Padding, Grenadier", booster: "Stamina Enhancement",
    strats: ["GL-21 Grenade Launcher", "B-1 Supply Pack", "Eagle Airstrike", "Orbital Napalm Barrage"],
    blurb: "Strip the shield, then Dynamite the hull from outside." },
  { id: "squids-sky-denial", faction: "squids", name: "Sky Denial", mission: "wave", alt: ["defend"], diff: ["high", "extreme"], biomes: [], heat: false,
    primary: "SG-97 Sweeper", secondary: "GP-20 Ultimatum", grenade: "G-4 Gas", armor: "Siege-Ready", booster: "Stamina Enhancement",
    strats: ["StA-X3 W.A.S.P. Launcher", "E/AT-12 Anti-Tank Emplacement", "Eagle Strafing Run", "Orbital Gas Strike"],
    blurb: "W.A.S.P. is a dedicated squid tool, near useless elsewhere." },
  { id: "squids-voteless-grinder", faction: "squids", name: "Voteless Grinder", mission: "wave", alt: ["defend"], diff: ["low", "mid"], biomes: ["hot"], heat: false, fire: true,
    primary: "SG-97 Sweeper", secondary: "P-19 Redeemer", grenade: "G-13 Incendiary Impact", armor: "Acclimated", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "B-1 Supply Pack", "A/G-16 Gatling Sentry", "Orbital Gatling Barrage"],
    blurb: "Endless bodies, almost no armor. Ammo economy is the constraint." },
  { id: "squids-purge", faction: "squids", name: "Purge", mission: "blitz", alt: ["wave"], diff: ["low", "mid"], biomes: ["urban", "cave"], heat: false, fire: true,
    primary: "FLAM-66 Torcher", secondary: "P-72 Crisper", grenade: "G-13 Incendiary Impact", armor: "Acclimated", booster: "Hellpod Space Optimization",
    strats: ["M-105 Stalwart", "AX/FLAM-75 Hot Dog", "A/ARC-3 Tesla Tower", "Orbital Napalm Barrage"],
    blurb: "Torcher rates top tier vs squids and near bottom vs bots. Hard specialist." },
  { id: "squids-flash-raid", faction: "squids", name: "Flash Raid", mission: "blitz", alt: ["standard"], diff: ["mid", "high", "extreme"], biomes: ["cold"], heat: false,
    primary: "CB-9 Explosive Crossbow", secondary: "GP-20 Ultimatum", grenade: "G-123 Thermite", armor: "Oxygenator", booster: "Stamina Enhancement",
    strats: ["EAT-411 Leveller", "LIFT-850 Jump Pack", "Eagle Strafing Run", "Orbital Precision Strike"],
    blurb: "Ultimatum in the sidearm slot means no anti-tank support weapon needed." },
  { id: "squids-last-stand", faction: "squids", name: "Last Stand", mission: "defend", alt: ["wave"], diff: ["mid", "high"], biomes: ["urban"], heat: true,
    primary: "PLAS-101 Purifier", secondary: "LAS-58 Talon", grenade: "G/SH-39 Shield", armor: "Siege-Ready", booster: "Hellpod Space Optimization",
    strats: ["E/MG-101 HMG Emplacement", "E/AT-12 Anti-Tank Emplacement", "Eagle Strafing Run", "Orbital Laser"],
    blurb: "Two emplacements, one for chaff and one for Harvesters." },
  { id: "squids-holdfast", faction: "squids", name: "Holdfast", mission: "defend", alt: [], diff: ["high", "extreme"], biomes: ["urban"], heat: false,
    primary: "R-36 Eruptor", secondary: "GP-31 Grenade Pistol", grenade: "G-4 Gas", armor: "Siege-Ready", booster: "Increased Reinforcement Budget",
    strats: ["A/AC-8 Autocannon Sentry", "A/MG-43 Machine Gun Sentry", "E/MG-101 HMG Emplacement", "Orbital Laser"],
    blurb: "Gas grenade panics whatever the sentries have not killed." },
  { id: "squids-alley-cat", faction: "squids", name: "Alley Cat", mission: "standard", alt: ["blitz", "defend"], diff: ["mid", "high"], biomes: ["urban", "cave", "foggy"], heat: false,
    primary: "SMG-203 Gallant", secondary: "GP-31 Grenade Pistol", grenade: "G-23 Stun", armor: "Engineering Kit", booster: "Hellpod Space Optimization",
    strats: ["MGX-42 Bullet Storm", "SH-32 Shield Generator Pack", "Eagle Strafing Run", "Orbital Gas Strike"],
    blurb: "Fleshmobs charge straight down alleys. Stun plus Shield Pack survives that." },
];

/* ================================================================== */
/* LOCK MODEL                                                         */
/* Two independent sources of truth, unioned at read time:            */
/*   lockedItems    per item, toggled in the tier browser             */
/*   lockedWarbonds whole warbond, toggled in the Warbonds tab        */
/* Clearing one never destroys the other.                             */
/* ================================================================== */

const ITEM_SOURCE = (() => {
  const m = {};
  for (const c of CATEGORIES) for (const r of c.rows) m[r[0]] = r[5];
  return m;
})();

/* ================================================================== */
/* NAME MATCHING SELF CHECK                                           */
/* Three maps are keyed by item name: WEAPON_CATEGORY, STRAT_CATEGORY */
/* and ARMOR_TRAITS. A typo in any of them fails silently, the item   */
/* just loses its label or its filter bucket with no error. This runs */
/* once and surfaces both directions of the mismatch in the UI.       */
/* ================================================================== */

const INTEGRITY = (() => {
  const byCat = {};
  for (const c of CATEGORIES) byCat[c.id] = c.rows.map((r) => r[0]);
  const all = new Set(Object.values(byCat).flat());
  const problems = [];

  const orphans = (map, label) => {
    const bad = Object.keys(map).filter((k) => !all.has(k));
    if (bad.length) problems.push(`${label} has ${bad.length} key(s) matching no row: ${bad.join(", ")}`);
  };
  const missing = (names, map, label) => {
    const bad = names.filter((n) => !map[n]);
    if (bad.length) problems.push(`${label} is missing ${bad.length} row(s): ${bad.join(", ")}`);
  };

  orphans(WEAPON_CATEGORY, "WEAPON_CATEGORY");
  orphans(STRAT_CATEGORY, "STRAT_CATEGORY");
  orphans(ARMOR_TRAITS, "ARMOR_TRAITS");
  missing([...byCat.primary, ...byCat.secondary], WEAPON_CATEGORY, "WEAPON_CATEGORY");
  missing(byCat.strat, STRAT_CATEGORY, "STRAT_CATEGORY");
  missing(byCat.armor, ARMOR_TRAITS, "ARMOR_TRAITS");

  const loadoutNames = new Set(LOADOUTS.flatMap(loadoutItems));
  const badLoadout = [...loadoutNames].filter((n) => !all.has(n));
  if (badLoadout.length) problems.push(`Loadouts reference ${badLoadout.length} name(s) matching no row: ${badLoadout.join(", ")}`);

  return problems;
})();

/* Items renamed during the 7.0.0 data rebuild. Old saved lock state  */
/* is migrated on load so it does not silently vanish.                */
const LEGACY_NAMES = {
  "SG-225 Trident": "LAS-13 Trident",
  "AR-23C Liberator Carbine": "AR-23A Liberator Carbine",
};

function buildLockedSet(lockedItems, lockedWarbonds) {
  const wb = new Set(lockedWarbonds);
  const s = new Set(lockedItems);
  if (wb.size) {
    for (const name in ITEM_SOURCE) if (wb.has(ITEM_SOURCE[name])) s.add(name);
  }
  return s;
}

function loadoutItems(l) {
  return [l.primary, l.secondary, l.grenade, l.armor, l.booster, ...l.strats];
}

function selectLoadouts(faction, biome, mission, difficulty, lockedSet, hideLocked) {
  const byDiff = LOADOUTS.filter((l) => l.faction === faction && l.diff.includes(difficulty));
  const heatPool = biome === "hot" ? byDiff.filter((l) => !l.heat) : byDiff;
  const removedByHeat = byDiff.length - heatPool.length;
  const pool = hideLocked ? heatPool.filter((l) => !loadoutItems(l).some((i) => lockedSet.has(i))) : heatPool;
  const removedByLock = heatPool.length - pool.length;

  const scored = pool
    .map((l) => {
      let s = 0;
      if (l.mission === mission) s += 4;
      else if (l.alt.includes(mission)) s += 2;
      if (biome !== "any" && l.biomes.includes(biome)) s += 2.5;
      if (biome === "any" && l.biomes.length === 0) s += 0.5;
      const lockCount = loadoutItems(l).filter((i) => lockedSet.has(i)).length;
      s -= lockCount * 1.2;
      return { loadout: l, score: s };
    })
    .sort((a, b) => b.score - a.score);

  return { picks: scored.slice(0, 3), removedByHeat, removedByLock, poolSize: pool.length };
}

/* ================================================================== */
/* SHARED UI                                                          */
/* ================================================================== */

function Chips({ label, options, value, onChange, activeClass }) {
  return (
    <div>
      {label ? (
        <span className="mb-1.5 block font-semibold uppercase tracking-wider text-[10px] text-zinc-500" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {label}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button key={o.id} onClick={() => onChange(o.id)}
              className={"px-2.5 py-1.5 text-xs font-medium rounded border transition-colors " +
                (active ? activeClass : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-100")}>
              {o.Icon ? <o.Icon className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Multi select chips. Two modes because the two use cases are opposite. */
/* "exclude" starts with everything on and each click hides a bucket,     */
/* which is two clicks to drop SMGs and shotguns. "include" starts empty  */
/* and each click narrows, which is one click for "just orbitals".        */
function MultiChips({ label, hint, options, value, onChange, mode }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const isOn = (id) => (mode === "exclude" ? !value.includes(id) : value.includes(id));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-500" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {label}
        </span>
        {hint ? <span className="text-[9px] text-zinc-600 lowercase">{hint}</span> : null}
        {value.length > 0 ? (
          <button onClick={() => onChange([])} className="text-[9px] text-zinc-500 underline hover:text-zinc-200">reset</button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = isOn(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)} aria-pressed={on}
              className={"px-2.5 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1 " +
                (on
                  ? "bg-zinc-200 text-zinc-900 border-zinc-200"
                  : "bg-zinc-900 text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 " +
                    (mode === "exclude" ? "line-through" : ""))}>
              {o.Icon ? <o.Icon className="w-3.5 h-3.5" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TierBadge({ tier, dim }) {
  if (!tier) {
    return (
      <span className={"w-11 h-8 rounded flex items-center justify-center text-sm font-bold border border-dashed border-zinc-600 text-zinc-600 " + (dim ? "opacity-30" : "")}
        style={{ fontFamily: "'Oswald', sans-serif" }}>?</span>
    );
  }
  return (
    <span className={`w-11 h-8 rounded flex items-center justify-center text-sm font-bold ${TIER_STYLE[tier]} ` + (dim ? "opacity-30" : "")}
      style={{ fontFamily: "'Oswald', sans-serif" }}>
      {tier}
    </span>
  );
}

/* ================================================================== */
/* TIER BROWSER                                                       */
/* ================================================================== */

const KIND_FILTERS = [
  { id: "all", label: "All" }, { id: "thermal", label: "Heat-venting" },
  { id: "fire", label: "Fire" }, { id: "arc", label: "Arc" },
  { id: "ballistic", label: "Ballistic" }, { id: "explosive", label: "Explosive" },
];

const LOCK_FILTERS = [
  { id: "bottom", label: "Show at bottom" },
  { id: "hide", label: "Hide" },
  { id: "only", label: "Only locked" },
];

const FAV_FILTERS = [
  { id: "inline", label: "In normal order" },
  { id: "top", label: "Pin to top" },
  { id: "only", label: "Only favorites" },
];

/* Which filters make sense per category. Damage type is dropped on    */
/* armor and boosters because kind is a data convenience there, not a  */
/* real property: Servo-Assisted is not a ballistic passive.           */
const FILTER_SHAPE = {
  primary: { kind: true, weaponCat: true },
  secondary: { kind: true, weaponCat: true },
  throwable: { kind: true },
  strat: { kind: true, stratType: true },
  armor: { armorTrait: true },
  booster: {},
};

function RowDetail({ name, flag, isArmor }) {
  const sets = isArmor ? ARMOR_SETS[name] : null;
  const patch = PATCH_NOTES[name];
  return (
    <div className="border-t border-zinc-800 bg-zinc-950/60 px-3 py-2.5 flex flex-col gap-2.5">
      {flag === "new" ? (
        <p className="text-[11px] leading-relaxed text-zinc-400">{UNRATED_NOTE}</p>
      ) : null}
      {flag === "stale" && patch ? (
        <div className="text-[11px] leading-relaxed text-zinc-400">
          <span className="text-amber-500 font-semibold">Changed in 7.0.0. </span>
          {patch}
          <span className="text-zinc-600"> The tiers above are community votes from 6.3.1 and have not absorbed this.</span>
        </div>
      ) : null}
      {sets ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Armor sets with this passive</p>
          {["light", "medium", "heavy"].map((wt) => (
            <div key={wt} className="flex items-baseline gap-2 text-[11px]">
              <span className="w-14 shrink-0 uppercase tracking-wide text-zinc-500">{wt}</span>
              {sets[wt].length === 0 ? (
                <span className="text-zinc-700">not available</span>
              ) : (
                <span className="text-zinc-300" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {sets[wt].join(", ")}
                </span>
              )}
            </div>
          ))}
          <p className="text-[10px] text-zinc-600">
            Weight vs medium: heavy is 10% slower with 25% less damage taken, light is 10% faster with 25% more. Numbers in
            brackets are armor/speed/stamina where the set differs from the standard for its class. Helmets and capes do nothing.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* The three faction ratings are real columns with one header, not an  */
/* inline cluster read per row. Column identity is set once at the top. */
function FactionHeader({ factionFilter, left }) {
  return (
    <div className="sticky top-0 z-10 flex items-stretch border border-transparent bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex-1 min-w-0 flex items-end px-3 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {left}
        </span>
      </div>
      <div className="flex items-stretch shrink-0">
        {FACTIONS.map((f) => {
          const dim = factionFilter !== "all" && factionFilter !== f.id;
          return (
            <div key={f.id} title={dim ? `${f.label} is not being ranked right now` : f.label}
              className={"w-14 sm:w-16 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-t border-l " + (dim ? "opacity-30" : "")}
              style={{ backgroundColor: dim ? "transparent" : f.hex + "26", borderColor: f.hex + "33" }}>
              <f.Icon className="w-4 h-4" style={{ color: dim ? "#71717A" : f.hex }} />
              <span className="text-[9px] uppercase tracking-wider font-bold" style={{ fontFamily: "'Oswald', sans-serif", color: dim ? "#71717A" : f.hex }}>
                {f.short}
              </span>
            </div>
          );
        })}
      </div>
      <span className="w-9 shrink-0" />
    </div>
  );
}

function TierRow({ r, factionFilter, isLocked, lockedByWarbond, toggleLock, isFav, toggleFav, isArmor, catId, open, onToggleOpen }) {
  const [name, bots, bugs, squids, kind, source, note, flag] = r;
  const meta = KIND_META[kind] || KIND_META.ballistic;
  const KindIcon = meta.Icon;
  const hasDetail = flag === "new" || (flag === "stale" && PATCH_NOTES[name]) || isArmor;

  const strat = catId === "strat" ? STRAT_CATEGORY[name] : null;
  const stratMeta = strat ? CAT_META[strat[0]] : null;
  const groupHex = stratMeta ? STRAT_GROUP[stratMeta.group].hex : null;
  /* The amber dot means "this eats your own backpack slot". Pointless on */
  /* the backpack subtype, where that is the entire item.                 */
  const eatsBackpack = strat && strat[0] !== "backpack" && strat[1] === true;
  const weaponCat = WEAPON_CATEGORY[name];

  return (
    <div className={"rounded-lg border overflow-hidden " + (isLocked ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-800 bg-zinc-900")}>
      <div className="flex items-stretch">
        <div className="flex items-center gap-2 px-2.5 py-2.5 flex-1 min-w-0">
          <button onClick={() => toggleLock(name)} disabled={lockedByWarbond}
            aria-label={isLocked ? `Mark ${name} as unlocked` : `Mark ${name} as not unlocked`}
            title={lockedByWarbond ? `Locked by the ${source} warbond. Change it in the Warbonds tab.` : "Tap to mark as not unlocked"}
            className={"shrink-0 rounded p-1 " + (lockedByWarbond ? "cursor-default" : "hover:bg-zinc-800")}>
            {isLocked ? <Lock className={"w-4 h-4 " + (lockedByWarbond ? "text-amber-700" : "text-amber-500")} />
              : <Unlock className="w-4 h-4 text-zinc-700 hover:text-zinc-400" />}
          </button>

          <button onClick={() => toggleFav(name)}
            aria-label={isFav ? `Remove ${name} from favorites` : `Add ${name} to favorites`} aria-pressed={isFav}
            title={isFav ? "Favorite" : "Mark as a favorite"}
            className="shrink-0 rounded p-1 hover:bg-zinc-800">
            <Star className={"w-4 h-4 " + (isFav ? "fill-amber-400 text-amber-400" : "text-zinc-700 hover:text-zinc-400")} />
          </button>

          <div className={"flex items-center gap-2.5 flex-1 min-w-0 " + (isLocked ? "opacity-40" : "")}>
            {stratMeta ? (
              <span className="hidden sm:flex items-center gap-1.5 shrink-0 w-[108px]" title={STRAT_GROUP[stratMeta.group].label}>
                <stratMeta.Icon className="w-4 h-4 shrink-0" style={{ color: groupHex }} />
                <span className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ fontFamily: "'Oswald', sans-serif", color: groupHex }}>
                  {stratMeta.label}
                </span>
              </span>
            ) : weaponCat ? (
              <span className="hidden sm:inline-block shrink-0 w-[86px] text-[10px] uppercase tracking-wider font-semibold text-zinc-500 truncate"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                {weaponCat}
              </span>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {KindIcon ? (
                  <KindIcon className="w-3.5 h-3.5 shrink-0 text-zinc-500" title={meta.label + (meta.note ? ` · ${meta.note}` : "")} />
                ) : null}
                <span className={"text-sm truncate " + (isLocked ? "text-zinc-400 line-through" : "text-zinc-100")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {name}
                </span>
                {eatsBackpack ? (
                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500" title="Uses your backpack slot" />
                ) : null}
                {flag === "new" ? (
                  <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700">new</span>
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{source}{note ? ` · ${note}` : ""}</p>
            </div>
          </div>
        </div>

        <div className="flex items-stretch shrink-0">
          {[["bots", bots], ["bugs", bugs], ["squids", squids]].map(([fid, tier]) => {
            const f = FACTIONS.find((x) => x.id === fid);
            const dim = factionFilter !== "all" && factionFilter !== fid;
            return (
              <div key={fid} title={`${f.label}: ${tier || "no rating yet"}`}
                className="w-14 sm:w-16 flex items-center justify-center border-l"
                style={{ backgroundColor: dim ? "transparent" : f.hex + "14", borderColor: f.hex + "33" }}>
                <TierBadge tier={tier} dim={dim} />
              </div>
            );
          })}
        </div>

        <div className="w-9 shrink-0 flex items-center justify-center">
          {hasDetail ? (
            <button onClick={() => onToggleOpen(name)} aria-expanded={open} aria-label={`Details for ${name}`}
              className="rounded p-1 hover:bg-zinc-800">
              {isArmor && flag !== "stale" && flag !== "new"
                ? <ChevronDown className={"w-4 h-4 text-zinc-600 transition-transform " + (open ? "rotate-180" : "")} />
                : <HelpCircle className={"w-4 h-4 " + (flag ? "text-amber-500" : "text-zinc-600")} />}
            </button>
          ) : null}
        </div>
      </div>
      {open && hasDetail ? <RowDetail name={name} flag={flag} isArmor={isArmor} /> : null}
    </div>
  );
}

const BLANK_FILTERS = {
  faction: "all", kind: "all", minTier: "D", lock: "bottom", fav: "inline",
  query: "", hiddenCats: [], types: [], traits: [],
};

function TierBrowser({ lockedSet, warbondLockedSet, toggleLock, clearItemLocks, itemLockCount, favoriteItems, toggleFavItem, clearFavItems }) {
  const [catId, setCatId] = useState("primary");
  const [openRow, setOpenRow] = useState(null);
  /* Filters are per category. Switching tabs no longer drags a damage    */
  /* type filter onto a list where it produces zero results.              */
  const [allFilters, setAllFilters] = useState(() => {
    const m = {};
    for (const c of CATEGORIES) m[c.id] = { ...BLANK_FILTERS };
    return m;
  });

  const f = allFilters[catId];
  const setF = useCallback((patch) => {
    setAllFilters((prev) => ({ ...prev, [catId]: { ...prev[catId], ...patch } }));
  }, [catId]);

  const category = CATEGORIES.find((c) => c.id === catId);
  const shape = FILTER_SHAPE[catId] || {};
  const fTheme = FACTION_THEME[f.faction];
  const isArmor = catId === "armor";
  const favSet = useMemo(() => new Set(favoriteItems), [favoriteItems]);
  const toggleOpen = useCallback((n) => setOpenRow((p) => (p === n ? null : n)), []);

  const catOptions = useMemo(() => {
    const seen = [];
    for (const r of category.rows) {
      const c = WEAPON_CATEGORY[r[0]];
      if (c && !seen.includes(c)) seen.push(c);
    }
    return seen.sort().map((c) => ({ id: c, label: c }));
  }, [category]);

  const rows = useMemo(() => {
    const sortFaction = f.faction === "all" ? null : f.faction;
    const idx = { bots: 1, bugs: 2, squids: 3 };
    const rank = (v) => (v ? TIER_RANK[v] : 0);

    /* The value the tier floor is allowed to judge. Null means there is  */
    /* no rating to judge, so the floor cannot exclude it. Unrated items  */
    /* survive every tier floor and sort last. That is the only way a     */
    /* Castellan's Creed weapon ever gets seen and tried.                 */
    const judged = (r) => {
      if (sortFaction) return r[idx[sortFaction]];
      const rated = [r[1], r[2], r[3]].filter(Boolean);
      if (!rated.length) return null;
      return rated.reduce((a, b) => (TIER_RANK[a] >= TIER_RANK[b] ? a : b));
    };

    return category.rows
      .filter((r) => {
        const name = r[0];
        const locked = lockedSet.has(name);
        if (f.lock === "hide" && locked) return false;
        if (f.lock === "only" && !locked) return false;
        if (f.fav === "only" && !favSet.has(name)) return false;
        if (f.query && !name.toLowerCase().includes(f.query.toLowerCase())) return false;

        if (shape.kind) {
          if (f.kind === "thermal" && !(r[4] === "heat" || r[4] === "arc")) return false;
          if (f.kind !== "all" && f.kind !== "thermal" && r[4] !== f.kind) return false;
        }
        if (shape.weaponCat && f.hiddenCats.length) {
          if (f.hiddenCats.includes(WEAPON_CATEGORY[name])) return false;
        }
        if (shape.stratType && f.types.length) {
          const s = STRAT_CATEGORY[name];
          if (!s || !f.types.includes(s[0])) return false;
        }
        if (shape.armorTrait && f.traits.length) {
          const t = ARMOR_TRAITS[name] || [];
          if (!t.some((x) => f.traits.includes(x))) return false;
        }

        const j = judged(r);
        if (!j) return true;
        return TIER_RANK[j] >= TIER_RANK[f.minTier];
      })
      .slice()
      .sort((a, b) => {
        const aLock = lockedSet.has(a[0]) ? 1 : 0;
        const bLock = lockedSet.has(b[0]) ? 1 : 0;
        if (aLock !== bLock) return aLock - bLock;
        if (f.fav === "top") {
          const aFav = favSet.has(a[0]) ? 0 : 1;
          const bFav = favSet.has(b[0]) ? 0 : 1;
          if (aFav !== bFav) return aFav - bFav;
        }
        const aNew = judged(a) ? 0 : 1;
        const bNew = judged(b) ? 0 : 1;
        if (aNew !== bNew) return aNew - bNew;
        const av = sortFaction ? rank(a[idx[sortFaction]]) : (rank(a[1]) + rank(a[2]) + rank(a[3])) / 3;
        const bv = sortFaction ? rank(b[idx[sortFaction]]) : (rank(b[1]) + rank(b[2]) + rank(b[3])) / 3;
        if (bv !== av) return bv - av;
        return a[0].localeCompare(b[0]);
      });
  }, [category, shape, f, lockedSet, favSet]);

  const lockedInCategory = category.rows.filter((r) => lockedSet.has(r[0])).length;
  const favInCategory = category.rows.filter((r) => favSet.has(r[0])).length;
  const flaggedInCategory = category.rows.filter((r) => r[7]).length;
  const unratedInCategory = category.rows.filter((r) => !r[1] && !r[2] && !r[3]).length;
  const backpackHere = catId === "strat"
    ? category.rows.filter((r) => { const s = STRAT_CATEGORY[r[0]]; return s && s[0] !== "backpack" && s[1] === true; }).length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {INTEGRITY.length > 0 ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2.5 text-[11px] text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <p className="font-semibold">Name matching broken. Lock state and labels will misbehave until this is fixed.</p>
            {INTEGRITY.map((p) => <p key={p} className="mt-1 text-red-400">{p}</p>)}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const n = c.rows.filter((r) => lockedSet.has(r[0])).length;
          const fv = c.rows.filter((r) => favSet.has(r[0])).length;
          return (
            <button key={c.id} onClick={() => { setCatId(c.id); setOpenRow(null); }}
              className={"px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded border flex items-center gap-1.5 " +
                (c.id === catId ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-100")}
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              {c.label}
              {fv > 0 ? <Star className="w-3 h-3 fill-amber-400 text-amber-400 opacity-80" /> : null}
              {n > 0 ? <Lock className="w-3 h-3 opacity-60" /> : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Chips label="Rank by" options={[{ id: "all", label: "All fronts" }, ...FACTIONS.map((x) => ({ id: x.id, label: x.short, Icon: x.Icon }))]}
            value={f.faction} onChange={(v) => setF({ faction: v })} activeClass={fTheme.chip} />
          <Chips label="Minimum tier" options={TIER_ORDER.map((t) => ({ id: t, label: t }))}
            value={f.minTier} onChange={(v) => setF({ minTier: v })} activeClass="bg-zinc-200 text-zinc-900 border-zinc-200" />
          {shape.kind ? (
            <Chips label="Damage type" options={KIND_FILTERS} value={f.kind}
              onChange={(v) => setF({ kind: v })} activeClass="bg-zinc-200 text-zinc-900 border-zinc-200" />
          ) : null}
          {shape.weaponCat ? (
            <MultiChips label="Weapon category" hint="click to hide" mode="exclude" options={catOptions}
              value={f.hiddenCats} onChange={(v) => setF({ hiddenCats: v })} />
          ) : null}
          {shape.stratType ? (
            <MultiChips label="Stratagem type" hint="click to narrow" mode="include" options={STRAT_TYPE_FILTERS}
              value={f.types} onChange={(v) => setF({ types: v })} />
          ) : null}
          {shape.armorTrait ? (
            <MultiChips label="What it does" hint="click to narrow" mode="include" options={ARMOR_TRAIT_FILTERS}
              value={f.traits} onChange={(v) => setF({ traits: v })} />
          ) : null}
          <Chips label="Locked items" options={LOCK_FILTERS} value={f.lock}
            onChange={(v) => setF({ lock: v })} activeClass="bg-amber-500 text-amber-950 border-amber-500" />
          <Chips label="Favorites" options={FAV_FILTERS} value={f.fav}
            onChange={(v) => setF({ fav: v })} activeClass="bg-amber-400 text-amber-950 border-amber-400" />
          <div>
            <span className="mb-1.5 block font-semibold uppercase tracking-wider text-[10px] text-zinc-500" style={{ fontFamily: "'Oswald', sans-serif" }}>Search</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input value={f.query} onChange={(e) => setF({ query: e.target.value })} placeholder="Search"
                className="w-full bg-zinc-900 border border-zinc-700 rounded pl-7 pr-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
          <span>{rows.length} of {category.rows.length} shown</span>
          {lockedInCategory > 0 ? <span className="text-amber-500">{lockedInCategory} locked here</span> : null}
          {favInCategory > 0 ? (
            <span className="flex items-center gap-1 text-amber-400"><Star className="w-3.5 h-3.5 fill-amber-400" /> {favInCategory} favorited here</span>
          ) : null}
          {shape.kind ? <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> vents heat: better in cold, worse in hot</span> : null}
          {backpackHere > 0 ? (
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {backpackHere} eat your backpack slot</span>
          ) : null}
          {unratedInCategory > 0 ? (
            <span>{unratedInCategory} unrated, always shown at the bottom whatever the tier floor</span>
          ) : null}
          {flaggedInCategory > 0 ? (
            <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5 text-amber-500" /> {flaggedInCategory} with a rating caveat, tap to read it</span>
          ) : null}
          {isArmor ? <span className="flex items-center gap-1"><ChevronDown className="w-3.5 h-3.5" /> expand for the armor sets that carry it</span> : null}
          {itemLockCount > 0 ? (
            <button onClick={clearItemLocks} className="text-zinc-400 underline hover:text-zinc-100">clear {itemLockCount} item locks</button>
          ) : null}
          {favoriteItems.length > 0 ? (
            <button onClick={clearFavItems} className="text-zinc-400 underline hover:text-zinc-100">clear {favoriteItems.length} favorites</button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FactionHeader factionFilter={f.faction} left={category.label} />
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 py-8 text-center text-sm text-zinc-400">
            {f.fav === "only" && favInCategory === 0
              ? "Nothing favorited in this list yet. Tap a star on any row to keep it here."
              : "Nothing matches those filters. Drop the minimum tier, clear the search, or reset the category chips."}
          </div>
        ) : (
          rows.map((r) => (
            <TierRow key={r[0]} r={r} factionFilter={f.faction}
              isLocked={lockedSet.has(r[0])} lockedByWarbond={warbondLockedSet.has(r[0])}
              toggleLock={toggleLock} isFav={favSet.has(r[0])} toggleFav={toggleFavItem}
              isArmor={isArmor} catId={catId}
              open={openRow === r[0]} onToggleOpen={toggleOpen} />
          ))
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* WARBONDS                                                           */
/* ================================================================== */

function WarbondPanel({ lockedWarbonds, toggleWarbond, setWarbondGroup }) {
  const counts = useMemo(() => {
    const m = {};
    for (const c of CATEGORIES) for (const r of c.rows) m[r[5]] = (m[r[5]] || 0) + 1;
    return m;
  }, []);
  const wbSet = new Set(lockedWarbonds);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-400 leading-relaxed">
        Mark a warbond you do not own and every item in it is locked across the tier lists and the loadout picker at once.
        This is separate from per item locking, so turning a warbond back on will not wipe the individual items you locked by hand.
        <span className="block mt-2 text-zinc-500">
          Armor passives are not listed here. The source data maps passives to armor sets, not to warbonds, so armor
          stays on per item locking in the Armor passives tier list.
        </span>
      </div>

      {WARBOND_GROUPS.map((g) => {
        const gateable = g.id !== "other";
        const lockedInGroup = g.names.filter((n) => wbSet.has(n)).length;
        return (
          <div key={g.id} className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-100" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {g.label} <span className="text-zinc-600 font-normal">({g.names.length})</span>
                </h3>
                <p className="text-[11px] text-zinc-500">{g.note}</p>
              </div>
              {gateable ? (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setWarbondGroup(g.names, true)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 hover:border-amber-600 hover:text-amber-400">
                    Lock all
                  </button>
                  <button onClick={() => setWarbondGroup(g.names, false)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-100">
                    Unlock all
                  </button>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-3">
              {g.names.map((n) => {
                const locked = wbSet.has(n);
                const count = counts[n] || 0;
                if (!gateable) {
                  return (
                    <div key={n} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900/40 px-2.5 py-2 text-xs text-zinc-500">
                      <span className="truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{n}</span>
                      <span className="shrink-0 text-[10px] text-zinc-600">{count}</span>
                    </div>
                  );
                }
                return (
                  <button key={n} onClick={() => toggleWarbond(n)} aria-pressed={locked}
                    className={"flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-xs transition-colors " +
                      (locked ? "border-amber-700/60 bg-amber-950/40 text-amber-400" : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-600")}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {locked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Unlock className="w-3.5 h-3.5 shrink-0 text-zinc-700" />}
                      <span className={"truncate " + (locked ? "line-through" : "")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{n}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-600">{count}</span>
                  </button>
                );
              })}
            </div>
            {lockedInGroup > 0 ? (
              <p className="border-t border-zinc-800 px-4 py-1.5 text-[11px] text-amber-500">{lockedInGroup} locked in this group</p>
            ) : null}
          </div>
        );
      })}

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Counts are items this tool tracks from that warbond, not total warbond contents. Cosmetics, capes, player cards and
        vehicle patterns are not tracked. Righteous Revenants is the Killzone crossover; the reference tables never label it
        by tier, so its placement under Legendary is inferred from the 24 warbond count.
      </p>
    </div>
  );
}

/* ================================================================== */
/* PICKER                                                             */
/* ================================================================== */

function StratChip({ name, isLocked }) {
  const [cat, usesBackpack] = STRAT_CATEGORY[name] || ["support", false];
  const meta = CAT_META[cat] || CAT_META.support;
  const { Icon } = meta;
  /* Same rule as the tier list: the dot warns that a support weapon eats */
  /* your backpack slot. On a backpack it would be stating the obvious.   */
  const eatsBackpack = usesBackpack === true && cat !== "backpack";
  return (
    <div className={"relative flex items-start gap-1.5 rounded px-1.5 py-1.5 pr-3 " + (isLocked ? "bg-zinc-800/40" : "bg-zinc-800/80")}
      title={meta.label + (eatsBackpack ? " (uses backpack slot)" : "") + (isLocked ? " · not unlocked" : "")}>
      {isLocked ? <Lock className="w-3.5 h-3.5 shrink-0 mt-px text-amber-500" />
        : <Icon className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: STRAT_GROUP[meta.group].hex }} />}
      <span className={"text-[10px] leading-tight " + (isLocked ? "text-zinc-500 line-through" : "text-zinc-300")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {name}
      </span>
      {eatsBackpack ? <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
    </div>
  );
}

function LoadoutCard({ loadout, isFavorite, onToggleFavorite, rankLabel, biome, lockedSet }) {
  const theme = FACTION_THEME[loadout.faction];
  const biomeMatch = biome !== "any" && loadout.biomes.includes(biome);
  const fireNote = biome === "hot" && loadout.fire;
  const lockedHere = loadoutItems(loadout).filter((i) => lockedSet.has(i));
  const staleHere = loadoutItems(loadout).filter((i) => PATCH_NOTES[i]);
  const rows = [["Primary", loadout.primary], ["Secondary", loadout.secondary], ["Grenade", loadout.grenade], ["Armor", loadout.armor], ["Booster", loadout.booster]];

  return (
    <div className={`flex flex-col rounded-lg border bg-zinc-900 overflow-hidden ${biomeMatch ? theme.cardBorder : "border-zinc-800"}`}>
      <div className="h-1 w-full" style={{ backgroundColor: theme.hex }} />
      <div className="p-3.5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{rankLabel}</p>
            <h3 className={`text-lg font-bold leading-tight ${theme.text}`} style={{ fontFamily: "'Oswald', sans-serif" }}>{loadout.name}</h3>
          </div>
          <button onClick={() => onToggleFavorite(loadout.id)} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} className="shrink-0 rounded p-1.5 hover:bg-zinc-800">
            <Star className={"w-5 h-5 " + (isFavorite ? "fill-amber-400 text-amber-400" : "text-zinc-600")} />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">{loadout.blurb}</p>

        {lockedHere.length > 0 ? (
          <div className="flex items-start gap-1.5 rounded border border-amber-800/60 bg-amber-950/40 px-2 py-1.5 text-[11px] text-amber-300">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{lockedHere.length} {lockedHere.length === 1 ? "item" : "items"} marked as not unlocked.</span>
          </div>
        ) : null}

        {staleHere.length > 0 ? (
          <div className="flex items-start gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-400">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-500" />
            <span>{staleHere.join(", ")} changed in 7.0.0. The tier list has not caught up.</span>
          </div>
        ) : null}

        {biomeMatch ? (
          <div className="flex items-start gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" /><span>Built for this terrain.</span>
          </div>
        ) : null}

        {fireNote ? (
          <div className="flex items-start gap-1.5 rounded border border-amber-800/60 bg-amber-950/40 px-2 py-1.5 text-[11px] text-amber-300">
            <Flame className="w-3.5 h-3.5 shrink-0 mt-px" /><span>Fire-based kit. Watch out on fire tornado planets.</span>
          </div>
        ) : null}

        <div className="border-t border-zinc-800 pt-2.5 flex flex-col gap-1.5">
          {rows.map(([label, value]) => {
            const isLocked = lockedSet.has(value);
            return (
              <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-zinc-500 shrink-0">{label}</span>
                <span className={"text-right flex items-center gap-1 " + (isLocked ? "text-zinc-500 line-through" : "text-zinc-200")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {isLocked ? <Lock className="w-3 h-3 text-amber-500 shrink-0" /> : null}
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 pt-2.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Stratagems</p>
          <div className="grid grid-cols-2 gap-1.5">
            {loadout.strats.map((s) => <StratChip key={s} name={s} isLocked={lockedSet.has(s)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Picker({ favorites, toggleFavorite, lockedSet }) {
  const [faction, setFaction] = useState("bugs");
  const [biome, setBiome] = useState("any");
  const [mission, setMission] = useState("standard");
  const [difficulty, setDifficulty] = useState("mid");
  const [gearFilter, setGearFilter] = useState("all");

  const fTheme = FACTION_THEME[faction];
  const bTheme = BIOME_THEME[biome];
  const { picks, removedByHeat, removedByLock, poolSize } = selectLoadouts(faction, biome, mission, difficulty, lockedSet, gearFilter === "owned");
  const rankLabels = ["Best match", "Alt option", "Alt option"];

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-lg border p-4 flex flex-col gap-4 transition-colors ${bTheme.panel} ${bTheme.border}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Chips label="Faction" options={FACTIONS.map((f) => ({ id: f.id, label: f.short, Icon: f.Icon }))} value={faction} onChange={setFaction} activeClass={fTheme.chip} />
          <Chips label="Biome" options={BIOMES} value={biome} onChange={setBiome} activeClass="bg-zinc-200 text-zinc-900 border-zinc-200" />
          <Chips label="Mission" options={MISSION_TYPES} value={mission} onChange={setMission} activeClass="bg-zinc-200 text-zinc-900 border-zinc-200" />
          <Chips label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} activeClass="bg-zinc-200 text-zinc-900 border-zinc-200" />
          <Chips label="Gear" options={[{ id: "all", label: "All builds" }, { id: "owned", label: "Only unlocked gear" }]} value={gearFilter} onChange={setGearFilter} activeClass="bg-amber-500 text-amber-950 border-amber-500" />
        </div>
        {bTheme.note ? (
          <div className="flex items-start gap-2 text-xs text-zinc-300 border-t border-zinc-700/60 pt-3">
            <Info className="w-4 h-4 shrink-0 mt-px" style={{ color: bTheme.dot }} /><span>{bTheme.note}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>{poolSize} builds match this brief</span>
        {removedByHeat > 0 ? (
          <span className="flex items-center gap-1 text-amber-500"><FilterX className="w-3.5 h-3.5" />{removedByHeat} heat-based excluded</span>
        ) : null}
        {removedByLock > 0 ? (
          <span className="flex items-center gap-1 text-amber-500"><Lock className="w-3.5 h-3.5" />{removedByLock} need locked gear</span>
        ) : null}
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> uses backpack slot</span>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 py-8 text-center text-sm text-zinc-400">
          Nothing matches that combination yet. Try a different mission type or difficulty band.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {picks.map((p, i) => (
            <LoadoutCard key={p.loadout.id} loadout={p.loadout} isFavorite={favorites.includes(p.loadout.id)} onToggleFavorite={toggleFavorite}
              rankLabel={rankLabels[i]} biome={biome} lockedSet={lockedSet} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* ROOT                                                               */
/* ================================================================== */

export default function Armory() {
  const [tab, setTab] = useState("browse");
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [lockedItems, setLockedItems] = useState([]);
  const [lockedWarbonds, setLockedWarbonds] = useState([]);

  useEffect(() => {
    let mounted = true;
    const read = async (key, fallback) => {
      try {
        const r = await window.storage.get(key, false);
        if (r && r.value) {
          const p = JSON.parse(r.value);
          if (Array.isArray(p)) return p;
        }
      } catch (e) { /* nothing saved yet */ }
      return fallback;
    };
    (async () => {
      const fav = await read("hd2-loadout-favorites", []);
      const favItems = await read("hd2-favorite-items", []);
      const items = await read("hd2-locked-items", []);
      const wbs = await read("hd2-locked-warbonds", []);
      if (!mounted) return;
      setFavorites(fav);
      setFavoriteItems(favItems.map((n) => LEGACY_NAMES[n] || n));
      setLockedItems(items.map((n) => LEGACY_NAMES[n] || n));
      setLockedWarbonds(wbs.filter((n) => GATEABLE.has(n)));
    })();
    return () => { mounted = false; };
  }, []);

  const persist = (key, value) => {
    (async () => {
      try { await window.storage.set(key, JSON.stringify(value), false); } catch (e) { /* session only */ }
    })();
  };

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      persist("hd2-loadout-favorites", next);
      return next;
    });
  }, []);

  /* Item favorites are independent of lock state and of loadout          */
  /* favorites. A favorite says "I want to come back to this", a lock says */
  /* "I do not own this". They are allowed to be true at the same time.    */
  const toggleFavItem = useCallback((name) => {
    setFavoriteItems((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      persist("hd2-favorite-items", next);
      return next;
    });
  }, []);

  const clearFavItems = useCallback(() => {
    setFavoriteItems(() => { persist("hd2-favorite-items", []); return []; });
  }, []);

  const toggleLock = useCallback((name) => {
    setLockedItems((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      persist("hd2-locked-items", next);
      return next;
    });
  }, []);

  const clearItemLocks = useCallback(() => {
    setLockedItems(() => { persist("hd2-locked-items", []); return []; });
  }, []);

  const toggleWarbond = useCallback((name) => {
    setLockedWarbonds((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      persist("hd2-locked-warbonds", next);
      return next;
    });
  }, []);

  const setWarbondGroup = useCallback((names, locked) => {
    setLockedWarbonds((prev) => {
      const s = new Set(prev);
      for (const n of names) { if (locked) s.add(n); else s.delete(n); }
      const next = [...s];
      persist("hd2-locked-warbonds", next);
      return next;
    });
  }, []);

  const warbondLockedSet = useMemo(() => buildLockedSet([], lockedWarbonds), [lockedWarbonds]);
  const lockedSet = useMemo(() => buildLockedSet(lockedItems, lockedWarbonds), [lockedItems, lockedWarbonds]);
  const favoriteLoadouts = LOADOUTS.filter((l) => favorites.includes(l.id));

  const TABS = [
    ["browse", "Tier lists"],
    ["picker", "Loadouts"],
    ["warbonds", `Warbonds${lockedWarbonds.length ? ` (${lockedWarbonds.length})` : ""}`],
    ["favorites", `Favorites${favorites.length ? ` (${favorites.length})` : ""}`],
  ];

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden" style={{ fontFamily: "system-ui, sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      <div className="h-2 w-full" style={{ backgroundImage: "repeating-linear-gradient(135deg, #EAB308 0px, #EAB308 10px, #09090b 10px, #09090b 20px)" }} />

      <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-zinc-800 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-widest font-semibold uppercase text-yellow-500">Super Earth Armed Forces</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>Armory</h1>
          <p className="text-[10px] text-zinc-600 mt-0.5">Patch 7.0.0 Devoid of Liberty · ratings from u.gg 6.3.1, armor passives 7.0.0</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          {favoriteItems.length > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400" />{favoriteItems.length} starred
            </span>
          ) : null}
          {lockedSet.size > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-500">
              <Lock className="w-3.5 h-3.5" />{lockedSet.size} locked
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex border-b border-zinc-800">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={"flex-1 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wide border-b-2 " +
              (tab === id ? "text-yellow-400 border-yellow-500" : "text-zinc-500 border-transparent hover:text-zinc-300")}
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {tab === "browse" ? (
          <TierBrowser lockedSet={lockedSet} warbondLockedSet={warbondLockedSet} toggleLock={toggleLock}
            clearItemLocks={clearItemLocks} itemLockCount={lockedItems.length}
            favoriteItems={favoriteItems} toggleFavItem={toggleFavItem} clearFavItems={clearFavItems} />
        ) : null}
        {tab === "picker" ? <Picker favorites={favorites} toggleFavorite={toggleFavorite} lockedSet={lockedSet} /> : null}
        {tab === "warbonds" ? (
          <WarbondPanel lockedWarbonds={lockedWarbonds} toggleWarbond={toggleWarbond} setWarbondGroup={setWarbondGroup} />
        ) : null}
        {tab === "favorites" ? (
          favoriteLoadouts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 py-10 px-4 text-center">
              <Star className="w-6 h-6 mx-auto text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-400">No loadouts saved yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Star one from the Loadouts tab to keep it here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {favoriteLoadouts.map((l) => (
                <LoadoutCard key={l.id} loadout={l} isFavorite onToggleFavorite={toggleFavorite}
                  rankLabel={FACTIONS.find((f) => f.id === l.faction).label} biome="any" lockedSet={lockedSet} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
