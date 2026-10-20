import { cn } from "@/lib/utils";

const columns = ["ErgStats", "Self-hosted Concept2 MCP servers", "AI rowing-coach apps"];
/** Shorter column names, shown beside each value once the table stacks on phones. */
const shortColumns = ["ErgStats", "Self-hosted servers", "Coach apps"];

const rows: { feature: string; values: [string, string, string] }[] = [
  { feature: "Works in Claude and ChatGPT", values: ["Yes, plus Claude Code, Codex and Cursor", "Desktop apps, after setup", "No, their own chat"] },
  { feature: "Setup", values: ["Paste a URL, sign in with Concept2", "Install Node or Rust, paste a token or password", "New app and account"] },
  { feature: "Access to your Logbook", values: ["Read-only, revoke any time", "Often read and write", "Varies"] },
  { feature: "Open source", values: ["Yes, MIT on GitHub", "Usually", "Varies"] },
  { feature: "Price", values: ["Free", "Free", "Usually a subscription"] },
];

/** A four-column comparison that turns into one block per row on phones, so nothing scrolls sideways. */
export function CompareTable({ className }: { className?: string }) {
  return (
    <div className={cn("col-span-full overflow-hidden rounded-2xl border bg-card", className)}>
      <table className="w-full table-fixed border-collapse text-[0.9375rem] leading-normal max-md:block">
        <thead className="bg-muted max-md:hidden">
          <tr>
            <th scope="col" className="px-6 py-4 text-left">
              <span className="sr-only">Feature</span>
            </th>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={cn("px-6 py-4 text-left text-sm font-medium text-muted-foreground", i === 0 && "font-semibold text-foreground")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((row) => (
            <tr key={row.feature} className="border-t first:border-t-0 max-md:block max-md:px-6 max-md:py-5 md:first:border-t">
              <th scope="row" className="px-6 py-4 text-left align-top font-medium max-md:block max-md:p-0 max-md:pb-3 max-md:font-semibold">
                {row.feature}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={shortColumns[i]}
                  data-label={shortColumns[i]}
                  className={cn(
                    "px-6 py-4 align-top text-muted-foreground max-md:grid max-md:grid-cols-[5fr_7fr] max-md:gap-4 max-md:px-0 max-md:py-1.5 max-md:before:text-[0.8125rem] max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]",
                    i === 0 && "font-medium text-foreground md:bg-primary/5",
                  )}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
