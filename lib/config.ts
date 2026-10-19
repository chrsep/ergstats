import { getPublicOrigin } from "mcp-handler";

/** Path the MCP endpoint is mounted at. The canonical resource URI is `<origin>/mcp`. */
export const MCP_PATH = "/mcp";

/** The only scope this server issues. Covers every read-only tool. */
export const SCOPE = "ergdata:read";

/** Scopes requested from Concept2. Read-only apps don't need Concept2's approval. */
export const CONCEPT2_SCOPES = "user:read,results:read";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function concept2Config() {
  return {
    clientId: required("CONCEPT2_CLIENT_ID"),
    clientSecret: required("CONCEPT2_CLIENT_SECRET"),
    baseUrl: (process.env.CONCEPT2_BASE_URL || "https://log.concept2.com").replace(/\/+$/, ""),
  };
}

export function tokenSecret(): string {
  return required("TOKEN_SECRET");
}

/** Public origin of this deployment, e.g. `https://ergdata.example.com`. */
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return getPublicOrigin(req);
}

/** The OAuth issuer identifier. This server is its own authorization server. */
export function issuer(req: Request): string {
  return publicOrigin(req);
}

/** The canonical MCP server URI (RFC 8707 resource indicator). */
export function resourceUri(req: Request): string {
  return `${publicOrigin(req)}${MCP_PATH}`;
}
