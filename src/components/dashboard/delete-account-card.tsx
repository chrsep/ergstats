"use client";

import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { DeleteAccountResult } from "./types";

export const DELETE_CONFIRMATION = "delete";

/**
 * Deleting asks twice: the dialog, then typing "delete". A sign-in older than a
 * day can't delete, so the dialog offers to sign in again first; `defaultOpen`
 * reopens it when they come back.
 */
export function DeleteAccountCard({
  onDelete,
  onReauthenticate,
  defaultOpen = false,
}: {
  onDelete: () => Promise<DeleteAccountResult>;
  onReauthenticate: () => void | Promise<void>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<"reauthenticate" | "failed" | null>(null);

  const confirmed = confirmation.trim().toLowerCase() === DELETE_CONFIRMATION;

  function handleOpenChangeComplete(isOpen: boolean) {
    if (isOpen) return;
    setConfirmation("");
    setProblem(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setPending(true);
    setProblem(null);
    const result = await onDelete().catch((): DeleteAccountResult => ({ ok: false, reason: "failed" }));
    // On success the page navigates away; keep the spinner until it does.
    if (!result.ok) {
      setProblem(result.reason);
      setPending(false);
    }
  }

  async function handleReauthenticate() {
    setPending(true);
    try {
      await onReauthenticate();
    } catch {
      setPending(false);
    }
  }

  return (
    <Card id="delete-account">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your ErgStats account and everything ErgStats stores about you. Your Concept2 Logbook isn&apos;t
          affected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen} onOpenChangeComplete={handleOpenChangeComplete}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Delete account
              </Button>
            }
          />
          <AlertDialogContent>
            <form onSubmit={handleSubmit} className="contents">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes your ErgStats account, API keys, connected apps and the Concept2 access ErgStats holds. Every
                  connected app loses access right away. Your workouts stay in your Concept2 Logbook. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {problem === "reauthenticate" ? (
                <Alert>
                  <TriangleAlertIcon />
                  <AlertDescription>
                    To keep your account safe, sign in with Concept2 again before deleting it. You&apos;ll come back here to
                    confirm.
                  </AlertDescription>
                </Alert>
              ) : (
                <Field data-invalid={problem ? true : undefined}>
                  <FieldLabel htmlFor="delete-account-confirmation">
                    Type &ldquo;{DELETE_CONFIRMATION}&rdquo; to confirm
                  </FieldLabel>
                  <Input
                    id="delete-account-confirmation"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={problem ? true : undefined}
                  />
                  {problem === "failed" ? <FieldError>Couldn&apos;t delete your account. Try again.</FieldError> : null}
                </Field>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                {problem === "reauthenticate" ? (
                  <Button type="button" onClick={handleReauthenticate} disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    Sign in again
                  </Button>
                ) : (
                  <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    Delete account
                  </Button>
                )}
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
