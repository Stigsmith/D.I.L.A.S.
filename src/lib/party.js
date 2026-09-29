/* ================================================================== */
/* THE LIVE PARTY, BROWSER HALF                                       */
/*                                                                    */
/* Opens or joins a party, holds the WebSocket, reconnects when the   */
/* line drops, and hands the drop screen the party as the server sees */
/* it. worker/party.ts is the other half and says what the server     */
/* promises; this file only ever trusts what it can check.            */
/*                                                                    */
/* No account, by the curator's call: a party is a code, and you are  */
/* whoever holds the token this browser made for it. Reload, drop the */
/* line, open a second tab on the same address: the same token comes  */
/* back and the server gives you your old seat.                       */
/* ================================================================== */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SETTINGS, readDoc, writeDoc } from "./storage.js";
import { presets } from "./loadouts.js";
import { readDrop, packBuild } from "./drop.js";
import { cleanScenario, sameScenario } from "./scenario.js";

/* Mirrors worker/party.ts. Read aloud over voice chat, so no 0, O, 1, I or L. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
export const SQUAD_CAP = 4;
const NAME_MAX = 24;

export function normaliseCode(raw) {
  const code = String(raw || "").toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

const cleanName = (raw) =>
  typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";

/* 32 random bytes, URL safe. The server keeps only its hash. */
function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const validToken = (t) => typeof t === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(t);

/* The endings the server announces, each with the sentence that says
   what happened. Anything else is a dropped line and worth another try. */
const FINAL = {
  4001: "That party is full. A squad is four.",
  4003: "The host removed you from the party.",
  4004: "That party has ended.",
  4029: "Too many messages too fast, so the party closed your connection. Join again to carry on.",
};

/* How long to wait before each retry. Never faster than a second, never
   slower than half a minute, because somebody is waiting to drop. */
const BACKOFF = [1000, 2000, 5000, 10000, 20000, 30000];

const NO_SERVER =
  "Parties need the tool's own server, and this address does not have one. They work on the Cloudflare address for now.";

const EMPTY_SESSION = { name: "", code: null, token: null };

function readSession() {
  const d = readDoc(SETTINGS.party);
  if (!d) return EMPTY_SESSION;
  const code = normaliseCode(d.code);
  return {
    name: cleanName(d.name),
    code: code && validToken(d.token) ? code : null,
    token: code && validToken(d.token) ? d.token : null,
  };
}

/* The server answered in its own voice: JSON. Anything else, an HTML
   page from a static host or a dev server, means there is no party server
   here at all, which deserves its own sentence. */
async function readAnswer(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) return { ours: false, body: null };
  try {
    return { ours: true, body: await response.json() };
  } catch {
    return { ours: false, body: null };
  }
}

/**
 * status   idle | opening | connecting | live | reconnecting
 * state    the party as the server last sent it, or null
 * problem  a sentence about why you are not in a party, until dismissed
 * notice   the server's last complaint about something you tried
 * epoch    counts fresh connections, so everything this browser shares is
 *          sent again after a reconnect rather than assumed to have landed
 */
