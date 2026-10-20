import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CodeBlock } from "@/components/code-block";
import { JsonLd } from "@/components/json-ld";
import { TOOLS } from "@/components/marketing/tool-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { SITE_URL, guideClients } from "@/lib/site";

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
  const others = guideClients().filter((c) => c.id !== setup.id);
  const steps = [
    { name: `Add ErgStats to ${setup.name}`, text: setup.steps },
    { name: "Sign in with Concept2", text: "Approve read-only access to your Concept2 Logbook. ErgStats can’t add, change or delete anything." },
    { name: "Ask about your training", text: `Ask ${setup.name} about your splits, PBs, weekly volume or pacing within a piece.` },
  ];

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Connect your Concept2 Logbook to ${setup.name}`,
    url: `${SITE_URL}/connect/${setup.id}`,
    totalTime: "PT2M",
    step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
  };

  return (
    <>
      <JsonLd data={howTo} />
      <SiteHeader>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </SiteHeader>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <p className="mb-4 font-mono text-xs text-muted-foreground">Setup guide · {setup.name}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Connect your Concept2 Logbook to {setup.name}</h1>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">
          ErgStats is a free, read-only MCP server that lets {setup.name} read your Concept2 Logbook. Once it’s connected, ask about
          your RowErg, SkiErg and BikeErg workouts in plain language. Anything ErgData or your PM5 syncs is included.
        </p>

        <ol className="mt-12 flex flex-col gap-10">
          {steps.map((step, i) => (
            <li key={step.name} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-xl font-medium">{step.name}</h2>
                <p className="text-muted-foreground">{step.text}</p>
                {i === 0 && <CodeBlock title={setup.where} code={setup.code} />}
                {i === 2 && (
                  <ul className="flex flex-col gap-2">
                    {TOOLS.map((t) => (
                      <li key={t.name} className="rounded-md bg-muted/60 px-3 py-2 text-sm italic">
                        “{t.prompt}”
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-16 flex flex-wrap items-center gap-3 border-t pt-8">
          <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
            Get started free
          </Link>
          <Link href="/#faq" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Questions
          </Link>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Using something else?{" "}
          {others.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={`/connect/${c.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
