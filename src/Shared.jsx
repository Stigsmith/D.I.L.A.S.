/* ================================================================== */
/* A BUILD SOMEBODY SENT YOU                                          */
/*                                                                    */
/* #/shared/<code>: the build a link carries, read against your own   */
/* scenario, with the two things you might want to do with it. Keep  */
/* a copy in your Armoury, or keep it and drop with it tonight.       */
/*                                                                    */
/* Nothing here trusts the link. lib/share.js cleans it against this  */
/* browser's own tables first, and a link that holds nothing usable   */
/* says so rather than drawing half a build.                          */
/* ================================================================== */

import { useMemo } from "react";
import { Link2, Save, Rocket, AlertTriangle } from "lucide-react";

import { LoadoutCard } from "./Tiers.jsx";
import { readShareCode } from "./lib/share.js";
import { emptyLoadout, deriveHeat } from "./lib/loadouts.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };

export default function Shared({ code, state, scenario, navigate, onUseForDrop }) {
  const build = useMemo(() => readShareCode(code), [code]);

  if (!build) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-base-700 px-4 py-10 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-accent-400" />
        <p className="mt-2 text-sm text-base-300">This link does not contain a readable build.</p>
        <p className="mt-1 text-xs text-base-500">It may have been cut short when copied. Ask for it again.</p>
        <button onClick={() => navigate("bay")}
          className="mx-auto mt-3 rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
          Go to Drop Bay
        </button>
      </div>
    );
  }

  /* A copy of your own, under a fresh id, so keeping the same link twice
     makes two builds rather than one overwriting the other. */
  const keep = () => {
    const fresh = emptyLoadout(build.faction);
    const copy = { ...fresh, ...build, id: fresh.id, preset: false, forkedFrom: null, updatedAt: fresh.updatedAt };
    state.saveLoadout({ ...copy, heat: deriveHeat(copy) });
    return copy.id;
  };
  const filled = [build.primary, build.secondary, build.grenade, build.armor, build.booster, ...build.strats].filter(Boolean).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="rounded-lg border border-base-800 bg-base-900/60 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-base-200" style={OSWALD}>
          <Link2 className="h-4 w-4 text-brand" /> A build somebody shared with you
        </p>
        <p className="mt-1 text-xs leading-relaxed text-base-500">
          Rated for your scenario.
          {filled < 9 ? ` ${9 - filled} ${9 - filled === 1 ? "slot is" : "slots are"} empty: left empty, or holding gear this version does not know.` : ""}
        </p>
        {build.blurb ? <p className="mt-2 text-xs italic leading-relaxed text-base-300">"{build.blurb}"</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => { const id = keep(); navigate(`builder/${id}`); }}
            className="flex items-center gap-1.5 rounded border border-base-700 px-3 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
            <Save className="h-3.5 w-3.5" /> Keep a copy in my Armoury
          </button>
          <button onClick={() => { const id = keep(); onUseForDrop(id); }}
            className="flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-1.5 text-xs text-base-900 hover:bg-base-100">
            <Rocket className="h-3.5 w-3.5" /> Keep it and drop with it
          </button>
        </div>
      </div>

      <LoadoutCard loadout={{ ...build, heat: deriveHeat(build) }} rankLabel="Shared with you"
        scenario={scenario} lockedSet={state.lockedSet} />
    </div>
  );
}
