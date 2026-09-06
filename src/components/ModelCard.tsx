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
function FormatPlate({ format }: { format: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 size-full text-line"
        fill="none"
        aria-hidden
      >
        <path
          d="M60 22 96 42v36L60 98 24 78V42z"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      </svg>
      <span className="label relative z-10 text-[10px] text-faint">.{format}</span>
    </div>
  );
}

export function ModelCard({ model }: { model: Model }) {
  const [wire, setWire] = useState(false);
  const hasThumb = Boolean(model.previewUrl);
  const animated = model.animationCount !== 0;

  return (
    <Link
      href={`/model/${model.id}`}
      className="group relative flex flex-col overflow-hidden rounded-md border border-line-soft bg-panel transition-colors hover:border-line focus-visible:border-sel"
      onMouseEnter={() => setWire(true)}
      onMouseLeave={() => setWire(false)}
      onFocus={() => setWire(true)}
      onBlur={() => setWire(false)}
    >
      <div className="relative aspect-square overflow-hidden bg-raise">
        {hasThumb ? (
          <>
            <Image
              src={`/thumbs/${model.id}.webp`}
              alt={model.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
              className="object-contain p-2 transition-opacity duration-200"
              style={{ opacity: wire ? 0 : 1 }}
            />
            {/* Wireframe pass sits on top and fades in — topology from the grid. */}
            <Image
              src={`/thumbs/${model.id}.wire.webp`}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw"
              loading="lazy"
              className="object-contain p-2 transition-opacity duration-200"
              style={{ opacity: wire ? 1 : 0 }}
            />
          </>
        ) : (
          <FormatPlate format={model.format} />
        )}

        <div className="absolute left-2 top-2 flex gap-1">
          {animated && (
            <Badge title={animated ? "Has animation clips" : undefined}>anim</Badge>
          )}
          {model.detail.draco && <Badge>draco</Badge>}
          {model.duplicates.length > 0 && (
            <Badge title={`${model.duplicates.length} duplicate copies on disk`}>
              ×{model.duplicates.length + 1}
            </Badge>
          )}
        </div>

        <span className="num absolute right-2 top-2 rounded bg-void/75 px-1.5 py-0.5 text-[10px] uppercase text-dim backdrop-blur-sm">
          {model.format}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-line-soft p-3">
        <h3 className="line-clamp-1 text-[13px] font-medium leading-tight text-ink transition-colors group-hover:text-sel">
          {model.name}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="num text-[11px] text-dim">{count(model.triangles)} tris</span>
          <span className="num text-[11px] text-faint">{bytes(model.bytes)}</span>
        </div>

        <BudgetMeter triangles={model.triangles} weight={model.weight} />
      </div>
    </Link>
  );
}

function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="num rounded bg-void/75 px-1.5 py-0.5 text-[10px] text-sel backdrop-blur-sm"
    >
      {children}
    </span>
  );
}
