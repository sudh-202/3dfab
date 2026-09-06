"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BudgetMeter } from "./BudgetMeter";
import { bytes, count } from "@/lib/format";
import type { Model } from "@/lib/models";

/**
 * Files we cannot render in a browser still deserve a real card. The plate
 * draws an empty bounding box with the format in the middle — it reads as
 * "indexed, not viewable" rather than as a broken image.
 */
export function FormatPlate({ format }: { format: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full text-line" fill="none" aria-hidden>
        <path d="M60 22 96 42v36L60 98 24 78V42z" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
      </svg>
      <span className="label relative z-10 text-[10px] text-faint">.{format}</span>
    </div>
  );
}

/** Shaded thumbnail that crossfades to its wireframe pass while `wire` is true. */
export function Thumb({ model, wire, sizes }: { model: Model; wire: boolean; sizes: string }) {
  if (!model.previewUrl) return <FormatPlate format={model.format} />;
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

export function CardShell({
  children,
  media,
  onHover,
}: {
  children: React.ReactNode;
  media: React.ReactNode;
  onHover?: (on: boolean) => void;
}) {
  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line-soft bg-panel transition-[border-color,transform] duration-200 hover:border-line hover:-translate-y-0.5"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-raise">{media}</div>
      <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
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
    <Link
      href={`/model/${model.id}`}
      className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-sel"
      onFocus={() => setWire(true)}
      onBlur={() => setWire(false)}
    >
      <CardShell
        onHover={setWire}
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
    </Link>
  );
}
