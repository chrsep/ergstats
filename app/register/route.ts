import { ClientError, registerClient } from "@/lib/oauth/clients";
import { oauthJsonError } from "@/lib/oauth/http";
import { CORS_HEADERS } from "@/lib/oauth/metadata";

/** Dynamic Client Registration (RFC 7591). Deprecated by MCP 2026-07-28 but kept for older clients. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return oauthJsonError("invalid_client_metadata", "Request body must be a JSON object");
  }
  try {
    return Response.json(await registerClient(body), { status: 201, headers: { ...CORS_HEADERS, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ClientError) return oauthJsonError(error.code, error.message);
    throw error;
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
