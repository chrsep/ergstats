import { clientSetups } from "@/lib/mcp/clients";

/**
 * Canonical origin for search engines and AI crawlers. Fixed rather than read
 * from the environment so previews never advertise themselves as canonical.
 */
export const SITE_URL = "https://www.ergstats.com";
export const CANONICAL_MCP_URL = `${SITE_URL}/mcp`;
export const GITHUB_URL = "https://github.com/chrsep/ergstats";

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

export interface GuideDetails {
  /** Short label for the kind of setup, shown on the home page card. */
  kind: string;
  /** One or two sentences for the home page card. Wrap commands in backticks. */
  summary: string;
  /** Plan or role limits, shown before the steps. */
  requirements?: string;
  /** The menu items to click, in order. */
  menuPath?: string[];
  /** Lead-in to the example prompts. */
  askHint: string;
  troubleshooting: Faq[];
}

const API_KEY_FALLBACK =
  "Use an API key instead: create one in your ErgStats dashboard and send it as an Authorization header from the same config.";

/**
 * Per-client copy for the setup guides. Plan limits come from the vendors' help
 * pages (Oct 2026): Claude allows custom connectors on every plan (Free: one),
 * ChatGPT only on Pro, Business, Enterprise and Edu, on the web.
 */
const GUIDE_DETAILS: Record<string, GuideDetails> = {
  claude: {
    kind: "Connector",
    summary: "Customize → Connectors → + Add → Add custom connector. Paste the URL and sign in. Works on every plan, including Free.",
    requirements:
      "Works on every Claude plan. Free accounts can add one custom connector. On Team and Enterprise, an owner adds ErgStats under Organization settings → Connectors first, then you click Connect.",
    menuPath: ["Customize", "Connectors", "+ Add", "Add custom connector"],
    askHint: "Start a new chat. If ErgStats is off, switch it on from + → Connectors, then ask:",
    troubleshooting: [
      {
        question: "I don’t see Add custom connector",
        answer:
          "On Team and Enterprise plans only owners can add custom connectors. Ask an owner to add ErgStats under Organization settings → Connectors, then find it under Customize → Connectors and click Connect.",
      },
      {
        question: "Claude doesn’t use my workouts",
        answer: "Open the + menu in the chat, choose Connectors and check that ErgStats is on. Mentioning your Concept2 Logbook in the question helps too.",
      },
    ],
  },
  chatgpt: {
    kind: "Plugin",
    summary: "Plugins → + → Add custom MCP server. Paste the URL, choose OAuth and sign in. Pro, Business, Enterprise and Edu.",
    requirements:
      "Custom MCP servers need ChatGPT Pro, Business, Enterprise or Edu, on chatgpt.com in a browser. On a Business workspace, only admins and owners can add one.",
    menuPath: ["Plugins", "+", "Add custom MCP server"],
    askHint: "Start a new chat, type @, pick ErgStats and ask:",
    troubleshooting: [
      {
        question: "I don’t see Add custom MCP server",
        answer:
          "Custom MCP servers need ChatGPT Pro, Business, Enterprise or Edu, and only work on chatgpt.com in a browser, not in the mobile apps. On a Business workspace, ask an admin or owner to add ErgStats.",
      },
      {
        question: "ChatGPT doesn’t use my workouts",
        answer: "Type @ and pick ErgStats in your message, or mention your Concept2 Logbook in the question.",
      },
    ],
  },
  "claude-code": {
    kind: "Terminal",
    summary: "Run `claude mcp add` with the URL, then pick ergstats in `/mcp` and sign in.",
    askHint: "Start Claude Code in the same project, or in any folder if you added --scope user, and ask:",
    troubleshooting: [
      { question: "Claude Code says ergstats needs to sign in", answer: "Run /mcp, pick ergstats and sign in again with Concept2." },
    ],
  },
  codex: {
    kind: "Terminal",
    summary: "Run `codex mcp add` with the URL, then `codex mcp login ergstats` to sign in.",
    askHint: "Start Codex and ask:",
    troubleshooting: [
      {
        question: "Codex says ergstats isn’t signed in",
        answer: "Run codex mcp login ergstats again. Codex opens the sign-in page in your browser.",
      },
    ],
  },
  cursor: {
    kind: "mcp.json",
    summary: "Add the URL to your MCP config, then click Connect under Settings → MCP to sign in.",
    askHint: "Open the agent chat and ask:",
    troubleshooting: [{ question: "There’s no Connect button", answer: API_KEY_FALLBACK }],
  },
  vscode: {
    kind: "mcp.json",
    summary: "Add the URL to `.vscode/mcp.json` and start the server. VS Code opens sign-in.",
    askHint: "Open the chat in agent mode and ask:",
    troubleshooting: [{ question: "VS Code doesn’t open the sign-in page", answer: API_KEY_FALLBACK }],
  },
};

export function guideDetails(id: string, name: string): GuideDetails {
  const details = GUIDE_DETAILS[id];
  if (!details) throw new Error(`No setup guide copy for ${id}`);
  return {
    ...details,
    troubleshooting: [
      ...details.troubleshooting,
      {
        question: "How do I disconnect?",
        answer: `Remove ErgStats from ${name}, or disconnect it from your ErgStats dashboard. Access stops right away.`,
      },
    ],
  };
}

/** Shown on the home page and in its FAQPage JSON-LD. Answers stand on their own so AI search can quote them. */
export const FAQS: Faq[] = [
  {
    question: "How do I connect my Concept2 Logbook to ChatGPT?",
    answer: `In ChatGPT, open the Plugins page (chatgpt.com/plugins), click +, then Add custom MCP server. Paste ${CANONICAL_MCP_URL}, choose OAuth, pick Create as a plugin and sign in with your Concept2 Logbook account. ChatGPT can then read your workouts whenever you ask about your training. Custom MCP servers need ChatGPT Pro, Business, Enterprise or Edu, on chatgpt.com in a browser.`,
  },
  {
    question: "How do I connect my Concept2 Logbook to Claude?",
    answer: `In Claude on the web or desktop, open Customize → Connectors, click + Add, then Add custom connector, and paste ${CANONICAL_MCP_URL}. Click Continue, then Add, and sign in with Concept2. Claude can then answer questions about your splits, PBs and training load. It works on every Claude plan, including Free.`,
  },
  {
    question: "Which Claude and ChatGPT plans does ErgStats work with?",
    answer:
      "Claude: every plan, including Free, which allows one custom connector. On Team and Enterprise an owner adds it first. ChatGPT: Pro, Business, Enterprise and Edu, on chatgpt.com in a browser. On Business, only workspace admins and owners can add it.",
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
    question: "Is ErgStats open source?",
    answer: `Yes. The full source is on GitHub at ${GITHUB_URL.replace("https://", "")} under the MIT license, so you can see exactly how your Logbook data is read and stored.`,
  },
  {
    question: "How much does ErgStats cost?",
    answer: "ErgStats is free. Sign in with your Concept2 Logbook account to get started.",
  },
];
