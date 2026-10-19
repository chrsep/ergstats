"use server";

import { disconnectApp } from "@/lib/oauth/connected-apps";
import { getSession } from "@/lib/session";

export async function disconnectAppAction(consentId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  return { ok: await disconnectApp(session.user.id, consentId) };
}
