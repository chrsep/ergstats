"use client";

import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { describeScopes } from "@/lib/mcp/scopes";

export interface ConsentCardProps {
  /** The app's self-declared name. */
  clientName: string;
  /** Host the browser returns to after the decision, the one part of the request an app can't fake. */
  redirectHost: string;
  scopes: readonly string[];
  user: { name: string; email?: string | null; image?: string | null };
  /** Send the decision. Resolves once the browser is on its way back to the app. */
  onDecide: (accept: boolean) => Promise<void>;
}

/** Shown when an MCP client such as Claude or ChatGPT asks to connect to someone's ErgStats account. */
export function ConsentCard({ clientName, redirectHost, scopes, user, onDecide }: ConsentCardProps) {
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);

  async function decide(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    try {
      await onDecide(accept);
    } catch {
      setPending(null);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Logo showWordmark={false} className="mb-2 justify-center [&_svg]:size-10" />
        <CardTitle className="text-xl">Connect {clientName} to ErgStats</CardTitle>
        <CardDescription>
          {clientName} is asking to use your ErgStats account. Only allow apps you trust.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{user.name}</p>
            {user.email ? <p className="truncate text-muted-foreground">{user.email}</p> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{clientName} will be able to:</p>
          <ul className="flex flex-col gap-2 text-sm">
            {describeScopes(scopes).map((line) => (
              <li key={line} className="flex gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">It can&apos;t change or delete anything in your logbook.</p>
        </div>
        <Separator />
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ExternalLinkIcon className="size-4 shrink-0" aria-hidden />
          <span>
            You&apos;ll go back to <span className="font-medium text-foreground">{redirectHost}</span>. Disconnect it any
            time from your dashboard.
          </span>
        </p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" disabled={pending !== null} onClick={() => decide(false)}>
          {pending === "deny" ? <Spinner data-icon="inline-start" /> : null}
          Deny
        </Button>
        <Button size="lg" disabled={pending !== null} onClick={() => decide(true)}>
          {pending === "allow" ? <Spinner data-icon="inline-start" /> : null}
          Allow
        </Button>
      </CardFooter>
    </Card>
  );
}
