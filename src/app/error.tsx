"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { captureClientError, errorDigest } from "@/lib/observability/browser";

/** Errors in any page land here. React catches them, so report them to error tracking ourselves. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    captureClientError(error, { digest: errorDigest(error), boundary: "page" });
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">This page hit an error. Try again, or come back in a moment.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}

