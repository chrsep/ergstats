import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Sign in with Concept2",
    body: "Approve read-only access to your Logbook. Anything you row with ErgData or log on the PM5 shows up.",
  },
  {
    title: "Create an API key",
    body: "One key per agent or machine, so you can revoke one without touching the rest.",
  },
  {
    title: "Add ErgStats to your agent",
    body: "Claude Code, Cursor, VS Code, Claude Desktop or any MCP client. Then just ask.",
  },
];

export function HowItWorks({ mcpUrl, className }: { mcpUrl: string; className?: string }) {
  return (
    <div className={cn("grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center", className)}>
      <ol className="flex flex-col gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm tabular-nums">
              {i + 1}
            </span>
            <div className="space-y-1">
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <CodeBlock
        title="Terminal"
        code={`claude mcp add --transport http ergstats ${mcpUrl} \\\n  --header "Authorization: Bearer erg_…"`}
      />
    </div>
  );
}
