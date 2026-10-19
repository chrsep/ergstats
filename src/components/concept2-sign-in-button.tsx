"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

/** Starts the Concept2 OAuth flow. Signing in also connects the Logbook. */
export function Concept2SignInButton({
  callbackURL = "/dashboard",
  label = "Sign in with Concept2",
  size = "lg",
  className,
}: {
  callbackURL?: string;
  label?: string;
  size?: "default" | "lg";
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      size={size}
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({
          provider: "concept2",
          callbackURL,
          errorCallbackURL: "/sign-in",
        });
        if (error) {
          setPending(false);
          toast.error("Couldn't reach Concept2", { description: error.message });
        }
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {label}
      {!pending && <ArrowRightIcon data-icon="inline-end" />}
    </Button>
  );
}
