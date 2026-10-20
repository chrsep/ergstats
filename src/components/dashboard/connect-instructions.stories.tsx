import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { apiKeySetups, clientSetups } from "@/lib/mcp/clients";
import { ConnectInstructions } from "./connect-instructions";

const mcpUrl = "https://www.ergstats.com/mcp";

const meta = {
  title: "Dashboard/ConnectInstructions",
  component: ConnectInstructions,
  args: { setups: clientSetups(mcpUrl) },
} satisfies Meta<typeof ConnectInstructions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {};

export const ApiKeyPlaceholder: Story = { args: { setups: apiKeySetups(mcpUrl) } };

export const ApiKeyWithFreshKey: Story = {
  args: { setups: apiKeySetups(mcpUrl, "erg_eVotQbNCISzbMxmorJhBvgKEfJrnEvlERmTiLHjKKNRs") },
};

export const SwitchesClients: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "ChatGPT" }));
    await expect(canvas.getByText(/Add custom MCP server/)).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Cursor" }));
    await expect(canvas.getByText("~/.cursor/mcp.json")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "VS Code" }));
    await expect(canvas.getByText(".vscode/mcp.json")).toBeVisible();
  },
};
