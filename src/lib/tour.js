/* ================================================================== */
/* THE TOUR                                                           */
/*                                                                    */
/* The Democracy Officer shows you round, W.A.R.P.'s shape: each step  */
/* lights one thing, says it in-universe in large type, and then says  */
/* it plainly in small type underneath. The curator's ask of 3 October */
/* 2026, with Helldivers 2's own item tooltips as the register.        */
/*                                                                    */
/* The voice is the game's, none of the words are. Nothing here is     */
/* quoted from the game: every line is written for this tool, in the   */
/* tone of a Ministry of Truth briefing.                               */
/*                                                                    */
/* The rule that earns the jokes: **`plain` is the fact, and it must   */
/* stand on its own.** Somebody who skims only the small print should  */
/* come away knowing what every lit thing does.                        */
/*                                                                    */
/* Fields:                                                            */
/*   route     where to go before the step is shown, as navigate()     */
/*             takes it. None means stay where you are                 */
/*   at        the data-tour value to light. None means a whole-page   */
/*             line, said from the middle of the screen                */
/*   optional  skip the step when its anchor never turns up, rather    */
/*             than saying it over nothing. Drop Bay has no slot to    */
/*             point at before a front is chosen, and sends you to the */
/*             war room instead                                        */
/*                                                                    */
/* A step that is not optional and whose anchor is missing (a menu     */
/* entry on a phone, where the menu is a drawer) is said from the      */
/* middle instead. The words still hold without the pointing.          */
/* ================================================================== */

export const TOUR = [
  {
    title: "Welcome aboard, Helldiver",
    speech:
      "Attention! You have been selected for a mandatory orientation on the Democratic Intelligent Loadout & Armoury System. Attendance is voluntary. Non-attendance has been noted.",
    plain: "A short tour of the tool. Esc skips it, the arrow keys step through it, and Settings replays it.",
  },
  {
    at: "nav",
    title: "The chain of command",
    speech:
      "This is the menu. Every destination on it has been cleared by the Ministry of Truth. The entries that are greyed out do not exist, and you did not see them.",
    plain:
      "Drop Bay, the Star Map, the Armoury, the Tier Lists and your Collection, then the pages about the tool. Greyed out entries are planned and not built yet.",
  },
  {
    route: "scenario",
    at: "war-planner",
    title: "Choose your battlefield",
    speech:
      "Liberty cannot be delivered without an address. Pick a planet on the galaxy map, or let the planner pick one for you, and its biome, hazards and front fill themselves in. Super Earth thanks you for your geography.",
    plain:
      "The war room sets where you are dropping: front, planet and mission. Every rating in the tool reads it, and with the live war it shows which fronts are open.",
  },
  {
    route: "scenario",
    at: "war-difficulty",
    title: "Know your odds",
    speech:
      "Select a difficulty appropriate to your patriotism, then report how many of you are deploying. Solo deployment is a courageous choice, and has been forwarded to your next of kin.",
    plain:
      "Difficulty and squad size decide which enemies count and which gear rises. The same rifle rates differently solo on Super Helldive and four of you on Hard.",
  },
  {
    route: "bay",
    at: "drop-slots",
    optional: true,
    title: "The Drop Bay",
    speech:
      "Your Hellpod is fuelled and pointed at the enemy. Choose a build, press DROP, and history will record that you did. We keep a log. We always keep a log.",
    plain:
      "Drop Bay suggests three of your builds for this drop and says why. DROP confirms one, counts it for your squad and adds it to your drop history.",
  },
  {
    route: "bay",
    at: "scenario-bar",
    optional: true,
    title: "Your orders, at a glance",
    speech:
      "This strip is your orders. If it says Automatons, it is Automatons. Press Adjust to amend your orders, which is permitted, encouraged and monitored.",
    plain:
      "The scenario bar sits on every page that reads it. Adjust opens the war room, and the bar says so whenever a rule is switched off.",
  },
  {
    route: "armoury/builds",
    at: "nav-armoury",
    title: "The Armoury",
    speech:
      "Every loadout you have ever trusted with your life, filed in one place. Name them, copy them, share them. Hoarding equipment is a sign of preparedness, not of a problem.",
    plain:
      "Your builds. Builds browses them, Coverage shows what you have for each occasion on each front, and History shows what you actually dropped with.",
  },
  {
    route: "tiers/primary",
    at: "rating-columns",
    title: "Two opinions, one truth",
    speech:
      "On the left, the vote of the people. On the right, our reading for where you are actually dropping. Where they disagree, a sentence explains why. Disagreement is healthy. Within limits.",
    plain:
      "The u.gg community tier beside ours for your scenario. Click a row to see what moved it. Either column sorts the list.",
  },
  {
    route: "collection/warbonds",
    at: "nav-collection",
    title: "Requisitions",
    speech:
      "Log the Warbonds you own and the gear you have unlocked. The tool will never recommend equipment you have not earned. Earning it is your civic duty.",
    plain:
      "What you own, per profile. Gear you have not unlocked is left out of suggestions and pickers unless you ask to see it.",
  },
  {
    route: "rules",
    at: "nav-rules",
    title: "Full transparency",
    speech:
      "Every rule behind our rating, published in full, because Super Earth has nothing to hide. You may switch any rule off. The rule will not take it personally.",
    plain:
      "The Rules page lists each rule, what it moves where you are dropping, and a switch to turn it off in this browser.",
  },
  {
    at: "party",
    title: "Squad up",
    speech:
      "Helldivers do not dive alone. Unless they do, in which case they dive bravely. Open a party, read the code to your squad, and their loadouts land in your Drop Bay the moment they commit.",
    plain:
      "A six character code and no account. Each member's confirmed build shows in their slot, and the host's scenario becomes everybody's.",
  },
  {
    route: "settings",
    at: "tour-replay",
    title: "Mandatory refresher",
    speech:
      "Should your memory fail you under fire, this orientation may be repeated at any time. Repetition is how freedom is learned.",
    plain:
      "Settings also holds themes, Export and Import. Your collection lives in this browser, so export it before clearing anything.",
  },
  {
    title: "Dismissed",
    speech:
      "Orientation complete. You are now fully informed, which is the second most dangerous thing a citizen can be. Get out there and spread Managed Democracy.",
    plain: "That is the tour. Drop Bay is where an evening starts.",
  },
];
