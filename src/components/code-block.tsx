import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

/** A copyable snippet. `title` names the file or shell the snippet belongs in. */
export function CodeBlock({ code, title, className }: { code: string; title?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-muted/40", className)}>
      <div className="flex h-9 items-center justify-between border-b bg-muted/60 pr-1 pl-3">
        <span className="font-mono text-xs text-muted-foreground">{title ?? ""}</span>
        <CopyButton value={code} label="Copy snippet" />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[0.8rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
