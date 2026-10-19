"use client";

import { CodeBlock } from "@/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clientSetups } from "@/lib/mcp/clients";

/**
 * Per-client setup snippets. Pass `apiKey` right after a key is created so
 * the snippets are ready to paste; otherwise they show a placeholder.
 */
export function ConnectInstructions({ mcpUrl, apiKey }: { mcpUrl: string; apiKey?: string }) {
  const setups = clientSetups(mcpUrl, apiKey);
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
          <CodeBlock title={s.where} code={s.code} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
