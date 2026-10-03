"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BudgetMeter } from "./BudgetMeter";
import { CreditLine } from "./Credit";
import { bytes, count } from "@/lib/format";
import type { Model } from "@/lib/models";

/** Why a file has no still: what the card says instead of a picture. */
function plateNote(model: Model) {
  const d = model.detail;
  if (model.triangles) return `${count(model.triangles)} tris`;
  if (model.format === "fbx" && d.hasAnimation && !d.hasSkin) return "animation only · no mesh";
  if (model.format === "blend") return d.objects != null ? `${d.objects} objects` : "Blender scene";
  return d.parsed ? "no geometry" : "not parsed";
}

/**
 * Files we cannot render in a browser still deserve a real card. The plate
 * draws the bounding-box glyph in the accent, the format large, and what we
 * do know about the file — it reads as "indexed, no picture", not as a broken
 * image. `compact` is the 64px version used in variant lists.
 */
export function FormatPlate({ model, compact = false }: { model: Model; compact?: boolean }) {
  if (compact) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-sel-soft">
        <span className="label text-[9px] text-sel">.{model.format}</span>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_42%,var(--sel-soft),transparent_62%)]">
      <svg viewBox="0 0 120 120" className="size-[38%] max-h-28 text-sel" fill="none" aria-hidden>
        <path d="M60 18 98 40v40L60 102 22 80V40z" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M22 40 60 62 98 40M60 62v40" stroke="currentColor" strokeOpacity=".3" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
      <div className="text-center">
        <p className="num text-[22px] uppercase leading-none tracking-wide text-ink">.{model.format}</p>
        <p className="num mt-2 text-[11px] text-dim">{plateNote(model)}</p>
        <p className="label mt-1.5 text-[9px] text-faint">{model.collection}</p>
      </div>
    </div>
  );
}

/** Shaded thumbnail that crossfades to its wireframe pass while `wire` is true. */
export function Thumb({ model, wire, sizes }: { model: Model; wire: boolean; sizes: string }) {
  if (!model.thumb) return <FormatPlate model={model} />;
  return (
    <>
      <Image
        src={`/thumbs/${model.id}.webp`}
        alt={model.name}
        fill
        sizes={sizes}
        className="object-contain p-5 transition-opacity duration-200"
        style={{ opacity: wire ? 0 : 1 }}
      />
      <Image
        src={`/thumbs/${model.id}.wire.webp`}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        loading="lazy"
        className="object-contain p-5 transition-opacity duration-200"
        style={{ opacity: wire ? 1 : 0 }}
      />
    </>
  );
}

const SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw";

/** Focus ring for a card's stretched action, drawn inside the clipped shell. */
export const CARD_ACTION =
  "absolute inset-0 z-[1] rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sel";

/**
 * `action` is the card's link or button, stretched over the whole card. It is
 * a sibling of the content rather than its wrapper so the footer (a credit
 * line) can hold its own link without nesting one anchor inside another.
 */
export function CardShell({
  children,
  media,
  action,
  footer,
  onHover,
}: {
  children: React.ReactNode;
  media: React.ReactNode;
  action: React.ReactNode;
  footer?: React.ReactNode;
  onHover?: (on: boolean) => void;
}) {
  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line-soft bg-panel transition-[border-color,transform] duration-200 hover:border-line hover:-translate-y-0.5"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {action}
      <div className="relative aspect-[4/3] overflow-hidden bg-raise">{media}</div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {children}
        {footer && <div className="relative z-[2] -mt-1 min-w-0">{footer}</div>}
      </div>
    </div>
  );
}

export function CardBody({ model, subtitle }: { model: Model; subtitle?: string }) {
  return (
    <>
      <div className="min-w-0">
        <h3 className="truncate text-[14px] font-medium leading-snug text-ink transition-colors group-hover:text-sel">
          {model.name}
        </h3>
        <p className="num mt-1 truncate text-[11.5px] text-faint">
          {subtitle ?? `${count(model.triangles)} tris · ${bytes(model.bytes)} · ${model.collection}`}
        </p>
      </div>
      <div className="mt-auto">
        <BudgetMeter triangles={model.triangles} weight={model.weight} />
      </div>
    </>
  );
}

export function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="num rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] text-sel backdrop-blur-sm"
    >
      {children}
    </span>
  );
}

export function ModelCard({ model }: { model: Model }) {
  const [wire, setWire] = useState(false);

  return (
    <CardShell
      onHover={setWire}
      action={
        <Link
          href={`/model/${model.id}`}
          aria-label={model.name}
          className={CARD_ACTION}
          onFocus={() => setWire(true)}
          onBlur={() => setWire(false)}
        />
      }
      footer={model.credit && <CreditLine credit={model.credit} />}
      media={
        <>
          <Thumb model={model} wire={wire} sizes={SIZES} />
          <div className="absolute left-3 top-3 flex gap-1">
            {model.animationCount !== 0 && <Badge title="Has animation clips">anim</Badge>}
          </div>
          <span className="num absolute right-3 top-3 rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] uppercase text-dim backdrop-blur-sm">
            {model.format}
          </span>
        </>
      }
    >
      <CardBody model={model} />
    </CardShell>
  );
}
