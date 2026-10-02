/* ================================================================== */
/* PERSISTED STATE                                                    */
/* Everything the tool remembers, in one hook, so the shell owns it    */
/* once and every surface reads the same copy.                         */
/*                                                                    */
/* Lock state lives inside a named profile now. `lockedItems` and      */
/* `lockedWarbonds` still mean exactly what they always did, they just */
/* mean it about whichever profile is active, so every surface that    */
/* reads them kept working without knowing profiles exist.             */
/* ================================================================== */

import { useState, useEffect, useCallback, useMemo } from "react";
import { KEYS, readList, writeList, readDoc, writeDoc } from "./storage.js";
import { BRAND } from "./brand.js";
import { idForLabel, warbondIdForLabel, gateableWarbondIds } from "./items.js";
import {
  seedLockedItems, seedLockedWarbonds, lockedFromOwnership, isOwnershipDoc, buildLockedSet,
  cleanProfileDoc, blankProfile, profileId, DEFAULT_PROFILE_ID,
} from "./ownership.js";
import { cleanLoadout, duplicateLoadout } from "./loadouts.js";
import { cleanHistory, mergeHistory } from "./history.js";

/* State written before items had ids was keyed by display name. Both   */
/* forms resolve, so old saved state survives the move and a list that  */
/* is already ids passes through unchanged. Anything that resolves to   */
/* nothing is dropped rather than kept as a reference to no item.       */
const toItemIds = (list) => [...new Set(list.map(idForLabel).filter(Boolean))];
const toWarbondIds = (list) =>
  [...new Set(list.map(warbondIdForLabel).filter((id) => gateableWarbondIds.has(id)))];

const oneProfile = (lockedItems, lockedWarbonds) => ({
  active: DEFAULT_PROFILE_ID,
  profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default", lockedItems, lockedWarbonds }],
});

