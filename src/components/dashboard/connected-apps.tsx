"use client";

import { PlugZapIcon, UnplugIcon } from "lucide-react";

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
import { formatDate } from "@/lib/format-date";
import type { ConnectedAppRow } from "./types";

export function ConnectedApps({
  apps,
  onDisconnect,
}: {
  apps: ConnectedAppRow[];
  onDisconnect: (app: ConnectedAppRow) => void | Promise<void>;
}) {
  if (apps.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PlugZapIcon />
          </EmptyMedia>
          <EmptyTitle>No apps connected yet</EmptyTitle>
          <EmptyDescription>Add ErgStats to Claude, ChatGPT or another MCP client and sign in. It shows up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {apps.map((app) => (
        <li key={app.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{app.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {app.host ? `${app.host} · ` : ""}Connected {formatDate(app.connectedAt)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <UnplugIcon data-icon="inline-start" />
                  Disconnect
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {app.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {app.name} loses access to your logbook right away. You can connect it again by signing in from the app.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => onDisconnect(app)}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      ))}
    </ul>
  );
}
