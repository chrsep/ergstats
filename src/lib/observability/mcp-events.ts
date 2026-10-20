/**
 * What MCP analytics may keep. The PostHog MCP SDK records each tool call's
 * full arguments and response; for ErgStats those are workout ids, dates and
 * the athlete's training data, so this module reduces every event to counts,
 * enums and categories before it leaves the server.
 */

/** Tool arguments that are enums, paging or counts, which say how a tool is used without saying anything about the athlete. */
const KEPT_ARGUMENTS = new Set([
  "machine",
  "format",
  "group_by",
  "when",
  "segments",
  "limit",
  "page",
  "offset",
  "days",
  "season",
  "year",
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kept arguments, plus the length of a date range in days; dates and ids themselves are dropped. */
export function summarizeArguments(args: unknown): Record<string, string | number> {
  let value = args;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const kept: Record<string, string | number> = {};
  for (const [key, arg] of Object.entries(input)) {
    if (!KEPT_ARGUMENTS.has(key)) continue;
    if (typeof arg === "number" && Number.isFinite(arg)) kept[key] = arg;
    // Enums only: anything longer or with odd characters isn't one of ours.
    else if (typeof arg === "string" && /^[a-z0-9_-]{1,24}$/i.test(arg)) kept[key] = arg;
  }
  const { from, to } = input;
  if (typeof from === "string" && typeof to === "string" && DATE.test(from) && DATE.test(to)) {
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (Number.isFinite(days)) kept.range_days = days;
  }
  return kept;
}

export type ToolErrorCategory =
  | "no_concept2_account"
  | "concept2_reconnect_needed"
  | "concept2_unauthorized"
  | "not_found"
  | "concept2_rate_limited"
  | "concept2_unavailable"
  | "concept2_timeout"
  | "concept2_error"
  | "internal";

/** Why a tool call failed, as a fixed category that dashboards can group by. */
export function classifyToolError(error: unknown): ToolErrorCategory {
  if (!(error instanceof Error)) return "internal";
  if (error.name === "NotConnectedError") {
    return (error as Error & { reason?: string }).reason === "refresh_failed" ? "concept2_reconnect_needed" : "no_concept2_account";
  }
  if (error.name === "TimeoutError") return "concept2_timeout";
  if (error.name === "Concept2Error") {
    const status = (error as Error & { status?: number }).status ?? 0;
    if (status === 401 || status === 403) return "concept2_unauthorized";
    if (status === 404) return "not_found";
    if (status === 429) return "concept2_rate_limited";
    if (status >= 500) return "concept2_unavailable";
    return "concept2_error";
  }
  return "internal";
}

/** Facts about one /mcp request, collected while it runs. */
export interface McpRequestStats {
  /** The caller's ErgStats user id. Never sent; events carry its pseudonym. */
  userId?: string;
  authMethod: "oauth" | "api_key";
  /** Which OAuth app: the host of its Client ID Metadata Document (claude.ai, chatgpt.com...), or "registered" for dynamic registration. */
  oauthClient?: string;
  upstreamRequests: number;
  upstreamMs: number;
  upstreamFailures: number;
  /** HTTP status of the last failed Concept2 request. */
  upstreamStatus?: number;
  errorCategory?: ToolErrorCategory;
  responseBytes?: number;
}

/** Where an OAuth client comes from, without its full client id. */
export function oauthClientLabel(clientId: string | undefined): string | undefined {
  if (!clientId) return undefined;
  if (!/^https:\/\//.test(clientId)) return "registered";
  try {
    return new URL(clientId).host;
  } catch {
    return "registered";
  }
}

export interface McpCaptureEvent {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}

/** Response and payload fields the SDK fills that could carry athlete data. */
const DROPPED_PROPERTIES = ["$mcp_response", "$mcp_parameters", "$ip", "$mcp_intent", "$mcp_conversation_id"];

/**
 * The beforeSend hook: drops the SDK's own `$identify` (it sends one per
 * request, because every request gets a fresh server) and `$exception`
 * (tools/failures are reported with a real stack elsewhere), and strips what
 * the athlete's data could leak through from the rest.
 */
export function sanitizeMcpEvent<E extends McpCaptureEvent>(
  event: E,
  stats: McpRequestStats | undefined,
  environment: string,
): E | null {
  if (event.event === "$identify" || event.event === "$exception") return null;
  const props = event.properties;
  const args = props.$mcp_parameters;
  for (const key of DROPPED_PROPERTIES) delete props[key];
  delete props.$set;
  delete props.$set_once;

  props.environment = environment;
  props.$geoip_disable = true;
  if (stats) {
    props.auth_method = stats.authMethod;
    if (stats.oauthClient) props.oauth_client = stats.oauthClient;
  }

  if (event.event === "$mcp_tool_call") {
    Object.assign(props, prefixKeys(summarizeArguments(toolArguments(args)), "arg_"));
    if (stats) {
      props.upstream_requests = stats.upstreamRequests;
      props.upstream_ms = Math.round(stats.upstreamMs);
      props.upstream_failures = stats.upstreamFailures;
      if (stats.upstreamStatus) props.upstream_status = stats.upstreamStatus;
      if (stats.responseBytes !== undefined) props.response_bytes = stats.responseBytes;
      if (props.$mcp_is_error && stats.errorCategory) props.$mcp_error_type = stats.errorCategory;
    }
  }
  return event;
}

/** The SDK records the whole JSON-RPC request; the tool's arguments are inside it. */
function toolArguments(parameters: unknown): unknown {
  const request = (parameters as { request?: { params?: { arguments?: unknown } } } | undefined)?.request;
  return request ? request.params?.arguments : parameters;
}

function prefixKeys<T>(record: Record<string, T>, prefix: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [`${prefix}${key}`, value]));
}
