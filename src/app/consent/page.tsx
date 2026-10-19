import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
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

function toSearchParams(params: Awaited<SearchParams>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) query.append(key, v);
  }
  return query;
}

/**
 * The authorization request Better Auth signed when it sent the browser here,
 * or null if the URL was tampered with or has expired. Only the parameters the
 * signature covers (listed in `ba_param`) count, as in the client plugin.
 */
async function signedRequest(query: URLSearchParams): Promise<URLSearchParams | null> {
  const signedNames = new Set(query.getAll("ba_param"));
  const signed = new URLSearchParams();
  for (const [key, value] of query) {
    if (key === "sig" || key === "ba_param" || signedNames.has(key)) signed.append(key, value);
  }
  const { secret } = await auth.$context;
  return (await verifyOAuthQueryParams(signed.toString(), secret)) ? signed : null;
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
  const query = toSearchParams(await searchParams);
  const session = await getSession();
  // Keep the signed request so sign-in returns here.
  if (!session) redirect(`/sign-in?${query}`);

  // Show only what the signature vouches for; the consent endpoint checks it again.
  const request = await signedRequest(query);
  const clientId = request?.get("client_id");
  const redirectHost = hostOf(request?.get("redirect_uri") ?? "");
  if (!clientId || !redirectHost) return <InvalidRequest />;

  const client = await auth.api
    .getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() })
    .catch(() => null);
  if (!client) return <InvalidRequest />;

  return (
    <ConsentForm
      clientName={client.client_name || fallbackName(clientId)}
      redirectHost={redirectHost}
      scopes={(request?.get("scope") ?? "").split(" ").filter(Boolean)}
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
