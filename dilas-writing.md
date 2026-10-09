# **D.I.L.A.S.: Writing Guide**

> How every word on screen is written, and where it sits. **v1, final, 9 October 2026.** Built from the curator's notes on about sixty real lines over two rounds; the second round, with his notes, is `docs/writing/round-1.md`. Every session follows this for UI text.

---

# **The Style In One Line**

**Say what it does, in the game's words, and stop.**

Literal, factual and short, like a mission briefing: "Stealth advised." "Gas damages everyone, Helldivers included."

---

# **Who Reads It**

Helldivers veterans, a hardcore community. They know the game better than the tool does.

**Never explain the game and never state the obvious.** "Four wheels" on an FRV earned "It's a car. People ain't stupid." Give the one fact they do not already have: "The fact that it has a heavy machine gun is good info. Just that."

# **Voice**

- **Plain and factual.** Present tense, literal verbs: damages, reduces, resists, opens, kills, helps, hurts, advised.
- **"You" is for instructions**: "Hit the weak points." Never narrate a scene for the reader ("you are not trying to win the firefight").
- **No jokes in working text.** The Ministry voice has two homes, the tour and the changelog, and stays there.

---

# **What He Hates**

Every line here is a real one from the tool that he rejected.

| Never | From the tool |
|---|---|
| **Clever lines**: aphorisms, slogans, wordplay, a punchline to finish | "what cannot catch you cannot hurt you" · "quiet wins" · "noise costs" · "no support weapon is no support weapon" · "It does not make a bad sidearm good, it makes a good one indispensable" |
| **Things that act or feel** | "A gas cloud does not care whose it is" · "Armor somewhere on them turns this away" · "Hunters do not wait for you" |
| **Little stories** | "the difference between crossing an outpost and being chased out of one" |
| **The obvious** | "four wheels" · "Someone has to drive" |
| **"X, not Y" and "X rather than Y"** | "weather rather than climate" · "a risk you carry rather than a state you are in" |
| **Vague verbs for what the tool does** | "moves it" · "where this sits" · "have not absorbed it" · "a hit and a slow one" · "1 of those only just" |
| **Engine words** | rules that "fire" or "read" |
| **Our to-do list** | "Re-check u.gg around early September 2026". In his words: "We recheck for them" |
| **Defending and caveating everywhere** | "Ours, not a community vote", on panel after panel |
| **Maths inline** | "Roughly 14 points is one tier, and no scenario can move a rating by more than two" |
| **Explaining the UI inside the UI** | "Open one to see what it does". A glow or a pulse says that better |
| **Dense sentences doing three jobs** | one he had to read four times |
| **Walls of grey text, all at one weight** | "no clue where to look or start" |
| **Several values in one field** | "Leaves your backpack free / not recorded / This is the backpack" |

# **What He Likes**

- **Labelled facts, numbers and names**: "Full damage: 11 of 15 enemies". "Weak points only: Bile Titan, Charger and Charger Behemoth".
- **A marker for a gap**, with the reason on hover: Missing data.
- **The tool's own tooltip** for what a term means and for the longer reason.
- **One place for the maths and the sources**: About, How the rating works.
- **Visual cues instead of instructions.**
- **His own rewrites, which are the model:**
  - "A gas cloud damages everyone including Helldivers. This armour negates gas damage."
  - "A storm decreases line of sight."
  - "Reduced visibility and silenced weapons will benefit here."
  - "Stealth is advised."
  - "For Bile Titan, Charger, Charger Behemoth you have to hit weak points due to heavy armour."
  - "On this difficulty AP 3 can open Charger armour."
  - "Current scenario has no effects on D.I.L.A.S. tier."

Note what they share: a thing, a plain verb, an effect. No adjectives doing work a number could do. One idea per sentence.

---

# **The Recipe**

For every line:

1. **Find the one fact** the player needs.
2. **Write it literally**: the thing, a plain verb, the effect. Use the game's words.
3. **Cut every clause that defends, narrates, jokes or explains the tool.**
4. **Move what is left to its layer** (below).
5. **Run the checklist.**

# **Layers: Where Everything Lives**

| Layer | What goes there | Example |
|---|---|---|
| **At first glance** | The answer | `S` · `70%` · "No crowd clear" |
| **One click away** | Short lines: a label and its value, or a rule's name and its points | "+9 Durable damage helps · Terminids" |
| **Hover**, through `Tip` | What a term means. The full reason, at most two sentences. Where a number came from | "Big Terminids are mostly tough flesh. Weapons with high durable damage keep most of their damage against it." |
| **About, How the rating works** | Maths, sources, limits, the missing data list, peril | "About 14 points make a tier." |
| **The changelog** | What changed, and when | "True Grit now counts big belts." |
| **Nowhere on screen** | Our to-do list, who decided what, dates of our own decisions | "Re-check u.gg" · "at the curator's word, 4 October" |

