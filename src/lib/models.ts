import index from "@/../data/models.json";

export type Weight = "light" | "medium" | "heavy" | "extreme" | "unknown";

export interface AnimationInfo {
  name: string;
  channels: number;
}

export interface MaterialInfo {
  name: string;
  alphaMode: string;
  doubleSided: boolean;
  metallic: number;
  roughness: number;
}

export interface ModelDetail {
  parsed: boolean;
  drawCalls?: number;
  meshes?: number;
  nodes?: number;
  materials?: MaterialInfo[];
  imageCount?: number;
  textureBytes?: number;
  animations?: AnimationInfo[];
  skins?: number;
  bones?: number;
  bbox?: { min: number[]; max: number[]; size: number[] } | null;
  generator?: string | null;
  gltfVersion?: string | null;
  extensions?: string[];
  draco?: boolean;
  // FBX
  binary?: boolean;
  fbxVersion?: string | null;
  hasSkin?: boolean;
  hasAnimation?: boolean;
  hasEmbeddedTextures?: boolean;
  // .blend
  blenderVersion?: string;
  objects?: number;
  scenes?: number;
  armatures?: number;
  actions?: number;
  compressed?: boolean;
  compression?: string | null;
}

export interface Model {
  id: string;
  name: string;
  fileName: string;
  format: string;
  collection: string;
  group: string;
  bytes: number;
  modified: string;
  created: string;
  /** Byte-identical copies that were collapsed into this record. */
  duplicateCount: number;
  triangles: number | null;
  vertices: number | null;
  weight: Weight;
  animationCount: number;
  materialCount: number | null;
  textureCount: number | null;
  detail: ModelDetail;
  previewUrl: string | null;
}

export interface Library {
  generatedAt: string;
  totals: {
    models: number;
    bytes: number;
    triangles: number;
    vertices: number;
    animated: number;
    duplicates: number;
    previewable: number;
    previewBytes: number;
  };
  collections: { name: string; count: number; bytes: number; triangles: number }[];
  offlineRoots: string[];
  models: Model[];
}

export const library = index as unknown as Library;

export const models = library.models;

export function getModel(id: string) {
  return models.find((m) => m.id === id);
}

/**
 * Same asset exported more than once — a source mesh and its game-ready
 * decimation, say. They share a name, differ in geometry, and belong on one
 * card with a picker rather than on two near-identical cards.
 */
export const variantKey = (m: Model) => m.name.trim().toLowerCase();

export function variantsOf(model: Model) {
  const key = variantKey(model);
  return models.filter((m) => m.id !== model.id && variantKey(m) === key);
}

/** Models sharing a group + collection, minus the one being viewed and its variants. */
export function relatedModels(model: Model, limit = 8) {
  const key = variantKey(model);
  const others = models.filter((m) => m.id !== model.id && variantKey(m) !== key);
  const sameGroup = others.filter(
    (m) => m.collection === model.collection && m.group === model.group
  );
  const sameCollection = others.filter(
    (m) => m.collection === model.collection && m.group !== model.group
  );
  return [...sameGroup, ...sameCollection].slice(0, limit);
}

export const FORMATS = [...new Set(models.map((m) => m.format))].sort();
export const COLLECTIONS = library.collections.map((c) => c.name);
export const GROUPS = [...new Set(models.map((m) => m.group))].sort();

export const WEIGHT_ORDER: Weight[] = ["light", "medium", "heavy", "extreme", "unknown"];

export const WEIGHT_LABEL: Record<Weight, string> = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  extreme: "Extreme",
  unknown: "Uncounted",
};

/** Bounds of each class, used for the meter legend and the overview histogram. */
export const WEIGHT_RANGE: Record<Weight, string> = {
  light: "< 5K tris",
  medium: "5K – 50K",
  heavy: "50K – 250K",
  extreme: "> 250K",
  unknown: "not parsed",
};
