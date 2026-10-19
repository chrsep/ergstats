import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Top bar shared by every page. Pass the right-hand actions as children. */
export function SiteHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/80 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="ErgStats home" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
