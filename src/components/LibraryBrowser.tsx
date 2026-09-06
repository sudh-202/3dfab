"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ModelCard } from "./ModelCard";
import { WeightDot } from "./BudgetMeter";
import { bytes, count } from "@/lib/format";
import {
  WEIGHT_LABEL,
  WEIGHT_ORDER,
  WEIGHT_RANGE,
  type Model,
  type Weight,
} from "@/lib/models";

type Sort = "name" | "tris-desc" | "tris-asc" | "size-desc" | "recent";

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "tris-desc", label: "Heaviest" },
  { value: "tris-asc", label: "Lightest" },
  { value: "size-desc", label: "Largest file" },
  { value: "recent", label: "Recently changed" },
];

const FLAGS = [
  { key: "animated", label: "Animated" },
  { key: "viewable", label: "Viewable in browser" },
  { key: "duplicated", label: "Has duplicates" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

/** One row in a facet list: a count you can act on, not just a filter. */
function Facet({
  label,
  n,
  active,
  onClick,
  swatch,
  note,
}: {
  label: string;
  n: number;
  active: boolean;
  onClick: () => void;
  swatch?: React.ReactNode;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] transition-colors ${
        active ? "bg-sel-soft text-sel" : "text-dim hover:bg-panel hover:text-ink"
      }`}
    >
      {swatch}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {note && <span className="num text-[10px] text-faint">{note}</span>}
      <span className="num shrink-0 text-[11px] text-faint">{n}</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft py-4 first:border-t-0 first:pt-0">
      <h2 className="label mb-2 px-2">{title}</h2>
      <div className="space-y-px">{children}</div>
    </section>
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
  const [railOpen, setRailOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);

  const toggle = <T,>(list: T[], set: (v: T[]) => void, value: T) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const activeCount =
    collections.length + groups.length + formats.length + weights.length + flags.length;

  const reset = () => {
    setCollections([]);
    setGroups([]);
    setFormats([]);
    setWeights([]);
    setFlags([]);
    setQuery("");
  };

  const matchesFlag = (m: Model, f: FlagKey) =>
    f === "animated"
      ? m.animationCount !== 0
      : f === "viewable"
        ? Boolean(m.previewUrl)
        : m.duplicates.length > 0;

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];

    const result = models.filter((m) => {
      if (collections.length && !collections.includes(m.collection)) return false;
      if (groups.length && !groups.includes(m.group)) return false;
      if (formats.length && !formats.includes(m.format)) return false;
      if (weights.length && !weights.includes(m.weight)) return false;
      if (flags.length && !flags.every((f) => matchesFlag(m, f))) return false;
      if (!terms.length) return true;

      const haystack = `${m.name} ${m.fileName} ${m.group} ${m.collection} ${m.relPath}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
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

  /* Facet counts reflect everything except the facet's own dimension, so a
     count never reads zero for an option that would actually return results. */
  const tally = <K extends string>(key: (m: Model) => K, ignore: unknown[]) => {
    const map = new Map<K, number>();
    const q = deferredQuery.trim().toLowerCase();
    for (const m of models) {
      if (ignore !== collections && collections.length && !collections.includes(m.collection)) continue;
      if (ignore !== groups && groups.length && !groups.includes(m.group)) continue;
      if (ignore !== formats && formats.length && !formats.includes(m.format)) continue;
      if (ignore !== weights && weights.length && !weights.includes(m.weight as Weight)) continue;
      if (ignore !== flags && flags.length && !flags.every((f) => matchesFlag(m, f))) continue;
      if (q && !`${m.name} ${m.fileName} ${m.group} ${m.relPath}`.toLowerCase().includes(q)) continue;
      const k = key(m);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  };

  const collectionCounts = tally((m) => m.collection, collections);
  const groupCounts = tally((m) => m.group, groups);
  const formatCounts = tally((m) => m.format, formats);
  const weightCounts = tally((m) => m.weight, weights);
  const flagCounts = new Map(
    FLAGS.map((f) => [f.key, models.filter((m) => matchesFlag(m, f.key)).length] as const)
  );

  const shownBytes = filtered.reduce((s, m) => s + m.bytes, 0);
  const shownTris = filtered.reduce((s, m) => s + (m.triangles ?? 0), 0);

  const sortedGroups = [...groupCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex max-w-[1600px] gap-0 px-4 sm:px-6">
      {/* Filter rail — an outliner, not a sidebar of chips. */}
      <aside
        className={`${
          railOpen ? "block" : "hidden"
        } shrink-0 border-r border-line-soft pr-5 lg:block lg:w-[212px]`}
      >
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-5">
          <Group title="Project">
            {[...collectionCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, n]) => (
                <Facet
                  key={name}
                  label={name}
                  n={n}
                  active={collections.includes(name)}
                  onClick={() => toggle(collections, setCollections, name)}
                />
              ))}
          </Group>

          <Group title="Triangle budget">
            {WEIGHT_ORDER.filter((w) => weightCounts.get(w)).map((w) => (
              <Facet
                key={w}
                label={WEIGHT_LABEL[w]}
                note={WEIGHT_RANGE[w]}
                n={weightCounts.get(w) ?? 0}
                active={weights.includes(w)}
                onClick={() => toggle(weights, setWeights, w)}
                swatch={<WeightDot weight={w} />}
              />
            ))}
          </Group>

          <Group title="Format">
            {[...formatCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([f, n]) => (
                <Facet
                  key={f}
                  label={`.${f}`}
                  n={n}
                  active={formats.includes(f)}
                  onClick={() => toggle(formats, setFormats, f)}
                />
              ))}
          </Group>

          <Group title="Contains">
            {FLAGS.map((f) => (
              <Facet
                key={f.key}
                label={f.label}
                n={flagCounts.get(f.key) ?? 0}
                active={flags.includes(f.key)}
                onClick={() => toggle(flags, setFlags, f.key)}
              />
            ))}
          </Group>

          <Group title="Folder">
            {sortedGroups.map(([g, n]) => (
              <Facet
                key={g}
                label={g}
                n={n}
                active={groups.includes(g)}
                onClick={() => toggle(groups, setGroups, g)}
              />
            ))}
          </Group>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-6">
        {/* Command bar */}
        <div className="sticky top-14 z-40 -mx-4 border-b border-line-soft bg-void/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRailOpen((v) => !v)}
              className="label rounded border border-line-soft px-2.5 py-2 text-dim hover:text-ink lg:hidden"
              aria-expanded={railOpen}
            >
              Filters{activeCount > 0 && ` (${activeCount})`}
            </button>

            <div className="relative min-w-[180px] flex-1">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, file or folder"
                aria-label="Search models"
                className="w-full rounded border border-line-soft bg-panel py-2 pl-8 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-sel focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2">
              <span className="label hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort models"
                className="num rounded border border-line-soft bg-panel px-2 py-2 text-[12px] text-dim focus:border-sel focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {activeCount + (query ? 1 : 0) > 0 && (
              <button
                type="button"
                onClick={reset}
                className="label rounded px-2 py-2 text-sel hover:bg-sel-soft"
              >
                Reset
              </button>
            )}
          </div>

          <p className="num mt-2 text-[11px] text-faint">
            {filtered.length === models.length
              ? `All ${models.length} models`
              : `${filtered.length} of ${models.length} models`}
            {" · "}
            {count(shownTris)} tris {" · "} {bytes(shownBytes)}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-28 text-center">
            <p className="display text-lg text-dim">Nothing matches those filters</p>
            <p className="max-w-sm text-[13px] text-faint">
              Widen the triangle budget or clear the search to see the rest of the library.
            </p>
            <button
              type="button"
              onClick={reset}
              className="label mt-1 rounded border border-line px-3 py-2 text-sel hover:bg-sel-soft"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
