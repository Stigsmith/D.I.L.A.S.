/* ================================================================== */
/* THE PARTY MENU                                                     */
/*                                                                    */
/* Top right, next to the profile switcher, on every page: the        */
/* curator's call, 1 October 2026, the way the game keeps your squad  */
/* in a corner rather than on one screen. The party was always app    */
/* wide underneath (your confirmed build reaches it from anywhere,    */
/* the host's scenario reaches you anywhere); only its controls lived */
/* on Drop Bay. They live here now, and Drop Bay keeps one line that  */
/* opens this.                                                        */
/*                                                                    */
/* This is also where friends and finding a group will live once      */
/* accounts exist. The panel says so rather than showing a locked     */
/* menu entry for them.                                               */
/* ================================================================== */

import { useEffect, useRef, useState } from "react";
import { Radio, Copy, Check, LogOut, Crown, X, AlertTriangle, Info, Rocket, Users, Loader2 } from "lucide-react";

import { SQUAD_CAP } from "./lib/party.js";
import { unpackBuild } from "./lib/drop.js";

const OSWALD = { fontFamily: "'Oswald', sans-serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const STATUS_LINE = {
  opening: "Opening a party",
  connecting: "Joining",
  reconnecting: "Connection lost. Reconnecting",
};

/* The button in the header. Squad up when you are on your own; the code
   and a dot per seat when you are in one, so who is here is readable
   from any page without opening anything. */
export function PartyButton({ party, open, onToggle, compact = false }) {
  const inParty = Boolean(party.code);
  const members = party.state ? party.state.members : [];
  const live = party.status === "live";
  return (
    <button onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" data-tour="party"
      title={inParty ? `Party ${party.code}` : "Play with friends: share a party code"}
      className={"flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors " +
        (open ? "border-base-500 bg-base-800 text-base-100" : "border-base-700 bg-base-900 text-base-300 hover:border-base-500 hover:text-base-100")}>
      {inParty && !live ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-400 motion-reduce:animate-none" />
        : <Radio className={"h-3.5 w-3.5 " + (inParty ? "text-emerald-400" : "")} />}
      {inParty ? (
        <>
          <span className="tracking-widest" style={MONO}>{party.code}</span>
          <span className="flex gap-0.5" aria-label={`${members.length} of ${SQUAD_CAP}`}>
            {Array.from({ length: SQUAD_CAP }, (_, i) => {
              const m = members[i];
              return <span key={i} className={"h-1.5 w-1.5 rounded-full " + (!m ? "bg-base-700" : m.online ? "bg-emerald-400" : "bg-base-500")} />;
            })}
          </span>
        </>
      ) : compact ? null : (
        <span>Squad up</span>
      )}
    </button>
  );
}

function MemberRow({ member, isHost, isYou, canRemove, onRemove }) {
  const [sure, setSure] = useState(false);
  const build = member.build ? unpackBuild(member.build) : null;
  return (
    <div className="flex items-center gap-2 rounded bg-base-900/70 px-2 py-1.5">
      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (member.online ? "bg-emerald-400" : "bg-base-600")}
        title={member.online ? "Connected" : "Not connected right now"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-base-100">
          <span className="truncate">{member.name}</span>
          {isYou ? <span className="text-[10px] text-base-500">you</span> : null}
          {isHost ? <Crown className="h-3 w-3 shrink-0 text-brand" aria-label="Host" /> : null}
        </span>
        <span className={"block truncate text-[10px] " + (build ? "text-base-400" : "text-base-600")}>
          {build ? build.name : "Still deciding"}
        </span>
      </span>
      {canRemove ? (
        sure ? (
          <span className="flex shrink-0 gap-1">
            <button onClick={onRemove} className="rounded border border-red-700 px-1.5 py-0.5 text-[10px] text-red-300 hover:border-red-500">Remove</button>
            <button onClick={() => setSure(false)} className="rounded border border-base-700 px-1.5 py-0.5 text-[10px] text-base-300">Keep</button>
          </span>
        ) : (
          <button onClick={() => setSure(true)} title={`Remove ${member.name} from the party`}
            className="shrink-0 rounded p-1 text-base-500 hover:bg-base-800 hover:text-red-400">
            <X className="h-3.5 w-3.5" />
          </button>
        )
      ) : null}
    </div>
  );
}

/* The panel. Fixed under the top chrome, right aligned, so it is the same
   thing on every page. Escape or a click outside closes it. */
