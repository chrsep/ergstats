import { context as otelContext, trace } from "@opentelemetry/api";
import { type AnyValueMap, type Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

import { deploymentEnvironment, POSTHOG_HOSTS, release, serverToken } from "./config";
import { posthogServer } from "./server";

/**
 * Server logs. Every line still goes to the console, so Vercel's runtime logs
 * keep working, and with PostHog configured it is also shipped to PostHog Logs
 * over OTLP, tied to the trace it was written in.
 *
 * Log messages are written by us. Attributes are for ids, counts and status
 * codes, never tokens, emails or workout data.
 */
let provider: LoggerProvider | undefined;
let logger: Logger | null | undefined;

function otelLogger(): Logger | null {
  if (logger !== undefined) return logger;
  const token = serverToken();
  if (!token) return (logger = null);
  provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "ergstats",
      "service.version": release() ?? "dev",
      "deployment.environment.name": deploymentEnvironment(),
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${POSTHOG_HOSTS.ingest}/i/v1/logs`,
          headers: { Authorization: `Bearer ${token}` },
        }),
      }),
    ],
  });
  return (logger = provider.getLogger("ergstats"));
}

/** The OpenTelemetry context of the PostHog span running now, so the log line links to its trace. */
function activeSpanContext() {
  const traceparent = posthogServer()?.getActiveSpan()?.traceparent();
  const match = traceparent?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) return undefined;
  return trace.setSpanContext(otelContext.active(), {
    traceId: match[1],
    spanId: match[2],
    traceFlags: Number.parseInt(match[3], 16),
  });
}

function errorAttributes(error: unknown): AnyValueMap {
  if (!(error instanceof Error)) return error === undefined ? {} : { "exception.message": String(error) };
  return { "exception.type": error.name, "exception.message": error.message, "exception.stacktrace": error.stack ?? "" };
}

type Attributes = Record<string, string | number | boolean | undefined>;

const LEVELS = {
  info: { severityNumber: SeverityNumber.INFO, console: console.info },
  warn: { severityNumber: SeverityNumber.WARN, console: console.warn },
  error: { severityNumber: SeverityNumber.ERROR, console: console.error },
} as const;

function emit(level: keyof typeof LEVELS, message: string, attributes: Attributes = {}, error?: unknown) {
  const { severityNumber, console: write } = LEVELS[level];
  write(message, ...(Object.keys(attributes).length ? [attributes] : []), ...(error === undefined ? [] : [error]));
  try {
    otelLogger()?.emit({
      severityNumber,
      severityText: level.toUpperCase(),
      body: message,
      attributes: { ...attributes, ...errorAttributes(error) },
      context: activeSpanContext(),
    });
  } catch {
    // Logging must never break a request.
  }
}

export const log = {
  info: (message: string, attributes?: Attributes) => emit("info", message, attributes),
  warn: (message: string, attributes?: Attributes, error?: unknown) => emit("warn", message, attributes, error),
  error: (message: string, attributes?: Attributes, error?: unknown) => emit("error", message, attributes, error),
};

export async function flushLogs(): Promise<void> {
  await provider?.forceFlush().catch(() => {});
}
