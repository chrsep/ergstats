import { ClientError, resolveClient } from "@/lib/oauth/clients";
import { oauthJsonError } from "@/lib/oauth/http";
import { CORS_HEADERS } from "@/lib/oauth/metadata";
import { TokenError, exchangeAuthorizationCode, exchangeRefreshToken } from "@/lib/oauth/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => undefined);
  if (!form) return oauthJsonError("invalid_request", "Expected an application/x-www-form-urlencoded body");
  const get = (name: string) => form.get(name)?.toString() ?? null;
  const clientId = get("client_id");

  try {
    await resolveClient(clientId);
    const grantType = get("grant_type");
    const tokens =
      grantType === "authorization_code"
        ? await exchangeAuthorizationCode({
            code: get("code"),
            clientId,
            redirectUri: get("redirect_uri"),
            codeVerifier: get("code_verifier"),
            resource: get("resource"),
          })
        : grantType === "refresh_token"
          ? await exchangeRefreshToken({ refreshToken: get("refresh_token"), clientId, resource: get("resource") })
          : undefined;
    if (!tokens) return oauthJsonError("unsupported_grant_type", "Use authorization_code or refresh_token");
    return Response.json(tokens, { headers: { ...CORS_HEADERS, "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) {
    if (error instanceof ClientError) return oauthJsonError("invalid_client", error.message, 401);
    if (error instanceof TokenError) return oauthJsonError(error.code, error.message);
    throw error;
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
