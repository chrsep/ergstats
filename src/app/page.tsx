import { ArrowRightIcon, CodeXmlIcon, EyeIcon, LockKeyholeIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AddToClientButton } from "@/components/add-to-client-button";
import { JsonLd } from "@/components/json-ld";
import { CompareTable } from "@/components/marketing/compare-table";
import { FaqList } from "@/components/marketing/faq";
import { GuideCards, McpUrlBar } from "@/components/marketing/guide-cards";
import { HorizonPainting } from "@/components/marketing/horizon-painting";
import {
  Eyebrow,
  PageGrid,
  Panel,
  Section,
  SectionHeading,
  h1Class,
  h2Class,
  h3Class,
  ledeClass,
  panelClass,
} from "@/components/marketing/page-layout";
import { SiteFooter } from "@/components/site-footer";
import { HeaderGitHub, HeaderSignIn, SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { mcpUrl } from "@/lib/app-url";
import { claudeConnectorUrl } from "@/lib/mcp/clients";
import { FAQS, GITHUB_URL, SITE_DESCRIPTION, SITE_URL, guideClients, guideDetails } from "@/lib/site";
import { cn } from "@/lib/utils";

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

const steps = [
  {
    title: "Add ErgStats to Claude",
    body: "The Add to Claude button opens Claude with ErgStats already filled in. Click Continue, then Add.",
    note: "Works on every plan, including Free. On Team and Enterprise, someone who manages connectors adds it first.",
  },
  {
    title: "Sign in with Concept2",
    body: "Claude sends you to your Concept2 Logbook to approve read-only access. That sign-in is your ErgStats account, so there’s nothing else to sign up for.",
    note: "Disconnect from Claude or your ErgStats dashboard any time.",
  },
  {
    title: "Ask about your training",
    body: "Start a new chat and ask. Claude fetches the workouts it needs: splits, intervals, heart rate and PBs.",
    prompt: "How has my 2k pace changed since January?",
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
  const guides = guideClients()
    .filter((c) => c.id !== "claude")
    .map((c) => ({ id: c.id, name: c.name, ...guideDetails(c.id, c.name) }));
  const claudeUrl = claudeConnectorUrl(mcpUrl());

  return (
    <>
      <JsonLd data={structuredData} />
      {/* On phones the painting runs up under a black fade, with solid buttons so they stay clear. */}
      <SiteHeader className="dark border-b-0 bg-transparent bg-linear-to-b from-black/90 via-black/60 to-transparent text-foreground max-md:backdrop-blur-none md:bg-[#0B1514] md:bg-none">
        <HeaderGitHub className="max-md:rounded-full max-md:border max-md:border-white/20 max-md:bg-[#0F1A19] max-md:text-foreground" />
        <HeaderSignIn className="max-md:rounded-full max-md:border-white/20! max-md:bg-[#0F1A19]! max-md:hover:bg-[#1A2826]!" />
      </SiteHeader>

      <main id="main" tabIndex={-1} className="flex-1 scroll-mt-16 outline-none lg:scroll-mt-18">
        {/* Always dark. On phones the painting runs edge to edge and up under the header; from md it is a
            wide card, wider than the header's content, that sits flush on the next section. */}
        <div className="bg-[#0B1514] text-[#F2F6F5]">
          <div className="mx-auto w-full max-w-[105rem] md:px-4 lg:px-6">
            <section
              aria-labelledby="hero-title"
              className="relative isolate -mt-16 flex min-h-[max(40rem,100svh)] flex-col items-center overflow-hidden bg-[#050A09] px-5 pt-16 pb-6 text-center md:mt-0 md:min-h-[clamp(36rem,52vw,50rem)] md:rounded-t-[2.5rem] md:px-14 md:pt-14 md:pb-9"
            >
              <HorizonPainting className="absolute inset-0 -z-10 size-full object-cover object-bottom" />
              <div className="my-auto flex max-w-235 flex-col items-center gap-5 py-10 md:gap-5.5">
                <p className="font-mono text-xs text-[#8FD3CD] md:text-[0.8125rem]">Concept2 Logbook · MCP server</p>
                <h1 id="hero-title" className={cn(h1Class, "leading-[1.02] lg:text-[4.5rem]")}>
                  Ask your AI agent about every meter you’ve rowed.
                </h1>
                <p className={cn(ledeClass, "max-w-xl text-[#B7C4C2]")}>
                  Add ErgStats to Claude, sign in with your Concept2 Logbook, and ask. There’s no separate account to create.
                </p>
                <div className="flex w-full flex-col items-center gap-2 pt-2 sm:w-auto sm:flex-row sm:gap-7">
                  <AddToClientButton
                    href={claudeUrl}
                    client="claude"
                    name="Claude"
                    source="home_hero"
                    size="xl"
                    className="w-full rounded-full bg-[#F2F6F5] px-7 text-[#0B1514] hover:bg-white sm:w-auto"
                  />
                  <Link href="/#guides" className="inline-flex min-h-11 items-center gap-2 font-medium transition-colors hover:text-[#8FD3CD]">
                    Use ChatGPT or another app
                    <ArrowRightIcon aria-hidden="true" className="size-4.5" />
                  </Link>
                </div>
                <p className="text-sm text-[#B7C4C2]">Works on every Claude plan, including Free.</p>
              </div>
              <div className="flex min-h-38 w-full flex-col items-center justify-end gap-1.5 text-[0.8125rem] text-[#B7C4C2] md:min-h-30 md:flex-row md:items-end md:justify-between md:gap-8 md:text-sm">
                <p>Works with Claude, ChatGPT, and any AI agent</p>
                <p className="font-mono text-xs">Free · Read-only · Open source</p>
              </div>
            </section>
          </div>
        </div>

        <Section id="how" tone="muted" aria-labelledby="how-title">
          <PageGrid>
            <SectionHeading
              id="how-title"
              eyebrow="How it works"
              title="Connect your Concept2 Logbook to Claude"
              lede="Three steps, about two minutes. No password to share, no token to paste, nothing to install."
            />
          </PageGrid>
          <PageGrid>
            <ol className="col-span-full grid grid-cols-subgrid gap-y-4 md:gap-y-6">
              {steps.map((step, i) => (
                <li key={step.title} className={cn(panelClass, "col-span-full md:col-span-8 lg:col-span-4")}>
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-xl bg-primary/10 font-mono font-semibold text-primary"
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className={h3Class}>{step.title}</h3>
                    <p className="text-pretty text-muted-foreground">{step.body}</p>
                  </div>
                  {step.note && <p className="mt-auto pt-2 text-sm text-pretty text-muted-foreground">{step.note}</p>}
                  {step.prompt && <p className="mt-auto rounded-xl bg-muted px-4 py-3 text-[0.9375rem]">“{step.prompt}”</p>}
                </li>
              ))}
            </ol>
            <div className="col-span-full flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <AddToClientButton href={claudeUrl} client="claude" name="Claude" source="home_steps" size="xl" />
              <Link
                href="/connect/claude"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-3 hover:underline"
              >
                Step-by-step Claude guide
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </PageGrid>
        </Section>

        <Section id="guides" aria-labelledby="guides-title" className="border-t">
          <PageGrid>
            <SectionHeading
              id="guides-title"
              eyebrow="Other apps"
              title="Using ChatGPT or a coding agent?"
              lede="Every app uses the same URL and the same Concept2 sign-in. Pick yours for the exact steps."
            />
          </PageGrid>
          <PageGrid>
            <GuideCards guides={guides} />
            <McpUrlBar url={mcpUrl()} oneClick={false} />
            <p className="col-span-full text-sm text-pretty text-muted-foreground">
              Using another MCP client? Any client that supports sign-in works with the same URL. Clients that can’t sign in can use an API
              key from your{" "}
              <Link href="/dashboard" className="font-medium text-primary underline underline-offset-3 hover:no-underline">
                dashboard
              </Link>
              .
            </p>
          </PageGrid>
        </Section>

        <Section id="ask" tone="muted" aria-labelledby="ask-title">
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
              <p className={ledeClass}>
                Free, read-only and{" "}
                <a href={GITHUB_URL} className="font-medium text-primary underline underline-offset-3 hover:no-underline">
                  open source
                </a>
                . Connected in two minutes.
              </p>
            </div>
            <div className="col-span-full flex flex-col gap-4 sm:flex-row lg:col-span-5 lg:justify-end">
              <AddToClientButton href={claudeUrl} client="claude" name="Claude" source="home_cta" size="xl" />
              <Link href="/#guides" className={cn(buttonVariants({ size: "xl", variant: "outline" }), "font-medium")}>
                Other apps
              </Link>
            </div>
          </PageGrid>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
