/**
 * Privacy filters for what the browser sends. Query strings on ErgStats pages
 * carry OAuth parameters (client ids, signed authorization requests, callback
 * URLs) that analytics has no use for, so only campaign tags survive.
 */

const KEPT_PARAMS = /^(utm_[a-z0-9_]+|ref)$/i;

/** A URL without its fragment and without any query parameter except utm_* and ref. */
export function scrubUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Not absolute: keep the path only.
    return value.split(/[?#]/, 1)[0];
  }
  const kept = new URLSearchParams();
  for (const [key, val] of url.searchParams) if (KEPT_PARAMS.test(key)) kept.append(key, val);
  url.search = kept.toString();
  url.hash = "";
  return url.toString();
}

/** Event properties PostHog fills with URLs: $current_url, $referrer, $initial_referrer, $prev_pageview_url... */
const URL_PROPERTY = /(url|referrer)$/i;

/** Scrubs every URL-valued property in place, including the person-property bags. */
export function scrubUrlProperties(properties: Record<string, unknown> | undefined): void {
  if (!properties) return;
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string" && URL_PROPERTY.test(key) && value !== "$direct") {
      properties[key] = scrubUrl(value);
    } else if ((key === "$set" || key === "$set_once") && value && typeof value === "object") {
      scrubUrlProperties(value as Record<string, unknown>);
    }
  }
}
