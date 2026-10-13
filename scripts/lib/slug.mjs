/* The slug the planet art is named by: planet_<slug>.webp. One copy, so
   the fetch that names the files and the patch check that looks for them
   cannot disagree about a planet with an apostrophe in it. */
export const slug = (s) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