> [!danger] A hover never holds the only copy of something you need to decide what to bring
> If the hover spot is taken by something more important, the text goes to About.

**Use `Tip`, never `title=`.** The browser's own tooltip is slow, unstyled and missing on a phone. A label with a tip gets the dotted underline, `HAS_TIP`. A missing value is `<MissingData />`, or `Fact`'s `missing` prop in the expanded row.

---

# **Kinds Of Text**

| Kind | Shape | Limit | Example |
|---|---|---|---|
| Label, chip, button | a noun or a verb | 1 to 4 words | "Missing data" · "Take it" |
| Section heading | what the section holds | 1 to 4 words | "What affects this tier" |
| Field value | a number with its unit, or a short phrase | a number and 3 words | "3.2s total · one round at a time" |
| **Rule name**, which is also the visible reason line | effect · when | about 50 characters | "Stealth advised · Automatons, 1 or 2 players, peril 22+" |
| **Rule sentence**, on hover | the situation, then what the item does about it | 2 sentences, about 25 words | "Gas damages everyone, Helldivers included. Your armour resists gas damage." |
| Warning | a fact as the title, then what is missing | title of 5 words, one sentence | "No crowd clear. Nothing here kills groups of small enemies quickly." |
| Empty state | what is missing, then one thing to do | 2 short sentences | "No builds yet. Pick a primary to start one." |
| Item note | the one useful fact | a fragment | "mounted Heavy Machine Gun" |
| Tooltip | a meaning or a reason | 2 short sentences | "How fast the barrel follows your aim." |

**Rule names carry their condition**, peril included, so a name says when it applies as well as what it does. The effect comes first, because in the tier row the name is the reason line.

# **Words We Use**

| Say | Never | Note |
|---|---|---|
| stratagem | call-in | the game's word |
| D.I.L.A.S. tier | ours, our rating, our reading, our column | the column header already says it. On screen it comes from `BRAND.short` in `src/lib/brand.js`, never typed out |
| community tier | the vote, a u.gg aggregate | the u.gg column |
| affects, changes | moves, sits, absorbed | "What affects this tier" |
| applies | fires, reads, kicks in | what a rule does |
| weak points | the right spot | the game's word |
| peril 22+ | a hard drop, this deep | always with its number. Explained on About, and on hover wherever it appears |
| 1 or 2 players | alone or in pairs, with this few of you | |
| Missing data | not in any source, not recorded, genuinely unknown | |
| helps, less useful, advised, not needed, risky | rewards, punishes, favours, pays, wasted, earns its keep | the verbs in a rule name. Say what happens when a verb can: "Loud weapons draw patrols" |
| Automatons, Terminids, Illuminate | a mix of bots, bugs and squids | the names on the front buttons |

# **Spelling, Numbers, Punctuation**

- **British spelling**, as in the name: armour, armoury. A game name keeps the game's spelling.
- **Digits for every game number**: AP 3, 15 enemies, difficulty 7, 3 minutes, peril 22+, 80%.
- **Exact figures.** If the passive is 80%, write 80%. His "negates gas damage" became "resists" because Advanced Filtration is +80%.
- **Sentence case.** The small uppercase headings are uppercased by styling; write them in sentence case.
- **No em dashes.** Use a full stop, a comma, a colon or the middle dot `·`.

# **Checklist**

1. Can a veteran act on it at a glance?
2. Could it be a number, a name or a marker?
3. Is every verb literal? Does anything act, feel or "move"?
4. Is there a slogan, a joke, a little story, a punchline, or an "X, not Y"? Cut it.
5. Does it explain the game or state the obvious?
6. Does a heading, a label or another panel already say it?
7. Is it a caveat, maths, a source, history or our to-do? Move it to its layer.
8. Are these the game's words and ours from the table above?
9. No em dashes.

---

# **Worked Examples, From His Notes**

