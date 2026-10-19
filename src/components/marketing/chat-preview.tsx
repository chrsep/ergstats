import { SparklesIcon, WrenchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const splits = [
  { split: "500m", time: "1:55.0", spm: 31, hr: 168 },
  { split: "1000m", time: "1:54.0", spm: 29, hr: 177 },
  { split: "1500m", time: "1:53.0", spm: 29, hr: 182 },
  { split: "2000m", time: "1:49.4", spm: 33, hr: 187 },
];

/** Hero illustration: an agent answering a training question with ErgStats tools. */
export function ChatPreview({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-xl shadow-primary/5 sm:p-5", className)}>
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        How did my 2k on Saturday compare to September’s?
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {["list_workouts", "get_workout"].map((tool) => (
          <div key={tool} className="flex w-fit items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            <WrenchIcon className="size-3" />
            ergstats · {tool}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <p>
            <span className="font-semibold">7:31.4</span>, a <span className="font-semibold text-primary">10.6 second PB</span> over
            7:42.0 on Sep 2. You negative split it and finished at 33 spm:
          </p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full font-mono text-xs tabular-nums">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Split</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">/500m</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">spm</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">bpm</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => (
                  <tr key={s.split} className="border-t">
                    <td className="px-2.5 py-1.5 text-muted-foreground">{s.split}</td>
                    <td className={cn("px-2.5 py-1.5 text-right", i === splits.length - 1 && "font-semibold text-primary")}>{s.time}</td>
                    <td className="px-2.5 py-1.5 text-right">{s.spm}</td>
                    <td className="px-2.5 py-1.5 text-right">{s.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground">
            Your third 500 was the soft spot. Next time hold 1:52 through 1500m and save the sprint for the last 250.
          </p>
        </div>
      </div>
    </div>
  );
}
