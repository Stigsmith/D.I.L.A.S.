/* ================================================================== */
/* THEME                                                              */
/* A theme is a token set, so switching one is a single attribute on   */
/* the root element. Nothing here forces a future theme to ship both a */
/* light and a dark variant: the 40K one is inherently dark and should  */
/* just be dark.                                                       */
/* ================================================================== */

import { useState, useEffect, useCallback } from "react";

const KEY = "hd2-theme";

/* The three base themes first, then the skins. A skin is a palette      */
/* study that reached the app: the study in Image Library/Themes/<Name>/ is */
/* the source and argues its own reasoning, so read it before arguing    */
/* with a value. Adding one is a block in index.css and a line here.     */
export const THEMES = [
  { id: "dark", label: "Dark", note: "Dark grey" },
  { id: "light", label: "Light", note: "Off white" },
  { id: "neon", label: "Neon", note: "Near black with the logo yellow" },
  { id: "castellans-creed", label: "Castellan's Creed", note: "Cadian green and gold, the first warbond skin" },
  { id: "automaton", label: "Automaton", note: "Foundry steel and warning red" },
  { id: "bile-titan", label: "Bile Titan", note: "Terminid chitin and acid" },
  { id: "entrenched-division", label: "Entrenched Division", note: "Trench olive and mustard, smoke and gas" },
  { id: "odst", label: "ODST", note: "New Mombasa at night, Superintendent green and rain" },
  { id: "hellpod-drop-bay", label: "Hellpod Drop Bay", note: "Deck plate and hazard yellow" },
  { id: "malevelon-creek", label: "Malevelon Creek", note: "Blue night and tracer fire" },
  { id: "ministry-of-truth", label: "Ministry of Truth", note: "Bureau paper and stamp navy, a light theme" },
  { id: "super-destroyer", label: "Super Destroyer", note: "Hull grey and console amber" },
  { id: "viper-commandos", label: "Viper Commandos", note: "Woodland camo with viper teal lighting" },
];

const isKnown = (id) => THEMES.some((t) => t.id === id);

export function useTheme() {
  /* Dark is the default rather than the system preference. This is a    */
  /* Helldivers tool and it has always been dark.                        */
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (isKnown(saved)) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const choose = useCallback((id) => {
    if (!isKnown(id)) return;
    setTheme(id);
    try { localStorage.setItem(KEY, id); } catch (e) { /* private mode */ }
  }, []);

  return { theme, setTheme: choose };
}
