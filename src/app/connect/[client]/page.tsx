import { ArrowRightIcon, CheckIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToClientButton } from "@/components/add-to-client-button";
import { CodeBlock } from "@/components/code-block";
import { JsonLd } from "@/components/json-ld";
import { FaqList } from "@/components/marketing/faq";
import { Container, PageGrid, h1Class, h3Class, ledeClass } from "@/components/marketing/page-layout";
import { TOOLS } from "@/components/marketing/tool-grid";
import { SiteFooter } from "@/components/site-footer";
import { HeaderSignIn, SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { SITE_URL, guideClients, guideDetails } from "@/lib/site";
import { cn } from "@/lib/utils";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function generateStaticParams() {
  return guideClients().map((c) => ({ client: c.id }));
}

async function findClient(params: PageProps<"/connect/[client]">["params"]) {
  const { client } = await params;
  const setup = guideClients().find((c) => c.id === client);
  if (!setup) notFound();
  return setup;
}

export async function generateMetadata({ params }: PageProps<"/connect/[client]">): Promise<Metadata> {
  const setup = await findClient(params);
  const title = `Connect your Concept2 Logbook to ${setup.name}`;
  const description = `Set up ErgStats in ${setup.name} in two minutes and ask about your RowErg, SkiErg and BikeErg workouts: splits, PBs and training load. Free and read-only.`;
  return { title, description, alternates: { canonical: `/connect/${setup.id}` }, openGraph: { siteName: "ErgStats", type: "website", locale: "en_US", title, description } };
}

export default async function ConnectGuidePage({ params }: PageProps<"/connect/[client]">) {
  const setup = await findClient(params);
  const details = guideDetails(setup.id, setup.name);
  const others = guideClients().filter((c) => c.id !== setup.id);
  const steps = [
    {
      name: `Add ErgStats to ${setup.name}`,
      text: setup.oneClick ? `${setup.oneClick.steps} Or add it by hand: ${lowerFirst(setup.steps)}` : setup.steps,
    },
    {
      name: "Sign in with Concept2",
      text: `${setup.name} opens ErgStats in your browser. Sign in with your Concept2 Logbook account and approve read-only access. ErgStats never sees your password and can’t add, change or delete anything.`,
    },
    { name: "Ask about your training", text: details.askHint },
  ];

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Connect your Concept2 Logbook to ${setup.name}`,
    url: `${SITE_URL}/connect/${setup.id}`,
    totalTime: "PT2M",
    // The visible step 3 ends in a colon before the prompt list, so the schema gets an example prompt to stand on its own.
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: i === 2 ? `${s.text} “${TOOLS[0].prompt}”` : s.text,
    })),
  };

  return (
    <>
      <JsonLd data={howTo} />
      <SiteHeader nav current="guides">
        <HeaderSignIn />
      </SiteHeader>

      <main id="main" tabIndex={-1} className="flex-1 scroll-mt-16 pt-8 outline-none lg:scroll-mt-18 pb-18 md:pt-12 md:pb-24 lg:pb-32">
        <Container>
          <PageGrid className="items-start">
            <nav aria-label="Breadcrumb" className="col-span-full">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/" className="hover:text-foreground">
                    ErgStats
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/#guides" className="hover:text-foreground">
                    Setup guides
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-foreground">
                  {setup.name}
                </li>
              </ol>
            </nav>

            <article className="col-span-full flex flex-col gap-10 md:gap-16 lg:col-span-8">
              <div className="flex flex-col gap-6">
                <h1 className={cn(h1Class, "lg:text-[3.25rem]")}>Connect your Concept2 Logbook to {setup.name}</h1>
                <p className={ledeClass}>
                  ErgStats is a free, read-only MCP server that lets {setup.name} read your Concept2 Logbook. Add it once, then ask about
                  your RowErg, SkiErg and BikeErg workouts in plain language. Anything ErgData or your PM5 syncs is included.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {["2 minutes", "Free", "Read-only"].map((label) => (
                    <li key={label} className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-sm font-medium text-primary">
                      <CheckIcon className="size-3.5" strokeWidth={2.5} />
                      {label}
                    </li>
                  ))}
                </ul>
                {details.requirements && (
                  <div role="note" className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-4 rounded-2xl border bg-card p-6">
                    <InfoIcon className="mt-0.5 size-5 text-primary" />
                    <div className="flex flex-col gap-2">
                      <p className="font-semibold">Before you start</p>
                      <p className="text-pretty text-muted-foreground">{details.requirements}</p>
                    </div>
                  </div>
                )}
              </div>

              <ol className="flex flex-col gap-8 md:gap-12">
                {steps.map((step, i) => (
                  <li key={step.name} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[2.5rem_minmax(0,1fr)] md:gap-x-6">
                    <span
                      aria-hidden="true"
                      className="flex size-8 items-center justify-center rounded-full border bg-card font-mono text-sm font-medium tabular-nums md:size-10 md:text-[0.9375rem]"
                    >
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-4 pt-1 md:pt-2">
                      <h2 className={h3Class}>{step.name}</h2>
                      {i === 0 && setup.oneClick && (
                        <>
                          <p className="text-pretty text-muted-foreground">{setup.oneClick.steps}</p>
                          <AddToClientButton href={setup.oneClick.url} client={setup.id} name={setup.name} source="guide" size="xl" className="self-start" />
                          <h3 className="mt-4 font-semibold">Or add it by hand</h3>
                        </>
                      )}
                      {i === 0 && details.menuPath && (
                        <ol aria-label="Menu path" className="flex flex-wrap items-center gap-2">
                          {details.menuPath.map((item, j, path) => (
                            <li key={item} className="flex items-center gap-2">
                              <span className="inline-flex min-h-8 items-center rounded-lg border bg-card px-2.5 text-sm font-medium shadow-[0_1px_0_0_var(--color-border)]">{item}</span>
                              {j < path.length - 1 && <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />}
                            </li>
                          ))}
                        </ol>
                      )}
                      <p className="text-pretty text-muted-foreground">{i === 0 ? setup.steps : step.text}</p>
                      {i === 0 && <CodeBlock title={setup.where} code={setup.code} className="rounded-xl" />}
                      {i === 2 && (
                        <ul className="grid gap-4 md:grid-cols-2">
                          {TOOLS.slice(0, 4).map((t) => (
                            <li key={t.name} className="rounded-xl border bg-card px-4 py-3 text-[0.9375rem]">
                              “{t.prompt}”
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              <section aria-labelledby="trouble-title" className="flex flex-col gap-6">
                <h2 id="trouble-title" className="text-2xl font-semibold tracking-[-0.015em]">
                  If something goes wrong
                </h2>
                <FaqList faqs={details.troubleshooting} />
              </section>
            </article>

            <aside
              aria-labelledby="other-title"
              className="col-span-full mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-6 md:mt-10 lg:col-span-3 lg:col-start-10 lg:mt-0"
            >
              <h2 id="other-title" className="text-[1.0625rem] font-semibold">
                Using something else?
              </h2>
              <ul className="flex flex-col border-t">
                {others.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/connect/${c.id}`}
                      className="flex min-h-12 items-center justify-between border-b text-[0.9375rem] transition-colors hover:text-primary"
                    >
                      {c.name}
                      <ArrowRightIcon className="size-4 text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/sign-in" className={buttonVariants({ size: "xl", className: "w-full" })}>
                Get started free
              </Link>
            </aside>
          </PageGrid>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
