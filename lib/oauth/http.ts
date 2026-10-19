/** Small HTTP helpers shared by the OAuth route handlers. */

export const CSRF_COOKIE = "__Host-ergdata_csrf";

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlPage(title: string, body: string, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7f9; --card: #fff; --text: #111827; --muted: #4b5563; --accent: #0b5cad; --border: #d1d5db; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f1115; --card: #181b21; --text: #e5e7eb; --muted: #9ca3af; --accent: #5aa2f0; --border: #2d323b; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
  main { max-width: 440px; margin: 10vh auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p, li { color: var(--muted); }
  strong { color: var(--text); }
  code { font-size: 13px; word-break: break-all; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; font: inherit; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
</head>
<body><main><div class="card">${body}</div></main></body>
</html>`;
  const headers = new Headers({ ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" });
  new Headers(init.headers).forEach((value, key) => headers.append(key, value));
  return new Response(page, { status: init.status ?? 200, headers });
}

export function errorPage(message: string, status = 400): Response {
  return htmlPage("Authorization error", `<h1>Can't connect</h1><p>${escapeHtml(message)}</p>`, { status });
}

/** OAuth error response for the token and registration endpoints. */
export function oauthJsonError(error: string, description: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** Redirects back to the client with OAuth response parameters (RFC 6749 §4.1.2, RFC 9207 iss). */
export function redirectToClient(redirectUri: string, params: Record<string, string | undefined>, extraHeaders?: HeadersInit): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const headers = new Headers({ location: url.toString(), "cache-control": "no-store" });
  new Headers(extraHeaders).forEach((value, key) => headers.append(key, value));
  return new Response(null, { status: 302, headers });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

/** Normalizes a URI for resource-indicator comparison: lowercase scheme and host, no trailing slash. */
export function normalizeResource(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.hash) return undefined;
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}${url.search}`;
  } catch {
    return undefined;
  }
}
