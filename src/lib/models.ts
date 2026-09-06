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
  sourcePath: string;
  relPath: string;
  bytes: number;
  modified: string;
  created: string;
  duplicates: string[];
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
  host: string;
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

/** Models sharing a group + collection, minus the one being viewed. */
export function relatedModels(model: Model, limit = 8) {
  const sameGroup = models.filter(
    (m) => m.id !== model.id && m.collection === model.collection && m.group === model.group
  );
  const sameCollection = models.filter(
    (m) => m.id !== model.id && m.collection === model.collection && m.group !== model.group
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
