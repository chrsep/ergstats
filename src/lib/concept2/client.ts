import type {
  Concept2List,
  Concept2Result,
  Concept2Stroke,
  Concept2User,
  MachineType,
} from "./types";

/** Concept2 Logbook API client. Docs: https://log.concept2.com/developers/documentation/ */

export const CONCEPT2_SCOPES = "user:read,results:read";

export function concept2BaseUrl(): string {
  return (process.env.CONCEPT2_BASE_URL || "https://log.concept2.com").replace(/\/+$/, "");
}

export class Concept2Error extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "Concept2Error";
  }
}

type Query = Record<string, string | number | undefined>;

export interface ResultsQuery {
  /** Inclusive, YYYY-MM-DD. */
  from?: string;
  /** Inclusive, YYYY-MM-DD. */
  to?: string;
  type?: MachineType;
  page?: number;
  /** Results per page. Concept2 allows up to 250. */
  number?: number;
}

export interface Concept2ClientOptions {
  accessToken: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/** The largest page Concept2 serves, used when we need every result in a range. */
const MAX_PAGE_SIZE = 250;

export class Concept2Client {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ accessToken, baseUrl, fetch: fetchImpl }: Concept2ClientOptions) {
    this.accessToken = accessToken;
    this.baseUrl = (baseUrl ?? concept2BaseUrl()).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async get<T>(path: string, query: Query = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const res = await this.fetchImpl(url, {
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        accept: "application/vnd.c2logbook.v1+json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) {
      throw new Concept2Error(
        401,
        "Concept2 rejected the stored credentials. Sign in to ergstats.com again to reconnect your Logbook.",
      );
    }
    if (res.status === 404) throw new Concept2Error(404, "Not found in your Concept2 Logbook.");
    if (!res.ok) throw new Concept2Error(res.status, `Concept2 API request failed with HTTP ${res.status}.`);
    return (await res.json()) as T;
  }

  async getMe(): Promise<Concept2User> {
    const body = await this.get<{ data: Concept2User }>("/api/users/me");
    return body.data;
  }

  listResults(query: ResultsQuery = {}): Promise<Concept2List<Concept2Result>> {
    return this.get("/api/users/me/results", { ...query });
  }

  async getResult(id: number): Promise<Concept2Result> {
    const body = await this.get<{ data: Concept2Result }>(`/api/users/me/results/${id}`);
    return body.data;
  }

  async getStrokes(id: number): Promise<Concept2Stroke[]> {
    const body = await this.get<{ data: Concept2Stroke[] }>(`/api/users/me/results/${id}/strokes`);
    return body.data ?? [];
  }

  /**
   * Every result matching the query, newest first, following pagination.
   * Stops after `maxPages` so one call can't run away on a huge logbook;
   * `truncated` says whether it stopped early.
   */
  async listAllResults(
    query: Omit<ResultsQuery, "page" | "number"> = {},
    maxPages = 20,
  ): Promise<{ results: Concept2Result[]; truncated: boolean }> {
    const results: Concept2Result[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const body = await this.listResults({ ...query, page, number: MAX_PAGE_SIZE });
      results.push(...body.data);
      const totalPages = body.meta?.pagination?.total_pages ?? 1;
      if (page >= totalPages || body.data.length === 0) return { results, truncated: false };
    }
    return { results, truncated: true };
  }
}
