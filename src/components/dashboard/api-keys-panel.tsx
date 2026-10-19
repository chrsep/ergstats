"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { apiKeySetups } from "@/lib/mcp/clients";
import { ApiKeyTable } from "./api-key-table";
import { ConnectInstructions } from "./connect-instructions";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import type { ApiKeyRow } from "./types";

/** Wires the API key UI to BetterAuth. Server-rendered keys come in as `initialKeys`. */
export function ApiKeysPanel({ initialKeys, mcpUrl }: { initialKeys: ApiKeyRow[]; mcpUrl: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [freshKey, setFreshKey] = useState<string | undefined>();

  async function createKey(name: string) {
    const { data, error } = await authClient.apiKey.create({ name });
    if (error || !data) throw new Error(error?.message ?? "Couldn't create the key.");
    setKeys((current) => [
      {
        id: data.id,
        name: data.name,
        start: data.start,
        createdAt: data.createdAt,
        lastRequest: data.lastRequest,
        expiresAt: data.expiresAt,
      },
      ...current,
    ]);
    return data.key;
  }

  async function revokeKey(key: ApiKeyRow) {
    const { error } = await authClient.apiKey.delete({ keyId: key.id });
    if (error) {
      toast.error("Couldn't revoke the key", { description: error.message });
      return;
    }
    setKeys((current) => current.filter((k) => k.id !== key.id));
    toast.success(`Revoked “${key.name || "Untitled key"}”`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          For clients and scripts that can&apos;t sign in. Send the key as a bearer token.
        </CardDescription>
        <CardAction>
          <CreateApiKeyDialog onCreate={createKey} onDone={setFreshKey} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ApiKeyTable keys={keys} onRevoke={revokeKey} />
        {keys.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {freshKey
                ? "Your new key is already in these snippets. Paste one into your client."
                : "Replace YOUR_API_KEY with one of your keys."}
            </p>
            <ConnectInstructions setups={apiKeySetups(mcpUrl, freshKey)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
