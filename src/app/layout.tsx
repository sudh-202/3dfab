import type { Metadata } from "next";
import { Archivo, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { library } from "@/lib/models";
import { count } from "@/lib/format";
import { THEME_INIT, ThemeToggle } from "@/components/ThemeToggle";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "3DFAB — free 3D models, counted down to the triangle",
  description:
    "A library of free-to-use 3D models with real triangle counts, bounding boxes, materials and rigs, viewable in the browser.",
};

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      {/* An isometric cube drawn from the axis triad — the mark is the gizmo. */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2.6 21 7.8v10.4L12 23.4 3 18.2V7.8z" stroke="var(--line)" strokeWidth="1.2" />
        <path d="M12 13v10.4" stroke="var(--axis-y)" strokeWidth="1.4" />
        <path d="M12 13 3 7.8" stroke="var(--axis-x)" strokeWidth="1.4" />
        <path d="M12 13l9-5.2" stroke="var(--axis-z)" strokeWidth="1.4" />
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
    <html lang="en" className={`${archivo.variable} ${interTight.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-50 border-b border-line-soft bg-void/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-5 sm:px-8">
            <Wordmark />
            <nav className="flex items-center gap-1">
              <NavLink href="/">Library</NavLink>
              <NavLink href="/overview">Overview</NavLink>
            </nav>
            <div className="ml-auto flex items-center gap-5">
              <div className="hidden items-center gap-5 md:flex">
                <Readout label="models" value={String(library.totals.models)} />
                <Readout label="tris" value={count(library.totals.triangles)} />
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-28 border-t border-line-soft">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-10 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>
              Free to download and use — no attribution required. Made with Fable 5 &amp; 5.1, GPT
              Astra and GPT Sole.
            </p>
            <p className="num">
              Indexed{" "}
              {new Date(library.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
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
      className="label rounded-md px-3 py-2 transition-colors hover:bg-panel hover:text-ink"
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
