import Link from "next/link";

import { GitHubIcon } from "@/components/brand/github-icon";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/marketing/page-layout";
import { MobileNav, type NavLink } from "@/components/mobile-nav";
import { buttonVariants } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const SITE_NAV: NavLink[] = [
  { id: "guides", label: "Setup guides", href: "/#guides" },
  { id: "ask", label: "What to ask", href: "/#ask" },
  { id: "faq", label: "FAQ", href: "/#faq" },
];

/**
 * Top bar shared by every page. Pass the right-hand actions as children. With `nav`,
 * it adds the public site links, which collapse into a full-screen menu on phones.
 */
export function SiteHeader({
  children,
  nav = false,
  sectionLinks = true,
  current,
  className,
}: {
  children?: React.ReactNode;
  nav?: boolean;
  /** With `nav`, whether wide screens also list SITE_NAV next to GitHub. The phone menu always does. */
  sectionLinks?: boolean;
  /** The SITE_NAV id of the page being shown. */
  current?: string;
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
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {sectionLinks &&
                SITE_NAV.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    aria-current={link.id === current ? "true" : undefined}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=true]:font-medium aria-[current=true]:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              <a
                href={GITHUB_URL}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <GitHubIcon />
                Star on GitHub
              </a>
            </nav>
          )}
          {children}
          {nav && <MobileNav links={SITE_NAV} githubUrl={GITHUB_URL} signInHref="/dashboard" />}
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
