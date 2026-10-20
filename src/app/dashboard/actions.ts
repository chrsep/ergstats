"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import type { DeleteAccountResult } from "@/components/dashboard/types";
import { auth } from "@/lib/auth";
import { disconnectApp } from "@/lib/oauth/connected-apps";
import { getSession } from "@/lib/session";

export async function disconnectAppAction(consentId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  return { ok: await disconnectApp(session.user.id, consentId) };
}

/** Deletes the signed-in user and everything stored about them, then clears the session cookie. */
export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  try {
    await auth.api.deleteUser({ headers: await headers(), body: {} });
    return { ok: true };
  } catch (error) {
    // Deleting needs a recent sign-in (or any sign-in at all).
    if (error instanceof APIError && (error.body?.code === "SESSION_EXPIRED" || error.statusCode === 401)) {
      return { ok: false, reason: "reauthenticate" };
    }
    console.error("[account] deletion failed", error);
    return { ok: false, reason: "failed" };
  }
}
