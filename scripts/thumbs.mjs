#!/usr/bin/env node
/**
 * Renders two thumbnails per renderable model — a shaded pass and a wireframe
 * pass — by loading each file into a real WebGL context via headless Chromium.
 * Models are read from their source on disk (data/sources.local.json, written
 * by scan.mjs), so files that are too large or not licensed for bundling still
 * get a still image. glTF/GLB and FBX are rendered; .blend is not.
 * The grid crossfades between the two on hover, so topology is readable without
 * opening the model.
 *
 *   node scripts/thumbs.mjs           render anything missing
 *   node scripts/thumbs.mjs --force   re-render everything
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "thumbs");
const FORCE = process.argv.includes("--force");
const SIZE = 640;

const MIME = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".html": "text/html",
};

/**
 * Serves node_modules/three so the page can import the real library, public/,
 * and /src/<id>/<file> from the model's own folder on disk — the folder, not
 * just the file, so a .gltf's buffers and an FBX's textures resolve.
 */
function serve(sources) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let file;
      if (url.startsWith("/three/")) file = path.join(ROOT, "node_modules/three", url.slice(7));
      else if (url.startsWith("/src/")) {
        const [, , id, ...rest] = url.split("/");
        const src = sources[id];
        file = src ? path.join(path.dirname(src), ...rest) : "";
      } else file = path.join(PUBLIC, url);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "access-control-allow-origin": "*",
      });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#14161c;overflow:hidden}canvas{display:block}</style>
<script type="importmap">
{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const S = ${SIZE};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(S, S);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const scene = new THREE.Scene();
scene.environment = envMap;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 5000);

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(4, 6, 5);
const rim = new THREE.DirectionalLight(0xa8c4ff, 1.0);
rim.position.set(-5, 2, -4);
scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("/three/examples/jsm/libs/draco/");
loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);
// KHR_texture_basisu (KTX2) textures, as shipped by The Veil.
const ktx2 = new KTX2Loader().setTranscoderPath("/three/examples/jsm/libs/basis/").detectSupport(renderer);
loader.setKTX2Loader(ktx2);

let current = null;

/** Frames the model so it fills the same proportion of every thumbnail. */
function frame(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 1e-4);

  object.position.sub(center);

  const dist = (radius / Math.sin((camera.fov * Math.PI) / 180 / 2)) * 0.95;
  camera.position.set(dist * 0.62, dist * 0.42, dist * 0.72);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

const fbxManager = new THREE.LoadingManager();
const fbx = new FBXLoader(fbxManager);
let fbxPending = 0;
fbxManager.onStart = () => fbxPending++;
fbxManager.onLoad = () => (fbxPending = 0);

/**
 * Game-ready exports can carry helpers the game hides at runtime: collision
 * hulls (COL_/UCX_, The Veil's extras.veil_collider) and coarser LODs stacked on
 * the main mesh (extras.veil_lod). Drawn, a hull is an opaque box over the
 * prop. Removed rather than hidden so they do not skew framing either.
 */
function stripHelpers(root) {
  // Keep the finest LOD present: a texture-variant export may start at lod1.
  let finest = Infinity;
  root.traverse((o) => {
    if (typeof o.userData?.veil_lod === "number") finest = Math.min(finest, o.userData.veil_lod);
  });
  const drop = [];
  root.traverse((o) => {
    const u = o.userData ?? {};
    const coarser = typeof u.veil_lod === "number" && u.veil_lod > finest;
    if (o !== root && (u.veil_collider || coarser || /^(COL|UCX)_/.test(o.name))) drop.push(o);
  });
  drop.forEach((o) => o.removeFromParent());
}

function release() {
  if (!current) return;
  scene.remove(current);
  current.traverse((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => {
      for (const v of Object.values(x)) if (v?.isTexture) v.dispose();
      x.dispose?.();
    });
  });
  current = null;
}

window.load = (url, format) =>
  new Promise((resolve, reject) => {
    release();
    const fail = (e) => reject(new Error(String(e?.message ?? e)));
    if (format === "fbx") {
      fbx.load(
        url,
        async (group) => {
          // FBX textures load after the model resolves; give them a moment.
          for (let i = 0; i < 40 && fbxPending; i++) await new Promise((r) => setTimeout(r, 100));
          current = group;
          stripHelpers(current);
          scene.add(current);
          frame(current);
          renderer.render(scene, camera);
          resolve(true);
        },
        undefined,
        fail
      );
      return;
    }
    loader.load(
      url,
      (gltf) => {
        current = gltf.scene;
        stripHelpers(current);
        scene.add(current);
        frame(current);
        renderer.render(scene, camera);
        resolve(true);
      },
      undefined,
      fail
    );
  });

