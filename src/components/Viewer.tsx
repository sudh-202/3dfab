"use client";

/*
 * react-hooks/immutability is disabled for this file. Driving a three.js scene
 * means mutating the objects useThree and useGLTF return — swapping materials,
 * moving the camera, setting scene.environment. That is the library's API, not
 * an escape hatch, and every mutation here is undone on cleanup.
 */
/* eslint-disable react-hooks/immutability */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Grid, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type Shading = "render" | "wireframe" | "normals" | "matcap" | "basecolor" | "uv";

const SHADING: { value: Shading; label: string; hint: string }[] = [
  { value: "render", label: "Rendered", hint: "Materials and lighting as authored" },
  { value: "basecolor", label: "Base colour", hint: "Albedo only, lighting removed" },
  { value: "wireframe", label: "Wireframe", hint: "Topology over the shaded pass" },
  { value: "normals", label: "Normals", hint: "Surface direction as RGB" },
  { value: "matcap", label: "Clay", hint: "Neutral shading to read form" },
  { value: "uv", label: "UV checker", hint: "Texel density and stretching" },
];

/** A checker texture drawn once and reused, for reading UV stretch. */
function useCheckerTexture() {
  return useMemo(() => {
    const size = 512;
    const cells = 16;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const step = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#20242c" : "#cbd2de";
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
    ctx.strokeStyle = "#f5a623";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Model({
  url,
  shading,
  clip,
  onScene,
}: {
  url: string;
  shading: Shading;
  clip: string | null;
  onScene: (info: { clips: string[]; radius: number }) => void;
}) {
  const gltf = useGLTF(url, "/draco/", true);
  const checker = useCheckerTexture();

  // useGLTF caches per URL, so a fresh graph per mount keeps two viewers from
  // fighting over the same materials. A plain clone() leaves skinned meshes
  // bound to the cached skeleton, so clips would drive bones nobody renders;
  // SkeletonUtils rebinds skins to the copied bones.
  const scene = useMemo(() => cloneSkeleton(gltf.scene) as THREE.Group, [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, group);

  const original = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());

  useLayoutEffect(() => {
    const map = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) map.set(o as THREE.Mesh, (o as THREE.Mesh).material);
    });
    original.current = map;

    // Skinned meshes only have meaningful bounds once their bones are posed,
    // and only the precise path walks skinned vertices. <Center> measures the
    // same way, so camera distance and centring agree.
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update();
    });
    const box = new THREE.Box3().setFromObject(scene, true);
    onScene({
      clips: gltf.animations.map((a) => a.name),
      radius: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.001),
    });
  }, [scene, gltf.animations, onScene]);

  useEffect(() => {
    const swapped: THREE.Material[] = [];

    for (const [mesh, base] of original.current) {
      const first = Array.isArray(base) ? base[0] : base;
      const std = first as THREE.MeshStandardMaterial;

      let next: THREE.Material | null = null;
      switch (shading) {
        case "wireframe":
          next = new THREE.MeshBasicMaterial({
            color: 0xf5a623,
            wireframe: true,
            transparent: true,
            opacity: 0.7,
          });
          break;
        case "normals":
          next = new THREE.MeshNormalMaterial({ flatShading: false });
          break;
        case "matcap":
          next = new THREE.MeshStandardMaterial({ color: 0xb8bec9, roughness: 0.62, metalness: 0 });
          break;
        case "basecolor":
          next = new THREE.MeshBasicMaterial({
            map: std?.map ?? null,
            color: std?.map ? 0xffffff : (std?.color ?? new THREE.Color(0xcccccc)),
          });
          break;
        case "uv":
          next = new THREE.MeshBasicMaterial({ map: checker });
          break;
        default:
          next = null;
      }

      mesh.material = next ?? base;
      if (next) swapped.push(next);
    }

    return () => swapped.forEach((m) => m.dispose());
  }, [shading, checker]);

  useEffect(() => {
    mixer.stopAllAction();
    if (clip && actions[clip]) actions[clip].reset().fadeIn(0.2).play();
  }, [clip, actions, mixer]);

  return (
    <group ref={group}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

/**
 * Image-based lighting generated in-process from three's RoomEnvironment. The
 * preset HDRIs drei ships fetch from a CDN at runtime; this matches the lighting
 * the thumbnails were baked with and needs no network.
 */
function LocalEnvironment() {
  const { scene, gl } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [scene, gl]);
  return null;
}

