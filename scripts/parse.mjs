import fs from "node:fs";
import path from "node:path";

/* ---------- glTF / GLB ---------------------------------------------------- */

/** Pull the JSON chunk out of a binary .glb (glTF 2.0 container). */
function readGlbJson(file) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(12);
    if (fs.readSync(fd, head, 0, 12, 0) < 12) return null;
    if (head.toString("utf8", 0, 4) !== "glTF") return null;

    const chunk = Buffer.alloc(8);
    fs.readSync(fd, chunk, 0, 8, 12);
    const len = chunk.readUInt32LE(0);
    if (chunk.toString("utf8", 4, 8).trim() !== "JSON") return null;

    const json = Buffer.alloc(len);
    fs.readSync(fd, json, 0, len, 20);
    return JSON.parse(json.toString("utf8"));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function readGltfJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Triangle count for one primitive. `mode` follows the glTF spec:
 * 4 = TRIANGLES, 5 = TRIANGLE_STRIP, 6 = TRIANGLE_FAN. Anything else
 * (points, lines) contributes no triangles.
 */
function primitiveTriangles(prim, accessors) {
  const mode = prim.mode ?? 4;
  const src = prim.indices != null ? prim.indices : prim.attributes?.POSITION;
  const count = accessors?.[src]?.count ?? 0;
  if (!count) return 0;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

/**
 * Meshes are counted once, but a mesh referenced by several nodes is drawn
 * several times — so geometry totals walk the node graph, not the mesh list.
 */
function meshInstanceCounts(gltf) {
  const counts = new Map();
  const nodes = gltf.nodes ?? [];
  const visit = (i, seen) => {
    if (seen.has(i)) return;
    seen.add(i);
    const n = nodes[i];
    if (!n) return;
    if (n.mesh != null) counts.set(n.mesh, (counts.get(n.mesh) ?? 0) + 1);
    for (const c of n.children ?? []) visit(c, seen);
  };
  const scenes = gltf.scenes ?? [];
  if (scenes.length) {
    for (const s of scenes) for (const r of s.nodes ?? []) visit(r, new Set());
  } else {
    nodes.forEach((n) => n.mesh != null && counts.set(n.mesh, (counts.get(n.mesh) ?? 0) + 1));
  }
  // A mesh nothing points at still exists in the file; count it once.
  (gltf.meshes ?? []).forEach((_, i) => { if (!counts.has(i)) counts.set(i, 1); });
  return counts;
}

export function parseGltfLike(file) {
  const gltf = file.toLowerCase().endsWith(".glb") ? readGlbJson(file) : readGltfJson(file);
  if (!gltf) return { parsed: false };

  const accessors = gltf.accessors ?? [];
  const instances = meshInstanceCounts(gltf);

  let triangles = 0;
  let vertices = 0;
  let drawCalls = 0;

  (gltf.meshes ?? []).forEach((mesh, i) => {
    const n = instances.get(i) ?? 1;
    for (const prim of mesh.primitives ?? []) {
      triangles += primitiveTriangles(prim, accessors) * n;
      vertices += (accessors[prim.attributes?.POSITION]?.count ?? 0) * n;
      drawCalls += n;
    }
  });

  const animations = (gltf.animations ?? []).map((a, i) => ({
    name: a.name || `Animation ${i + 1}`,
    channels: (a.channels ?? []).length,
  }));

  const skins = (gltf.skins ?? []).length;
  let bones = 0;
  for (const s of gltf.skins ?? []) bones += (s.joints ?? []).length;

  // Bounding box comes from POSITION accessor min/max, which the spec requires.
  let bbox = null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const a = accessors[prim.attributes?.POSITION];
      if (!a?.min || !a?.max) continue;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], a.min[k]);
        max[k] = Math.max(max[k], a.max[k]);
      }
    }
  }
  if (Number.isFinite(min[0])) {
    bbox = { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }

  const images = gltf.images ?? [];
  const textureBytes = images.reduce((sum, img) => {
    const bv = gltf.bufferViews?.[img.bufferView];
    return sum + (bv?.byteLength ?? 0);
  }, 0);

  const materials = (gltf.materials ?? []).map((m, i) => ({
    name: m.name || `Material ${i + 1}`,
    alphaMode: m.alphaMode ?? "OPAQUE",
    doubleSided: !!m.doubleSided,
    metallic: m.pbrMetallicRoughness?.metallicFactor ?? 1,
    roughness: m.pbrMetallicRoughness?.roughnessFactor ?? 1,
  }));

  return {
    parsed: true,
    triangles,
    vertices,
    drawCalls,
    meshes: (gltf.meshes ?? []).length,
    nodes: (gltf.nodes ?? []).length,
    materials,
    materialCount: materials.length,
    textureCount: (gltf.textures ?? []).length,
    imageCount: images.length,
    textureBytes,
    animations,
    animationCount: animations.length,
    skins,
    bones,
    bbox,
    generator: gltf.asset?.generator ?? null,
    gltfVersion: gltf.asset?.version ?? null,
    copyright: gltf.asset?.copyright ?? null,
    extensions: [
      ...new Set([...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])]),
    ],
    draco: (gltf.extensionsUsed ?? []).includes("KHR_draco_mesh_compression"),
  };
}

