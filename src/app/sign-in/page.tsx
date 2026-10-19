import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { Concept2SignInButton } from "@/components/concept2-sign-in-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  access_denied: "You declined access on Concept2. ErgStats needs read access to your Logbook to work.",
};

async function SignInError({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  // Already signed in? Skip straight to the dashboard.
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  if (!error || typeof error !== "string") return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{ERRORS[error] ?? "Sign-in didn’t finish. Please try again."}</AlertDescription>
    </Alert>
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo showWordmark={false} className="mb-2 justify-center [&_svg]:size-10" />
          <CardTitle className="text-xl">Sign in to ErgStats</CardTitle>
          <CardDescription>Use your Concept2 Logbook account. ErgStats only asks for read access.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <SignInError searchParams={searchParams} />
          </Suspense>
          <Concept2SignInButton className="w-full" />
          <p className="text-center text-xs text-muted-foreground">
            No Logbook account? Create one free at{" "}
            <a href="https://log.concept2.com/signup" className="underline underline-offset-4 hover:text-foreground">
              log.concept2.com
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