export function useParty() {
  const [session, setSession] = useState(EMPTY_SESSION);
  const [status, setStatus] = useState("idle");
  const [state, setState] = useState(null);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(null);
  const [epoch, setEpoch] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => { setSession(readSession()); }, []);

  const persist = useCallback((next) => {
    writeDoc(SETTINGS.party, next);
    setSession(next);
  }, []);

  /* Out of the party, for whatever reason, keeping the name. */
  const end = useCallback((sentence) => {
    setSession((s) => {
      const next = { name: s.name, code: null, token: null };
      writeDoc(SETTINGS.party, next);
      return next;
    });
    setState(null);
    setStatus("idle");
    setProblem(sentence || null);
  }, []);

  /* The connection, alive for as long as there is a code and a token. */
  useEffect(() => {
    const { code, token, name } = session;
    if (!code || !token) return undefined;

    let stopped = false;
    let retry = 0;
    let timer = null;
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const address = `${scheme}://${window.location.host}/api/party/${code}`;

    /* A socket that closed before the party ever answered tells us nothing
       about why. Ask once over plain HTTP: a 404 means the code is dead and
       retrying is pointless; anything that is not the server's own JSON
       means there is no party server on this address at all. */
    const diagnose = async () => {
      try {
        const response = await fetch(`/api/party/${code}`);
        const { ours, body } = await readAnswer(response);
        if (!ours) return NO_SERVER;
        if (response.status === 404) return "That party has ended, or the code is wrong.";
        if (response.status === 429) return body && body.error ? body.error : "Too many tries. Wait a while and try again.";
        return null;
      } catch {
        return null;
      }
    };

    const schedule = () => {
      if (stopped) return;
      setStatus("reconnecting");
      timer = setTimeout(connect, BACKOFF[Math.min(retry, BACKOFF.length - 1)]);
      retry += 1;
    };

    function connect() {
      if (stopped) return;
      setStatus((s) => (s === "live" || s === "reconnecting" ? "reconnecting" : "connecting"));
      let ws;
      try {
        ws = new WebSocket(address);
      } catch {
        schedule();
        return;
      }
      wsRef.current = ws;
      let answered = false;

      ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token, name }));
      ws.onmessage = (event) => {
        let m;
        try { m = JSON.parse(event.data); } catch { return; }
        if (m && m.type === "state" && Array.isArray(m.members)) {
          setState(m);
          if (!answered) {
            answered = true;
            retry = 0;
            setStatus("live");
            setProblem(null);
            setEpoch((n) => n + 1);
          }
        } else if (m && m.type === "error" && typeof m.error === "string") {
          setNotice(m.error.slice(0, 200));
        }
      };
      ws.onclose = async (event) => {
        if (wsRef.current === ws) wsRef.current = null;
        if (stopped) return;
        if (FINAL[event.code]) { end(FINAL[event.code]); return; }
        if (!answered) {
          const why = await diagnose();
          if (stopped) return;
          if (why) { end(why); return; }
        }
        schedule();
      };
    }

    connect();

    /* Back from the game or back online: try now rather than at the end
       of the current wait. */
    const wake = () => {
      if (stopped || wsRef.current || document.visibilityState === "hidden") return;
      clearTimeout(timer);
      connect();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close(1000, "closing");
    };
    /* The name rides on hello; changing it does not need a new connection. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [session.code, session.token, end]);

  const send = useCallback((message) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }, []);

  const setName = useCallback((raw) => {
    setSession((s) => {
      const next = { ...s, name: String(raw || "").slice(0, NAME_MAX) };
      writeDoc(SETTINGS.party, next);
      return next;
    });
  }, []);

  const open = useCallback(async () => {
    setProblem(null);
    setNotice(null);
    setStatus("opening");
    const token = newToken();
    const name = cleanName(session.name) || "Helldiver";
    try {
      const response = await fetch("/api/party", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name }),
      });
      const { ours, body } = await readAnswer(response);
      if (!ours) { setStatus("idle"); setProblem(NO_SERVER); return; }
      if (!response.ok || !body || !normaliseCode(body.code)) {
        setStatus("idle");
        setProblem((body && body.error) || "Could not open a party. Try again in a moment.");
        return;
      }
      persist({ name, code: normaliseCode(body.code), token });
    } catch {
      setStatus("idle");
      setProblem("Could not reach the party server. Check your connection and try again.");
    }
  }, [session.name, persist]);

  const join = useCallback((raw) => {
    setNotice(null);
    const code = normaliseCode(raw);
    if (!code) {
      setProblem("A party code is six letters and numbers.");
      return;
    }
    setProblem(null);
    const name = cleanName(session.name) || "Helldiver";
    /* Rejoining the party you were in keeps your seat. */
    const token = session.code === code && session.token ? session.token : newToken();
    persist({ name, code, token });
  }, [session, persist]);

  const leave = useCallback(() => {
    send({ type: "leave" });
    end(null);
  }, [send, end]);

  const me = state ? state.members.find((m) => m.id === state.you) || null : null;
  const host = state ? state.members.find((m) => m.id === state.host) || null : null;

  return {
    status,
    code: session.code,
    name: session.name,
    setName,
    state,
    me,
    host,
    isHost: Boolean(state && state.host === state.you),
    problem,
    notice,
    epoch,
    open,
    join,
    leave,
    dismiss: useCallback(() => { setProblem(null); setNotice(null); }, []),
    shareLoadout: useCallback((build) => send({ type: "loadout", build }), [send]),
    shareScenario: useCallback((scenario) => send({ type: "scenario", scenario }), [send]),
    kick: useCallback((member) => send({ type: "kick", member }), [send]),
  };
}

