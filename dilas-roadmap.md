# **D.I.L.A.S.: Roadmap**

> Everything still open, and what each item waits on. Finished work lives in `src/data/changelog.json` and git history, and how the tool works lives in `CLAUDE.md`. When an item ships, delete its line here, then check `src/data/roadmap.json`, the public summary, still reads true.

---

## Waiting on the curator

> [!danger] Accounts stay shut until a forgotten password has a way back
> An account you can be locked out of for good is a trap. Password reset has to work end to end first: the letter sends, the link lands on a real screen, and the new password takes.

- **Password reset (Stage 2).** Create a Resend account (the same one Enodia uses), verify a sending subdomain of dilas.me in it, and pick the `MAIL_FROM` address. Then set the `RESEND_API_KEY` secret and wire up `worker/email.ts`. Enodia's records sit on `send.enodia.me` so the apex SPF never had to change, and this should do the same
- **Turn accounts on**, by flipping `ACCOUNTS_LIVE` in `src/lib/account.js`. Only after reset works, and arguably only after sync, since an account does nothing until then. A major bump, 2.0.0
- **The edge rate-limit rule.** A Cloudflare dashboard rule in front of `/api/*`, which rejects before the Worker runs. Free
- **A contact mailbox** on dilas.me for `SUPER_CONTACT`, in place of the site address
- **Netlify.** Switch it off once nobody uses the old address. Turn off `workers_dev` in `wrangler.jsonc` the same way
- **Product calls** that block work further down:
  - Do profiles survive accounts? The recommendation is to keep them separate: a profile is what one player owns, an account is who you are. Sync is where this has to be decided
  - What counts as a run and a clear? Leaderboards cannot exist until this is answered
  - Moderation, before anything discoverable ships. Builds carry free text notes. And if Exchange lets people rate builds, who may vote: open voting is unusable within a week
  - Rating disagreements between sources. The SG-8 Punisher Plasma is S+ on u.gg and B on GamesRadar; the tool shows only u.gg. Averaging would lose the most useful signal, so if it is ever shown, show both
  - Three defaults applied in 1.31.0 for him to overturn: the Autocannon is not `close-blast`, the Stalwart gets +2 beside True Grit, and the expendable-beside-a-support-weapon warning moves no points
  - A ceiling for gear the game refuses. A reinforcement booster on a Commando mission reads B, because two tiers is the most a scenario may move anything
  - Whether switched-off rules go into the export
  - Whether melee weapons get joined to the game tables by hand, and whether vehicles and exosuits do (the game splits each one into its guns)
  - Corrections to the terrain table in `vocabulary.json`, which is a draft
  - Whether the game's own patch notes belong on About
  - The accent disagreement: several theme studies paint their signature colour on the lock. The rule says the accent is never the brand colour. Settle it if the skins are ever redrawn

## Waiting on a source