| | Before | After |
|---|---|---|
| A1 | Nothing about where you are dropping changes where this sits | No effect from this scenario. *(applied)* |
| A6 to A9 | AP 3 gets through 12 of the 15 Terminid enemies wherever you hit them. 1 of those only just... | Full damage: 11 of 15 enemies. Reduced damage: Hive Guard. Weak points only: Bile Titan, Charger and Charger Behemoth. *(applied)* |
| A12 | Opens armor: Opens armor. Kills Chargers, Hulks, Bile Titans and Factory Striders | Opens armour: Kills Chargers, Hulks, Bile Titans and Factory Striders |
| A12 | Closes bug holes and fabricators from your carried kit, without spending a call-in | Closes bug holes and fabricators without spending a stratagem |
| A12 | Our call, not a community vote. Every tier on this row is a u.gg aggregate... | *(cut)* |
| A13 | Why this scenario moves it | What affects this tier |
| A14 | +9 Terminids are mostly large fleshy parts, and durable damage is what hurts those. This one keeps most of its damage against them where a chaff gun loses it. | **+9 Durable damage helps · Terminids**, and on hover: "Big Terminids are mostly tough flesh. Weapons with high durable damage keep most of their damage against it." |
| A14 | -8 Poor ergonomics means the barrel lags behind the camera, and Hunters do not wait for you to catch up. | **-8 Slow handling hurts · Terminids**, and on hover: "Low ergonomics makes the barrel slow to follow your aim. Hunters close in fast." |
| A16 | Changed after the vote. {patch note} The tiers above were voted before this change and have not absorbed it. | Changed after the vote. {patch note} The community tier is from before this change. |
| A17 | Released 12 August 2026 in Castellan's Creed. No community rating exists yet. Re-check u.gg around early September 2026. | New in Castellan's Creed. No community rating yet. *(the warbond is filled in per item)* |
| A18 | four wheels and a Heavy Machine Gun. Someone has to drive, so it costs you a gun and a pair of hands | mounted Heavy Machine Gun |
| B1 | Against bugs the speed is the armour: what cannot catch you cannot hurt you. | Terminids attack up close. Light armour is the fastest weight. |
| B1 | A gas cloud does not care whose it is, and your armour lets you stand in yours. | Gas damages everyone, Helldivers included. Your armour resists gas damage. |
| B1 | Open, even ground, where the FRV is fast and stays on its wheels. | Flat, open ground. The FRV drives fastest here and rarely flips. |
| B2 | A storm cuts their sight as much as yours, and with this few of you this deep you are not trying to win the firefight... | A storm reduces line of sight for both sides. With a silenced weapon, enemies are less likely to find you. |
| B3 | ...everything else means putting it down first. It does not make a bad sidearm good, it makes a good one indispensable. | You carry an objective for most of this mission. A one handed weapon can fire while you carry it. |
| B4 | ...and no support weapon is no support weapon. You keep the handling and lose the half that makes it S+. | No support weapon here reloads, so True Grit's +30% support reload does nothing. Only its +20 handling applies. |
| B5 | ...They are weather rather than climate though: roughly three minutes at a time, so this is a risk you carry rather than a state you are in. | Sandstorms reduce visibility, so long range weapons are less useful. Each storm lasts about 3 minutes. |
| B6 | Alone or in pairs on a hard bot drop, quiet wins | Stealth advised · Automatons, 1 or 2 players, peril 22+ |
| B6 | Alone or in pairs on a very hard bot drop, noise costs | Loud weapons draw patrols · Automatons, 1 or 2 players, peril 28+ |
| B6 | Stealth armour is wasted on an easy drop | Stealth armour not needed · peril 0 or less |
| C2 | How hard, and how many of you · Difficulty and squad size, read together. None of these fire until you have said both. | Difficulty and squad size · These apply once you set both. |
| D1 | Nothing about how this fits together changes what the gear is worth. | Fits together fine. |

---

# **Where It Has Been Applied**

| Surface | State |
|---|---|
| The expanded tier row, the rating badge's hover, About's How the rating works | **The pilot, 9 October 2026.** |
| **Pass 1, rule text**, 1.32.0 | **Done, 9 October 2026.** All 115 rule names and sentences. A reason shows as its rule's name with the sentence on hover, in the tier row, the badge and editor slot hovers, the build reading and the Drop Bay suggestions. The build caption, the Rules page's headers and empty states, the Role footnote moved to hover, and Gear and Build plus Ground and megacities on About |
| Still to do, one surface per pass | Generated sentences (the Rules page's Applies, Looks at and Size lines, the armour arrivals line, the squad warnings); the rest of the tier row (item notes, damage type glosses, filter labels); Drop Bay; Collection; the Armoury; the war room and the Star Map; Party, Settings and About; the Rules page's judgement, source and measured notes |

> [!danger] A wording change must not move a score
> Run `npm run rules`, `npm run builds` and `npm run drop` before and after. All three must give identical output. Rule names and sentences live in the rules data and feed the tier rows, the suggestions and the Rules page at once.

# **Still Open**

- **Peril on screen.** Rule names show it as a number, so it needs its explanation on About (a placeholder is there) and a hover wherever it appears.
- **An AP table**, one reference of enemy armour per front, linked from the armour block.
- **A contact channel**, so Missing data can say where to send a source. It waits on the feedback form.
