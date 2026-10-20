import type { Faq } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Questions and answers, rendered as plain text so crawlers and AI search can read them without running JS. */
export function FaqList({ faqs, className }: { faqs: Faq[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-12 gap-y-8 md:grid-cols-2", className)}>
      {faqs.map((faq) => (
        <div key={faq.question} className="space-y-2">
          <dt className="font-medium">{faq.question}</dt>
          <dd className="text-sm text-pretty break-words text-muted-foreground">{faq.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
