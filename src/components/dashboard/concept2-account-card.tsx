import { CheckCircle2Icon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Concept2AccountCard({ name, image, email }: { name: string; image?: string | null; email?: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Concept2 Logbook</CardTitle>
        <CardDescription>ErgStats reads your workouts with read-only access. It never changes your logbook.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Avatar className="size-10">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          {email ? <p className="truncate text-sm text-muted-foreground">{email}</p> : null}
        </div>
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2Icon className="text-primary" />
          Connected
        </Badge>
      </CardContent>
    </Card>
  );
}