/* ------------------------------------------------------------------ */
/* Keeping the party and this browser in step                          */
/*                                                                     */
/* Three things flow, and each is sent again on every fresh connection */
/* rather than assumed to have survived a dropped line:                */
/*                                                                     */
/*  - your loadout, but only once confirmed. Unconfirmed sends null,   */
/*    so the others see "Still deciding" and nothing else, which is    */
/*    the curator's call. Edit a confirmed build and it goes back to   */
/*    null on its own, because readDrop stops calling it confirmed     */
/*  - the host's scenario, out to everybody                            */
/*  - the host's scenario, in, for everybody else. Followed when the   */
/*    host changes it, not enforced: a squadmate who adjusts their own */
/*    keeps it until the host's next change, and the drop screen says  */
/*    when the two differ                                              */
/*                                                                     */
/* One more, on the host only: the squad size in the scenario is set   */
/* to how many people are in the party, since that is the true answer  */
/* to "how many of you" and it is what the peril rules read.           */
/* ------------------------------------------------------------------ */

export function usePartySync({ party, drop, loadouts, scenario, replaceScenario, setSquad }) {
  const live = party.status === "live";

  const byId = useMemo(() => {
    const map = new Map();
    for (const p of presets) map.set(p.id, { ...p, preset: true });
    for (const l of loadouts) map.set(l.id, { ...l, preset: false });
    return map;
  }, [loadouts]);

  const { mine, confirmed } = readDrop(drop, (id) => byId.get(id));
  const outgoing = confirmed ? packBuild(mine) : null;
  const outgoingKey = JSON.stringify(outgoing);
  const sentBuild = useRef(null);
  useEffect(() => {
    if (!live) return;
    const key = `${party.epoch}|${outgoingKey}`;
    if (sentBuild.current === key) return;
    sentBuild.current = key;
    party.shareLoadout(outgoing);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [live, party.epoch, outgoingKey]);

  const wire = cleanScenario(scenario);
  const wireKey = JSON.stringify(wire);
  const sentScenario = useRef(null);
  useEffect(() => {
    if (!live || !party.isHost || !wire) return;
    const key = `${party.epoch}|${wireKey}`;
    if (sentScenario.current === key) return;
    sentScenario.current = key;
    party.shareScenario(wire);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [live, party.isHost, party.epoch, wireKey]);

  const incoming = party.state ? party.state.scenario : null;
  const incomingKey = JSON.stringify(incoming);
  const followed = useRef(null);
  useEffect(() => {
    if (!live || party.isHost || !incoming) return;
    if (followed.current === incomingKey) return;
    followed.current = incomingKey;
    if (!sameScenario(incoming, scenario)) replaceScenario(incoming);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [live, party.isHost, incomingKey]);

  const size = party.state ? party.state.members.length : 0;
  useEffect(() => {
    if (live && party.isHost && size > 0 && scenario.squad !== size) setSquad(size);
  }, [live, party.isHost, size, scenario.squad, setSquad]);

  /* Whether this browser's scenario has drifted from the host's, for the
     drop screen to say so. The host by definition has not. */
  const drifted = live && !party.isHost && incoming ? !sameScenario(incoming, scenario) : false;
  return { drifted, follow: () => incoming && replaceScenario(incoming) };
}
