# 3DFAB

A ledger of every 3D model on this machine — Sketchfab-style browsing, but for
your own disk. Triangle counts, bounding boxes, materials, rigs and animation
clips are read out of the files themselves, then served as a static site with a
live WebGL viewer.

**Stack:** Next.js 16 · React Three Fiber · Tailwind v4 · Playwright (thumbnails)

## How it works

```
scripts/roots.json     which folders to walk
scripts/scan.mjs       index every .glb/.gltf/.fbx/.blend → data/models.json
                       copy previewable GLBs → public/models/
scripts/thumbs.mjs     render shaded + wireframe thumbnails → public/thumbs/
src/                   the site, built from data/models.json at build time
```

Nothing runs at request time. The deployed site is a snapshot of the index;
the source files themselves stay where they are.

### Re-index

```bash
npm run index          # scan + render new thumbnails
npm run scan           # index only
npm run thumbs -- --force   # re-render every thumbnail
```

Edit `scripts/roots.json` to add project folders. Files under the bundle cap
(`bundle.maxFileBytes`, up to `bundle.maxTotalBytes` in total) are copied into
`public/models/` so the viewer works on a deployment with no access to your disk.
Larger files stay indexed but show specs without a viewer.

### What gets parsed

| Format   | Read from             | Yields                                                      |
| -------- | --------------------- | ----------------------------------------------------------- |
| `.glb`   | glTF JSON chunk       | triangles, vertices, draw calls, bbox, materials, textures, clips, skins/bones, extensions |
| `.gltf`  | JSON                  | same                                                        |
| `.fbx`   | binary header + scan  | version, skinned/animated flags, generator                  |
| `.blend` | block table           | Blender version, object/mesh/material/image/armature counts |

Triangle counts walk the node graph, so an instanced mesh is counted every
time it is drawn. Compressed `.blend` files (zstd/gzip) are reported but not
parsed.

## Demo video

```bash
npm run build && npx next start -p 3100 &
node scripts/record-demo.mjs <outDir>
```

Records a scripted walkthrough with Playwright against the production build
and writes `<outDir>/video/raw/*.webm` plus `marks.json` (caption timestamps).

## Develop

```bash
npm install
npm run dev
```

## Deploy

Static output — any host works. The repo carries the bundled GLBs and
thumbnails so a fresh clone deploys without re-scanning.
