import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Container, PageGrid } from "@/components/marketing/page-layout";
import { GITHUB_URL, guideClients } from "@/lib/site";

const linkClass = "flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-0";

export function SiteFooter() {
  return (
    <footer className="border-t pt-10 pb-10 md:pt-16">
      <Container>
        <PageGrid className="gap-y-10">
          <div className="col-span-full flex flex-col gap-3 md:col-span-4 lg:col-span-6">
            <Link href="/" aria-label="ErgStats home" className="flex min-h-11 w-fit items-center">
              <Logo />
            </Link>
            <p className="max-w-sm text-sm text-muted-foreground">A free, open-source MCP connector for the Concept2 Logbook.</p>
          </div>
          <nav aria-label="Setup guides" className="col-span-2 flex flex-col md:gap-3 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold md:mb-1">Setup guides</h2>
            {guideClients().map((c) => (
              <Link key={c.id} href={`/connect/${c.id}`} className={linkClass}>
                {c.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="ErgStats" className="col-span-2 flex flex-col md:gap-3 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold md:mb-1">ErgStats</h2>
            <Link href="/#ask" className={linkClass}>
              What to ask
            </Link>
            <Link href="/#faq" className={linkClass}>
              FAQ
            </Link>
            <Link href="/dashboard" className={linkClass}>
              Sign in
            </Link>
            <a href={GITHUB_URL} className={linkClass}>
              Source code on GitHub
            </a>
          </nav>
        </PageGrid>
        <div className="mt-8 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground md:mt-12">
          <p>
            © 2026 ErgStats ·{" "}
            <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="underline-offset-3 hover:text-foreground hover:underline">
              MIT license
            </a>
          </p>
          <p>Not affiliated with or endorsed by Concept2.</p>
        </div>
      </Container>
    </footer>
  );
}