/** Pulls the camera back to fit whatever just loaded. */
function FitCamera({ radius }: { radius: number }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!radius) return;
    const cam = camera as THREE.PerspectiveCamera;
    // Extra margin so an animated clip that swings wide stays inside the frame.
    const dist = (radius / Math.sin((cam.fov * Math.PI) / 180 / 2)) * 1.3;
    cam.position.set(dist * 0.62, dist * 0.4, dist * 0.72);
    cam.near = dist / 200;
    cam.far = dist * 100;
    cam.updateProjectionMatrix();
    cam.lookAt(0, 0, 0);
  }, [radius, camera]);
  return null;
}

function Turntable({ on, children }: { on: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (on && ref.current) ref.current.rotation.y += delta * 0.25;
  });
  return <group ref={ref}>{children}</group>;
}

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <p className="label animate-pulse">Loading model…</p>
    </div>
  );
}

/** Reads a CSS variable off <html> and re-reads it when the theme flips. */
function useThemeVar(name: string, fallback: string) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const read = () =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [name, fallback]);
  return value;
}

export function Viewer({ url, className = "" }: { url: string; className?: string }) {
  const stage = useThemeVar("--panel", "#1a1d24");
  const gridCell = useThemeVar("--line", "#2c313c");
  const gridSection = useThemeVar("--dim", "#3a4150");
  const [shading, setShading] = useState<Shading>("render");
  const [clips, setClips] = useState<string[]>([]);
  const [clip, setClip] = useState<string | null>(null);
  const [radius, setRadius] = useState(1);
  const [spin, setSpin] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const onScene = useMemo(
    () => (info: { clips: string[]; radius: number }) => {
      setClips(info.clips);
      setRadius(info.radius);
      setClip((c) => c ?? info.clips[0] ?? null);
      setLoaded(true);
    },
    []
  );

  return (
    <div className={`relative overflow-hidden rounded-md border border-line-soft bg-panel ${className}`}>
      <Canvas
        camera={{ fov: 35, position: [2, 1.4, 2.4] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
        className="!absolute inset-0"
      >
        <color attach="background" args={[stage]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 6, 5]} intensity={2} />
        <directionalLight position={[-5, 2, -4]} intensity={0.9} color="#a8c4ff" />
        <Suspense fallback={null}>
          <LocalEnvironment />
          <Turntable on={spin}>
            <Model url={url} shading={shading} clip={clip} onScene={onScene} />
          </Turntable>
        </Suspense>
        {showGrid && (
          <Grid
            args={[radius * 12, radius * 12]}
            position={[0, -radius * 1.02, 0]}
            cellSize={radius / 2}
            sectionSize={radius * 2}
            cellColor={gridCell}
            sectionColor={gridSection}
            fadeDistance={radius * 14}
            fadeStrength={1.5}
            infiniteGrid
          />
        )}
        <FitCamera radius={radius} />
        <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} />
      </Canvas>

      {!loaded && <Loading />}

      {/* Inspector — a properties strip, docked like a DCC panel. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-2.5">
        <div className="pointer-events-auto flex flex-wrap gap-1 rounded border border-line-soft bg-void/80 p-1 backdrop-blur-md">
          {SHADING.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.hint}
              onClick={() => setShading(s.value)}
              aria-pressed={shading === s.value}
              className={`label rounded px-2 py-1.5 text-[10px] transition-colors ${
                shading === s.value ? "bg-sel text-on-sel" : "text-dim hover:bg-panel hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}

          <span className="mx-1 w-px self-stretch bg-line-soft" aria-hidden />

          <Toggle on={spin} onClick={() => setSpin((v) => !v)}>
            Turntable
          </Toggle>
          <Toggle on={showGrid} onClick={() => setShowGrid((v) => !v)}>
            Floor
          </Toggle>
        </div>

        {clips.length > 0 && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded border border-line-soft bg-void/80 p-1 backdrop-blur-md">
            <span className="label px-1.5 text-[10px]">Clips</span>
            {clips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClip(clip === c ? null : c)}
                aria-pressed={clip === c}
                className={`num max-w-[190px] truncate rounded px-2 py-1 text-[11px] transition-colors ${
                  clip === c ? "bg-sel text-on-sel" : "text-dim hover:bg-panel hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {loaded && (
        <p className="pointer-events-none absolute right-3 top-3 text-[11px] text-faint">
          Drag to orbit · scroll to zoom
        </p>
      )}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`label rounded px-2 py-1.5 text-[10px] transition-colors ${
        on ? "bg-panel text-sel" : "text-dim hover:bg-panel hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
