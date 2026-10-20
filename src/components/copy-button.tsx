"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  labelled = false,
  className,
  onCopy,
}: {
  value: string;
  label?: string;
  /** Show a "Copy" text button sized for touch instead of an icon with a tooltip. */
  labelled?: boolean;
  className?: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Denied or unavailable: leave the button as it was.
    }
    setCopied(true);
    onCopy?.();
  };

  if (labelled) {
    return (
      <Button variant="outline" size="touch" className={className} aria-label={copied ? "Copied" : label} onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("text-muted-foreground", className)}
            aria-label={copied ? "Copied" : label}
            onClick={copy}
          />
        }
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
    </Tooltip>
  );
}
