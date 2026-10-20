"use client";

import { ArrowUpRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { captureClientEvent } from "@/lib/observability/browser";
import { cn } from "@/lib/utils";

/**
 * A link that opens a client's add dialog with ErgStats filled in, in a new tab
 * so the setup steps stay open for the sign-in. `source` says where it was clicked, for analytics.
 */
export function AddToClientButton({
  href,
  client,
  name,
  source,
  size = "touch",
  className,
}: {
  href: string;
  client: string;
  name: string;
  source: string;
  size?: "touch" | "xl";
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={cn(buttonVariants({ size }), className)}
      onClick={() => captureClientEvent("one_click_add_clicked", { client, source })}
    >
      Add to {name}
      <ArrowUpRightIcon />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
