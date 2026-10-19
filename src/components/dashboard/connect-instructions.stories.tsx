import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ConnectInstructions } from "./connect-instructions";

const meta = {
  title: "Dashboard/ConnectInstructions",
  component: ConnectInstructions,
  args: { mcpUrl: "https://ergstats.com/mcp" },
} satisfies Meta<typeof ConnectInstructions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const WithFreshKey: Story = {
  args: { apiKey: "erg_eVotQbNCISzbMxmorJhBvgKEfJrnEvlERmTiLHjKKNRs" },
};

export const SwitchesClients: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Cursor" }));
    await expect(canvas.getByText("~/.cursor/mcp.json")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "VS Code" }));
    await expect(canvas.getByText(".vscode/mcp.json")).toBeVisible();
  },
};
