"use client";

import { KeyRoundIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format-date";
import type { ApiKeyRow } from "./types";

export function ApiKeyTable({
  keys,
  onRevoke,
  now,
}: {
  keys: ApiKeyRow[];
  onRevoke: (key: ApiKeyRow) => void | Promise<void>;
  /** Fixed "now" for relative times, so stories and tests render the same every day. */
  now?: Date;
}) {
  if (keys.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRoundIcon />
          </EmptyMedia>
          <EmptyTitle>No API keys yet</EmptyTitle>
          <EmptyDescription>Create a key to connect Claude Code, Cursor or another MCP client.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">{key.name || "Untitled key"}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{key.start ? `${key.start}…` : "••••"}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(key.createdAt)}</TableCell>
              <TableCell className="text-muted-foreground">{formatRelative(key.lastRequest, now)}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${key.name || "key"}`}>
                        <Trash2Icon />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke “{key.name || "Untitled key"}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Any agent using this key loses access to your logbook right away. This can’t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => onRevoke(key)}>
                        Revoke key
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
