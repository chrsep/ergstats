import { relay } from "@/lib/observability/relay";

// Browser analytics, relayed to PostHog without cookies (see relay.ts).
export function GET(req: Request) {
  return relay(req);
}

export function POST(req: Request) {
  return relay(req);
}
