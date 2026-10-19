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
