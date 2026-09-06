import Link from "next/link";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import { library, models } from "@/lib/models";
import { bytes, count } from "@/lib/format";

export default function Home() {
  const { totals, collections, offlineRoots } = library;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line-soft">
        <div className="grid-floor absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-[1600px] px-4 pb-9 pt-12 sm:px-6 sm:pt-16">
          <p className="label mb-4">Local 3D asset ledger</p>

          <h1 className="display max-w-5xl text-[clamp(2.1rem,5vw,3.6rem)]">
            Everything you have modelled,
            <br />
            <span className="text-sel">counted down to the triangle.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-dim">
            {totals.models} files across {collections.length} projects on this machine, read
            straight from disk. Triangle counts, bounding boxes, materials and rigs come out of the
            files themselves — not from a name or a folder.
          </p>

          {/* The ledger line: totals as a spec strip, not as stat cards. */}
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5 border-t border-line-soft pt-6">
            <Stat label="models" value={String(totals.models)} />
            <Stat label="triangles" value={count(totals.triangles)} />
            <Stat label="vertices" value={count(totals.vertices)} />
            <Stat label="on disk" value={bytes(totals.bytes)} />
            <Stat label="with rigs or clips" value={String(totals.animated)} />
            <Stat label="viewable here" value={String(totals.previewable)} />
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/overview"
              className="label rounded border border-line px-3.5 py-2.5 text-sel transition-colors hover:bg-sel-soft"
            >
              See the breakdown
            </Link>
            {totals.duplicates > 0 && (
              <p className="num text-[12px] text-faint">
                {totals.duplicates} duplicate copies collapsed into their originals
              </p>
            )}
            {offlineRoots.length > 0 && (
              <p className="num text-[12px] text-w-heavy">
                {offlineRoots.join(", ")} offline at index time
              </p>
            )}
          </div>
        </div>
      </section>

      <LibraryBrowser models={models} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label mb-1.5">{label}</dt>
      <dd className="num text-2xl leading-none text-ink">{value}</dd>
    </div>
  );
}
