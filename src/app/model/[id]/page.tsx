import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getModel, models, relatedModels, variantsOf, WEIGHT_LABEL, WEIGHT_RANGE } from "@/lib/models";
import { BudgetMeter, WeightDot } from "@/components/BudgetMeter";
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
      ? `${count(model.triangles)} triangles, ${bytes(model.bytes)}, free to download.`
      : undefined,
  };
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const model = getModel((await params).id);
  if (!model) notFound();

  const d = model.detail;
  const variants = variantsOf(model);
  const related = relatedModels(model);
  const size = d.bbox?.size;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
      <nav className="label mb-6 flex flex-wrap items-center gap-2">
        <Link href="/" className="hover:text-sel">
          Library
        </Link>
        <span className="text-line">/</span>
        <span className="text-dim">{model.collection}</span>
        {model.group !== "Top level" && (
          <>
            <span className="text-line">/</span>
            <span className="text-dim">{model.group}</span>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Stage */}
        <div className="min-w-0">
          {model.previewUrl ? (
            <Viewer url={model.previewUrl} className="aspect-[16/10] w-full" />
          ) : (
            <NoPreview format={model.format} bytesOnDisk={model.bytes} />
          )}

          <header className="mt-8 flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="display text-[clamp(1.7rem,3.4vw,2.5rem)] text-ink">{model.name}</h1>
              <p className="num mt-2 text-[13px] text-faint">
                .{model.format} · {bytes(model.bytes)} · {model.collection} · updated{" "}
                {relativeDate(model.modified)}
              </p>
            </div>
            {model.previewUrl && (
              <div className="flex flex-col items-end gap-1.5">
                <a
                  href={model.previewUrl}
                  download={model.fileName}
                  className="label inline-flex items-center gap-2 rounded-lg bg-sel px-5 py-3 text-on-sel transition-opacity hover:opacity-90"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M8 2v8m0 0 3-3M8 10 5 7M2.5 12.5h11" />
                  </svg>
                  Download .{model.format}
                </a>
                <p className="text-[11.5px] text-faint">Free to use · no attribution required</p>
              </div>
            )}
          </header>

          {/* Budget row: the headline number, in context. */}
          <section className="mt-8 rounded-xl border border-line-soft bg-panel p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="label mb-2">Triangle budget</p>
                <p className="num text-[32px] leading-none text-ink">{exact(model.triangles)}</p>
              </div>
              <div className="flex items-center gap-2.5 text-right">
                <WeightDot weight={model.weight} />
                <div>
                  <p className="text-[14px] text-ink">{WEIGHT_LABEL[model.weight]}</p>
                  <p className="num text-[11px] text-faint">{WEIGHT_RANGE[model.weight]}</p>
                </div>
              </div>
            </div>
            <BudgetMeter triangles={model.triangles} weight={model.weight} height={6} />
            <div className="num mt-2 flex justify-between text-[10px] text-faint">
              <span>100</span>
              <span>5K</span>
              <span>50K</span>
              <span>250K</span>
              <span>1M</span>
            </div>
          </section>

          {variants.length > 0 && (
            <Section title={`Other exports of this asset (${variants.length})`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {variants.map((v) => (
                  <Link
                    key={v.id}
                    href={`/model/${v.id}`}
                    className="flex items-center gap-4 rounded-lg border border-line-soft bg-raise/50 p-3 transition-colors hover:border-line"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-raise">
                      {v.previewUrl && (
                        <Image src={`/thumbs/${v.id}.webp`} alt="" fill sizes="64px" className="object-contain p-1.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[14px] text-ink">
                        <WeightDot weight={v.weight} />
                        <span className="num">{count(v.triangles)} tris</span>
                      </p>
                      <p className="num mt-1 truncate text-[11.5px] text-faint">
                        .{v.format} · {bytes(v.bytes)} · {v.group}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {d.materials && d.materials.length > 0 && (
            <Section title={`Materials (${d.materials.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-[13px]">
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
                        <td className="max-w-[240px] truncate py-2.5 pr-3 text-ink">{mat.name}</td>
                        <td className="num py-2.5 pr-3">{mat.metallic.toFixed(2)}</td>
                        <td className="num py-2.5 pr-3">{mat.roughness.toFixed(2)}</td>
                        <td className="num py-2.5 pr-3">{mat.alphaMode.toLowerCase()}</td>
                        <td className="num py-2.5">{mat.doubleSided ? "double" : "single"}</td>
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
                  <li key={i} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[13px] odd:bg-raise/50">
                    <span className="num truncate text-ink">{a.name}</span>
                    <span className="num shrink-0 text-[11px] text-faint">{a.channels} channels</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Spec column */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
                  <div key={axis} className="rounded-lg border border-line-soft bg-raise p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="size-[6px] rounded-full" style={{ backgroundColor: `var(--axis-${axis})` }} aria-hidden />
                      <span className="label text-[9px]">{axis}</span>
                    </div>
                    <p className="num text-[14px] text-ink">{dim(size[i])}</p>
                  </div>
                ))}
              </div>
              <p className="num mt-2.5 text-[10.5px] leading-relaxed text-faint">
                Scene units as authored — glTF does not record a real-world scale.
              </p>
            </Panel>
          )}

          <Panel title="Surfacing">
            {model.materialCount != null && <Row k="Materials" v={exact(model.materialCount)} />}
            {model.textureCount != null && <Row k="Textures" v={exact(model.textureCount)} />}
            {d.imageCount != null && <Row k="Images" v={exact(d.imageCount)} />}
            {d.textureBytes ? <Row k="Texture data" v={bytes(d.textureBytes)} /> : null}
            {d.hasEmbeddedTextures != null && <Row k="Embedded textures" v={d.hasEmbeddedTextures ? "yes" : "no"} />}
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
            <Row k="Updated" v={date(model.modified)} />
            {d.gltfVersion && <Row k="glTF" v={d.gltfVersion} />}
            {d.fbxVersion && <Row k="FBX" v={d.fbxVersion} />}
            {d.blenderVersion && <Row k="Blender" v={d.blenderVersion} />}
            {d.compression && <Row k="Compression" v={d.compression} />}
            {d.generator && <Row k="Made with" v={d.generator} />}
            {model.duplicateCount > 0 && <Row k="Identical copies" v={String(model.duplicateCount + 1)} />}
          </Panel>

          {d.extensions && d.extensions.length > 0 && (
            <Panel title="glTF extensions">
              <ul className="flex flex-wrap gap-1.5">
                {d.extensions.map((e) => (
                  <li key={e} className="num rounded-md border border-line-soft bg-raise px-2 py-1 text-[10.5px] text-dim">
                    {e}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-line-soft pt-10">
          <h2 className="label mb-5">More from {model.collection}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
            {related.map((r) => (
              <Link key={r.id} href={`/model/${r.id}`} className="group overflow-hidden rounded-xl border border-line-soft bg-panel transition-colors hover:border-line">
                <div className="relative aspect-square bg-raise">
                  {r.previewUrl ? (
                    <Image src={`/thumbs/${r.id}.webp`} alt={r.name} fill sizes="12vw" className="object-contain p-2" />
                  ) : (
                    <span className="label absolute inset-0 grid place-items-center text-[9px]">.{r.format}</span>
                  )}
                </div>
                <p className="truncate px-3 py-2.5 text-[12px] text-dim group-hover:text-sel">{r.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function NoPreview({ format, bytesOnDisk }: { format: string; bytesOnDisk: number }) {
  return (
    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-xl border border-line-soft bg-panel px-6 text-center">
      <svg viewBox="0 0 120 120" className="size-24 text-line" fill="none" aria-hidden>
        <path d="M60 22 96 42v36L60 98 24 78V42z" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 5" />
      </svg>
      <p className="display text-lg text-dim">No browser preview</p>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-faint">
        {format === "fbx"
          ? "FBX is indexed from its header but not rendered here."
          : format === "blend"
            ? "Blender scenes are indexed from their block table but not rendered here."
            : `This ${bytes(bytesOnDisk)} file is above the preview size cap.`}{" "}
        The full spec is on the right.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-line-soft bg-panel p-5">
      <h2 className="label mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line-soft bg-panel p-4">
      <h2 className="label mb-3">{title}</h2>
      <div className="space-y-px">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[13px] text-faint">{k}</span>
      <span className="num min-w-0 truncate text-right text-[13px] text-ink" title={v}>
        {v}
      </span>
    </div>
  );
}