- **Planet effects in the ratings.** The real prize of the live war. `api.helldivers2.dev`'s tidy endpoints carry none. Only `/raw/api/WarSeason/801/Status` holds `planetActiveEffects`, and it has been unreliable. Definitions are in `effects/planetEffects.json` in `helldivers-2/json`. The variant enemies in `enemies.json` switch on from the same list. Re-ranking lists with it is the curator's call, with measurements in front of him
- **filediver's explosion, beam and hit-zone tables** no longer decode after a patch. When they do: `npm run game -- --refresh`, then extend `scripts/data/game-ids.json` to grenades, eagles, orbitals, mines, lasers, arc weapons and enemy armour
- **Ratings:** the P/40-K Bolt Pistol has none yet, and the P-33 Missile Pistol keeps a 6.3.1 rating until u.gg lists it again
- **Data:** the TD-110 Maelstrom has no wiki data; the G-8 Immolation has no armour penetration or demolition of its own (the wiki's AP 0 looks like the burn, and was not copied)
- **Inferences from 1.23.0, to correct when a source says otherwise:** the LAS-12 Sai is recorded as Superstore from the icon u.gg shows beside it; the P-34 Breacher's damage type is `fire`, and it has no objective role pending its demolition figure
- **Art:** the eleven items added in 1.23.0, Electrical Conduit, and the Ironclad Democracy cover. The curator adds art
- **Rules held back until a source says:** whether Med-Kit lengthens Experimental Infusion; Localization Confusion and squad size; the Hover Pack on steep ground; whether the Shield Generator Pack stops your own blast throwing you; whether a Solo Silo keeps firing through an ion storm or a jammer
- **Per-planet mission lists.** The drop planner narrows missions by front, because nothing says which planets offer which missions
- **Which part of a planet a mission is on.** The city rules guess from the planet, at half weight, until this exists
- **"What has run here"**, the missions played on a planet, for the Star Map's intel. No source

## Buildable, not started

### The server track, after accounts

Port from Enodia in `C:\Dev\Enodia`, where the code and its docblocks are the source. Read those files before writing anything.

| Stage | What | Enodia files |
|---|---|---|
| **3, sync** | Log in elsewhere and your collection is there. One table, one `POST /api/sync`, newest wins per item, tombstones never deleted, an explicit list of synced keys. Loadouts as one item each, the other keys whole. Must not remount the screen | `worker/sync.ts`, `src/state/sync.ts`, `stamps.ts`, `useSync.ts` |
| **4, publishing and short links** | A build at `/b/<id>`. The server never reads a build. Taking down is a timestamp, never a delete | `worker/publish.ts`, `src/state/publish.ts` |
| **5, Exchange, friends, LFG, leaderboards** | Browse other people's builds and keep them; friends by code, never by search; boards that count and never combine two numbers; stats keyed per build version; user ids never sent to the browser; an author cannot take or rate their own build. The party menu is where friends and LFG will live | `worker/exchange.ts`, `friends.ts`, `boards.ts`, and their `src/state` halves |

Also on this track: saving a squadmate's build straight from their party slot (it wants Exchange's write path), "what other people are taking here" on Drop Bay, and a bug and feature request form on Support, which needs somewhere for a submission to go.

### On its own

- **Replace the 39 curated builds.** They are legacy AI generations, and are to be binned and rebuilt by a separate tool that reads this project's data and writes `loadouts.json`. `readBuild` is the validator and `check-builds.mjs` already generates and scores legal builds; what is missing is the steering, with variety as a hard constraint (no item in more than N builds, every A or better item on a front used at least once). When the set changes, rewrite the citations of the 39 in `build-rules.json` and rerun `npm run builds`. Two known faults in the current set disappear with it: True Grit is in none of them, though it is S+ on every front, and `bugs-blender` is marked `fire: false` while carrying the most committed fire kit of the lot. **This is not the auto-calibration that was declined**
- **The roll-the-dice generator** in the builder: a roll you ask for, that does not just take the top item in every slot, with playstyle options. Parked until the coverage logic is good enough to be worth rolling
- **A wider warning set**, as a design session first: what else kills a run; whether range band and ammo economy become tagged axes; whether difficulty scales thresholds rather than gating them
- **Superstore and event armour sets have no lock of their own.** Sets from a warbond lock with it; the others need a per set lock in Collection, which touches the profile shape
- **In a party, suggest boosters nobody has brought**, rather than only warning about duplicates after
- **The Armoury's Builds grid still filters on the five old internal mission ids**, while the scenario uses the 70 real missions. They should become one thing
- **Re-cut two masthead banners** as JPG: Hellpod Drop Bay and Super Destroyer still ship PNGs of about 650 KB each, where a JPG cut is under 100 KB. See CLAUDE.md, "Cutting a masthead banner"
- **The seven Void planets** with no map coordinates (Hydrobius (Void), Senge 23 (Void) and the five UVP entries)
