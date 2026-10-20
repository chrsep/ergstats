/**
 * End-to-end smoke test against a running app wired to the fake Concept2:
 * sign in, create an API key in the dashboard, then call the MCP server with
 * that key through the MCP client SDK.
 *
 *   node scripts/fake-concept2.ts &
 *   pnpm build && pnpm start &
 *   node scripts/smoke.ts
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:3000";
const shots = process.env.SCREENSHOT_DIR;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(base);
if (shots) await page.screenshot({ path: `${shots}/landing.png`, fullPage: true });

await page.getByRole("link", { name: "Get started free" }).click();
await page.waitForURL("**/sign-in");
if (shots) await page.screenshot({ path: `${shots}/sign-in.png` });

await page.getByRole("button", { name: "Sign in with Concept2" }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("heading", { name: "Dashboard" }).waitFor();

await page.getByRole("button", { name: "Create API key" }).click();
await page.getByLabel("Name").fill("Smoke test");
await page.getByRole("button", { name: "Create key" }).click();
const key = (await page.getByTestId("new-api-key").textContent())?.trim();
if (!key?.startsWith("erg_")) throw new Error(`Unexpected key: ${key}`);
if (shots) await page.screenshot({ path: `${shots}/new-key.png` });
await page.getByRole("button", { name: "Done" }).click();
await page.getByRole("cell", { name: "Smoke test", exact: true }).first().waitFor();
await page.getByText(`Bearer ${key}`).first().waitFor();
if (shots) await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  }),
);
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
const result = await client.callTool({ name: "get_personal_bests", arguments: {} });
const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
console.log(text);
if (result.isError || !text.includes("RowErg 2k: 7:31.4")) throw new Error("get_personal_bests did not return the fixture PB");
const profile = await client.callTool({ name: "get_profile", arguments: {} });
console.log((profile.content as { text: string }[])[0].text);
const feedback = await client.callTool({
  name: "send_feedback",
  arguments: { type: "missing_capability", summary: "Smoke test: the user asked for something no tool covers." },
});
const feedbackText = (feedback.content as { text: string }[])[0]?.text ?? "";
console.log(feedbackText);
// After 20 runs in a day the fake account hits the feedback limit, which still means the database was reached.
if (feedback.isError || !/^(Sent|Not sent: this account has reached)/.test(feedbackText)) {
  throw new Error("send_feedback did not reach the feedback table");
}
await client.close();

const bad = await fetch(`${base}/mcp`, {
  method: "POST",
  headers: { authorization: "Bearer erg_nope", "content-type": "application/json" },
  body: "{}",
});
if (bad.status !== 401) throw new Error(`Expected 401 for a bad key, got ${bad.status}`);

await browser.close();
console.log("Smoke test passed.");
