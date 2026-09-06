import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getModel, models, relatedModels } from "@/lib/models";
import { BudgetMeter, WeightDot } from "@/components/BudgetMeter";
import { CopyPath } from "@/components/CopyPath";
import { WEIGHT_LABEL, WEIGHT_RANGE } from "@/lib/models";
import { bytes, count, date, dim, exact, relativeDate } from "@/lib/format";

const Viewer = dynamic(() => import("@/components/Viewer").then((m) => m.Viewer));

export function generateStaticParams() {
  return models.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const model = getModel((await params).id);
  return {
    title: model ? `${model.name} — 3DFAB` : "Model not found — 3DFAB",
    description: model
      ? `${count(model.triangles)} triangles, ${bytes(model.bytes)}, from ${model.collection}.`
      : undefined,
  };
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const model = getModel((await params).id);
  if (!model) notFound();

  const d = model.detail;
  const related = relatedModels(model);
  const size = d.bbox?.size;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <nav className="label mb-5 flex flex-wrap items-center gap-1.5">
        <Link href="/" className="hover:text-sel">
          All models
        </Link>
        <span className="text-line">/</span>
        <span className="text-dim">{model.collection}</span>
        <span className="text-line">/</span>
        <span className="text-dim">{model.group}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Stage */}
        <div className="min-w-0">
          {model.previewUrl ? (
            <Viewer url={model.previewUrl} className="aspect-[4/3] w-full" />
          ) : (
            <NoPreview model={model} />
          )}

          <header className="mt-5">
            <h1 className="display text-[clamp(1.6rem,3.4vw,2.4rem)] text-ink">{model.name}</h1>
            <p className="num mt-1.5 text-[12.5px] text-faint">
              {model.fileName} · modified {relativeDate(model.modified)}
            </p>
          </header>

          {/* Budget row: the headline number, in context. */}
          <section className="mt-6 rounded-md border border-line-soft bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="label mb-1.5">Triangle budget</p>
                <p className="num text-3xl leading-none text-ink">{exact(model.triangles)}</p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <WeightDot weight={model.weight} />
                <div>
                  <p className="text-[13px] text-ink">{WEIGHT_LABEL[model.weight]}</p>
                  <p className="num text-[11px] text-faint">{WEIGHT_RANGE[model.weight]}</p>
                </div>
              </div>
            </div>
            <BudgetMeter triangles={model.triangles} weight={model.weight} height={6} />
            <div className="num mt-1.5 flex justify-between text-[10px] text-faint">
              <span>100</span>
              <span>5K</span>
              <span>50K</span>
              <span>250K</span>
              <span>1M</span>
            </div>
          </section>

          {d.materials && d.materials.length > 0 && (
            <Section title={`Materials (${d.materials.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-[12.5px]">
                  <thead>
                    <tr className="label border-b border-line-soft">
                      <th className="py-2 pr-3 font-normal">Name</th>
                      <th className="py-2 pr-3 font-normal">Metal</th>
                      <th className="py-2 pr-3 font-normal">Rough</th>
                      <th className="py-2 pr-3 font-normal">Alpha</th>
                      <th className="py-2 font-normal">Sides</th>
                    </tr>
                  </thead>
                  <tbody className="text-dim">
                    {d.materials.map((mat, i) => (
                      <tr key={i} className="border-b border-line-soft/60 last:border-0">
                        <td className="max-w-[220px] truncate py-2 pr-3 text-ink">{mat.name}</td>
                        <td className="num py-2 pr-3">{mat.metallic.toFixed(2)}</td>
                        <td className="num py-2 pr-3">{mat.roughness.toFixed(2)}</td>
                        <td className="num py-2 pr-3">{mat.alphaMode.toLowerCase()}</td>
                        <td className="num py-2">{mat.doubleSided ? "double" : "single"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {d.animations && d.animations.length > 0 && (
            <Section title={`Animation clips (${d.animations.length})`}>
              <ul className="space-y-px">
                {d.animations.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-[12.5px] odd:bg-raise/50"
                  >
                    <span className="num truncate text-ink">{a.name}</span>
                    <span className="num shrink-0 text-[11px] text-faint">
                      {a.channels} channels
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {model.duplicates.length > 0 && (
            <Section title={`Duplicate copies (${model.duplicates.length})`}>
              <p className="mb-3 text-[12.5px] text-dim">
                Byte-identical files found elsewhere on disk. They are indexed once, here.
              </p>
              <ul className="space-y-1.5">
                {model.duplicates.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <code className="num min-w-0 flex-1 truncate rounded bg-raise px-2 py-1.5 text-[11px] text-faint">
                      {p}
                    </code>
                    <CopyPath path={p} label="Copy" />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Spec column */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel title="Geometry">
            <Row k="Triangles" v={exact(model.triangles)} />
            <Row k="Vertices" v={exact(model.vertices)} />
            {d.meshes != null && <Row k="Meshes" v={exact(d.meshes)} />}
            {d.drawCalls != null && <Row k="Draw calls" v={exact(d.drawCalls)} />}
            {d.nodes != null && <Row k="Nodes" v={exact(d.nodes)} />}
            {d.objects != null && <Row k="Objects" v={exact(d.objects)} />}
          </Panel>

          {size && (
            <Panel title="Bounding box">
              <div className="grid grid-cols-3 gap-2">
                {(["x", "y", "z"] as const).map((axis, i) => (
                  <div key={axis} className="rounded border border-line-soft bg-raise p-2">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span
                        className="size-[6px] rounded-full"
                        style={{ backgroundColor: `var(--color-axis-${axis})` }}
                        aria-hidden
                      />
                      <span className="label text-[9px]">{axis}</span>
                    </div>
                    <p className="num text-[13px] text-ink">{dim(size[i])}</p>
                  </div>
                ))}
              </div>
              <p className="num mt-2 text-[10.5px] text-faint">
                Scene units, as authored — glTF does not record a real-world scale.
              </p>
            </Panel>
          )}

          <Panel title="Surfacing">
            {model.materialCount != null && <Row k="Materials" v={exact(model.materialCount)} />}
            {model.textureCount != null && <Row k="Textures" v={exact(model.textureCount)} />}
            {d.imageCount != null && <Row k="Images" v={exact(d.imageCount)} />}
            {d.textureBytes ? <Row k="Texture data" v={bytes(d.textureBytes)} /> : null}
            {d.hasEmbeddedTextures != null && (
              <Row k="Embedded textures" v={d.hasEmbeddedTextures ? "yes" : "no"} />
            )}
          </Panel>

          {(d.skins || d.bones || d.armatures || d.hasSkin) && (
            <Panel title="Rig">
              {d.skins != null && <Row k="Skins" v={exact(d.skins)} />}
              {d.bones ? <Row k="Bones" v={exact(d.bones)} /> : null}
              {d.armatures != null && <Row k="Armatures" v={exact(d.armatures)} />}
              {d.actions != null && <Row k="Actions" v={exact(d.actions)} />}
              {d.hasSkin != null && <Row k="Skinned" v={d.hasSkin ? "yes" : "no"} />}
            </Panel>
          )}

          <Panel title="File">
            <Row k="Format" v={`.${model.format}`} />
            <Row k="Size" v={bytes(model.bytes)} />
            <Row k="Project" v={model.collection} />
            <Row k="Folder" v={model.group} />
            <Row k="Modified" v={date(model.modified)} />
            {d.gltfVersion && <Row k="glTF" v={d.gltfVersion} />}
            {d.fbxVersion && <Row k="FBX" v={d.fbxVersion} />}
            {d.blenderVersion && <Row k="Blender" v={d.blenderVersion} />}
            {d.compression && <Row k="Compression" v={d.compression} />}
            {d.generator && <Row k="Made with" v={d.generator} />}
          </Panel>

          {d.extensions && d.extensions.length > 0 && (
            <Panel title="glTF extensions">
              <ul className="flex flex-wrap gap-1">
                {d.extensions.map((e) => (
                  <li
                    key={e}
                    className="num rounded border border-line-soft bg-raise px-1.5 py-1 text-[10.5px] text-dim"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Source">
            <code className="num block break-all rounded bg-raise p-2.5 text-[11px] leading-relaxed text-faint">
              {model.sourcePath}
            </code>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CopyPath path={model.sourcePath} />
              {model.previewUrl && (
                <a
                  href={model.previewUrl}
                  download={model.fileName}
                  className="label shrink-0 rounded border border-line-soft px-2 py-1.5 text-[10px] text-dim transition-colors hover:border-line hover:text-sel"
                >
                  Download copy
                </a>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-14 border-t border-line-soft pt-8">
          <h2 className="label mb-4">More from {model.collection}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/model/${r.id}`}
                className="group overflow-hidden rounded border border-line-soft bg-panel transition-colors hover:border-line"
              >
                <div className="relative aspect-square bg-raise">
                  {r.previewUrl ? (
                    <Image
                      src={`/thumbs/${r.id}.webp`}
                      alt={r.name}
                      fill
                      sizes="12vw"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <span className="label absolute inset-0 grid place-items-center text-[9px]">
                      .{r.format}
                    </span>
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-[11.5px] text-dim group-hover:text-sel">
                  {r.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function NoPreview({ model }: { model: { format: string; bytes: number } }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-md border border-line-soft bg-panel px-6 text-center">
      <svg viewBox="0 0 120 120" className="size-24 text-line" fill="none" aria-hidden>
        <path
          d="M60 22 96 42v36L60 98 24 78V42z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
      </svg>
      <p className="display text-lg text-dim">No browser preview</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-faint">
        {model.format === "fbx"
          ? "FBX is indexed from its header but not rendered here. Open it in Blender to view."
          : model.format === "blend"
            ? "Blender scenes are indexed from their block table. Open the file in Blender to view."
            : `This ${bytes(model.bytes)} file was left out of the bundled preview set.`}{" "}
        The full spec is on the right.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-md border border-line-soft bg-panel p-4">
      <h2 className="label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line-soft bg-panel p-3.5">
      <h2 className="label mb-2.5">{title}</h2>
      <div className="space-y-px">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[12.5px] text-faint">{k}</span>
      <span className="num min-w-0 truncate text-right text-[12.5px] text-ink" title={v}>
        {v}
      </span>
    </div>
  );
}
