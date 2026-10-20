import type { Instrumentation } from "next";

/**
 * Server errors Next.js caught (a page, route handler, server action or the
 * proxy threw), sent to PostHog error tracking. The digest matches the one
 * the error page reports from the browser, so the two can be joined.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ captureServerError }, { flushTelemetry }, { scrubUrl }] = await Promise.all([
    import("@/lib/observability/server"),
    import("@/lib/observability/telemetry"),
    import("@/lib/observability/scrub"),
  ]);
  captureServerError(error, {
    digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
    path: scrubUrl(request.path),
    method: request.method,
    route: context.routePath,
    route_type: context.routeType,
    render_source: "renderSource" in context ? context.renderSource : undefined,
  });
  await flushTelemetry();
};
