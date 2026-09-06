import type { Metadata } from "next";
import { Archivo, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { library } from "@/lib/models";
import { count } from "@/lib/format";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "3DFAB — 3D asset ledger",
  description:
    "Every 3D model on this machine, indexed with triangle counts, bounding boxes, materials and rigs.",
};

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      {/* An isometric cube drawn from the axis triad — the mark is the gizmo. */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2.6 21 7.8v10.4L12 23.4 3 18.2V7.8z" stroke="var(--color-line)" strokeWidth="1.2" />
        <path d="M12 13v10.4" stroke="var(--color-axis-y)" strokeWidth="1.4" />
        <path d="M12 13 3 7.8" stroke="var(--color-axis-x)" strokeWidth="1.4" />
        <path d="M12 13l9-5.2" stroke="var(--color-axis-z)" strokeWidth="1.4" />
      </svg>
      <span
        className="display text-[15px] text-ink transition-colors group-hover:text-sel"
        style={{ letterSpacing: "0.02em" }}
      >
        3DFAB
      </span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${interTight.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-50 border-b border-line-soft bg-void/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
            <Wordmark />
            <nav className="flex items-center gap-1">
              <NavLink href="/">Library</NavLink>
              <NavLink href="/overview">Overview</NavLink>
            </nav>
            <div className="ml-auto hidden items-center gap-4 md:flex">
              <Readout label="models" value={String(library.totals.models)} />
              <Readout label="tris" value={count(library.totals.triangles)} />
              <Readout label="viewable" value={String(library.totals.previewable)} />
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-24 border-t border-line-soft">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="num">
              Indexed {new Date(library.generatedAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              on {library.host}
            </p>
            <p>
              Re-index with{" "}
              <code className="num rounded bg-panel px-1.5 py-0.5 text-dim">npm run index</code>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="label rounded px-2.5 py-1.5 transition-colors hover:bg-panel hover:text-ink"
    >
      {children}
    </Link>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="num text-[13px] text-ink">{value}</span>
      <span className="label text-[10px]">{label}</span>
    </div>
  );
}
