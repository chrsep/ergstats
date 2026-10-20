import { DrizzleQueryError } from "drizzle-orm";

/**
 * What error tracking may see of a failure.
 *
 * Drizzle reports a failed query with its bound parameters in the message:
 * user ids, OAuth client ids, what an agent wrote in send_feedback. PostHog
 * sends an error's message, its stack header and every `cause` as they are,
 * so the parameters are cut out before an error leaves the server. The SQL
 * stays: table and column names say where a query failed without saying whose.
 */
export function reportableError(error: unknown): unknown {
  return withoutParameters(error, 0);
}

/** How far down a chain of causes to look; anything deeper is dropped. */
const MAX_DEPTH = 8;

function withoutParameters(error: unknown, depth: number): unknown {
  if (!(error instanceof Error)) return error;
  if (depth >= MAX_DEPTH) return undefined;
  const cause = withoutParameters(error.cause, depth + 1);
  if (isQueryError(error)) return queryErrorWithoutParameters(error, cause);
  // Nothing to scrub here or below: report the error itself, stack and all.
  if (cause === error.cause) return error;
  const copy = new Error(error.message, { cause });
  copy.name = error.name;
  copy.stack = error.stack;
  return copy;
}

type QueryError = Error & { query?: unknown };

function isQueryError(error: Error): error is QueryError {
  return error instanceof DrizzleQueryError || error.message.startsWith("Failed query: ");
}

function queryErrorWithoutParameters(error: QueryError, cause: unknown): Error {
  const query = typeof error.query === "string" ? error.query : error.message.slice("Failed query: ".length).split("\nparams: ", 1)[0];
  const copy = new Error(`Failed query: ${query}`, { cause });
  // Drizzle leaves the name at "Error"; the type is what dashboards group by.
  copy.name = "DrizzleQueryError";
  // A stack starts with the message, parameters included. Keep only its frames.
  const frames = error.stack?.indexOf("\n    at ") ?? -1;
  copy.stack = `${copy.name}: ${copy.message}${frames >= 0 ? error.stack!.slice(frames) : ""}`;
  return copy;
}
