import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { CodeBlock } from "./code-block";

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  args: {
    title: "Terminal",
    code: 'claude mcp add --transport http ergstats https://ergstats.com/mcp \\\n  --header "Authorization: Bearer YOUR_API_KEY"',
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shell: Story = {};

export const Json: Story = {
  args: {
    title: "~/.cursor/mcp.json",
    code: JSON.stringify(
      { mcpServers: { ergstats: { url: "https://ergstats.com/mcp", headers: { Authorization: "Bearer YOUR_API_KEY" } } } },
      null,
      2,
    ),
  },
};

export const CopiesToClipboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const writes: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void writes.push(text) },
      configurable: true,
    });
    await userEvent.click(canvas.getByRole("button", { name: "Copy snippet" }));
    await expect(writes).toEqual([args.code]);
    await expect(canvas.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  },
};
