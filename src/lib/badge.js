/* ================================================================== */
/* BADGE STYLE                                                        */
/*                                                                    */
/* How the tier badge is finished. Its own file, and its own storage,  */
/* because the design document is emphatic on one point:              */
/*                                                                    */
/* > FINISH IS NOT THEME.                                             */
/*                                                                    */
/* The app has a theme picker carrying eleven warbond skins. This is   */
/* a narrower setting that touches only the badge. Picking a warbond   */
/* skin must never move somebody's badge finish, and the two words     */
/* must never be used interchangeably in code, in props or in copy.    */
/* Keeping them in separate files and separate keys is what makes      */
/* that structural rather than a rule somebody has to remember.        */
/* ================================================================== */

import { useState, useCallback, useEffect } from "react";
import { SETTINGS, readSetting, writeSetting, readDoc, writeDoc } from "./storage.js";
import { FINISH_IDS, DEFAULT_FINISH, DEFAULT_SURFACE } from "../TierBadgePlate.jsx";

export function useBadgeStyle() {
  const [finish, setFinishState] = useState(DEFAULT_FINISH);
  const [surface, setSurfaceState] = useState(DEFAULT_SURFACE);

  /* Read after mount rather than in the initialiser, the same shape    */
  /* every other preference in this app uses, so nothing touches        */
  /* localStorage during render.                                        */
  useEffect(() => {
    const savedFinish = readSetting(SETTINGS.badgeFinish, FINISH_IDS, null);
    if (savedFinish) setFinishState(savedFinish);

    const savedSurface = readDoc(SETTINGS.badgeSurface);
    if (savedSurface && typeof savedSurface === "object") {
      /* Merged over the default rather than trusted, so a toggle added */
      /* later does not read as undefined against state written before  */
      /* it existed.                                                    */
      setSurfaceState({
        sheen: typeof savedSurface.sheen === "boolean" ? savedSurface.sheen : DEFAULT_SURFACE.sheen,
        glow: typeof savedSurface.glow === "boolean" ? savedSurface.glow : DEFAULT_SURFACE.glow,
        grain: typeof savedSurface.grain === "boolean" ? savedSurface.grain : DEFAULT_SURFACE.grain,
      });
    }
  }, []);

  const setFinish = useCallback((id) => {
    if (!FINISH_IDS.includes(id)) return;
    setFinishState(id);
    writeSetting(SETTINGS.badgeFinish, id);
  }, []);

  const toggleSurface = useCallback((key) => {
    setSurfaceState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeDoc(SETTINGS.badgeSurface, next);
      return next;
    });
  }, []);

  return { finish, setFinish, surface, toggleSurface };
}
