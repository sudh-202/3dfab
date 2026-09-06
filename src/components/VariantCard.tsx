"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, CardBody, CardShell, FormatPlate, Thumb } from "./ModelCard";
import { WeightDot } from "./BudgetMeter";
import { bytes, count } from "@/lib/format";
import type { Model } from "@/lib/models";

const SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw";

/** Stacked-squares glyph: one asset, several exports. */
function LayersIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4.5" y="1.5" width="10" height="10" rx="1.5" />
      <path d="M1.5 5.5v7a2 2 0 0 0 2 2h7" />
    </svg>
  );
}

/**
 * Several exports of one asset share a card. The card shows the export we can
 * render (heaviest first, since that is usually the source), and opening it
 * asks which variant you meant before going to a model page.
 */
export function VariantCard({ variants }: { variants: Model[] }) {
  const [wire, setWire] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const sorted = [...variants].sort(
    (a, b) => Number(Boolean(b.previewUrl)) - Number(Boolean(a.previewUrl)) || (b.triangles ?? 0) - (a.triangles ?? 0)
  );
  const lead = sorted[0];

  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();

  // Clicking the dim backdrop closes; clicks inside the panel do not.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) close();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  const trisRange = (() => {
    const t = sorted.map((m) => m.triangles).filter((n): n is number => n != null);
    if (!t.length) return "—";
    const lo = Math.min(...t);
    const hi = Math.max(...t);
    return lo === hi ? `${count(lo)} tris` : `${count(lo)} – ${count(hi)} tris`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="block h-full w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-sel"
        onFocus={() => setWire(true)}
        onBlur={() => setWire(false)}
        aria-haspopup="dialog"
      >
        <CardShell
          onHover={setWire}
          media={
            <>
              <Thumb model={lead} wire={wire} sizes={SIZES} />
              <div className="absolute left-3 top-3 flex gap-1">
                <Badge title={`${variants.length} exports of this asset`}>
                  <span className="inline-flex items-center gap-1">
                    <LayersIcon />
                    {variants.length} variants
                  </span>
                </Badge>
                {sorted.some((m) => m.animationCount !== 0) && <Badge title="Has animation clips">anim</Badge>}
              </div>
              <span className="num absolute right-3 top-3 rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] uppercase text-dim backdrop-blur-sm">
                {[...new Set(sorted.map((m) => m.format))].join(" · ")}
              </span>
            </>
          }
        >
          <CardBody model={lead} subtitle={`${trisRange} · ${variants.length} exports · ${lead.collection}`} />
        </CardShell>
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,640px)] rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-scrim"
        aria-labelledby={`variants-${lead.id}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
          <div>
            <p className="label mb-1.5">Choose an export</p>
            <h2 id={`variants-${lead.id}`} className="display text-xl text-ink">
              {lead.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-dim transition-colors hover:bg-raise hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </div>

        <ul className="divide-y divide-line-soft">
          {sorted.map((m) => (
            <li key={m.id}>
              <Link
                href={`/model/${m.id}`}
                onClick={close}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-raise"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-raise">
                  {m.previewUrl ? (
                    <Image src={`/thumbs/${m.id}.webp`} alt="" fill sizes="64px" className="object-contain p-1.5" />
                  ) : (
                    <FormatPlate format={m.format} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] text-ink">
                    <WeightDot weight={m.weight} />
                    <span className="num">{count(m.triangles)} tris</span>
                    <span className="text-faint">·</span>
                    <span className="num text-dim">{count(m.vertices)} verts</span>
                  </p>
                  <p className="num mt-1 truncate text-[11.5px] text-faint">
                    .{m.format} · {bytes(m.bytes)} · {m.collection} / {m.group}
                    {m.animationCount !== 0 ? " · animated" : ""}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-faint" aria-hidden>
                  <path d="m6 3 5 5-5 5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
