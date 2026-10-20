import { mcpHandler } from "@/lib/mcp/server";
import { withTelemetry } from "@/lib/observability/telemetry";

// Tool calls that page through a long logbook can take a while.
export const maxDuration = 60;

const handler = withTelemetry(mcpHandler);

export { handler as DELETE, handler as GET, handler as POST };
