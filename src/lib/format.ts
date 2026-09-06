/** Byte sizes read as file sizes, not storage-vendor decimals. */
export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** Counts stay readable at a glance: 1792 → 1.8K, 639005 → 639K. */
export function count(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`;
}

export function exact(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("en-US");
}

export function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  const y = Math.floor(days / 365);
  return `${y} yr${y > 1 ? "s" : ""} ago`;
}

/** Scene units are unlabelled in glTF; show enough precision to compare. */
export function dim(n: number) {
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

/**
 * Position on the triangle-budget scale. An asset library spans four orders of
 * magnitude, so the scale is logarithmic from 100 to 1M — a linear bar would
 * flatten every prop against one hero mesh.
 */
export const BUDGET_MIN = 100;
export const BUDGET_MAX = 1_000_000;

export function budgetPosition(tris: number | null | undefined) {
  if (!tris || tris <= 0) return 0;
  const lo = Math.log10(BUDGET_MIN);
  const hi = Math.log10(BUDGET_MAX);
  return Math.min(1, Math.max(0, (Math.log10(tris) - lo) / (hi - lo)));
}
