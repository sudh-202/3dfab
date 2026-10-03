/**
 * Reads attribution out of the asset manifests a project already keeps, so a
 * model card can say who made a model and under what licence. Nothing here is
 * guessed: a model gets a credit only when its project's manifest names a
 * source or licence for that exact file.
 *
 * A root opts in with `"credits": "<manifest path relative to the root>"` in
 * scripts/roots.json. Two manifest shapes are understood:
 *
 *   { assets: [{ files, textureVariants?, creator, sourceUrl, licenceId, … }] }
 *       paths relative to the project root (The Veil's assets-src/manifest.json)
 *
 *   { models: [{ file, source, license }] }
 *       paths relative to the manifest's folder (Below 10,000 Meters'
 *       public/models/manifest.json)
 *
 * Returns Map<path relative to root (posix), credit>.
 */
import fs from "node:fs";
import path from "node:path";

const LICENCE_LABEL = {
  "CC0-1.0": "CC0",
  CC0: "CC0",
  "CC-BY-3.0": "CC BY 3.0",
  "CC-BY-4.0": "CC BY 4.0",
  "CC-BY-SA-4.0": "CC BY-SA 4.0",
  "Fab-Standard": "Fab Standard",
  "Mixamo-in-GLB": "Mixamo licence",
  owner: "Project-owned",
};

const SITE_LABEL = {
  "sketchfab.com": "Sketchfab",
  "fab.com": "Fab",
  "polyhaven.com": "Poly Haven",
  "opengameart.org": "OpenGameArt",
  "mixamo.com": "Mixamo",
  "quaternius.com": "Quaternius",
  "kenney.nl": "Kenney",
  "poly.pizza": "Poly Pizza",
};

function siteOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SITE_LABEL[host] ?? host;
  } catch {
    return undefined;
  }
}

const posix = (p) => p.split(path.sep).join("/").replace(/^\.\//, "");

/** Drops empty fields so the index carries only what the evidence says. */
function clean(credit) {
  const out = {};
  for (const [k, v] of Object.entries(credit)) if (v != null && v !== "" && v !== false) out[k] = v;
  return Object.keys(out).length ? out : null;
}

/** The Veil: one row per asset, every shipped file listed, licence by SPDX-ish id. */
function fromAssetRows(rows) {
  const map = new Map();
  for (const a of rows) {
    // Rows without a licence id are the game's own work (route B/D) — no third party to credit.
    if (!a.licenceId) continue;
    const credit = clean({
      author: a.creator,
      source: a.sourceUrl ? siteOf(a.sourceUrl) : undefined,
      license: LICENCE_LABEL[a.licenceId] ?? a.licenceId,
      url: a.sourceUrl,
      notice: a.attribution,
      // Private-use licences (Fab Standard) forbid redistributing the file itself.
      restricted: a.privateUse === true,
    });
    if (!credit) continue;
    const files = [...(a.files ?? []), ...Object.values(a.textureVariants ?? {})];
    for (const f of files) map.set(posix(f), credit);
  }
  return map;
}

/** Below 10,000 Meters: one row per file, provenance as a free-text `source`. */
function fromModelRows(rows, dir) {
  const map = new Map();
  for (const m of rows) {
    const src = String(m.source ?? "");
    let credit = null;
    const haven = /^Poly Haven\s+([a-z0-9_]+)/i.exec(src);
    if (haven) {
      credit = clean({
        source: "Poly Haven",
        license: LICENCE_LABEL[m.license] ?? m.license,
        url: `https://polyhaven.com/a/${haven[1]}`,
      });
    } else if (/^Meshy\b/i.test(src)) {
      credit = clean({ source: "Meshy (AI)", license: LICENCE_LABEL[m.license] ?? m.license });
    }
    // Blender-authored, baked-procedural and "existing owner library" rows name no third party.
    if (credit) map.set(posix(path.join(dir, m.file)), credit);
  }
  return map;
}

export function loadCredits(rootPath, manifestRel) {
  if (!manifestRel) return new Map();
  const file = path.join(rootPath, manifestRel);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.warn(`  ! credits unreadable: ${manifestRel} — ${err.message}`);
    return new Map();
  }
  if (Array.isArray(json.assets)) return fromAssetRows(json.assets);
  if (Array.isArray(json.models)) return fromModelRows(json.models, path.dirname(manifestRel));
  console.warn(`  ! credits: unknown manifest shape in ${manifestRel}`);
  return new Map();
}