/** Share of the frame the model covers — near zero means a blank render. */
window.coverage = () => {
  renderer.render(scene, camera);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.drawImage(renderer.domElement, 0, 0, 128, 128);
  const px = ctx.getImageData(0, 0, 128, 128).data;
  let hit = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 8) hit++;
  return hit / (128 * 128);
};

/** Swaps every material for a wireframe of the same base tint, renders, restores. */
window.wireframe = () => {
  const saved = [];
  current.traverse((o) => {
    if (!o.isMesh) return;
    saved.push([o, o.material]);
    o.material = new THREE.MeshBasicMaterial({
      color: 0xf5a623,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
  });
  scene.environment = null;
  const prev = scene.background;
  renderer.render(scene, camera);
  const data = renderer.domElement.toDataURL("image/webp", 0.82);
  saved.forEach(([o, m]) => {
    o.material.dispose();
    o.material = m;
  });
  scene.environment = envMap;
  scene.background = prev;
  return data;
};

window.shot = () => {
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/webp", 0.82);
};
window.ready = true;
</script>`;

async function main() {
  const indexPath = path.join(ROOT, "data/models.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  let sources = {};
  try {
    sources = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sources.local.json"), "utf8"));
  } catch {
    console.warn("  ! data/sources.local.json missing — run scan.mjs; only bundled files will render");
  }
  /** Where the page fetches a model: its source folder when known, else the bundled copy. */
  const urlOf = (m, port) =>
    sources[m.id]
      ? `http://127.0.0.1:${port}/src/${m.id}/${encodeURIComponent(path.basename(sources[m.id]))}`
      : m.previewUrl
        ? `http://127.0.0.1:${port}${m.previewUrl}`
        : null;
  const RENDERABLE = new Set(["glb", "gltf", "fbx"]);
  const targets = index.models.filter(
    (m) => RENDERABLE.has(m.format) && (sources[m.id] || m.previewUrl)
  );

  // The index records which models have a thumbnail; the grid reads that flag.
  const markThumbs = () => {
    for (const m of index.models) m.thumb = fs.existsSync(path.join(OUT, `${m.id}.webp`));
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));
    const n = index.models.filter((m) => m.thumb).length;
    console.log(`  ${n} of ${index.models.length} models have a thumbnail`);
  };
  fs.mkdirSync(OUT, { recursive: true });

  const pending = targets.filter(
    (m) => FORCE || !fs.existsSync(path.join(OUT, `${m.id}.webp`))
  );
  if (!pending.length) {
    console.log(`  all ${targets.length} thumbnails present`);
    markThumbs();
    return;
  }
  console.log(`  rendering ${pending.length} of ${targets.length}`);

  const { server, port } = await serve(sources);
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const fresh = async () => {
    const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    await p.setContent(PAGE.replaceAll("/three/", `http://127.0.0.1:${port}/three/`));
    await p.waitForFunction("window.ready === true", { timeout: 60_000 });
    return p;
  };
  let page = await fresh();

  let done = 0;
  let failed = 0;
  const write = (file, dataUrl) =>
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));

  let blank = 0;
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms));
  for (const m of pending) {
    try {
      await Promise.race([page.evaluate(([u, f]) => window.load(u, f), [urlOf(m, port), m.format]), timeout(120_000)]);
      // A frame with (almost) nothing in it — an animation-only FBX, say — is not a thumbnail.
      if ((await page.evaluate(() => window.coverage())) < 0.002) {
        blank++;
        console.warn(`  · ${m.fileName}: renders blank, left on the placeholder`);
        continue;
      }
      write(path.join(OUT, `${m.id}.webp`), await page.evaluate(() => window.shot()));
      write(path.join(OUT, `${m.id}.wire.webp`), await page.evaluate(() => window.wireframe()));
      done++;
    } catch (err) {
      failed++;
      console.warn(`  ! ${m.fileName}: ${String(err.message).split("\n")[0].slice(0, 100)}`);
      if (page.isClosed() || /crash|closed|timed out/i.test(err.message)) page = await fresh();
    }
    if (done % 20 === 0 && done) process.stdout.write(`  ${done}/${pending.length}\n`);
  }

  await browser.close();
  server.close();
  console.log(`\n  ${done} rendered, ${blank} blank, ${failed} failed`);
  markThumbs();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
