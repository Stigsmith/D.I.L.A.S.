/* ================================================================== */
/* THE ACCOUNT, FROM THE BROWSER'S SIDE                               */
/*                                                                    */
/* worker/ is the other half. Everything here is a same origin fetch  */
/* under /api/, which is why public/_headers still says               */
/* connect-src 'self' with nothing added to it.                       */
/*                                                                    */
/* Ported from Enodia's src/state/account.ts in C:\Dev\Enodia, minus */
/* the sync and password reset halves, which arrive with Stages 3 and */
/* 2 of dds-cloudflare-handover.md.                                   */
/*                                                                    */
/* The gate is loose on purpose. **Viewing is free, creating is free, */
/* saving locally is free.** Nothing in the tool proper asks who you  */
/* are, and every screen works with no account at all: locks,         */
/* favorites, profiles and builds are still read from localStorage.   */
/* ================================================================== */

/* **The switch, and it is off.**
 *
 * It stays off until a forgotten password has a way back, which is Stage 2
 * and needs a domain to send mail from. An account somebody can be locked out
 * of permanently is a trap with a nice form on it. Enodia kept its own switch
 * off for exactly as long, for exactly that reason.
 *
 * Off, the Account entry in the sidebar keeps its "v2" tag and its route is
 * refused, the way Exchange and Squad are. On, it opens.
 *
 * **This is a UI gate and only a UI gate.** /api/auth/* is deployed and
 * reachable whatever this says: somebody who reads the JavaScript can post to
 * it by hand. What protects that endpoint is the rate limiting in
 * worker/auth.ts, never this line. If accounts ever have to be closed for real,
 * the place to do it is the Worker. */
export const ACCOUNTS_LIVE = false;

/* better-auth answers with { message, code } and a real status. The codes are
   stable and the messages are not written for a player, so the likely ones are
   reworded here and anything else falls back to the server's line. */
const SAID = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password do not match an account.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "There is already an account on that email.",
  USER_ALREADY_EXISTS: "There is already an account on that email.",
  PASSWORD_TOO_SHORT: "That password is too short. Eight characters at least.",
  INVALID_EMAIL: "That does not look like an email address.",
};

async function readError(response) {
  /* The rate limiter in worker/auth.ts, and the refusal somebody is most
     likely to hit honestly, by mistyping a password a few times. */
  if (response.status === 429) return "Too many attempts. Wait a few minutes and try again.";
  try {
    const body = await response.json();
    return (body.code && SAID[body.code]) || body.message || "That did not work.";
  } catch {
    return "That did not work.";
  }
}

async function post(path, body) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, say: await readError(response) };
    return { ok: true };
  } catch {
    /* Said plainly, because the next thing somebody wonders is whether their
       locks and builds went with it. They did not: they never left. */
    return { ok: false, say: "Could not reach the server. Nothing in this browser was touched." };
  }
}

/* Who is signed in, or nobody.
 *
 * Null rather than an error on a 401, because signed out is the normal state.
 * A network failure is null too: the tool works signed out, so an unreachable
 * API should look exactly like being signed out rather than putting an error
 * in front of somebody who was not asking. */
export async function currentAccount() {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) return null;
    const body = await response.json();
    return body.user || null;
  } catch {
    return null;
  }
}

/* Whether this deployment can send a password reset, which the browser
   cannot guess: it depends on a mail provider being configured on the server.
   Asking means the screen can warn plainly instead of offering a reset that
   sends nothing. */
export async function capabilities() {
  try {
    const response = await fetch("/api/capabilities");
    if (!response.ok) return { passwordReset: false };
    return await response.json();
  } catch {
    return { passwordReset: false };
  }
}

export const signUp = (name, email, password) => post("/api/auth/sign-up/email", { name, email, password });

export const signIn = (email, password) => post("/api/auth/sign-in/email", { email, password });

/* An empty object rather than no body: the endpoint requires JSON.
 *
 * Signing out touches nothing in this browser. Locks, favorites, profiles and
 * builds were here before the account and are here after it, and a sign out
 * that emptied anything would be the most alarming thing this tool could do. */
export const signOut = () => post("/api/auth/sign-out", {});
