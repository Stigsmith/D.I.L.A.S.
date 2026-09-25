/* ================================================================== */
/* GENERATE worker/schema.ts FROM BETTER-AUTH'S OWN OPTIONS           */
/*                                                                    */
/*   npm run db:schema                                                */
/*                                                                    */
/* Runs the `auth` CLI **at the exact version of better-auth that is  */
/* installed**, never `@latest`. That is the whole reason this is a   */
/* script rather than a one line npm script.                          */
/*                                                                    */
/* Found on 25 September 2026. Enodia's script says                   */
/* `npx auth@latest`, and the handover repeats it, because the older  */
/* `@better-auth/cli` lagged behind and emitted an `account` table    */
/* with no `issuer` column. By today `auth@latest` is 1.7.6 while the */
/* installed better-auth is 1.7.2, and the CLI generates from its own */
/* bundled core rather than the project's, so it drifted the other    */
/* way: 1.7.6 dropped `issuer`, and 1.7.2 requires it NOT NULL and    */
/* writes it on every sign up. Same failure as the old CLI, reached   */
/* from the opposite direction. Nothing breaks until the first person */
/* tries to make an account.                                          */
/*                                                                    */
/* Reading the installed version makes the two impossible to          */
/* separate: upgrade better-auth and the next run of this follows it. */
/* ================================================================== */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const installed = JSON.parse(readFileSync(join(ROOT, "node_modules/better-auth/package.json"), "utf8")).version;

console.log(`\n  better-auth ${installed} is installed, so running auth@${installed}\n`);
execSync(`npx --yes auth@${installed} generate --config worker/auth.config.ts --output worker/schema.ts -y`, {
  cwd: ROOT,
  stdio: "inherit",
});
