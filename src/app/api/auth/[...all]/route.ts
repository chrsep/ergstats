import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { withTelemetry } from "@/lib/observability/telemetry";

const handlers = toNextJsHandler(auth);

export const GET = withTelemetry(handlers.GET);
export const POST = withTelemetry(handlers.POST);
