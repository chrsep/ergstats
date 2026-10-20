import { cn } from "@/lib/utils";

/**
 * Layout primitives for the public pages, so every section shares one grid and
 * one spacing scale: 4 / 8 / 12 columns with a 16 / 24px gutter, 1200px of
 * content, 72 / 96 / 128px between sections and 40 / 64px from a heading to its
 * content (phone / tablet / desktop).
 */

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1248px] px-5 md:px-8 lg:px-6", className)} {...props} />;
}

export function PageGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-4 gap-4 md:grid-cols-8 md:gap-6 lg:grid-cols-12", className)} {...props} />;
}

const tones = {
  plain: "",
  muted: "border-t bg-muted/40",
  dark: "bg-[#0B1514] text-[#F2F6F5] dark:border-y",
  accent: "border-t bg-primary/8",
};

/** A full-width band. Its children sit in a Container, one heading-gap apart. */
export function Section({
  tone = "plain",
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { tone?: keyof typeof tones }) {
  return (
    <section className={cn("scroll-mt-16 py-18 md:py-24 lg:scroll-mt-18 lg:py-32", tones[tone], className)} {...props}>
      <Container className="flex flex-col gap-10 md:gap-16">{children}</Container>
    </section>
  );
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-mono text-[0.8125rem] font-medium tracking-[0.06em] text-primary uppercase", className)} {...props} />;
}

export const h1Class = "text-[2.5rem] leading-[1.04] font-[650] tracking-[-0.035em] text-balance md:text-[3.25rem] lg:text-[4rem]";
export const h2Class = "text-[1.875rem] leading-[1.1] font-[650] tracking-[-0.028em] text-balance md:text-[2.375rem] lg:text-[2.75rem]";
export const h3Class = "text-lg leading-snug font-semibold tracking-[-0.01em] md:text-xl";
export const ledeClass = "text-lg leading-[1.55] text-pretty text-muted-foreground lg:text-xl";

/** Eyebrow, title and lede for a section, spanning 7 of 12 columns. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("col-span-full flex flex-col gap-4 lg:col-span-7", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className={h2Class}>
        {title}
      </h2>
      {lede && <p className={ledeClass}>{lede}</p>}
    </div>
  );
}

/** The card every grid on the public pages uses: one padding, one radius, one inner gap. */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-6 md:p-8", className)} {...props} />;
}

/** Turns `backticked` words into inline code. */
export function InlineCode({ text }: { text: string }) {
  return text.split("`").map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded-md bg-muted px-1.5 py-px font-mono text-[0.88em] break-words text-foreground">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
