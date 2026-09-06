import { budgetPosition, count } from "@/lib/format";
import type { Weight } from "@/lib/models";

const FILL: Record<Weight, string> = {
  light: "var(--color-w-light)",
  medium: "var(--color-w-medium)",
  heavy: "var(--color-w-heavy)",
  extreme: "var(--color-w-extreme)",
  unknown: "var(--color-line)",
};

/* Class boundaries, as positions on the same log scale the bar uses. */
const TICKS = [5_000, 50_000, 250_000].map(budgetPosition);

/**
 * Where a model sits on a 100 → 1M triangle scale. Every card carries one, so
 * scanning the grid tells you what you can afford before you open anything.
 */
export function BudgetMeter({
  triangles,
  weight,
  showTicks = true,
  height = 3,
}: {
  triangles: number | null;
  weight: Weight;
  showTicks?: boolean;
  height?: number;
}) {
  const pos = budgetPosition(triangles);
  const unknown = !triangles;

  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-line-soft"
      style={{ height }}
      role="meter"
      aria-valuenow={triangles ?? 0}
      aria-valuemin={0}
      aria-valuemax={1_000_000}
      aria-label={
        unknown ? "Triangle count not available" : `${count(triangles)} triangles, ${weight} weight`
      }
    >
      {unknown ? (
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, var(--color-line) 0 3px, transparent 3px 7px)",
          }}
        />
      ) : (
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(pos * 100, 2).toFixed(3)}%`,
            backgroundColor: FILL[weight],
          }}
        />
      )}

      {showTicks &&
        TICKS.map((t) => (
          <div
            key={t}
            className="absolute inset-y-0 w-px bg-void/70"
            style={{ left: `${t * 100}%` }}
          />
        ))}
    </div>
  );
}

export function WeightDot({ weight }: { weight: Weight }) {
  return (
    <span
      className="inline-block size-[7px] shrink-0 rounded-full"
      style={{ backgroundColor: FILL[weight] }}
      aria-hidden
    />
  );
}

export { FILL as WEIGHT_FILL };
