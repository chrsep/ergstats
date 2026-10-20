import { PlusIcon } from "lucide-react";

import type { Faq } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Questions as native disclosures. The answers stay in the HTML, so crawlers and
 * AI search can read them without running JS.
 */
export function FaqList({ faqs, openFirst = false, className }: { faqs: Faq[]; openFirst?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col border-t", className)}>
      {faqs.map((faq, i) => (
        <details key={faq.question} open={openFirst && i === 0} className="group border-b">
          <summary className="flex min-h-11 cursor-pointer list-none rounded-lg items-center justify-between gap-6 py-5 text-[1.0625rem] leading-snug font-semibold outline-none focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 md:py-6 md:text-lg [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform duration-200 group-open:rotate-45"
            >
              <PlusIcon className="size-4" />
            </span>
          </summary>
          <p className="max-w-[68ch] pb-6 text-pretty break-words text-muted-foreground md:pr-14">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
