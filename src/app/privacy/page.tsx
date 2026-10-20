import { ChartNoAxesColumnIcon, CookieIcon, EyeOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnalyticsPreferenceControl } from "@/components/privacy/analytics-preference-control";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What ErgStats stores, what it measures, and how to turn analytics off.",
};

const CONTACT = "privacy@ergstats.com";
const UPDATED = "20 October 2026";

const summary = [
  { icon: CookieIcon, title: "No tracking cookies", body: "The only cookie keeps you signed in. Nothing to accept, so there’s no banner." },
  { icon: EyeOffIcon, title: "Your workouts stay yours", body: "Read from Concept2 when your AI asks, never stored, never in analytics." },
  { icon: ChartNoAxesColumnIcon, title: "Anonymous analytics", body: "Visits are counted without cookies, and IP addresses aren’t kept. You can switch it off below." },
];

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </SiteHeader>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-12 px-4 py-16 sm:px-6">
          <header className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
            <p className="text-lg text-pretty text-muted-foreground">
              ErgStats connects your Concept2 Logbook to your AI tools. Here is everything it keeps, everything it measures, and how
              to switch the measuring off.
            </p>
            <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
          </header>

          <div className="grid gap-6 sm:grid-cols-3">
            {summary.map((item) => (
              <div key={item.title} className="space-y-2">
                <item.icon className="size-5 text-primary" />
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>

          <Section id="analytics" title="Analytics">
            <p>
              To see whether ErgStats works well, it counts page views, page load speed and errors with PostHog, hosted in the EU
              (Frankfurt). It runs in cookieless mode: nothing is stored in your browser, and visitors are counted with a hash that
              changes every day. Your IP address is used for that count and then discarded; only your country is kept. Links lose
              everything after the <code className="font-mono text-sm">?</code> except campaign tags.
            </p>
            <p>
              Our server also records when you sign in or connect an AI tool, and, for each request from one, which tool ran, how
              long it took, whether it worked and which app sent it. That goes under an id that can’t be traced back to you without
              our server, and never includes your workouts, dates or anything you asked.
            </p>
            <AnalyticsPreferenceControl />
            <p className="text-sm">
              The switch covers this browser’s visits and saves your choice in its local storage, nothing else. To opt out of what
              the server records too, email us and we’ll delete it.
            </p>
          </Section>

          <Section title="What ErgStats stores">
            <ul>
              <li>
                <strong>Your account:</strong> the name, email and profile picture Concept2 shares when you sign in.
              </li>
              <li>
                <strong>Your Concept2 connection:</strong> the access tokens that let ErgStats read your Logbook, encrypted.
              </li>
              <li>
                <strong>Sign-in sessions:</strong> when they expire, plus the IP address and browser they started from, so you can
                spot one you don’t recognize.
              </li>
              <li>
                <strong>Connected apps and API keys:</strong> which AI tools you approved, and your API keys, stored hashed.
              </li>
            </ul>
            <p>
              Workouts aren’t on this list. ErgStats fetches them from Concept2 when your AI tool asks and passes them straight on.
            </p>
          </Section>

          <Section title="Cookies and storage">
            <ul>
              <li>
                <strong>Sign-in cookies</strong> keep you signed in. They’re only set when you sign in, and the site can’t work
                without them.
              </li>
              <li>
                <strong>Local storage</strong> remembers your light or dark theme, and your analytics choice if you turned it off.
              </li>
            </ul>
          </Section>

          <Section title="Who handles your data">
            <ul>
              <li>
                <strong>Concept2</strong>, where your Logbook lives.
              </li>
              <li>
                <strong>Vercel</strong>, which runs the site.
              </li>
              <li>
                <strong>Neon</strong>, which hosts the database, in Singapore.
              </li>
              <li>
                <strong>PostHog</strong>, which runs the analytics, in the EU.
              </li>
            </ul>
            <p>ErgStats shows no ads and never sells or shares your data with anyone else.</p>
          </Section>

          <Section title="Your choices">
            <ul>
              <li>Switch analytics off above, or turn on Do Not Track or Global Privacy Control in your browser.</li>
              <li>
                Disconnect an AI tool or delete an API key from your{" "}
                <Link href="/dashboard" className="text-foreground underline underline-offset-4">
                  dashboard
                </Link>
                . Access stops immediately.
              </li>
              <li>
                Delete your account from the bottom of your{" "}
                <Link href="/dashboard" className="text-foreground underline underline-offset-4">
                  dashboard
                </Link>
                . That erases your account, sessions, API keys, connected apps and Concept2 tokens straight away. Database backups
                and hosting logs keep a copy until they expire on their own schedule.
              </li>
              <li>
                Ask for a copy of your data, or for anything else to be deleted, by emailing{" "}
                <a href={`mailto:${CONTACT}`} className="text-foreground underline underline-offset-4">
                  {CONTACT}
                </a>
                .
              </li>
            </ul>
            <p>
              Under the GDPR, your account is handled to provide the service you signed up for, and analytics on the basis of a
              legitimate interest in keeping the service working, which you can object to at any time with the switch above.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
