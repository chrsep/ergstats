import { auth } from "@/lib/auth";

// OAuth discovery for MCP clients: protected resource metadata (RFC 9728) and
// authorization server metadata (RFC 8414 / OIDC). Better Auth serves both;
// they live at the site root, outside /api/auth.
export const GET = (request: Request) => auth.handler(request);
