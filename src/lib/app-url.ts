/** Public URL of this deployment. Set BETTER_AUTH_URL; Vercel's production URL is the fallback. */
export function appUrl(): string {
  const configured = process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function mcpUrl(): string {
  return `${appUrl()}/mcp`;
}

/** RFC 9728 protected resource metadata for /mcp, which tells MCP clients where to sign in. */
export function resourceMetadataUrl(): string {
  return `${appUrl()}/.well-known/oauth-protected-resource/mcp`;
}
