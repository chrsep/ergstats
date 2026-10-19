import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ConsentForm } from "@/components/consent/consent-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Connect an app" };

type SearchParams = PageProps<"/consent">["searchParams"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A CIMD client's ID is the URL of its metadata document, so its host names the app when it gives no name. */
function fallbackName(clientId: string): string {
  try {
    return new URL(clientId).host;
  } catch {
    return "An app";
  }
}

function hostOf(uri: string): string | undefined {
  try {
    return new URL(uri).host;
  } catch {
    return undefined;
  }
}

function InvalidRequest() {
  return (
    <Alert variant="destructive" className="max-w-md">
      <AlertTitle>This connection request isn&apos;t valid</AlertTitle>
      <AlertDescription>It may have expired. Go back to the app you were connecting and try again.</AlertDescription>
    </Alert>
  );
}

async function Consent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) {
    // Keep the signed request so sign-in returns here.
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) query.append(key, v);
    }
    redirect(`/sign-in?${query}`);
  }

  const clientId = first(params.client_id);
  const redirectHost = hostOf(first(params.redirect_uri) ?? "");
  if (!clientId || !redirectHost) return <InvalidRequest />;

  const client = await auth.api
    .getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() })
    .catch(() => null);
  if (!client) return <InvalidRequest />;

  return (
    <ConsentForm
      clientName={client.client_name || fallbackName(clientId)}
      redirectHost={redirectHost}
      scopes={(first(params.scope) ?? "").split(" ").filter(Boolean)}
      user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
    />
  );
}

export default function ConsentPage({ searchParams }: PageProps<"/consent">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16">
      <Suspense fallback={<Skeleton className="h-[30rem] w-full max-w-md rounded-xl" />}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
