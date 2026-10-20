import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { Concept2AccountCard } from "@/components/dashboard/concept2-account-card";
import { ConnectInstructions } from "@/components/dashboard/connect-instructions";
import { ConnectedAppsPanel } from "@/components/dashboard/connected-apps-panel";
import { DeleteAccountPanel } from "@/components/dashboard/delete-account-panel";
import type { ApiKeyRow } from "@/components/dashboard/types";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignedInUserMenu } from "@/components/user-menu";
import { mcpUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { clientSetups } from "@/lib/mcp/clients";
import { listConnectedApps } from "@/lib/oauth/connected-apps";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

async function HeaderUser() {
  const { user } = await requireSession();
  return <SignedInUserMenu name={user.name} email={user.email} image={user.image} />;
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { user } = await requireSession();
  const [{ apiKeys }, apps, { delete: deleteParam }] = await Promise.all([
    auth.api.listApiKeys({ headers: await headers() }),
    listConnectedApps(user.id),
    searchParams,
  ]);
  const keys: ApiKeyRow[] = apiKeys
    .map((k) => ({
      id: k.id,
      name: k.name,
      start: k.start,
      createdAt: k.createdAt,
      lastRequest: k.lastRequest,
      expiresAt: k.expiresAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect your agent</CardTitle>
          <CardDescription>Add ErgStats to your client, then sign in with Concept2 when it asks. No key to copy.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectInstructions setups={clientSetups(mcpUrl())} />
        </CardContent>
      </Card>
      <ConnectedAppsPanel initialApps={apps} />
      <ApiKeysPanel initialKeys={keys} mcpUrl={mcpUrl()} />
      <Concept2AccountCard name={user.name} email={user.email} image={user.image} />
      {/* Signing in again to delete lands back here with ?delete=confirm. */}
      <DeleteAccountPanel confirming={deleteParam === "confirm"} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <>
      <SiteHeader>
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <HeaderUser />
        </Suspense>
      </SiteHeader>
      <main id="main" tabIndex={-1} className="mx-auto scroll-mt-16 outline-none lg:scroll-mt-18 w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Connect ErgStats to your agent and manage what can read your logbook.</p>
        </div>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
