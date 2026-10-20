"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRightIcon, ArrowUpRightIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GitHubIcon } from "@/components/brand/github-icon";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/marketing/page-layout";
import { Button, buttonVariants } from "@/components/ui/button";

export interface NavLink {
  id: string;
  label: string;
  href: string;
}

const rowClass =
  "flex min-h-16 items-center justify-between gap-4 border-b text-[1.375rem] leading-tight font-semibold tracking-[-0.015em] outline-none focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50";

/** Phone-only menu: a full-screen sheet with the site links and the sign-in button. */
export function MobileNav({ links, githubUrl, signInHref }: { links: NavLink[]; githubUrl: string; signInHref: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // The sheet is hidden from md up, so close it if the screen grows (rotation, resize) while it is open.
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 48rem)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="outline" size="icon-touch" className="md:hidden" aria-label="Open menu" />}>
        <MenuIcon />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground duration-150 outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 md:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="border-b">
            <Container className="flex h-16 items-center justify-between gap-6">
              <Link href="/" aria-label="ErgStats home" onClick={close} className="flex min-h-11 items-center rounded-md">
                <Logo className="text-lg [&_svg]:size-7" />
              </Link>
              <Dialog.Close render={<Button variant="outline" size="icon-touch" aria-label="Close menu" />}>
                <XIcon />
              </Dialog.Close>
            </Container>
          </div>
          <nav aria-label="Main">
            <Container className="flex flex-col pt-4">
              {links.map((link) => (
                <Link key={link.id} href={link.href} onClick={close} className={rowClass}>
                  {link.label}
                  <ArrowRightIcon className="size-5 text-primary" />
                </Link>
              ))}
              <a href={githubUrl} onClick={close} className={rowClass}>
                <span className="flex items-center gap-3">
                  <GitHubIcon className="size-5" />
                  GitHub
                </span>
                <ArrowUpRightIcon className="size-5 text-primary" />
              </a>
            </Container>
          </nav>
          <Container className="mt-auto flex flex-col gap-4 pt-6 pb-8">
            <Link href={signInHref} onClick={close} className={buttonVariants({ size: "xl", className: "w-full" })}>
              Sign in with Concept2
            </Link>
            <p className="text-sm text-muted-foreground">Free, read-only and open source. Not affiliated with or endorsed by Concept2.</p>
          </Container>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
