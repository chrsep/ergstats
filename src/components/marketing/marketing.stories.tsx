import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ChatPreview } from "./chat-preview";
import { HowItWorks } from "./how-it-works";
import { ToolGrid } from "./tool-grid";

const meta = {
  title: "Marketing/Sections",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chat: Story = { render: () => <ChatPreview className="max-w-xl" /> };
export const Tools: Story = { render: () => <ToolGrid /> };
export const Steps: Story = { render: () => <HowItWorks mcpUrl="https://ergstats.com/mcp" /> };
