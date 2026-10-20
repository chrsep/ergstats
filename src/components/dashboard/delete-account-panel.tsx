"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteAccountAction } from "@/app/dashboard/actions";
import { authClient } from "@/lib/auth-client";
import { DeleteAccountCard } from "./delete-account-card";

/** Where a fresh sign-in lands so the delete dialog opens again. */
export const CONFIRM_DELETE_PATH = "/dashboard?delete=confirm#delete-account";

/** The delete-account card wired to the server and to Concept2 sign-in. */
export function DeleteAccountPanel({ confirming }: { confirming: boolean }) {
  const router = useRouter();

  return (
    <DeleteAccountCard
      defaultOpen={confirming}
      onDelete={async () => {
        const result = await deleteAccountAction();
        if (result.ok) {
          toast.success("Your ErgStats account was deleted");
          router.replace("/");
          router.refresh();
        }
        return result;
      }}
      onReauthenticate={async () => {
        const { error } = await authClient.signIn.social({
          provider: "concept2",
          callbackURL: CONFIRM_DELETE_PATH,
          errorCallbackURL: "/dashboard",
        });
        if (error) {
          toast.error("Couldn't reach Concept2", { description: error.message });
          throw error;
        }
      }}
    />
  );
}
