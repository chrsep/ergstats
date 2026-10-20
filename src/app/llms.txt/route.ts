import { TOOLS } from "@/components/marketing/tool-grid";
import { CANONICAL_MCP_URL, FAQS, SITE_DESCRIPTION, SITE_URL, guideClients } from "@/lib/site";

/** llms.txt (llmstxt.org): a plain Markdown summary for AI assistants and answer engines. */
export function GET() {
  const body = [
    "# ErgStats",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `ErgStats is a hosted, read-only MCP server for the Concept2 Logbook. Add ${CANONICAL_MCP_URL} to an AI assistant, sign in with Concept2, and ask about RowErg, SkiErg and BikeErg workouts in plain language. Anything ErgData or the PM5 syncs to the Logbook is included. ErgStats is independent and not affiliated with or endorsed by Concept2.`,
    "",
    "## Setup guides",
    "",
    ...guideClients().map((c) => `- [Connect your Concept2 Logbook to ${c.name}](${SITE_URL}/connect/${c.id})`),
    "",
    "## Tools",
    "",
    ...TOOLS.map((t) => `- \`${t.name}\`: ${t.summary} Example: "${t.prompt}"`),
    "",
    "## FAQ",
    "",
    ...FAQS.flatMap((f) => [`### ${f.question}`, "", f.answer, ""]),
    "## Optional",
    "",
    `- [Home page](${SITE_URL}/)`,
    "- [Source code](https://github.com/chrsep/ergstats)",
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
