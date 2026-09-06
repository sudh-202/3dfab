"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ModelCard } from "./ModelCard";
import { VariantCard } from "./VariantCard";
import { WeightDot } from "./BudgetMeter";
import { bytes, count } from "@/lib/format";
import {
  variantKey,
  WEIGHT_LABEL,
  WEIGHT_ORDER,
  WEIGHT_RANGE,
  type Model,
  type Weight,
} from "@/lib/models";

type Sort = "name" | "tris-desc" | "tris-asc" | "size-desc" | "recent";

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "tris-desc", label: "Heaviest first" },
  { value: "tris-asc", label: "Lightest first" },
  { value: "size-desc", label: "Largest file" },
  { value: "recent", label: "Recently changed" },
];

const FLAGS = [
  { key: "animated", label: "Animated" },
  { key: "viewable", label: "Viewable in browser" },
] as const;
type FlagKey = (typeof FLAGS)[number]["key"];

type Option = { value: string; label: string; n: number; note?: string; swatch?: React.ReactNode };

/** Dropdown facet, Sketchfab-style: one button per dimension, checkboxes inside. */
function FilterMenu({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = selected.length > 0;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-[13px] transition-colors ${
          active
            ? "border-sel/60 bg-sel-soft text-sel"
            : "border-line-soft bg-panel text-dim hover:border-line hover:text-ink"
        }`}
      >
        {label}
        {active && <span className="num text-[11px]">{selected.length}</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="m2 3.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable
          className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[60vh] min-w-[240px] overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-2xl"
        >
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onToggle(o.value)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                    on ? "bg-sel-soft text-sel" : "text-dim hover:bg-raise hover:text-ink"
                  }`}
                >
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border ${
                      on ? "border-sel bg-sel text-on-sel" : "border-line"
                    }`}
                    aria-hidden
                  >
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m2 5 2.2 2.2L8 3" />
                      </svg>
                    )}
                  </span>
                  {o.swatch}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.note && <span className="num text-[10.5px] text-faint">{o.note}</span>}
                  <span className="num shrink-0 text-[11px] text-faint">{o.n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center gap-1.5 rounded-full border border-line-soft bg-panel px-3 py-1 text-[12px] text-dim transition-colors hover:border-line hover:text-ink"
    >
      {children}
      <span aria-hidden className="text-faint">
        ×
      </span>
    </button>
  );
}

export function LibraryBrowser({ models }: { models: Model[] }) {
  const [query, setQuery] = useState("");
  const [collections, setCollections] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [flags, setFlags] = useState<FlagKey[]>([]);
  const [sort, setSort] = useState<Sort>("name");

  const deferredQuery = useDeferredValue(query);

  const toggle = <T extends string>(list: T[], set: (v: T[]) => void) => (value: string) => {
    const v = value as T;
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const activeCount = collections.length + groups.length + formats.length + weights.length + flags.length;

  const reset = () => {
    setCollections([]);
    setGroups([]);
    setFormats([]);
    setWeights([]);
    setFlags([]);
    setQuery("");
  };

  const matchesFlag = (m: Model, f: FlagKey) =>
    f === "animated" ? m.animationCount !== 0 : Boolean(m.previewUrl);

  const filtered = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const result = models.filter((m) => {
      if (collections.length && !collections.includes(m.collection)) return false;
      if (groups.length && !groups.includes(m.group)) return false;
      if (formats.length && !formats.includes(m.format)) return false;
      if (weights.length && !weights.includes(m.weight)) return false;
      if (flags.length && !flags.every((f) => matchesFlag(m, f))) return false;
      if (!terms.length) return true;
      const hay = `${m.name} ${m.fileName} ${m.group} ${m.collection}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const by: Record<Sort, (a: Model, b: Model) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      "tris-desc": (a, b) => (b.triangles ?? -1) - (a.triangles ?? -1),
      "tris-asc": (a, b) => (a.triangles ?? Infinity) - (b.triangles ?? Infinity),
      "size-desc": (a, b) => b.bytes - a.bytes,
      recent: (a, b) => b.modified.localeCompare(a.modified),
    };
    return result.sort(by[sort]);
  }, [models, deferredQuery, collections, groups, formats, weights, flags, sort]);

  /* Same-named exports collapse into one card, in the order the sort placed them. */
  const cards = useMemo(() => {
    const seen = new Map<string, Model[]>();
    for (const m of filtered) {
      const k = variantKey(m);
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k)!.push(m);
    }
    return [...seen.values()];
  }, [filtered]);

  /* Facet counts ignore their own dimension so an option never reads zero
     when picking it would actually return results. */
  const tally = <K extends string>(key: (m: Model) => K, ignore: unknown) => {
    const map = new Map<K, number>();
    const q = deferredQuery.trim().toLowerCase();
    for (const m of models) {
      if (ignore !== collections && collections.length && !collections.includes(m.collection)) continue;
      if (ignore !== groups && groups.length && !groups.includes(m.group)) continue;
      if (ignore !== formats && formats.length && !formats.includes(m.format)) continue;
      if (ignore !== weights && weights.length && !weights.includes(m.weight)) continue;
      if (ignore !== flags && flags.length && !flags.every((f) => matchesFlag(m, f))) continue;
      if (q && !`${m.name} ${m.fileName} ${m.group}`.toLowerCase().includes(q)) continue;
      const k = key(m);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  };

  const desc = (map: Map<string, number>): Option[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, label: value, n }));

  const collectionOpts = desc(tally((m) => m.collection, collections));
  const groupOpts = desc(tally((m) => m.group, groups));
  const formatOpts = desc(tally((m) => m.format, formats)).map((o) => ({ ...o, label: `.${o.value}` }));
  const weightCounts = tally((m) => m.weight, weights);
  const weightOpts: Option[] = WEIGHT_ORDER.filter((w) => weightCounts.get(w)).map((w) => ({
    value: w,
    label: WEIGHT_LABEL[w],
    note: WEIGHT_RANGE[w],
    n: weightCounts.get(w) ?? 0,
    swatch: <WeightDot weight={w} />,
  }));
  const flagCounts = tally((m) => FLAGS.filter((f) => matchesFlag(m, f.key)).map((f) => f.key).join("|") as string, flags);
  const flagOpts: Option[] = FLAGS.map((f) => ({
    value: f.key,
    label: f.label,
    n: [...flagCounts.entries()].filter(([k]) => k.split("|").includes(f.key)).reduce((s, [, n]) => s + n, 0),
  }));

  const shownBytes = filtered.reduce((s, m) => s + m.bytes, 0);
  const shownTris = filtered.reduce((s, m) => s + (m.triangles ?? 0), 0);

  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-8">
      {/* Filter bar */}
      <div className="sticky top-16 z-40 -mx-5 border-b border-line-soft bg-void/85 px-5 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="h-10 w-full rounded-lg border border-line-soft bg-panel pl-10 pr-3 text-[13.5px] text-ink placeholder:text-faint focus:border-sel focus:outline-none"
            />
          </div>

          <FilterMenu label="Project" options={collectionOpts} selected={collections} onToggle={toggle(collections, setCollections)} />
          <FilterMenu label="Triangle budget" options={weightOpts} selected={weights} onToggle={toggle(weights, setWeights)} />
          <FilterMenu label="Format" options={formatOpts} selected={formats} onToggle={toggle(formats, setFormats)} />
          <FilterMenu label="Folder" options={groupOpts} selected={groups} onToggle={toggle(groups, setGroups)} />
          <FilterMenu label="Contains" options={flagOpts} selected={flags} onToggle={toggle(flags, setFlags)} />

          <label className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-line-soft bg-panel px-3.5 text-[13px] text-dim">
            <span className="label text-[10px]">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort models"
              className="bg-transparent text-[13px] text-ink focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="num mr-1 text-[12px] text-faint">
            {filtered.length === models.length ? `${models.length} models` : `${filtered.length} of ${models.length}`}
            {" · "}
            {count(shownTris)} tris · {bytes(shownBytes)}
          </p>
          {collections.map((c) => <Chip key={c} onRemove={() => toggle(collections, setCollections)(c)}>{c}</Chip>)}
          {weights.map((w) => <Chip key={w} onRemove={() => toggle(weights, setWeights)(w)}>{WEIGHT_LABEL[w]}</Chip>)}
          {formats.map((f) => <Chip key={f} onRemove={() => toggle(formats, setFormats)(f)}>.{f}</Chip>)}
          {groups.map((g) => <Chip key={g} onRemove={() => toggle(groups, setGroups)(g)}>{g}</Chip>)}
          {flags.map((f) => <Chip key={f} onRemove={() => toggle(flags, setFlags)(f)}>{FLAGS.find((x) => x.key === f)?.label}</Chip>)}
          {activeCount + (query ? 1 : 0) > 0 && (
            <button type="button" onClick={reset} className="label rounded-md px-2 py-1 text-sel hover:bg-sel-soft">
              Reset
            </button>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <p className="display text-xl text-dim">Nothing matches those filters</p>
          <p className="max-w-sm text-[14px] text-faint">
            Widen the triangle budget or clear the search to see the rest of the library.
          </p>
          <button type="button" onClick={reset} className="label mt-2 rounded-lg border border-line px-4 py-2.5 text-sel hover:bg-sel-soft">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 py-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cards.map((group) =>
            group.length > 1 ? (
              <VariantCard key={group[0].id} variants={group} />
            ) : (
              <ModelCard key={group[0].id} model={group[0]} />
            )
          )}
        </div>
      )}
    </section>
  );
}
