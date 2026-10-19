import { mcpHandler } from "@/lib/mcp/server";

// Tool calls that page through a long logbook can take a while.
export const maxDuration = 60;

export { mcpHandler as GET, mcpHandler as POST, mcpHandler as DELETE };
