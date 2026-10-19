/** The parts of a BetterAuth API key the dashboard shows. Never includes the secret. */
export interface ApiKeyRow {
  id: string;
  name: string | null;
  /** First characters of the key, e.g. "erg_Ab12". */
  start: string | null;
  createdAt: Date | string;
  lastRequest: Date | string | null;
  expiresAt: Date | string | null;
}

/** An app (Claude, ChatGPT, Cursor...) the athlete connected by signing in, rather than with an API key. */
export interface ConnectedAppRow {
  /** The consent record's id. */
  id: string;
  name: string;
  /** Where the app lives, e.g. "claude.ai", when it says. */
  host: string | null;
  connectedAt: Date | string;
}
