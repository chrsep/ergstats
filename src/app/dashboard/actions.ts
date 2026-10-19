"use server";

import { after } from "next/server";

import { disconnectApp } from "@/lib/oauth/connected-apps";
import { captureServerEvent } from "@/lib/observability/server";
import { flushTelemetry } from "@/lib/observability/telemetry";
import { getSession } from "@/lib/session";

export async function disconnectAppAction(consentId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const ok = await disconnectApp(session.user.id, consentId);
  if (ok) {
    captureServerEvent("mcp_app_disconnected", {}, session.user.id);
    after(flushTelemetry);
  }
  return { ok };
}
