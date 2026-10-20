"use client";

import { CodeBlock } from "@/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClientSetup } from "@/lib/mcp/clients";
import { captureClientEvent } from "@/lib/observability/browser";

/** Per-client setup snippets, one tab per client. `auth` says which kind they are, for analytics. */
export function ConnectInstructions({ setups, auth = "oauth" }: { setups: ClientSetup[]; auth?: "oauth" | "api_key" }) {
  return (
    <Tabs defaultValue={setups[0].id} className="gap-3">
      <TabsList className="h-auto max-w-full flex-wrap justify-start">
        {setups.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="flex-none">
            {s.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {setups.map((s) => (
        <TabsContent key={s.id} value={s.id} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{s.steps}</p>
          <CodeBlock
            title={s.where}
            code={s.code}
            onCopy={() => captureClientEvent("setup_snippet_copied", { client: s.id, auth })}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
