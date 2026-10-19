/** Setup snippets for each MCP client, shown on the dashboard. */

export const KEY_PLACEHOLDER = "YOUR_API_KEY";

export interface ClientSetup {
  id: string;
  name: string;
  /** Where the snippet goes: a shell, or a config file path. */
  where: string;
  steps: string;
  code: string;
}

export function clientSetups(mcpUrl: string, key: string = KEY_PLACEHOLDER): ClientSetup[] {
  const json = (value: unknown) => JSON.stringify(value, null, 2);
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
      id: "claude-desktop",
      name: "Claude Desktop",
      where: "claude_desktop_config.json",
      steps: "Claude Desktop reaches remote servers with custom headers through mcp-remote. Restart Claude after saving.",
      code: json({
        mcpServers: {
          ergstats: {
            command: "npx",
            args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:Bearer ${ERGSTATS_API_KEY}"],
            env: { ERGSTATS_API_KEY: key },
          },
        },
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
