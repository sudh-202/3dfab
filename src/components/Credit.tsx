import type { Credit } from "@/lib/models";

/** "by Author · Source · Licence", leaving out whatever the manifest did not record. */
export function creditText(c: Credit) {
  return [c.author && `by ${c.author}`, c.source, c.license].filter(Boolean).join(" · ");
}

/**
 * One quiet line under a card's meter. Links to the source listing when the
 * manifest recorded one. On a card this sits above the card's own link (see
 * CardShell), so it stays a real, separately clickable anchor.
 */
export function CreditLine({ credit }: { credit: Credit }) {
  const text = creditText(credit);
  if (!text) return null;
  const cls = "block truncate text-[11px] leading-4 text-faint";
  return credit.url ? (
    <a
      href={credit.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${text} — opens the source page`}
      className={`${cls} transition-colors hover:text-sel hover:underline hover:underline-offset-2`}
    >
      {text}
    </a>
  ) : (
    <p className={cls} title={text}>
      {text}
    </p>
  );
}
