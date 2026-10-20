import { ArrowRightIcon, CodeXmlIcon, MessageSquareIcon, TerminalIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { AddToClientButton } from "@/components/add-to-client-button";
import { CopyButton } from "@/components/copy-button";
import { InlineCode, h3Class, panelClass } from "@/components/marketing/page-layout";
import { claudeConnectorUrl } from "@/lib/mcp/clients";
import { cn } from "@/lib/utils";

export interface GuideCard {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

const icons: Record<string, LucideIcon> = { Connector: MessageSquareIcon, Plugin: MessageSquareIcon, Terminal: TerminalIcon };

/** One card per setup guide, three across on desktop, two on tablets, one on phones. */
export function GuideCards({ guides, className }: { guides: GuideCard[]; className?: string }) {
  return guides.map((guide) => {
    const Icon = icons[guide.kind] ?? CodeXmlIcon;
    return (
      <Link
        key={guide.id}
        href={`/connect/${guide.id}`}
        className={cn(
          panelClass,
          "group col-span-full transition-[border-color,box-shadow] outline-none hover:border-foreground/20 hover:shadow-[0_16px_32px_-24px_rgb(13_60_58/0.35)] focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-4",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <span className="rounded-full border px-2 py-1 font-mono text-xs text-muted-foreground">{guide.kind}</span>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className={h3Class}>Connect to {guide.name}</h3>
          <p className="text-pretty text-muted-foreground">
            <InlineCode text={guide.summary} />
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[0.9375rem] font-medium text-primary">
          Setup guide
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  });
}

/** The MCP URL with a copy button and Claude's one-click add, spanning the whole grid. */
export function McpUrlBar({ url, className }: { url: string; className?: string }) {
  return (
    <div
      className={cn(
        "col-span-full flex flex-col gap-4 rounded-2xl border border-dashed border-foreground/20 p-6 md:flex-row md:items-center md:gap-6 md:py-4 md:pr-4",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">The one URL every client needs</span>
      <code className="font-mono font-medium break-all">{url}</code>
      <div className="flex flex-col gap-4 sm:flex-row md:ml-auto">
        <CopyButton value={url} label="Copy the ErgStats MCP URL" labelled />
        <AddToClientButton href={claudeConnectorUrl(url)} client="claude" name="Claude" source="home" />
      </div>
    </div>
  );
}