export function PartyPanel({ party, sync, onClose, onDropBay }) {
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const box = useRef(null);
  const inParty = Boolean(party.code);
  const busy = party.status === "opening" || party.status === "connecting";

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target) && !e.target.closest("[aria-haspopup=dialog]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(party.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* No clipboard here. The code is on screen to read out anyway. */
    }
  };

  const members = party.state ? party.state.members : [];
  const line = party.status === "live"
    ? `${members.length} of ${SQUAD_CAP}. ` + (party.isHost
      ? "You set the scenario."
      : party.host ? `Following ${party.host.name}'s scenario.` : "")
    : `${STATUS_LINE[party.status] || "Connecting"}...`;

  return (
    <div ref={box} role="dialog" aria-label="Party"
      className="fixed right-2 z-40 w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-base-700 bg-base-950/95 p-4 shadow-2xl backdrop-blur sm:right-4"
      style={{ top: "calc(var(--shell-chrome, 56px) + 0.5rem)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-base-400" />
        <p className="flex-1 text-sm font-bold uppercase tracking-wide text-base-100" style={OSWALD}>Party</p>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-base-500 hover:bg-base-800 hover:text-base-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!inParty ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-base-500">
            Open a party and share its code, or join with a friend's code. Each player's dropped loadout shows on Drop Bay,
            and everyone follows the host's scenario. No account needed.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-base-500">Your name</span>
            <input value={party.name} onChange={(e) => party.setName(e.target.value)} placeholder="Helldiver" maxLength={24}
              className="rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-base-100 placeholder-base-600 outline-none focus:border-base-500" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={party.open}
              className="flex items-center gap-1.5 rounded border border-base-200 bg-base-200 px-2.5 py-1.5 text-xs text-base-900 hover:bg-base-100">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Radio className="h-3.5 w-3.5" />}
              {party.status === "opening" ? "Opening" : "Open a party"}
            </button>
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); party.join(typed); }}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="CODE" maxLength={9} aria-label="Party code"
                autoCapitalize="characters" spellCheck={false}
                className="w-24 rounded border border-base-700 bg-base-900 px-2 py-1.5 text-xs uppercase tracking-widest text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                style={MONO} />
              <button type="submit" className="rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
                Join
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-[0.25em] text-base-100" style={MONO}>{party.code}</span>
            <button onClick={copy}
              className="flex items-center gap-1 rounded border border-base-700 px-2 py-1 text-[11px] text-base-300 hover:border-base-500 hover:text-base-100">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-base-500">{line}</p>
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isHost={party.state && m.id === party.state.host}
                isYou={party.state && m.id === party.state.you}
                canRemove={party.isHost && party.state && m.id !== party.state.you} onRemove={() => party.kick(m.id)} />
            ))}
            {Array.from({ length: Math.max(0, SQUAD_CAP - members.length) }, (_, i) => (
              <div key={`seat-${i}`} className="rounded border border-dashed border-base-800 px-2 py-1.5 text-[10px] text-base-600">
                Open seat
              </div>
            ))}
          </div>
          {sync.drifted ? (
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-accent-400">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Your scenario differs from the host's.
              <button onClick={sync.follow} className="underline hover:text-accent-300">Follow the party</button>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button onClick={onDropBay}
              className="flex items-center gap-1.5 rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-300 hover:border-base-500 hover:text-base-100">
              <Rocket className="h-3.5 w-3.5" /> The squad on Drop Bay
            </button>
            <button onClick={party.leave}
              className="ml-auto flex items-center gap-1.5 rounded border border-base-700 px-2.5 py-1.5 text-xs text-base-400 hover:border-red-600 hover:text-red-400">
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          </div>
        </div>
      )}

      {party.problem ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-accent-400">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /><span className="flex-1">{party.problem}</span>
          <button onClick={party.dismiss} aria-label="Dismiss" className="text-base-500 hover:text-base-200"><X className="h-3.5 w-3.5" /></button>
        </p>
      ) : null}
      {party.notice ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-base-400">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" /><span className="flex-1">{party.notice}</span>
          <button onClick={party.dismiss} aria-label="Dismiss" className="text-base-500 hover:text-base-200"><X className="h-3.5 w-3.5" /></button>
        </p>
      ) : null}

      <p className="mt-4 border-t border-base-800 pt-3 text-[10px] leading-relaxed text-base-600">
        Friends and group finding come with accounts. For now, share a code.
      </p>
    </div>
  );
}
