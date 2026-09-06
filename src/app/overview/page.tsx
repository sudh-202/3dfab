import Link from "next/link";
import { library, models, WEIGHT_LABEL, WEIGHT_ORDER, WEIGHT_RANGE, type Weight } from "@/lib/models";
import { WEIGHT_FILL, WeightDot } from "@/components/BudgetMeter";
import { bytes, count, exact, relativeDate } from "@/lib/format";

export const metadata = {
  title: "Overview — 3DFAB",
  description: "Where the triangles and the disk space actually went.",
};

/* Decade buckets on the same log scale the card meters use. */
const BUCKETS = [
  { label: "< 1K", max: 1_000 },
  { label: "1–5K", max: 5_000 },
  { label: "5–20K", max: 20_000 },
  { label: "20–50K", max: 50_000 },
  { label: "50–250K", max: 250_000 },
  { label: "> 250K", max: Infinity },
];

function weightOf(tris: number): Weight {
  if (tris < 5_000) return "light";
  if (tris < 50_000) return "medium";
  if (tris < 250_000) return "heavy";
  return "extreme";
}

export default function Overview() {
  const { totals, collections } = library;

  const counted = models.filter((m) => m.triangles);
  const histogram = BUCKETS.map((b, i) => {
    const min = i === 0 ? 0 : BUCKETS[i - 1].max;
    const inBucket = counted.filter((m) => m.triangles! >= min && m.triangles! < b.max);
    return {
      ...b,
      n: inBucket.length,
      weight: weightOf(Math.min(b.max === Infinity ? 300_000 : b.max - 1, b.max)),
    };
  });
  const peak = Math.max(...histogram.map((h) => h.n), 1);

  const heaviest = [...counted].sort((a, b) => b.triangles! - a.triangles!).slice(0, 10);
  const largest = [...models].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
  const recent = [...models].sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 8);

  const byFormat = Object.entries(
    models.reduce<Record<string, { n: number; bytes: number }>>((acc, m) => {
      (acc[m.format] ??= { n: 0, bytes: 0 }).n++;
      acc[m.format].bytes += m.bytes;
      return acc;
    }, {})
  ).sort((a, b) => b[1].n - a[1].n);

  const duplicated = models.filter((m) => m.duplicates.length > 0);
  const wastedBytes = duplicated.reduce((s, m) => s + m.bytes * m.duplicates.length, 0);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <p className="label mb-4">Overview</p>
        <h1 className="display text-[clamp(2rem,5vw,3.25rem)]">
          Where the triangles went.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-dim">
          {count(totals.triangles)} triangles and {bytes(totals.bytes)} spread across{" "}
          {totals.models} files. Most of the library is cheap; a handful of meshes carry the cost.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Histogram — the shape of the library in one read. */}
        <section className="rounded-md border border-line-soft bg-panel p-5 lg:col-span-2">
          <h2 className="label mb-1">Triangle distribution</h2>
          <p className="mb-6 text-[12.5px] text-faint">
            {counted.length} models with a parsed triangle count.
          </p>

          <div className="flex h-52 gap-2 sm:gap-3">
            {histogram.map((h) => (
              <div key={h.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="num text-[12px] text-ink">{h.n}</span>
                {/* The track carries the height; the bar is measured against it. */}
                <div className="relative w-full flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-sm"
                    style={{
                      height: `${Math.max((h.n / peak) * 100, 1.5).toFixed(3)}%`,
                      backgroundColor: WEIGHT_FILL[h.weight],
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span className="num w-full truncate text-center text-[10.5px] text-faint">
                  {h.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-soft pt-4">
            {WEIGHT_ORDER.filter((w) => w !== "unknown").map((w) => (
              <span key={w} className="flex items-center gap-1.5 text-[11.5px] text-dim">
                <WeightDot weight={w} />
                {WEIGHT_LABEL[w]}
                <span className="num text-faint">{WEIGHT_RANGE[w]}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line-soft bg-panel p-5">
          <h2 className="label mb-4">By project</h2>
          <ul className="space-y-4">
            {collections.map((c) => {
              const share = c.bytes / totals.bytes;
              return (
                <li key={c.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] text-ink">{c.name}</span>
                    <span className="num shrink-0 text-[11.5px] text-faint">
                      {c.count} · {bytes(c.bytes)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-sel"
                      style={{ width: `${Math.max(share * 100, 1).toFixed(3)}%` }}
                    />
                  </div>
                  <p className="num mt-1 text-[10.5px] text-faint">
                    {count(c.triangles)} tris · {(share * 100).toFixed(0)}% of disk
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Ranked
          title="Heaviest meshes"
          note="These are what blow a frame budget."
          rows={heaviest.map((m) => ({
            id: m.id,
            name: m.name,
            meta: m.collection,
            value: `${count(m.triangles)} tris`,
          }))}
        />
        <Ranked
          title="Largest files"
          note="Usually texture data, not geometry."
          rows={largest.map((m) => ({
            id: m.id,
            name: m.name,
            meta: m.format.toUpperCase(),
            value: bytes(m.bytes),
          }))}
        />
        <Ranked
          title="Recently changed"
          rows={recent.map((m) => ({
            id: m.id,
            name: m.name,
            meta: m.collection,
            value: relativeDate(m.modified),
          }))}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-md border border-line-soft bg-panel p-5">
          <h2 className="label mb-4">Formats</h2>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="label border-b border-line-soft">
                <th className="py-2 font-normal">Format</th>
                <th className="py-2 text-right font-normal">Files</th>
                <th className="py-2 text-right font-normal">On disk</th>
                <th className="py-2 text-right font-normal">Viewable</th>
              </tr>
            </thead>
            <tbody>
              {byFormat.map(([f, v]) => {
                const viewable = models.filter((m) => m.format === f && m.previewUrl).length;
                return (
                  <tr key={f} className="border-b border-line-soft/60 last:border-0">
                    <td className="num py-2.5 text-ink">.{f}</td>
                    <td className="num py-2.5 text-right text-dim">{v.n}</td>
                    <td className="num py-2.5 text-right text-dim">{bytes(v.bytes)}</td>
                    <td className="num py-2.5 text-right text-faint">
                      {viewable}/{v.n}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-line-soft bg-panel p-5">
          <h2 className="label mb-1">Duplicates</h2>
          <p className="mb-5 text-[12.5px] text-faint">
            Byte-identical files kept in more than one place.
          </p>

          {duplicated.length === 0 ? (
            <p className="text-[13px] text-dim">No duplicate files found.</p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <p className="label mb-1.5">duplicated files</p>
                  <p className="num text-2xl leading-none text-ink">{duplicated.length}</p>
                </div>
                <div>
                  <p className="label mb-1.5">extra copies</p>
                  <p className="num text-2xl leading-none text-ink">{totals.duplicates}</p>
                </div>
                <div>
                  <p className="label mb-1.5">reclaimable</p>
                  <p className="num text-2xl leading-none text-sel">{bytes(wastedBytes)}</p>
                </div>
              </div>
              <ul className="space-y-px">
                {duplicated.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/model/${m.id}`}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-[12.5px] hover:bg-raise"
                    >
                      <span className="truncate text-dim">{m.name}</span>
                      <span className="num shrink-0 text-[11px] text-faint">
                        ×{m.duplicates.length + 1} · {bytes(m.bytes)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-md border border-line-soft bg-panel p-5">
        <h2 className="label mb-4">Index coverage</h2>
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          <Fact k="Files indexed" v={exact(totals.models)} />
          <Fact k="Geometry parsed" v={`${counted.length} / ${totals.models}`} />
          <Fact k="Bundled for preview" v={`${totals.previewable} (${bytes(totals.previewBytes)})`} />
          <Fact k="With rigs or clips" v={exact(totals.animated)} />
          <Fact k="Total vertices" v={count(totals.vertices)} />
        </div>
        <p className="mt-5 max-w-2xl border-t border-line-soft pt-4 text-[12.5px] leading-relaxed text-faint">
          FBX and .blend files are read from their headers only — a full parse would not change what
          you can do with them here. Files above the bundle size cap stay indexed but are not copied
          into the deployment, so they show specs without a viewer.
        </p>
      </section>
    </main>
  );
}

function Ranked({
  title,
  note,
  rows,
}: {
  title: string;
  note?: string;
  rows: { id: string; name: string; meta: string; value: string }[];
}) {
  return (
    <section className="rounded-md border border-line-soft bg-panel p-5">
      <h2 className="label mb-1">{title}</h2>
      {note && <p className="mb-4 text-[12.5px] text-faint">{note}</p>}
      <ol className="space-y-px">
        {rows.map((r, i) => (
          <li key={r.id}>
            <Link
              href={`/model/${r.id}`}
              className="group flex items-center gap-3 rounded px-2 py-1.5 hover:bg-raise"
            >
              <span className="num w-4 shrink-0 text-[11px] text-line">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-dim group-hover:text-sel">
                  {r.name}
                </span>
                <span className="num block truncate text-[10.5px] text-faint">{r.meta}</span>
              </span>
              <span className="num shrink-0 text-[11.5px] text-ink">{r.value}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="label mb-1.5">{k}</p>
      <p className="num text-xl leading-none text-ink">{v}</p>
    </div>
  );
}
