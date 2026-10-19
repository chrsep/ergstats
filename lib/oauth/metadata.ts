import { generateProtectedResourceMetadata } from "mcp-handler";
import { SCOPE, issuer, resourceUri } from "../config";

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(req: Request) {
  const iss = issuer(req);
  return {
    issuer: iss,
    authorization_endpoint: `${iss}/authorize`,
    token_endpoint: `${iss}/token`,
    registration_endpoint: `${iss}/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: iss,
  };
}

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata(req: Request) {
  return generateProtectedResourceMetadata({
    authServerUrls: [issuer(req)],
    resourceUrl: resourceUri(req),
    additionalMetadata: {
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "ErgStats",
    },
  });
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400",
};
