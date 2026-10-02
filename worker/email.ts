/**
 * Sending email, and the one place a provider is named.
 *
 * **Not live yet, and that is the point of this file existing now.** Stage 2
 * of `dds-cloudflare-handover.md` wires it up, and it cannot happen before
 * stigly buys a domain: Resend only sends from a domain you have verified you
 * own. Until then `configured()` is false, `auth.ts` offers no password reset,
 * and `/api/capabilities` says so, so the UI never shows a "check your email"
 * screen for a letter nobody wrote.
 *
 * Ported from Enodia's `worker/email.ts`, whose structure carries over and
 * whose letter does not: that one is Dora's voice, workshopped by stigly
 * against her lines.
 *
 * **Swap point.** Everything else talks to `send()`. Changing provider means
 * rewriting the body of `send` and nothing else. Resend because it is an HTTP
 * API: Workers cannot open a raw socket to port 25.
 */

type Mail = {
  /** A secret, set with `wrangler secret put RESEND_API_KEY`. No default. */
  RESEND_API_KEY?: string
  /**
   * The From address. A `var` in `wrangler.jsonc` rather than a secret, because
   * it is printed on every letter and is therefore not one. Absent until the
   * domain exists.
   */
  MAIL_FROM?: string
}

export const configured = (env: Mail): boolean => Boolean(env.RESEND_API_KEY && env.MAIL_FROM)

export type Letter = {
  to: string
  subject: string
  /** Plain text on purpose: four lines and a link need no markup. */
  text: string
}

/** Send one. Returns whether it went, and never throws. */
export async function send(env: Mail, letter: Letter): Promise<boolean> {
  if (!configured(env)) return false

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [letter.to],
        subject: letter.subject,
        text: letter.text,
      }),
    })
    if (!response.ok) {
      // Nearly always an unverified sending domain. Worth logging, never showing.
      console.error('mail refused', response.status, await response.text().catch(() => ''))
      return false
    }
    return true
  } catch (error) {
    console.error('mail failed', error)
    return false
  }
}

/**
 * The reset letter. **A placeholder in plain words, and its voice is stigly's
 * call in Stage 2**, the way Enodia's was.
 *
 * What carries over from Enodia regardless of voice: the working half first,
 * because the reader is locked out and irritated; one line saying what the
 * link is for before they reach it, because an unexplained link at the top of
 * an unexpected email is the shape of every phishing message; and a boring
 * subject line, because it is what gets typed into a search box.
 */
/**
 * The tool's name, the one copy outside `src/lib/brand.js`: the Worker's
 * type check covers `worker/` only and cannot import the app's JavaScript.
 * Change both together.
 */
const NAME = 'D.I.L.A.S.'

export const resetLetter = (url: string): Omit<Letter, 'to'> => ({
  subject: `Reset your ${NAME} password`,
  text: [
    `Somebody asked to reset the password on this ${NAME} account.`,
    '',
    'If that was you, here is the link:',
    '',
    url,
    '',
    'It works once and expires in an hour.',
    '',
    'If it was not you, ignore this. Nothing has changed.',
    '',
    '',
    `${NAME} is an unofficial fan project. Not affiliated with Arrowhead Game Studios.`,
  ].join('\n'),
})
