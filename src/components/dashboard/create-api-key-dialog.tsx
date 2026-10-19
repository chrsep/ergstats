"use client";

import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * Two steps in one dialog: name the key, then show the secret exactly once.
 * `onCreate` resolves to the full key; `onDone` fires when the dialog closes
 * after a key was made, so the page can drop it into the setup snippets.
 */
export function CreateApiKeyDialog({
  onCreate,
  onDone,
  defaultOpen = false,
}: {
  onCreate: (name: string) => Promise<string>;
  onDone?: (key: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Reset once the close animation ends, so the form doesn't flash back in while the key fades out.
  function handleOpenChangeComplete(isOpen: boolean) {
    if (isOpen) return;
    if (createdKey) onDone?.(createdKey);
    setName("");
    setError(null);
    setCreatedKey(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      setCreatedKey(await onCreate(name.trim() || "Untitled key"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the key. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={handleOpenChangeComplete}>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Create API key
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Your new API key</DialogTitle>
              <DialogDescription>Copy it now and keep it somewhere safe.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 py-1 pr-1 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-sm" data-testid="new-api-key">
                {createdKey}
              </code>
              <CopyButton value={createdKey} label="Copy key" />
            </div>
            <Alert>
              <TriangleAlertIcon />
              <AlertDescription>
                This is the only time you’ll see the full key. If you lose it, revoke it and create another.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <DialogClose render={<Button>Done</Button>} />
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>Each agent or machine should get its own key, so you can revoke one without the others.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claude Code on my laptop"
                maxLength={64}
                autoFocus
                aria-invalid={error ? true : undefined}
              />
              {error ? <FieldError>{error}</FieldError> : <FieldDescription>Only you see this.</FieldDescription>}
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
