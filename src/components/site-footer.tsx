import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="text-foreground" />
          <span>Not affiliated with or endorsed by Concept2.</span>
        </div>
        <nav className="flex gap-4">
          <Link href="/#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/#tools" className="hover:text-foreground">
            Tools
          </Link>
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
