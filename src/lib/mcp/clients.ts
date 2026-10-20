/** Setup snippets for each MCP client, shown on the dashboard. */

export const KEY_PLACEHOLDER = "YOUR_API_KEY";

export interface ClientSetup {
  id: string;
  name: string;
  /** Where the snippet goes: a shell, a config file path, or a settings field. */
  where: string;
  steps: string;
  code: string;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The default: clients add the URL and the person signs in with Concept2, no key to copy. */
export function clientSetups(mcpUrl: string): ClientSetup[] {
  return [
    {
      id: "claude",
      name: "Claude",
      where: "Connector URL",
      steps:
        "In Claude on the web or desktop, open Customize → Connectors, click + Add, then Add custom connector. Name it ErgStats, paste this URL, click Continue, then Add, and sign in with Concept2.",
      code: mcpUrl,
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      where: "Connector URL",
      steps:
        "In ChatGPT, open the Plugins page, click +, then Add custom MCP server. Name it ErgStats, paste this URL, choose OAuth, confirm the warning and pick Create as a plugin. Then sign in with Concept2.",
      code: mcpUrl,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      where: "Terminal",
      steps: "Run this once (add --scope user to use it in every project), then run /mcp in Claude Code, pick ergstats and sign in.",
      code: `claude mcp add --transport http ergstats ${mcpUrl}`,
    },
    {
      id: "codex",
      name: "Codex",
      where: "Terminal",
      steps: "Add the server, then run codex mcp login ergstats. Codex opens the sign-in page in your browser.",
      code: `codex mcp add ergstats --url ${mcpUrl}\ncodex mcp login ergstats`,
    },
    {
      id: "cursor",
      name: "Cursor",
      where: "~/.cursor/mcp.json",
      steps: "Add this to your Cursor MCP config. Cursor shows a Connect button under Settings → MCP that opens the sign-in page.",
      code: json({ mcpServers: { ergstats: { url: mcpUrl } } }),
    },
    {
      id: "vscode",
      name: "VS Code",
      where: ".vscode/mcp.json",
      steps: "Add this to your workspace (or user) MCP config and start the server. VS Code opens the sign-in page.",
      code: json({ servers: { ergstats: { type: "http", url: mcpUrl } } }),
    },
    {
      id: "other",
      name: "Other",
      where: "Any Streamable HTTP client",
      steps: "Clients that support MCP's OAuth sign-in only need the URL. For one that doesn't, create an API key below.",
      code: mcpUrl,
    },
  ];
}

/** For clients and scripts that can't sign in: send an API key as a bearer token. */
export function apiKeySetups(mcpUrl: string, key: string = KEY_PLACEHOLDER): ClientSetup[] {
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      where: "Terminal",
      steps: "Run this once. Add --scope user to use it in every project.",
      code: `claude mcp add --transport http ergstats ${mcpUrl} \\\n  --header "Authorization: Bearer ${key}"`,
    },
    {
      id: "cursor",
      name: "Cursor",
      where: "~/.cursor/mcp.json",
      steps: "Add this to your Cursor MCP config, then enable ergstats under Settings → MCP.",
      code: json({ mcpServers: { ergstats: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } }),
    },
    {
      id: "vscode",
      name: "VS Code",
      where: ".vscode/mcp.json",
      steps: "Add this to your workspace (or user) MCP config and start the server from the editor.",
      code: json({
        servers: { ergstats: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } },
      }),
    },
    {
      id: "other",
      name: "Other",
      where: "Any Streamable HTTP client",
      steps: "Point your client at the URL and send the key as a bearer token.",
      code: `URL:    ${mcpUrl}\nHeader: Authorization: Bearer ${key}`,
    },
  ];
}
