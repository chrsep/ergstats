"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Keys let your agents read your logbook through the ErgStats MCP server.</CardDescription>
          <CardAction>
            <CreateApiKeyDialog onCreate={createKey} onDone={setFreshKey} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ApiKeyTable keys={keys} onRevoke={revokeKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect your agent</CardTitle>
          <CardDescription>
            {freshKey
              ? "Your new key is already in these snippets. Paste one into your client."
              : "Create a key, then add ErgStats to your client. Replace YOUR_API_KEY with the key."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectInstructions mcpUrl={mcpUrl} apiKey={freshKey} />
        </CardContent>
      </Card>
    </>
  );
}
