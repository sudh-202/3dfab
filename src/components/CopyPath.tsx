"use client";

import { useState } from "react";

/**
 * The source path is the one thing this dashboard can't do for you — the file
 * lives on the machine, not on the deployment. Copying it is the handoff.
 */
export function CopyPath({ path, label = "Copy path" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="label shrink-0 rounded border border-line-soft px-2 py-1.5 text-[10px] text-dim transition-colors hover:border-line hover:text-sel"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
