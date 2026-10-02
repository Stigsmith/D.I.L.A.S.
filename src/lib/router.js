/* ================================================================== */
/* ROUTING                                                            */
/* A hash router rather than a library. The route table is a handful   */
/* of destinations with at most one parameter, and hash routing needs  */
/* no server rewrite rules, so a dependency would be paying for        */
/* flexibility this app does not use. Swap in a real router the moment */
/* that stops being true.                                              */
/*                                                                    */
/* Routes look like #/tiers/primary, #/collection, #/builder/bugs-blender */
/* ================================================================== */

import { useState, useEffect, useCallback } from "react";

const parse = (fallback) => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return raw || fallback;
};

export function useRoute(fallback) {
  const [route, setRoute] = useState(() => parse(fallback));

  useEffect(() => {
    const onChange = () => setRoute(parse(fallback));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [fallback]);

  /* `replace` swaps the current entry rather than adding one, for a
     redirect: Back should not land on a page that sends you on again. */
  const navigate = useCallback((path, { replace = false } = {}) => {
    if (replace) window.location.replace(`#/${path}`);
    else window.location.hash = `/${path}`;
  }, []);

  const [destination, ...rest] = route.split("/");
  return { route, destination, param: rest.join("/") || null, navigate };
}
