#!/usr/bin/env node
/**
 * Renders two thumbnails per previewable model — a shaded pass and a wireframe
 * pass — by loading each file into a real WebGL context via headless Chromium.
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
  ".html": "text/html",
};

/** Serves public/ plus node_modules/three so the page can import the real library. */
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const file = url.startsWith("/three/")
        ? path.join(ROOT, "node_modules/three", url.slice(7))
        : path.join(PUBLIC, url);
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

window.load = (url) =>
  new Promise((resolve, reject) => {
    if (current) {
      scene.remove(current);
      current.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.());
      });
      current = null;
    }
    loader.load(
      url,
      (gltf) => {
        current = gltf.scene;
        scene.add(current);
        frame(current);
        renderer.render(scene, camera);
        resolve(true);
      },
      undefined,
      (e) => reject(new Error(String(e?.message ?? e)))
    );
  });

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
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "data/models.json"), "utf8"));
  const targets = index.models.filter((m) => m.previewUrl);
  fs.mkdirSync(OUT, { recursive: true });

  const pending = targets.filter(
    (m) => FORCE || !fs.existsSync(path.join(OUT, `${m.id}.webp`))
  );
  if (!pending.length) {
    console.log(`  all ${targets.length} thumbnails present`);
    return;
  }
  console.log(`  rendering ${pending.length} of ${targets.length}`);

  const { server, port } = await serve();
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  await page.setContent(PAGE.replaceAll("/three/", `http://127.0.0.1:${port}/three/`));
  await page.waitForFunction("window.ready === true", { timeout: 60_000 });

  let done = 0;
  let failed = 0;
  const write = (file, dataUrl) =>
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));

  for (const m of pending) {
    const url = `http://127.0.0.1:${port}${m.previewUrl}`;
    try {
      await page.evaluate((u) => window.load(u), url);
      write(path.join(OUT, `${m.id}.webp`), await page.evaluate(() => window.shot()));
      write(path.join(OUT, `${m.id}.wire.webp`), await page.evaluate(() => window.wireframe()));
      done++;
    } catch (err) {
      failed++;
      console.warn(`  ! ${m.fileName}: ${String(err.message).split("\n")[0].slice(0, 80)}`);
    }
    if (done % 20 === 0 && done) process.stdout.write(`  ${done}/${pending.length}\n`);
  }

  await browser.close();
  server.close();
  console.log(`\n  ${done} rendered, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
