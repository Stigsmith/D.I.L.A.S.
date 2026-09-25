/* ================================================================== */
/* ACCOUNT                                                            */
/*                                                                    */
/* Reachable only while ACCOUNTS_LIVE in src/lib/account.js is true.  */
/* Until then the sidebar keeps its "v2" tag and the route is         */
/* refused, and that is honest: an account with no password reset is */
/* a trap with a nice form on it, and at Stage 1 an account carries  */
/* nothing yet.                                                       */
/*                                                                    */
/* **The copy below is written for what an account does today, which */
/* is exist.** When Stage 3 sync lands it carries locks, favorites,   */
/* profiles and builds between devices, and the "What it does" panel  */
/* changes with it. A sentence that outlives its truth is the thing   */
/* Enodia's retired claims check exists to catch.                     */
/*                                                                    */
/* Why the forms are real <form>s: Enter submits and password         */
/* managers recognise them. preventDefault means they never navigate, */
/* and public/_headers sets form-action 'none', so if the script ever */
/* failed the browser would refuse the submit rather than post a      */
/* password anywhere. It fails closed.                                */
/* ================================================================== */

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserPlus, AlertTriangle } from "lucide-react";

import { Panel } from "./Pages.jsx";
import { capabilities, currentAccount, signIn, signOut, signUp } from "./lib/account.js";

const MODES = [
  { id: "in", label: "Sign in", Icon: LogIn },
  { id: "up", label: "Create an account", Icon: UserPlus },
];

const FIELD =
  "w-full rounded border border-base-700 bg-base-900 px-2.5 py-2 text-sm text-base-100 placeholder-base-600 outline-none focus:border-base-500";

function Field({ label, hint, ...input }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500"
        style={{ fontFamily: "'Oswald', sans-serif" }}>{label}</span>
      <input className={FIELD} {...input} />
      {hint ? <span className="text-[11px] leading-relaxed text-base-500">{hint}</span> : null}
    </label>
  );
}

const BUTTON =
  "flex items-center justify-center gap-1.5 rounded border border-base-200 bg-base-200 px-3 py-2 text-xs font-semibold text-base-900 hover:bg-base-100 disabled:cursor-default disabled:opacity-50";

export default function Account() {
  const [who, setWho] = useState(null);
  /* False while the first check is in flight, so the sign in form does not
     flash up for somebody who is already signed in. */
  const [checked, setChecked] = useState(false);
  const [canReset, setCanReset] = useState(false);

  const [mode, setMode] = useState("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([currentAccount(), capabilities()]).then(([account, caps]) => {
      if (!live) return;
      setWho(account);
      setCanReset(Boolean(caps.passwordReset));
      setChecked(true);
    });
    return () => { live = false; };
  }, []);

  const go = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const outcome = mode === "up"
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password);
    if (!outcome.ok) {
      setError(outcome.say);
      setBusy(false);
      return;
    }
    /* The password is not kept around once it has been used. */
    setPassword("");
    setWho(await currentAccount());
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    await signOut();
    setWho(null);
    setBusy(false);
  };

  const whatItDoes = (
    <Panel title="What an account does">
      <p>
        Nothing yet, and it is worth saying so plainly. It exists so the next things can: carrying your locks,
        favorites, profiles and builds between devices, and sharing a build with a short link.
      </p>
      <p>
        None of that is needed to use the tool. Everything still lives in this browser and works signed out, and
        Export in Settings is still how you move it by hand.
      </p>
      <p>The only things kept about you are the name and email you type here, and a signed in session.</p>
    </Panel>
  );

  if (!checked) {
    return <p className="text-sm text-base-500">Checking whether you are signed in.</p>;
  }

  if (who) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <Panel title="Signed in">
          <p>
            <span className="text-base-100">{who.name}</span>
            <br />
            <span className="text-base-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{who.email}</span>
          </p>
          <div>
            <button type="button" onClick={leave} disabled={busy} className={BUTTON}>
              <LogOut className="h-3.5 w-3.5" /> {busy ? "Signing out" : "Sign out"}
            </button>
          </div>
          <p className="text-[11px] text-base-500">
            Signing out touches nothing in this browser. Your locks, favorites, profiles and builds stay exactly where
            they are.
          </p>
        </Panel>
        {whatItDoes}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Panel title="Account" note="You do not need one to use any of this.">
        <div className="flex gap-1.5" role="tablist" aria-label="Sign in or create an account">
          {MODES.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id}
              onClick={() => { setMode(id); setError(null); }}
              className={"flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors " +
                (mode === id
                  ? "border-base-200 bg-base-200 text-base-900"
                  : "border-base-700 bg-base-900 text-base-400 hover:border-base-500 hover:text-base-100")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <form onSubmit={go} className="flex flex-col gap-3">
          {mode === "up" ? (
            <Field label="Name" type="text" autoComplete="nickname" required
              value={name} onChange={(e) => setName(e.target.value)} />
          ) : null}
          <Field label="Email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" required minLength={8}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            hint={mode === "up" ? "Eight characters at least. Use a password manager." : null}
            value={password} onChange={(e) => setPassword(e.target.value)} />

          {error ? (
            <p role="alert" className="rounded border border-red-800/70 bg-red-950/40 px-2.5 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <div>
            <button type="submit" disabled={busy} className={BUTTON}>
              {busy ? "Working" : MODES.find((m) => m.id === mode).label}
            </button>
          </div>
        </form>

        {/* Asked of the server rather than assumed, because whether a mail
            provider exists is not something the browser can know. */}
        {canReset ? null : (
          <p className="flex items-start gap-2 rounded border border-accent-800/60 bg-accent-950/40 px-2.5 py-2 text-[11px] leading-relaxed text-accent-300">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              There is no password reset yet. If you forget this password nobody can recover the account, so keep it in
              a password manager.
            </span>
          </p>
        )}
      </Panel>
      {whatItDoes}
    </div>
  );
}
