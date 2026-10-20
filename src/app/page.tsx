import { CodeXmlIcon, EyeIcon, LockKeyholeIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GitHubIcon } from "@/components/brand/github-icon";
import { JsonLd } from "@/components/json-ld";
import { ChatPreview } from "@/components/marketing/chat-preview";
import { CompareTable } from "@/components/marketing/compare-table";
import { FaqList } from "@/components/marketing/faq";
import { GuideCards, McpUrlBar } from "@/components/marketing/guide-cards";
import {
  Container,
  Eyebrow,
  PageGrid,
  Panel,
  Section,
  SectionHeading,
  h1Class,
  h2Class,
  h3Class,
  ledeClass,
} from "@/components/marketing/page-layout";
import { SiteFooter } from "@/components/site-footer";
import { HeaderSignIn, SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { mcpUrl } from "@/lib/app-url";
import { FAQS, GITHUB_URL, SITE_DESCRIPTION, SITE_URL, guideClients, guideDetails } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const machines = [
  {
    name: "RowErg",
    body: "2k tests, steady state, intervals and stroke-by-stroke pacing.",
    prompts: ["Where did I fade in my 5k?", "Show every 2k I did this year."],
  },
  {
    name: "SkiErg",
    body: "Sprint and threshold work, PBs and how your pace holds up.",
    prompts: ["What are my SkiErg PBs this season?", "Break down Tuesday’s 8×250m."],
  },
  {
    name: "BikeErg",
    body: "Watts, cadence and volume, with pace per 1000m like your monitor.",
    prompts: ["How far did I ride each week this block?", "Set my heart rate zones from my profile."],
  },
];

const promises = [
  { icon: EyeIcon, title: "Read-only", body: "ErgStats can read your workouts. It can’t add, change or delete anything." },
  { icon: LockKeyholeIcon, title: "Your keys, your call", body: "Concept2 tokens are encrypted at rest. Disconnect an app or revoke a key and access stops right away." },
  { icon: ZapIcon, title: "Built for agents", body: "Compact answers, structured output and clear errors, on the latest MCP spec." },
  { icon: CodeXmlIcon, title: "Open source", body: "Every line is public under the MIT license, so you can check what happens to your data." },
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
      license: "https://opensource.org/licenses/MIT",
      codeRepository: GITHUB_URL,
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
  const guides = guideClients().map((c) => ({ id: c.id, name: c.name, ...guideDetails(c.id, c.name) }));

  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader nav>
        <HeaderSignIn />
      </SiteHeader>

      <main id="main" className="flex-1">
        <section aria-labelledby="hero-title" className="pt-10 pb-18 md:pt-18 md:pb-24 lg:pt-24 lg:pb-32">
          <Container>
            <PageGrid className="items-center gap-y-10 md:gap-y-16">
              <div className="col-span-full flex flex-col items-start gap-6 lg:col-span-6">
                <p className="inline-flex items-center gap-2 rounded-full border bg-card py-1.5 pr-3 pl-2.5 font-mono text-[0.8125rem] text-muted-foreground">
                  <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                  <span className="max-sm:hidden">Concept2 Logbook</span> MCP server · free · open source
                </p>
                <h1 id="hero-title" className={h1Class}>
                  Ask Claude or ChatGPT about every meter you’ve rowed.
                </h1>
                <p className={ledeClass}>
                  Connect your Concept2 Logbook to Claude, ChatGPT, Claude Code or Codex in two minutes. Splits, PBs and training load
                  from your RowErg, SkiErg and BikeErg, answered in plain language.
                </p>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
                  <Link href="/#guides" className={buttonVariants({ size: "xl" })}>
                    Connect your Logbook
                  </Link>
                  <Link href="/#ask" className={buttonVariants({ size: "xl", variant: "outline", className: "font-medium" })}>
                    See what you can ask
                  </Link>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Works in</span>
                    {guides.map((g) => (
                      <Link
                        key={g.id}
                        href={`/connect/${g.id}`}
                        className="inline-flex min-h-7 items-center rounded-lg border bg-card px-2.5 text-sm transition-colors hover:border-foreground/20"
                      >
                        {g.name}
                      </Link>
                    ))}
                  </div>
                  <a href={GITHUB_URL} className="group inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <GitHubIcon />
                    <span>
                      Open source under the MIT license.{" "}
                      <span className="font-medium text-primary underline underline-offset-3 group-hover:no-underline">
                        Read the code on GitHub
                      </span>
                    </span>
                  </a>
                </div>
              </div>
              <ChatPreview className="col-span-full lg:col-span-5 lg:col-start-8" />
            </PageGrid>
          </Container>
        </section>

        <Section id="guides" tone="muted" aria-labelledby="guides-title">
          <PageGrid>
            <SectionHeading
              id="guides-title"
              eyebrow="Setup"
              title="Connect your Concept2 Logbook to your AI"
              lede="Add one URL, sign in with Concept2, and ask. No password to share, no token to paste, nothing to install."
            />
          </PageGrid>
          <PageGrid>
            <GuideCards guides={guides} />
            <McpUrlBar url={mcpUrl()} />
          </PageGrid>
        </Section>

        <Section id="ask" aria-labelledby="ask-title" className="border-t">
          <PageGrid>
            <SectionHeading
              id="ask-title"
              eyebrow="What to ask"
              title="Ask anything your Logbook knows"
              lede="Every workout ErgData or your PM5 syncs, plus anything you logged by hand. Your assistant picks the right tool, and paces come back the way your monitor shows them."
            />
          </PageGrid>
          <PageGrid>
            {machines.map((m) => (
              <Panel key={m.name} className="col-span-full md:col-span-4">
                <div className="flex flex-col gap-2">
                  <h3 className={h3Class}>{m.name}</h3>
                  <p className="text-pretty text-muted-foreground">{m.body}</p>
                </div>
                <ul className="mt-auto flex flex-col gap-2">
                  {m.prompts.map((p) => (
                    <li key={p} className="rounded-xl bg-muted px-4 py-3 text-[0.9375rem]">
                      “{p}”
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </PageGrid>
        </Section>

        <Section tone="dark" aria-labelledby="hyrox-title">
          <PageGrid className="items-center gap-y-10">
            <div className="col-span-full flex flex-col gap-4 lg:col-span-6">
              <Eyebrow className="text-[#8FD3CD]">For hybrid racing</Eyebrow>
              <h2 id="hyrox-title" className={h2Class}>
                Training for HYROX? Your erg stations, analyzed.
              </h2>
              <p className="text-lg leading-[1.55] text-pretty text-[#B7C4C2] lg:text-xl">
                HYROX races include a 1000m SkiErg and a 1000m RowErg. Ask for your best 1000m on each, how your pace holds up after hard
                work, and how your weekly erg volume is trending.
              </p>
            </div>
            <figure className="col-span-full m-0 flex flex-col gap-4 lg:col-span-5 lg:col-start-8">
              <figcaption className="font-mono text-xs text-[#8FD3CD]">Example answer</figcaption>
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                {[
                  { label: "SkiErg 1000m", time: "3:58.2", note: "Best · Mar 14" },
                  { label: "RowErg 1000m", time: "3:34.9", note: "Best · Feb 2" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col gap-2 rounded-2xl border border-[#24403D] p-6">
                    <span className="font-mono text-[0.8125rem] text-[#B7C4C2]">{s.label}</span>
                    <span className="text-[2rem] leading-none font-semibold tracking-[-0.02em] tabular-nums lg:text-[2.5rem]">{s.time}</span>
                    <span className="text-sm text-[#8FD3CD]">{s.note}</span>
                  </div>
                ))}
                <p className="col-span-full rounded-xl bg-[#13221F] px-4 py-3 text-[0.9375rem]">
                  “Compare my last three SkiErg 1000s and tell me which pacing worked.”
                </p>
              </div>
            </figure>
          </PageGrid>
        </Section>

        <Section tone="muted" aria-labelledby="why-title">
          <PageGrid>
            <SectionHeading
              id="why-title"
              eyebrow="Why ErgStats"
              title="Private, read‑only and free"
              lede="How ErgStats compares with running your own Concept2 MCP server or signing up for an AI coaching app."
            />
          </PageGrid>
          <PageGrid>
            {promises.map((p) => (
              <Panel key={p.title} className="col-span-full max-md:grid max-md:grid-cols-[2.5rem_minmax(0,1fr)] md:col-span-4 lg:col-span-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="size-5" />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className={h3Class}>{p.title}</h3>
                  <p className="text-pretty text-muted-foreground">{p.body}</p>
                </div>
              </Panel>
            ))}
          </PageGrid>
          <PageGrid>
            <CompareTable />
          </PageGrid>
        </Section>

        <Section id="faq" aria-labelledby="faq-title" className="border-t">
          <PageGrid className="gap-y-10">
            <div className="col-span-full flex flex-col gap-4 lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="faq-title" className={h2Class}>
                Questions
              </h2>
              <p className={ledeClass}>
                Something missing?{" "}
                <a href={`${GITHUB_URL}/issues`} className="font-medium text-primary underline underline-offset-3 hover:no-underline">
                  Ask on GitHub
                </a>
                .
              </p>
            </div>
            <FaqList faqs={FAQS} openFirst className="col-span-full lg:col-span-8" />
          </PageGrid>
        </Section>

        <Section tone="accent" aria-labelledby="cta-title">
          <PageGrid className="items-center gap-y-8">
            <div className="col-span-full flex flex-col gap-4 lg:col-span-7">
              <h2 id="cta-title" className={h2Class}>
                Your Logbook, in the assistant you already use.
              </h2>
              <p className={ledeClass}>Free, read-only and open source. Connected in two minutes.</p>
            </div>
            <div className="col-span-full flex flex-col gap-4 sm:flex-row lg:col-span-5 lg:justify-end">
              <Link href="/sign-in" className={buttonVariants({ size: "xl" })}>
                Sign in with Concept2
              </Link>
              <a href={GITHUB_URL} className={buttonVariants({ size: "xl", variant: "outline", className: "font-medium" })}>
                View the source
              </a>
            </div>
          </PageGrid>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
