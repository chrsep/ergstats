import Link from "next/link";

import { GitHubIcon } from "@/components/brand/github-icon";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/marketing/page-layout";
import { buttonVariants } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Top bar shared by every page. Pass the right-hand actions as children. With `nav`,
 * it adds the "Star on GitHub" link the public pages show.
 */
export function SiteHeader({
  children,
  nav = false,
  className,
}: {
  children?: React.ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md", className)}>
      <a
        href="#main"
        className="sr-only rounded-xl bg-foreground px-4 py-3 text-background focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-6 lg:h-18">
        <Link href="/" aria-label="ErgStats home" className="flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo className="text-lg [&_svg]:size-7" />
        </Link>
        <div className="flex items-center gap-2">
          {nav && (
            <a
              href={GITHUB_URL}
              aria-label="Star on GitHub"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <GitHubIcon className="max-sm:size-5" />
              <span className="max-sm:hidden">Star on GitHub</span>
            </a>
          )}
          {children}
        </div>
      </Container>
    </header>
  );
}

/** The header's sign-in link, sized for touch. */
export function HeaderSignIn() {
  return (
    <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "touch", className: "md:ml-2" })}>
      Sign in
    </Link>
  );
}
