/** The one scope MCP clients need: read the signed-in athlete's Logbook through ErgStats. */
export const MCP_SCOPE = "logbook:read";

/** What each OAuth scope lets a connected app do, in the words the consent screen and dashboard use. */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  [MCP_SCOPE]: "Read your Concept2 Logbook: workouts, splits, stroke data and personal bests",
  profile: "See your name and profile picture",
  email: "See your email address",
  offline_access: "Stay connected until you disconnect it",
};

/** Plain-language lines for the scopes an app asked for. `openid` only identifies you, so it has no line of its own. */
export function describeScopes(scopes: readonly string[]): string[] {
  return scopes.filter((scope) => scope !== "openid").map((scope) => SCOPE_DESCRIPTIONS[scope] ?? scope);
}
