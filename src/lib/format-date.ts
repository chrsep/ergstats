const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  return dateFormat.format(new Date(value));
}

/** "just now", "5 min ago", "3 days ago", falling back to a date after a month. */
export function formatRelative(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "Never";
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}
