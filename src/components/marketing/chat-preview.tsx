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
    <figure
      aria-label="Example: Claude answering a question about a 2k test"
      className={cn(
        "m-0 flex flex-col gap-4 rounded-[1.25rem] border bg-card p-5 shadow-[0_1px_2px_rgb(17_24_22/0.04),0_32px_64px_-32px_rgb(13_60_58/0.3)] md:p-6",
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-4 border-b pb-4 font-mono text-xs text-muted-foreground">
        <span>Example chat</span>
        <span>Claude + ErgStats</span>
      </figcaption>
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[0.9375rem] leading-snug text-primary-foreground">
        How did my 2k on Saturday compare to September’s?
      </p>
      <div className="flex flex-wrap gap-2">
        {["list_workouts", "get_workout"].map((tool) => (
          <span key={tool} className="rounded-lg border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            ergstats · {tool}
          </span>
        ))}
      </div>
      <p className="text-[0.9375rem] leading-relaxed">
        <strong className="font-semibold">7:31.4</strong>, a <strong className="font-semibold text-primary">10.6 second PB</strong>{" "}
        over 7:42.0 on Sep 2. You negative split it and finished at 33 spm:
      </p>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full font-mono text-[0.8125rem] tabular-nums">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Split
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                /500m
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                spm
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                bpm
              </th>
            </tr>
          </thead>
          <tbody>
            {splits.map((s, i) => (
              <tr key={s.split} className="border-t">
                <td className="px-3 py-2">{s.split}</td>
                <td className={cn("px-3 py-2 text-right", i === splits.length - 1 && "font-semibold text-primary")}>{s.time}</td>
                <td className="px-3 py-2 text-right">{s.spm}</td>
                <td className="px-3 py-2 text-right">{s.hr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Your third 500 was the soft spot. Next time hold 1:52 through 1500m and save the sprint for the last 250.
      </p>
    </figure>
  );
}
