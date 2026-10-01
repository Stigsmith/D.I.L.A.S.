/* ================================================================== */
/* EMPTY A FOLDER WITHOUT DELETING IT                                 */
/*                                                                    */
/* The repo sits in a folder a file sync app watches. On 30 September */
/* and 1 October 2026 that app read every folder deleted and made     */
/* again as a conflict and renamed the fresh one to "<name> (# Name   */
/* clash ...)": the art folders, and dist/assets seconds after a      */
/* build, which left the page with no script. Emptying a folder the   */
/* app already knows about is an ordinary change to it, so the image  */
/* importer and the build both empty in place rather than delete.     */
/* ================================================================== */

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export const CLASH = /Name clash/i;

/* With dropClashes, a renamed copy inside is removed whole, which is what
   a build always did to everything in its output folder. The image
   importer leaves them alone: whether to delete those is the curator's
   call. */
export function emptyInPlace(dir, { dropClashes = false } = {}) {
  mkdirSync(dir, { recursive: true });
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, d.name);
    if (d.isDirectory() && CLASH.test(d.name)) {
      if (dropClashes) rmSync(path, { recursive: true, force: true });
    } else if (d.isDirectory()) emptyInPlace(path, { dropClashes });
    else rmSync(path, { force: true });
  }
}
