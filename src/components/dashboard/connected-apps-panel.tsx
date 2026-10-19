"use client";

import { useState } from "react";
import { toast } from "sonner";

import { disconnectAppAction } from "@/app/dashboard/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedApps } from "./connected-apps";
import type { ConnectedAppRow } from "./types";

/** Apps connected by signing in, with Disconnect wired to the server. */
export function ConnectedAppsPanel({ initialApps }: { initialApps: ConnectedAppRow[] }) {
  const [apps, setApps] = useState(initialApps);

  async function disconnect(app: ConnectedAppRow) {
    const { ok } = await disconnectAppAction(app.id).catch(() => ({ ok: false }));
    if (!ok) {
      toast.error(`Couldn't disconnect ${app.name}`, { description: "Refresh the page and try again." });
      return;
    }
    setApps((current) => current.filter((a) => a.id !== app.id));
    toast.success(`Disconnected ${app.name}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected apps</CardTitle>
        <CardDescription>Apps you approved by signing in. Each one can read your logbook until you disconnect it.</CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectedApps apps={apps} onDisconnect={disconnect} />
      </CardContent>
    </Card>
  );
}
