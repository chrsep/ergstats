import { seal, open } from "../crypto";

/**
 * OAuth client resolution. Two registration mechanisms are supported, both
 * without server-side storage:
 *
 * - Client ID Metadata Documents (the 2026-07-28 MCP default): the client_id
 *   is an HTTPS URL serving the client's metadata, which we fetch and validate.
 * - Dynamic Client Registration (deprecated, kept for older clients): the
 *   registration is sealed into the client_id we return, so it never needs to
 *   be looked up.
 */
export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  /** How the client identified itself; shown on the consent screen. */
  source: "metadata-document" | "dynamic-registration";
}

export class ClientError extends Error {
  constructor(
    public readonly code: "invalid_client" | "invalid_client_metadata" | "invalid_redirect_uri",
    message: string,
  ) {
    super(message);
  }
}

const DCR_PREFIX = "dcr.";
const DCR_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;
const METADATA_MAX_BYTES = 64 * 1024;
const METADATA_TIMEOUT_MS = 5000;
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:"]);

export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Validates a redirect URI a client wants to register. */
export function validateRedirectUri(uri: string): void {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new ClientError("invalid_redirect_uri", `Redirect URI is not a valid URL: ${uri}`);
  }
  if (url.hash) throw new ClientError("invalid_redirect_uri", "Redirect URIs must not contain a fragment");
  if (FORBIDDEN_SCHEMES.has(url.protocol)) {
    throw new ClientError("invalid_redirect_uri", `Redirect URI scheme ${url.protocol} is not allowed`);
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new ClientError("invalid_redirect_uri", "Plain http redirect URIs are only allowed on loopback addresses");
  }
}

/**
 * Whether a redirect_uri in an authorization request matches a registered one.
 * Exact match, except that loopback redirects may use any port (RFC 8252 §7.3).
 */
export function redirectUriMatches(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== "http:" || !isLoopbackHost(req.hostname)) return false;
  return registered.some((candidate) => {
    try {
      const reg = new URL(candidate);
      return (
        reg.protocol === "http:" &&
        reg.hostname === req.hostname &&
        reg.pathname === req.pathname &&
        reg.search === req.search
      );
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591), stateless
// ---------------------------------------------------------------------------

export interface RegistrationRequest {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
}

export async function registerClient(body: RegistrationRequest) {
  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === "string")) {
    throw new ClientError("invalid_redirect_uri", "redirect_uris must be a non-empty array of strings");
  }
  redirectUris.forEach(validateRedirectUri);
  const authMethod = body.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    throw new ClientError(
      "invalid_client_metadata",
      "Only public clients are supported (token_endpoint_auth_method must be \"none\")",
    );
  }
  const clientName =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 100)
      : "Unnamed MCP client";

  const clientId = DCR_PREFIX + (await seal("client", { ru: redirectUris, cn: clientName }, DCR_TTL_SECONDS));
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

// ---------------------------------------------------------------------------
// Client ID Metadata Documents
// ---------------------------------------------------------------------------

export function isMetadataDocumentClientId(clientId: string): boolean {
  return clientId.startsWith("https://");
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Rejects client_id URLs we refuse to fetch (SSRF guard). */
function assertFetchableMetadataUrl(clientId: string): URL {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    throw new ClientError("invalid_client", "client_id is not a valid URL");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.pathname === "/" ||
    url.hash ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    IPV4.test(host) ||
    host.startsWith("[") ||
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new ClientError("invalid_client", "client_id is not an acceptable metadata document URL");
  }
  return url;
}

const metadataCache = new Map<string, { client: OAuthClient; expiresAt: number }>();

function cacheSeconds(cacheControl: string | null): number {
  const match = cacheControl?.match(/max-age=(\d+)/);
  const seconds = match ? Number(match[1]) : 300;
  if (cacheControl?.includes("no-store")) return 0;
  return Math.min(Math.max(seconds, 60), 3600);
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > METADATA_MAX_BYTES) {
      await reader.cancel();
      throw new ClientError("invalid_client", "Client metadata document is too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchMetadataDocument(clientId: string): Promise<OAuthClient> {
  const cached = metadataCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.client;

  const url = assertFetchableMetadataUrl(clientId);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
  } catch {
    throw new ClientError("invalid_client", "Could not fetch the client metadata document");
  }
  if (!res.ok) throw new ClientError("invalid_client", `Client metadata document returned HTTP ${res.status}`);

  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(await readLimited(res));
  } catch (error) {
    if (error instanceof ClientError) throw error;
    throw new ClientError("invalid_client", "Client metadata document is not valid JSON");
  }
  if (!doc || typeof doc !== "object") throw new ClientError("invalid_client", "Client metadata document is not an object");
  if (doc.client_id !== clientId) {
    throw new ClientError("invalid_client", "client_id in the metadata document does not match its URL");
  }
  const redirectUris = doc.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === "string")) {
    throw new ClientError("invalid_client", "Client metadata document has no redirect_uris");
  }
  redirectUris.forEach(validateRedirectUri);
  const authMethod = doc.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    throw new ClientError("invalid_client", "Only public clients are supported (token_endpoint_auth_method must be \"none\")");
  }
  const clientName =
    typeof doc.client_name === "string" && doc.client_name.trim() ? doc.client_name.trim().slice(0, 100) : url.hostname;

  const client: OAuthClient = { clientId, clientName, redirectUris, source: "metadata-document" };
  const ttl = cacheSeconds(res.headers.get("cache-control"));
  if (ttl > 0) metadataCache.set(clientId, { client, expiresAt: Date.now() + ttl * 1000 });
  return client;
}

/** Test hook. */
export function clearClientCache() {
  metadataCache.clear();
}

// ---------------------------------------------------------------------------

export async function resolveClient(clientId: string | null | undefined): Promise<OAuthClient> {
  if (!clientId) throw new ClientError("invalid_client", "Missing client_id");
  if (isMetadataDocumentClientId(clientId)) return fetchMetadataDocument(clientId);
  if (clientId.startsWith(DCR_PREFIX)) {
    const reg = await open<{ ru: string[]; cn: string }>("client", clientId.slice(DCR_PREFIX.length));
    if (!reg) throw new ClientError("invalid_client", "Unknown client_id");
    return { clientId, clientName: reg.cn, redirectUris: reg.ru, source: "dynamic-registration" };
  }
  throw new ClientError("invalid_client", "Unknown client_id");
}
