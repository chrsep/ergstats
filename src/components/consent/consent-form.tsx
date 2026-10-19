"use client";

import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { ConsentCard, type ConsentCardProps } from "./consent-card";

/** The consent card wired to Better Auth. The signed request rides along from the page URL. */
export function ConsentForm(props: Omit<ConsentCardProps, "onDecide">) {
  async function decide(accept: boolean) {
    const { data, error } = await authClient.oauth2.consent({ accept });
    if (error || !data?.url) {
      toast.error("Couldn't finish connecting", {
        description: error?.message ?? "Start again from the app you were connecting.",
      });
      throw new Error(error?.message ?? "consent failed");
    }
    window.location.assign(data.url);
  }

  return <ConsentCard {...props} onDecide={decide} />;
}
