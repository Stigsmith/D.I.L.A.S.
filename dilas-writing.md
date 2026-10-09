# **D.I.L.A.S.: Writing Guide**

> How every word on screen is written and where it sits. Draft v0, 9 October 2026, built from the curator's notes on real lines from the tool. Round 2 will test it on fresh lines. The open samples are in `docs/writing/round-1.md`.

---

# **Who Reads It**

Mostly Helldivers veterans, a hardcore community. They know the game better than the tool does, so **never explain the game to them**. They come to find out what to bring. Only a few want to know how the tool got there.

# **Voice**

Plain, direct, short. Write it the way you would say it to a squadmate.

**The Ministry voice is only for the tour and the changelog**, for now.

---

# **Don't**

| Habit | Before | After |
|---|---|---|
| Showing off: aphorisms, a "clever" closing line | "hitting the right spot is the whole job" | "Weak points only" |
| Writing as if things act | "Armor somewhere on them turns this away" | "Heavy armour on part of the body. Hit the weak points." |
| "X, not Y" and "X rather than Y" | "genuinely unknown rather than merely unlisted" | "Missing data" |
| Answering an objection nobody raised | "This does not move the rating. Almost every primary reads the same here, so..." | cut, or one short line on hover |
| Explaining what the tool cannot do, right there in the text | "Projectile count is not in any source this project has either" | a **Missing data** marker, with a hover |
| Repeating a caveat on every panel | "Ours, not a community vote" five times | once, in About's How the rating works |
| Showing the maths inline | "Roughly 14 points is one tier, and no scenario can move a rating by more than two" | About's How the rating works |
| Sentences so dense you read them four times | "Nothing about how this fits together changes what the gear is worth" | "Fits together fine" |
| One sentence doing three jobs | three ideas joined by commas and colons | one idea per sentence |
| Explaining the UI inside the UI | "Open one to see what it does and exactly what it moves right now" | let the design show it, with a glow or a pulse marker; the tour covers the rest |
| Repeating the visible label | the heading says "Why this scenario moves it", then a footnote says it again | the heading is enough |
| Several values crammed into one field | "Leaves your backpack free / not recorded / This is the backpack" | one short value per field: "Free" |

# **Do**

- **Give the answer first**, in the fewest words that are still clear. A number beats a sentence.
- **Name things**: "Bile Titan, Charger and Charger Behemoth", not "3 of 15".
- **Use plain cause and effect**: "Heavy armour on part of the body. Hit the weak points."
- **Keep labels and values short.** Glosses, sources and caveats go in a tooltip.
- **Mark a gap, do not explain it**: the Missing data chip, with the detail on hover.

---

# **Layers: Where Each Kind Of Information Lives**

| Layer | What goes there | Example |
|---|---|---|
| **At first glance** | The answer: a tier, a number, a verdict, a warning title | `S`, `70%`, "No crowd clear" |
| **One click away** (expanded row, open card) | The reason, one line per fact | "+9 Durable damage pays off on bugs" |
| **Hover**, with `Tip` from `src/Tip.jsx` | What a term means, where a number came from, why something is missing | "Share of damage that still counts against tough flesh" |
| **About, How the rating works** | The maths, the sources, the limits, the full list of missing data | points per tier, the two tier cap, how armour is counted |

> [!danger] A hover never holds the only copy of anything you need to decide what to bring
> If the hover spot is already taken by something more important, the text goes to About instead.

**Use `Tip`, not `title=`.** The browser's own tooltip is slow, unstyled and missing on a phone. A label that has a tip gets the dotted underline, `HAS_TIP`. A missing value is `<MissingData />`, or `Fact`'s `missing` prop in the expanded row. The rest of the tool still uses `title=` and moves over one surface at a time.

---

# **Length**

| Kind | Limit |
|---|---|
| Label, button, chip | 1 to 4 words |
| Field value | a number plus at most 3 words |
| Reason line, rule sentence | one sentence, about 15 words |
| Empty state | 2 short sentences: what is missing, then what to do |
| Warning | a title of up to 5 words, then one sentence |
| Tooltip | up to 2 short sentences |

---

# **Checklist For Any New Text**

1. Can a veteran act on it at a glance?
2. Could it be a number, a name or a marker instead?
3. Does a heading or label nearby already say it?
4. Is it a caveat, a source or maths? It goes on hover or on About.
5. No "X, not Y". No clever closing line. Things do not act.
6. No em dashes.

---

# **Where It Has Been Applied**

| Surface | State |
|---|---|
| The expanded tier row and the rating badge's hover | Done, 9 October 2026. The pilot |
| About, How the rating works | New, holds what left the row |
| Everything else | Not yet. One surface per pass: rule sentences, generated sentences, Drop Bay, Collection, the Armoury, the war room, the Star Map, Party, Settings, then the Rules page |

> [!danger] A wording change must not move a score
> Run `npm run rules`, `npm run builds` and `npm run drop` before and after. All three must give identical output. Rule sentences live in the rules data and feed rows, suggestions and the Rules page at once.

# **Open Questions**

- **What is our column called?** The curator wrote "dilas tier". Once it is settled, use that name everywhere instead of "ours" or "our reading".
- **Rule internals** (`judgement`, `source`, `measured`) are for players and stay on the Rules page, rewritten under this guide.
- **Peril is never explained on screen.** It has a placeholder in How the rating works.
- **An AP table**, one reference of enemy armour per front, linked from the armour block. The block links to How the rating works until the table exists.
- **"Tell us" on missing data** waits for a contact channel. The feedback form is deferred.
