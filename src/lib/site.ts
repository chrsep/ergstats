import { clientSetups } from "@/lib/mcp/clients";

/**
 * Canonical origin for search engines and AI crawlers. Fixed rather than read
 * from the environment so previews never advertise themselves as canonical.
 */
export const SITE_URL = "https://www.ergstats.com";
export const CANONICAL_MCP_URL = `${SITE_URL}/mcp`;

/**
 * Search wording: people search "<brand> chatgpt" and "<brand> claude" far more
 * than "<brand> mcp" (Google Trends, Oct 2026), so titles lead with the
 * assistants and keep "MCP" as the secondary term.
 */
export const SITE_TITLE = "Connect your Concept2 Logbook to Claude and ChatGPT";
export const SITE_DESCRIPTION =
  "ErgStats is a free MCP connector for your Concept2 Logbook. Ask Claude, ChatGPT, Claude Code or Codex about your RowErg, SkiErg and BikeErg splits, PBs and training load.";

/** Clients that get a public setup guide at /connect/<id>. */
export function guideClients() {
  return clientSetups(CANONICAL_MCP_URL).filter((s) => s.id !== "other");
}

export interface Faq {
  question: string;
  answer: string;
}

/** Shown on the home page and in its FAQPage JSON-LD. Answers stand on their own so AI search can quote them. */
export const FAQS: Faq[] = [
  {
    question: "How do I connect my Concept2 Logbook to ChatGPT?",
    answer: `In ChatGPT, open the Plugins page (chatgpt.com/plugins), click +, then Add custom MCP server. Paste ${CANONICAL_MCP_URL}, choose OAuth, pick Create as a plugin and sign in with your Concept2 Logbook account. ChatGPT can then read your workouts whenever you ask about your training.`,
  },
  {
    question: "How do I connect my Concept2 Logbook to Claude?",
    answer: `In Claude on the web or desktop, open Customize → Connectors, click + Add, then Add custom connector, and paste ${CANONICAL_MCP_URL}. Click Continue, then Add, and sign in with Concept2. Claude can then answer questions about your splits, PBs and training load.`,
  },
  {
    question: "Does ErgStats work with Claude Code, Codex and Cursor?",
    answer: `Yes. ErgStats is a remote MCP server, so any MCP client that supports sign-in only needs the URL. In Claude Code run "claude mcp add --transport http ergstats ${CANONICAL_MCP_URL}", then /mcp to sign in. In Codex run "codex mcp add ergstats --url ${CANONICAL_MCP_URL}", then "codex mcp login ergstats". In Cursor or VS Code add the URL to your MCP config and sign in. Clients that can't sign in can use an API key from your dashboard.`,
  },
  {
    question: "What is an MCP server?",
    answer:
      "MCP (Model Context Protocol) is the open standard Claude, ChatGPT and coding agents use to connect to outside data. ErgStats is an MCP server for the Concept2 Logbook: your assistant calls its tools to fetch your workouts when a question needs them.",
  },
  {
    question: "Which workouts can my AI see?",
    answer:
      "Everything in your Concept2 Logbook: RowErg, SkiErg and BikeErg workouts synced from ErgData or the PM5, and anything you logged by hand. That includes splits, intervals, heart rate, stroke rate, drag factor and stroke-by-stroke data.",
  },
  {
    question: "Can I use it for HYROX training?",
    answer:
      "Yes. HYROX races include a 1000m SkiErg and a 1000m RowErg station, and ErgStats sees every SkiErg and RowErg piece in your Logbook. Ask for your best 1000m, how your pace holds up in intervals, or how your weekly erg volume is trending.",
  },
  {
    question: "Can ErgStats change or delete my workouts?",
    answer:
      "No. ErgStats only asks Concept2 for read access. It can't add, edit or delete anything in your Logbook, and you can disconnect any app or revoke access from your dashboard.",
  },
  {
    question: "Is ErgStats made by Concept2?",
    answer:
      "No. ErgStats is an independent project that uses the official Concept2 Logbook API. It is not affiliated with or endorsed by Concept2.",
  },
  {
    question: "How much does ErgStats cost?",
    answer: "ErgStats is free. Sign in with your Concept2 Logbook account to get started.",
  },
];
