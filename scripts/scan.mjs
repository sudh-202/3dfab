#!/usr/bin/env node
/**
 * Walks the roots in scripts/roots.json, indexes every 3D file it finds, and
 * writes data/models.json. Files small enough to serve are copied into
 * public/models/ so the viewer works on a deployment that has no access to
 * this machine's disks.
 *
 *   node scripts/scan.mjs            index + copy previewable files
 *   node scripts/scan.mjs --no-copy  index only
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseGltfLike, parseFbx, parseBlend, EXTENSIONS, titleize } from "./parse.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/roots.json"), "utf8"));
const COPY = !process.argv.includes("--no-copy");

const OUT_DATA = path.join(ROOT, "data");
const OUT_MODELS = path.join(ROOT, "public/models");

/** Directory names, plus a couple of path fragments, we never descend into. */
function ignored(p) {
  return CONFIG.ignore.some((frag) =>
    frag.startsWith("/") ? p.includes(frag) : path.basename(p) === frag
  );
}

function walk(dir, out = [], depth = 0) {
  if (depth > 12) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (ignored(full)) continue;
    if (e.isDirectory()) walk(full, out, depth + 1);
    else if (e.isFile() && EXTENSIONS.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

/** Hash of the first 1 MB plus the byte size — enough to spot duplicate copies. */
function fingerprint(file, size) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(Math.min(size, 1 << 20));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return crypto.createHash("sha1").update(buf).update(String(size)).digest("hex").slice(0, 16);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Folder between the project root and the file, used as the in-project group
 * ("weapons", "zombie", "props"). Skips carrier folders like public/ or assets/
 * that say nothing about the asset itself.
 */
const CARRIER = new Set(["public", "assets", "models", "src", "static", "3d", "app"]);
function groupOf(rel) {
  const parts = path.dirname(rel).split(path.sep).filter((p) => p && p !== ".");
  const meaningful = parts.filter((p) => !CARRIER.has(p.toLowerCase()));
  return meaningful.length ? titleize(meaningful[meaningful.length - 1]) : "Top level";
}

/** Log-scale weight class over the range an inventory actually spans. */
function weightClass(tris) {
  if (!tris) return "unknown";
  if (tris < 5_000) return "light";
  if (tris < 50_000) return "medium";
  if (tris < 250_000) return "heavy";
  return "extreme";
}

function main() {
  fs.mkdirSync(OUT_DATA, { recursive: true });
  if (COPY) fs.mkdirSync(OUT_MODELS, { recursive: true });

  const seen = new Map();
  // Source paths stay in memory for copying and never reach the index.
  const sourceOf = new Map();
  const records = [];
  const missingRoots = [];

  for (const root of CONFIG.roots) {
    if (!fs.existsSync(root.path)) {
      missingRoots.push(root);
      console.warn(`  ! offline, skipped: ${root.label} (${root.path})`);
      continue;
    }
    const files = walk(root.path);
    console.log(`  ${String(files.length).padStart(4)}  ${root.label}`);

    for (const file of files) {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const fp = fingerprint(file, stat.size);
      if (seen.has(fp)) {
        seen.get(fp).duplicateCount++;
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      const rel = path.relative(root.path, file);
      const format = ext.slice(1);

      let detail = { parsed: false };
      if (ext === ".glb" || ext === ".gltf") detail = parseGltfLike(file);
      else if (ext === ".fbx") detail = parseFbx(file, stat.size);
      else if (ext === ".blend") detail = parseBlend(file);

      const record = {
        id: fp,
        name: titleize(file),
        fileName: path.basename(file),
        format,
        collection: root.label,
        group: groupOf(rel),
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        created: stat.birthtime.toISOString(),
        duplicateCount: 0,
        triangles: detail.triangles ?? null,
        vertices: detail.vertices ?? null,
        weight: weightClass(detail.triangles),
        animationCount: detail.animationCount ?? (detail.hasAnimation ? -1 : 0),
        materialCount: detail.materialCount ?? null,
        textureCount: detail.textureCount ?? null,
        detail,
        previewUrl: null,
      };
      seen.set(fp, record);
      sourceOf.set(fp, file);
      records.push(record);
    }
  }

  // Previewable files get copied in, smallest first, until the budget runs out.
  let copied = 0;
  let copiedBytes = 0;
  if (COPY) {
    const { maxFileBytes, maxTotalBytes } = CONFIG.bundle;
    const candidates = records
      .filter((r) => (r.format === "glb" || r.format === "gltf") && r.bytes <= maxFileBytes)
      .sort((a, b) => a.bytes - b.bytes);

    for (const r of candidates) {
      if (copiedBytes + r.bytes > maxTotalBytes) break;
      const dest = path.join(OUT_MODELS, `${r.id}.${r.format}`);
      try {
        if (!fs.existsSync(dest) || fs.statSync(dest).size !== r.bytes) {
          fs.copyFileSync(sourceOf.get(r.id), dest);
        }
        r.previewUrl = `/models/${r.id}.${r.format}`;
        copiedBytes += r.bytes;
        copied++;
      } catch (err) {
        console.warn(`  ! copy failed: ${r.fileName} — ${err.message}`);
      }
    }

    // Drop stale copies from a previous scan so the folder mirrors the index.
    const keep = new Set(records.filter((r) => r.previewUrl).map((r) => path.basename(r.previewUrl)));
    for (const f of fs.readdirSync(OUT_MODELS)) {
      if (!keep.has(f)) fs.unlinkSync(path.join(OUT_MODELS, f));
    }
  }

  records.sort((a, b) => a.name.localeCompare(b.name));

  const collections = {};
  for (const r of records) {
    const c = (collections[r.collection] ??= { name: r.collection, count: 0, bytes: 0, triangles: 0 });
    c.count++;
    c.bytes += r.bytes;
    c.triangles += r.triangles ?? 0;
  }

  const index = {
    generatedAt: new Date().toISOString(),
    totals: {
      models: records.length,
      bytes: records.reduce((s, r) => s + r.bytes, 0),
      triangles: records.reduce((s, r) => s + (r.triangles ?? 0), 0),
      vertices: records.reduce((s, r) => s + (r.vertices ?? 0), 0),
      animated: records.filter((r) => r.animationCount !== 0).length,
      duplicates: records.reduce((s, r) => s + r.duplicateCount, 0),
      previewable: copied,
      previewBytes: copiedBytes,
    },
    collections: Object.values(collections).sort((a, b) => b.count - a.count),
    offlineRoots: missingRoots.map((r) => r.label),
    models: records,
  };

  fs.writeFileSync(path.join(OUT_DATA, "models.json"), JSON.stringify(index, null, 1));

  const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
  console.log(
    `\n  ${records.length} models · ${mb(index.totals.bytes)} · ` +
      `${(index.totals.triangles / 1e6).toFixed(1)}M triangles`
  );
  console.log(`  ${copied} bundled for preview (${mb(copiedBytes)})`);
  console.log(`  ${index.totals.duplicates} duplicate copies collapsed\n`);
}

main();
