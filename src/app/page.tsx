import { LockKeyholeIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { ChatPreview } from "@/components/marketing/chat-preview";
import { FaqList } from "@/components/marketing/faq";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ToolGrid } from "@/components/marketing/tool-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { mcpUrl } from "@/lib/app-url";
import { FAQS, SITE_DESCRIPTION, SITE_URL, guideClients } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const promises = [
  { icon: ShieldCheckIcon, title: "Read-only", body: "ErgStats can read your workouts. It can’t add, change or delete anything." },
  { icon: LockKeyholeIcon, title: "Your keys, your call", body: "Concept2 tokens are encrypted at rest. Disconnect an app or revoke a key and access stops instantly." },
  { icon: ZapIcon, title: "Built for agents", body: "Compact answers, structured output and clear errors, on the latest MCP spec." },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "ErgStats" },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "ErgStats",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "SportsApplication",
      applicationSubCategory: "MCP server",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Connect the Concept2 Logbook to Claude, ChatGPT, Claude Code, Codex, Cursor and VS Code",
        "Read-only access to RowErg, SkiErg and BikeErg workouts",
        "Splits, intervals, heart rate and stroke data",
        "Personal bests and training volume summaries",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader>
        <Link href="/#how-it-works" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
          How it works
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </SiteHeader>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:pt-24">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">MCP server for the Concept2 Logbook</span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Ask Claude or ChatGPT about every meter you’ve rowed.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              ErgStats connects your Concept2 Logbook to Claude, ChatGPT, Claude Code, Codex and any MCP client. Splits, PBs and
              training load from your RowErg, SkiErg and BikeErg, in plain language.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
                Get started free
              </Link>
              <Link href="/#tools" className={buttonVariants({ size: "lg", variant: "outline" })}>
                See the tools
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">Works with RowErg, SkiErg and BikeErg. Anything ErgData or your PM5 syncs.</p>
          </div>
          <ChatPreview />
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="mb-10 text-3xl font-semibold tracking-tight">Connected in two minutes</h2>
            <HowItWorks mcpUrl={mcpUrl()} />
            <p className="mt-10 text-sm text-muted-foreground">
              Step-by-step setup:{" "}
              {guideClients().map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <Link href={`/connect/${c.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        </section>

        <section id="tools" className="scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="mb-10 max-w-2xl space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight">Six tools, every question</h2>
              <p className="text-muted-foreground">
                Your agent picks the right tool for the question. Paces come back the way your monitor shows them.
              </p>
            </div>
            <ToolGrid />
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
            {promises.map((p) => (
              <div key={p.title} className="space-y-2">
                <p.icon className="size-5 text-primary" />
                <h3 className="font-medium">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="faq" className="scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="mb-10 text-3xl font-semibold tracking-tight">Questions</h2>
            <FaqList faqs={FAQS} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
