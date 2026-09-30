/* ================================================================== */
/* THE LIVE WAR, AS THIS BROWSER HOLDS IT                             */
/*                                                                    */
/* Asks the tool's own server for the war snapshot while a map is on  */
/* screen, once a minute, and hands back what galaxy.js cleaned out   */
/* of it. The server fetches the community API every five minutes and */
/* keeps the answer; this never talks to anybody else, which is also  */
/* what the security policy allows.                                   */
/*                                                                    */
/* The API decorates, it never carries. With no server here, as under */
/* npm run dev or on Netlify, or with the server down, this returns   */
/* null and the map draws uncoloured. No spinner, no error, and no    */
/* network call on the path to choosing a planet.                     */
/* ================================================================== */

import { useState, useEffect, useMemo } from "react";
import { cleanWar } from "./galaxy.js";

/* The snapshot moves every five minutes and the server lets a browser
   keep it for one, so asking more often than this buys nothing. */
const EVERY_MS = 60 * 1000;

/* The last answer, kept for the session, so reopening a map draws it at
   once while it asks again. */
let last = null;

export function useWar(active = true) {
  const [raw, setRaw] = useState(last);
  /* The clock the age is judged against. It moves on every ask, so a
     snapshot the server stopped refreshing ages on screen, and stops
     being drawn once it is too old to trust. */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    let stop = false;
    let timer = null;
    const again = () => {
      if (!stop) timer = setTimeout(load, EVERY_MS);
    };
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return again();
      try {
        const res = await fetch("/api/war", { headers: { accept: "application/json" } });
        /* Where there is no server the answer is the app's own page, so
           the content type is what tells a snapshot from a fallback. */
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.includes("application/json")) {
          const body = await res.json();
          if (!stop) {
            last = body;
            setRaw(body);
          }
        }
      } catch {
        /* A dropped line. Keep what we had; its age will say the rest. */
      }
      if (!stop) setNow(Date.now());
      again();
    }
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [active]);

  return useMemo(() => cleanWar(raw, now), [raw, now]);
}

/* How long until, the way a person says it. */
export function untilText(ms) {
  const hours = Math.floor(ms / 3600000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 24) return hours - 24 === 0 ? "a day" : `a day and ${hours - 24} hour${hours - 24 === 1 ? "" : "s"}`;
  if (hours >= 1) return hours === 1 ? "an hour" : `${hours} hours`;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

/* How long ago, the way a person says it. */
export function agoText(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
