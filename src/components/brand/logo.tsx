import { cn } from "@/lib/utils";

/** Wordmark: a stroke-rate bar chart glyph next to "ergstats". */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0">
        <rect width="24" height="24" rx="6" className="fill-primary" />
        <g className="fill-primary-foreground">
          <rect x="5" y="12" width="2.5" height="7" rx="1.25" />
          <rect x="9" y="8" width="2.5" height="11" rx="1.25" />
          <rect x="13" y="5" width="2.5" height="14" rx="1.25" />
          <rect x="17" y="10" width="2.5" height="9" rx="1.25" />
        </g>
      </svg>
      {showWordmark && <span className="text-[1.05rem]">ergstats</span>}
    </span>
  );
}
