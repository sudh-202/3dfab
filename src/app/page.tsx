import Link from "next/link";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import { library, models } from "@/lib/models";
import { bytes, count } from "@/lib/format";

export default function Home() {
  const { totals, collections } = library;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line-soft">
        <div className="grid-floor absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-20 sm:px-8 sm:pt-28">
          <p className="label mb-5">Free 3D model library</p>

          <h1 className="display max-w-5xl text-[clamp(2.1rem,4.4vw,3.4rem)]">
            Everything modelled,
            <br />
            <span className="text-sel">counted down to the triangle.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-dim">
            {totals.models} models across {collections.length} projects. Triangle counts, bounding
            boxes, materials and rigs come out of the files themselves. Open any model, inspect it
            in the browser, and download it — free to use, no attribution required.
          </p>

          <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
            <Stat label="models" value={String(totals.models)} />
            <Stat label="triangles" value={count(totals.triangles)} />
            <Stat label="animated" value={String(totals.animated)} />
            <Stat label="viewable" value={String(totals.previewable)} />
            <Stat label="total size" value={bytes(totals.bytes)} />
          </dl>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#library"
              className="label rounded-lg bg-sel px-5 py-3 text-on-sel transition-opacity hover:opacity-90"
            >
              Browse the library
            </a>
            <Link
              href="/overview"
              className="label rounded-lg border border-line px-5 py-3 text-dim transition-colors hover:border-sel hover:text-sel"
            >
              See the breakdown
            </Link>
          </div>
        </div>
      </section>

      <div id="library" />
      <LibraryBrowser models={models} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label mb-2">{label}</dt>
      <dd className="num text-[28px] leading-none text-ink">{value}</dd>
    </div>
  );
}
