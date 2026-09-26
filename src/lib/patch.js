/* ================================================================== */
/* WHICH GAME, AND WHICH VOTES                                        */
/*                                                                    */
/* Written once. The footer shows the short form on every page,       */
/* Support expands it, and every expanded row compares its own        */
/* rating's stamp against `game`, so none of the three can drift.     */
/*                                                                    */
/* It lived in Pages.jsx until 1.23.0, while the expanded row in      */
/* Tiers.jsx carried its own hardcoded "the game is on 7.0.0". The    */
/* two had already disagreed once by the time the game reached 7.1.1. */
/* ================================================================== */

export const PATCH = {
  game: "7.1.1",
  gameName: "Devoid of Liberty",
  /* 7.1.1 fixed crashes and changed no weapon, per third party coverage
     of the patch. The last balance changes were 7.1.0 on 22 September. */
  gameDate: "24 September 2026",
  /* u.gg dates each list separately. Primaries 7.1.1; support weapons,
     backpacks, eagles and sentries 7.0.2; the other six print no stamp
     and already hold 7.1.0 content, so they read as 7.1.0. See
     scripts/apply-ugg-7-1.mjs. */
  ratings: "7.0.2 to 7.1.1",
  armor: "7.1.0",
  /* When the ratings were last read off u.gg. */
  readOn: "26 September 2026",
};

export const PATCH_SHORT = `Patch ${PATCH.game} · ratings ${PATCH.ratings}`;
