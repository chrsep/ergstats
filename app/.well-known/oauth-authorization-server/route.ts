import { CORS_HEADERS, authorizationServerMetadata } from "@/lib/oauth/metadata";

export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(req), { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
