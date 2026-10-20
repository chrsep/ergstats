import { describe, expect, it } from "vitest";

import { claudeConnectorUrl, clientSetups } from "./clients";

describe("claudeConnectorUrl", () => {
  it("opens Claude's Add custom connector dialog with the name and encoded URL", () => {
    expect(claudeConnectorUrl("https://www.ergstats.com/mcp")).toBe(
      "https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=ErgStats&connectorUrl=https%3A%2F%2Fwww.ergstats.com%2Fmcp",
    );
  });

  it("is offered only for Claude", () => {
    const setups = clientSetups("https://www.ergstats.com/mcp");
    expect(setups.filter((s) => s.oneClick).map((s) => s.id)).toEqual(["claude"]);
  });
});
