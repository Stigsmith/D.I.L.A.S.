/* ================================================================== */
/* A BUILD IN A LINK                                                  */
/*                                                                    */
/* Share a build without a server: the build is written into the link */
/* itself, #/shared/<code>, and whoever opens it sees it and can keep */
/* a copy. It works on every address the tool lives on today. Short   */
/* links that live on the server wait for the domain, Stage 4 of the  */
/* Cloudflare handover; this needs nothing.                           */
/*                                                                    */
/* A link is somebody else's text, so it is read exactly the way a    */
/* party member's build is: every slot resolved against this          */
/* browser's own item table, and anything that is not the right kind  */
/* of item dropped rather than drawn. unpackBuild in drop.js is the   */
/* one place that does that.                                          */
/* ================================================================== */

import vocabulary from "../data/vocabulary.json";
import { unpackBuild } from "./drop.js";

/* A link is anyone's text, so the few free values a build carries are
   held to the lists the tool knows. A party build comes from this tool;
   a link could come from anywhere. */
const FRONTS = new Set(["bots", "bugs", "squids"]);
const BANDS = new Set(vocabulary.difficulties.map((d) => d.band));
const GATE_BIOMES = new Set(["hot", "cold", "foggy", "urban", "cave"]);

/* A link longer than this is not a build. Nine ids, a name and a note
   come to well under a thousand characters. */
const MAX_CODE = 4000;
const MAX_NOTE = 280;

/* Short keys, because every character is in the link. v says which
   shape, so a later one can be read alongside this one. */
const KEYS = [
  ["n", "name"], ["f", "faction"], ["p", "primary"], ["s", "secondary"], ["g", "grenade"],
  ["a", "armor"], ["b", "booster"], ["t", "strats"], ["d", "diff"], ["m", "biomes"], ["o", "blurb"],
];

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code) {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* The code for a build. Empty slots are left out rather than written as
   nothing, so a half built build makes a shorter link. */
export function shareCode(build) {
  const out = { v: 1 };
  for (const [short, long] of KEYS) {
    let value = build[long];
    if (long === "blurb") value = typeof value === "string" ? value.trim().slice(0, MAX_NOTE) : "";
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && !value.some(Boolean)) continue;
    out[short] = value;
  }
  return toBase64Url(JSON.stringify(out));
}

/* The build a code holds, cleaned against this browser's tables, or null
   when it holds nothing the tool can read. Never throws: a mangled link
   is an ordinary thing to receive. */
export function readShareCode(code) {
  if (typeof code !== "string" || !code || code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let raw;
  try {
    raw = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  const long = { id: "shared" };
  for (const [short, key] of KEYS) if (raw[short] !== undefined) long[key] = raw[short];
  if (!FRONTS.has(long.faction)) return null;
  const build = unpackBuild(long);
  if (!build) return null;
  build.diff = build.diff.filter((d) => BANDS.has(d));
  build.biomes = build.biomes.filter((b) => GATE_BIOMES.has(b));
  const blurb = typeof raw.o === "string" ? raw.o.trim().slice(0, MAX_NOTE) : "";
  return { ...build, preset: false, blurb };
}

/* The whole link, for the address this tool is open on. */
export const shareUrl = (build, origin = "") => `${origin}#/shared/${shareCode(build)}`;