/* ---------- FBX ----------------------------------------------------------- */

/**
 * Binary FBX starts with "Kaydara FBX Binary  \0" then a 4-byte version at
 * offset 23. ASCII FBX is plain text. We read the header for a version and
 * sample the file for the marker strings that reveal rig/anim content —
 * a full FBX node-graph parse is not worth it for an inventory listing.
 */
export function parseFbx(file, size) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(32);
    fs.readSync(fd, head, 0, 32, 0);
    const binary = head.toString("binary", 0, 20).startsWith("Kaydara FBX Binary");
    const version = binary ? head.readUInt32LE(23) : null;

    const sampleLen = Math.min(size, 3_000_000);
    const sample = Buffer.alloc(sampleLen);
    fs.readSync(fd, sample, 0, sampleLen, 0);
    const text = sample.toString("binary");

    const has = (s) => text.includes(s);
    return {
      parsed: true,
      binary,
      fbxVersion: version ? (version / 1000).toFixed(1) : null,
      hasSkin: has("Deformer") || has("Cluster"),
      hasAnimation: has("AnimationCurve") || has("AnimationStack"),
      hasEmbeddedTextures: has("RelativeFilename") && has("Video"),
      generator: /Blender \(stable FBX IO\)[^\0]*/.exec(text)?.[0]?.slice(0, 60)
        ?? (has("Meshy") ? "Meshy AI" : null),
    };
  } catch {
    return { parsed: false };
  } finally {
    fs.closeSync(fd);
  }
}

/* ---------- .blend -------------------------------------------------------- */

/**
 * A .blend is a header ("BLENDER" + pointer size + endianness + version) then a
 * chain of blocks, each tagged with a 4-char code. Counting OB/ME/MA/IM blocks
 * gives object/mesh/material/image totals without a DNA walk. Compressed
 * .blend files (zstd/gzip) are reported as compressed and left unparsed.
 */
export function parseBlend(file) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    const magic = head.toString("utf8", 0, 7);

    if (magic !== "BLENDER") {
      const z = head[0] === 0x28 && head[1] === 0xb5; // zstd
      const g = head[0] === 0x1f && head[1] === 0x8b; // gzip
      return { parsed: false, compressed: z || g, compression: z ? "zstd" : g ? "gzip" : null };
    }

    const ptr64 = head.toString("utf8", 7, 8) === "-";
    const little = head.toString("utf8", 8, 9) === "v";
    const version = head.toString("utf8", 9, 12);
    const ptrSize = ptr64 ? 8 : 4;
    const headerSize = 4 + 4 + ptrSize + 4 + 4;

    const counts = {};
    const stat = fs.fstatSync(fd);
    let off = 12;
    const buf = Buffer.alloc(headerSize);

    // Guard the walk: a truncated or unexpected file must not spin forever.
    for (let i = 0; i < 400_000 && off + headerSize <= stat.size; i++) {
      if (fs.readSync(fd, buf, 0, headerSize, off) < headerSize) break;
      const code = buf.toString("utf8", 0, 4).replace(/\0/g, "");
      const len = little ? buf.readUInt32LE(4) : buf.readUInt32BE(4);
      if (code === "ENDB") break;
      counts[code] = (counts[code] ?? 0) + 1;
      if (len < 0 || len > stat.size) break;
      off += headerSize + len;
    }

    return {
      parsed: true,
      blenderVersion: `${version[0]}.${version.slice(1)}`,
      pointerSize: ptrSize * 8,
      objects: counts.OB ?? 0,
      meshes: counts.ME ?? 0,
      materialCount: counts.MA ?? 0,
      imageCount: counts.IM ?? 0,
      scenes: counts.SC ?? 0,
      armatures: counts.AR ?? 0,
      actions: counts.AC ?? 0,
    };
  } catch {
    return { parsed: false };
  } finally {
    fs.closeSync(fd);
  }
}

/* ---------- shared -------------------------------------------------------- */

export const EXTENSIONS = new Set([
  ".glb", ".gltf", ".fbx", ".obj", ".blend", ".usdz", ".stl", ".dae", ".ply", ".abc", ".3ds", ".usd",
]);

export function titleize(file) {
  return path
    .basename(file, path.extname(file))
    .replace(/[_-]+/g, " ")
    .replace(/\b(lod\d|v\d+)\b/gi, (m) => m.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
