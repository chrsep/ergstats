"use client";

import { useEffect } from "react";

import { captureClientError, errorDigest } from "@/lib/observability/browser";

/** Errors in the root layout itself. This replaces the whole document, so it carries no app styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    captureClientError(error, { digest: errorDigest(error), boundary: "root" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>ErgStats hit an error. Try again, or come back in a moment.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
