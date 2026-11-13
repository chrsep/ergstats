/**
 * How long to wait before each retry of a failed Concept2 token lookup.
 *
 * Concept2 rotates refresh tokens. When a token has expired and a client sends several
 * tool calls at once (Claude does), every call tries to refresh it: the first one wins
 * and stores the new tokens, and Concept2 rejects the others because their refresh token
 * is now spent. Waiting briefly and asking again lets the losers pick up the winner's
 * fresh access token instead of telling the user their connection has expired.
 */
export const TOKEN_RETRY_DELAYS_MS = [500, 1000] as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fetchToken` until it returns a token, retrying after each delay in `delaysMs`.
 * Errors are reported to `onError` and treated like a missing token. Returns undefined
 * when every attempt fails.
 */
export async function getTokenWithRetry(
  fetchToken: () => Promise<string | undefined>,
  {
    delaysMs = TOKEN_RETRY_DELAYS_MS,
    wait = sleep,
    onError,
  }: {
    delaysMs?: readonly number[];
    wait?: (ms: number) => Promise<void>;
    onError?: (error: unknown, attempt: number) => void;
  } = {},
): Promise<string | undefined> {
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    if (attempt > 0) await wait(delaysMs[attempt - 1]);
    try {
      const token = await fetchToken();
      if (token) return token;
    } catch (error) {
      onError?.(error, attempt);
    }
  }
  return undefined;
}
