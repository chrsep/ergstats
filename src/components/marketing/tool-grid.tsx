import { ActivityIcon, CalendarRangeIcon, ListIcon, type LucideIcon, TimerIcon, TrophyIcon, UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ToolInfo {
  name: string;
  icon: LucideIcon;
  summary: string;
  prompt: string;
}

export const TOOLS: ToolInfo[] = [
  {
    name: "get_training_summary",
    icon: CalendarRangeIcon,
    summary: "Meters, time and sessions by week or month, per machine.",
    prompt: "How consistent was my training this block?",
  },
  {
    name: "get_personal_bests",
    icon: TrophyIcon,
    summary: "Best 500m to marathon and 1 to 60 minute pieces.",
    prompt: "What are my PBs on the SkiErg this season?",
  },
  {
    name: "list_workouts",
    icon: ListIcon,
    summary: "Find sessions by date range and machine.",
    prompt: "Show every 2k I did this year.",
  },
  {
    name: "get_workout",
    icon: TimerIcon,
    summary: "Splits or intervals, targets, heart rate and rest.",
    prompt: "Break down Tuesday’s 4×500m intervals.",
  },
  {
    name: "get_workout_strokes",
    icon: ActivityIcon,
    summary: "Pacing through a piece, down to every single stroke.",
    prompt: "Where did I fade in my 5k?",
  },
  {
    name: "get_profile",
    icon: UserIcon,
    summary: "Age, weight and max heart rate from your Logbook profile.",
    prompt: "Set my heart rate zones from my profile.",
  },
];

export function ToolGrid({ tools = TOOLS, className }: { tools?: ToolInfo[]; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3", className)}>
      {tools.map((tool) => (
        <div key={tool.name} className="flex flex-col gap-3 bg-card p-5">
          <div className="flex items-center gap-2">
            <tool.icon className="size-4 text-primary" />
            <code className="font-mono text-sm font-medium">{tool.name}</code>
          </div>
          <p className="text-sm text-muted-foreground">{tool.summary}</p>
          <p className="mt-auto rounded-md bg-muted/60 px-3 py-2 text-sm italic">“{tool.prompt}”</p>
        </div>
      ))}
    </div>
  );
}
