import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { Concept2AccountCard } from "@/components/dashboard/concept2-account-card";
import type { ApiKeyRow } from "@/components/dashboard/types";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SignedInUserMenu } from "@/components/user-menu";
import { mcpUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

async function HeaderUser() {
  const { user } = await requireSession();
  return <SignedInUserMenu name={user.name} email={user.email} image={user.image} />;
}

async function DashboardContent() {
  const { user } = await requireSession();
  const { apiKeys } = await auth.api.listApiKeys({ headers: await headers() });
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
      <ApiKeysPanel initialKeys={keys} mcpUrl={mcpUrl()} />
      <Concept2AccountCard name={user.name} email={user.email} image={user.image} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <SiteHeader>
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <HeaderUser />
        </Suspense>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Create an API key and connect ErgStats to your agent.</p>
        </div>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </>
  );
}