export function useCollectionState() {
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [loadouts, setLoadouts] = useState([]);
  const [history, setHistory] = useState([]);
  const [profileDoc, setProfileDoc] = useState(() => oneProfile([], []));

  /* A key that has never been written reads as null, and only then does  */
  /* the ownership seed get a say. Once you have toggled anything in the  */
  /* app your own state wins, so clearing every lock by hand is not undone */
  /* on the next reload. Import is how a filled ownership file reaches a   */
  /* browser that already has state.                                       */
  useEffect(() => {
    setFavorites(readList(KEYS.favorites) || []);

    const favItems = readList(KEYS.favoriteItems);
    if (favItems !== null) {
      const migrated = toItemIds(favItems);
      if (migrated.length !== favItems.length || migrated.some((v, i) => v !== favItems[i])) {
        writeList(KEYS.favoriteItems, migrated);
      }
      setFavoriteItems(migrated);
    }

    /* Profiles, or the one profile implied by an older browser. The two  */
    /* pre-profile lock keys are read once and folded into Default, then  */
    /* left alone: nothing writes them again, and nothing deletes them.   */
    const stored = readDoc(KEYS.profiles);
    if (stored) {
      setProfileDoc(cleanProfileDoc(stored));
    } else {
      const items = readList(KEYS.lockedItems);
      const wbs = readList(KEYS.lockedWarbonds);
      const doc = oneProfile(
        items === null ? seedLockedItems() : toItemIds(items),
        wbs === null ? seedLockedWarbonds() : toWarbondIds(wbs)
      );
      setProfileDoc(doc);
      writeDoc(KEYS.profiles, doc);
    }

    /* Your own builds. Anything referencing an item that no longer       */
    /* resolves has that slot emptied rather than the build discarded.    */
    setLoadouts((readList(KEYS.loadouts) || []).map(cleanLoadout).filter(Boolean));
    setHistory(cleanHistory(readList(KEYS.history) || []));
  }, []);

  const persist = (key, value) => writeList(key, value);

  const saveProfiles = useCallback((next) => {
    setProfileDoc(next);
    writeDoc(KEYS.profiles, next);
    return next;
  }, []);

  /* Every lock mutation goes through here, so nothing can write to a     */
  /* profile that is not the active one by accident.                      */
  const updateActive = useCallback((fn) => {
    setProfileDoc((prev) => {
      const next = { ...prev, profiles: prev.profiles.map((p) => (p.id === prev.active ? fn(p) : p)) };
      writeDoc(KEYS.profiles, next);
      return next;
    });
  }, []);

  const active = useMemo(
    () => profileDoc.profiles.find((p) => p.id === profileDoc.active) || profileDoc.profiles[0],
    [profileDoc]
  );
  const lockedItems = active.lockedItems;
  const lockedWarbonds = active.lockedWarbonds;

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      persist(KEYS.favorites, next);
      return next;
    });
  }, []);

  /* Item favorites are independent of lock state and of loadout          */
  /* favorites. A favorite says "I want to come back to this", a lock says */
  /* "I do not own this". They are allowed to be true at the same time.    */
  /* They are also deliberately not per profile: a favorite is a note to   */
  /* yourself, not a fact about who owns what.                             */
  const toggleFavItem = useCallback((id) => {
    setFavoriteItems((prev) => {
      const next = prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id];
      persist(KEYS.favoriteItems, next);
      return next;
    });
  }, []);

  const clearFavItems = useCallback(() => {
    setFavoriteItems(() => { persist(KEYS.favoriteItems, []); return []; });
  }, []);

  const toggleLock = useCallback((id) => {
    updateActive((p) => ({
      ...p,
      lockedItems: p.lockedItems.includes(id) ? p.lockedItems.filter((n) => n !== id) : [...p.lockedItems, id],
    }));
  }, [updateActive]);

  const clearItemLocks = useCallback(() => {
    updateActive((p) => ({ ...p, lockedItems: [] }));
  }, [updateActive]);

  /* Bulk per item locking, for "unlock everything in this warbond" and    */
  /* for the same action over whatever the Items tab is currently showing. */
  /* It writes the per item axis only. Warbond ownership is untouched, so  */
  /* the two mechanisms still cannot fight.                                */
  const setItemGroup = useCallback((ids, locked) => {
    updateActive((p) => {
      const s = new Set(p.lockedItems);
      for (const id of ids) { if (locked) s.add(id); else s.delete(id); }
      return { ...p, lockedItems: [...s] };
    });
  }, [updateActive]);

  const toggleWarbond = useCallback((id) => {
    updateActive((p) => ({
      ...p,
      lockedWarbonds: p.lockedWarbonds.includes(id)
        ? p.lockedWarbonds.filter((n) => n !== id)
        : [...p.lockedWarbonds, id],
    }));
  }, [updateActive]);

  const setWarbondGroup = useCallback((ids, locked) => {
    updateActive((p) => {
      const s = new Set(p.lockedWarbonds);
      for (const id of ids) { if (locked) s.add(id); else s.delete(id); }
      return { ...p, lockedWarbonds: [...s] };
    });
  }, [updateActive]);

  /* ---------------------------------------------------------------- */
  /* Profiles                                                          */
  /* ---------------------------------------------------------------- */

  const setActiveProfile = useCallback((id) => {
    setProfileDoc((prev) => {
      if (!prev.profiles.some((p) => p.id === id) || prev.active === id) return prev;
      const next = { ...prev, active: id };
      writeDoc(KEYS.profiles, next);
      return next;
    });
  }, []);

  /* mode is "empty" for nothing owned, "full" for everything owned, or   */
  /* "copy" to clone whatever is active. Nothing owned is the useful one: */
  /* it is minutes to add what a new player has, and an evening to strip  */
  /* out what he does not.                                                */
  const createProfile = useCallback((name, mode) => {
    let created = null;
    setProfileDoc((prev) => {
      const id = profileId(name, prev.profiles.map((p) => p.id));
      const activeNow = prev.profiles.find((p) => p.id === prev.active);
      created = blankProfile(id, name.trim() || "Unnamed", mode, activeNow);
      const next = { active: id, profiles: [...prev.profiles, created] };
      writeDoc(KEYS.profiles, next);
      return next;
    });
    return created;
  }, []);

  const renameProfile = useCallback((id, name) => {
    const clean = name.trim();
    if (!clean) return;
    setProfileDoc((prev) => {
      const next = { ...prev, profiles: prev.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p)) };
      writeDoc(KEYS.profiles, next);
      return next;
    });
  }, []);

  /* There is always at least one profile, so the last one cannot go.     */
  const deleteProfile = useCallback((id) => {
    setProfileDoc((prev) => {
      if (prev.profiles.length <= 1) return prev;
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const next = { active: prev.active === id ? profiles[0].id : prev.active, profiles };
      writeDoc(KEYS.profiles, next);
      return next;
    });
  }, []);

  /* Loadout CRUD. Saving is explicit rather than on every keystroke, so */
  /* an unfinished build does not land in Drop Bay while you are mid     */
  /* thought about it.                                                    */
  const saveLoadout = useCallback((loadout) => {
    setLoadouts((prev) => {
      const stamped = { ...loadout, preset: false, updatedAt: new Date().toISOString() };
      const at = prev.findIndex((l) => l.id === stamped.id);
      const next = at < 0 ? [...prev, stamped] : prev.map((l) => (l.id === stamped.id ? stamped : l));
      persist(KEYS.loadouts, next);
      return next;
    });
  }, []);

  const deleteLoadout = useCallback((id) => {
    setLoadouts((prev) => {
      const next = prev.filter((l) => l.id !== id);
      persist(KEYS.loadouts, next);
      return next;
    });
    setFavorites((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((f) => f !== id);
      persist(KEYS.favorites, next);
      return next;
    });
  }, []);

  const duplicate = useCallback((loadout) => {
    const copy = duplicateLoadout(loadout);
    setLoadouts((prev) => {
      const next = [...prev, copy];
      persist(KEYS.loadouts, next);
      return next;
    });
    return copy;
  }, []);

  /* What you dropped with. Written on Confirm; a confirm taken back
     within a quarter of an hour is removed again, since that was a change
     of mind rather than a drop. */
  const logDrop = useCallback((entry) => {
    setHistory((prev) => {
      const next = cleanHistory([...prev, entry]);
      persist(KEYS.history, next);
      return next;
    });
  }, []);

  const unlogDrop = useCallback((id) => {
    setHistory((prev) => {
      if (!prev.some((e) => e.id === id)) return prev;
      const next = prev.filter((e) => e.id !== id);
      persist(KEYS.history, next);
      return next;
    });
  }, []);

  /* One file, everything this tool persists, with a schemaVersion so a  */
  /* later shape change can be migrated rather than rejected. Version 3  */
  /* carries every profile. Version 2 carried one flat pair of lock      */
  /* lists, and still imports.                                            */
  const exportState = useCallback(() => {
    const doc = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      favorites,
      favoriteItems,
      profiles: profileDoc,
      loadouts,
      history,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${BRAND.short.toLowerCase().replace(/[^a-z0-9]+/g, "")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [favorites, favoriteItems, profileDoc, loadouts, history]);

  /* Three shapes are accepted. A version 3 export carrying profiles, a   */
  /* version 2 export carrying one flat pair of lock lists, and an        */
  /* ownership list of id to boolean maps. They cannot be confused        */
  /* because they use different key names.                                */
  const importState = useCallback((doc) => {
    if (!doc || typeof doc !== "object") {
      return { ok: false, text: `That file is not a ${BRAND.short} export or an ownership list.` };
    }

    /* An ownership file describes one player, so it lands in the profile */
    /* you are looking at rather than silently creating another one.      */
    if (isOwnershipDoc(doc)) {
      const seeded = lockedFromOwnership(doc);
      /* Read the name before the update rather than inside it. The state  */
      /* updater runs after this function returns, so a name captured in   */
      /* there is always still empty by the time the message is built.     */
      const into = active.name;
      setProfileDoc((prev) => {
        const next = {
          ...prev,
          profiles: prev.profiles.map((p) =>
            p.id === prev.active
              ? { ...p, lockedItems: seeded.lockedItems, lockedWarbonds: seeded.lockedWarbonds }
              : p),
        };
        writeDoc(KEYS.profiles, next);
        return next;
      });
      const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
      return {
        ok: true,
        text: `Ownership loaded into ${into}. ` +
          `${count(seeded.lockedWarbonds.length, "warbond", "warbonds")} and ` +
          `${count(seeded.lockedItems.length, "item", "items")} marked as not owned. Favorites untouched.`,
      };
    }

    const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : null);
    const fav = list(doc.favorites);
    const favItems = list(doc.favoriteItems);
    const builds = Array.isArray(doc.loadouts) ? doc.loadouts.map(cleanLoadout).filter(Boolean) : null;

    /* Version 3 carries the whole profile document. Version 2 carried    */
    /* two flat arrays, which become the Default profile.                 */
    const hasProfiles = doc.profiles && typeof doc.profiles === "object";
    const items = list(doc.lockedItems);
    const wbs = list(doc.lockedWarbonds);

    /* Added to what is here rather than replacing it: two browsers'
       histories are both true, and an import should never forget a drop. */
    const drops = Array.isArray(doc.history) ? cleanHistory(doc.history) : null;

    if (!fav && !favItems && !builds && !hasProfiles && !items && !wbs && !drops) {
      return { ok: false, text: `That file is not a ${BRAND.short} export or an ownership list.` };
    }
    if (builds) { setLoadouts(builds); persist(KEYS.loadouts, builds); }

    /* A backup written by an older build holds display names. The same  */
    /* resolver the loader uses turns them into ids on the way in.       */
    if (fav) { setFavorites(fav); persist(KEYS.favorites, fav); }
    if (favItems) {
      const m = toItemIds(favItems);
      setFavoriteItems(m);
      persist(KEYS.favoriteItems, m);
    }

    let profileNote = "";
    if (hasProfiles) {
      const next = cleanProfileDoc(doc.profiles);
      saveProfiles(next);
      profileNote = ` ${next.profiles.length} ${next.profiles.length === 1 ? "profile" : "profiles"} restored.`;
    } else if (items || wbs) {
      saveProfiles(oneProfile(toItemIds(items || []), toWarbondIds(wbs || [])));
      profileNote = " Lock state landed in a single Default profile.";
    }

    let dropNote = "";
    if (drops && drops.length) {
      setHistory((prev) => {
        const next = mergeHistory(prev, drops);
        persist(KEYS.history, next);
        return next;
      });
      dropNote = ` ${drops.length} ${drops.length === 1 ? "drop" : "drops"} added to your history.`;
    }

    return { ok: true, text: `Backup restored.${profileNote}${dropNote}` };
  }, [saveProfiles, active]);

  /* Back to a first run, including the ownership seed. Export first.    */
  const resetLocal = useCallback(() => {
    for (const key of Object.values(KEYS)) {
      if (key !== KEYS.profiles) writeList(key, []);
    }
    setFavorites([]);
    setFavoriteItems([]);
    setLoadouts([]);
    setHistory([]);
    saveProfiles(oneProfile(seedLockedItems(), seedLockedWarbonds()));
  }, [saveProfiles]);

  const warbondLockedSet = useMemo(() => buildLockedSet([], lockedWarbonds), [lockedWarbonds]);
  const lockedSet = useMemo(
    () => buildLockedSet(lockedItems, lockedWarbonds),
    [lockedItems, lockedWarbonds]
  );

  return {
    favorites, favoriteItems, lockedItems, lockedWarbonds, loadouts, history,
    lockedSet, warbondLockedSet,
    profiles: profileDoc.profiles, activeProfileId: profileDoc.active, activeProfile: active,
    setActiveProfile, createProfile, renameProfile, deleteProfile,
    toggleFavorite, toggleFavItem, clearFavItems,
    toggleLock, clearItemLocks, setItemGroup, toggleWarbond, setWarbondGroup,
    saveLoadout, deleteLoadout, duplicate, logDrop, unlogDrop,
    exportState, importState, resetLocal,
  };
}
