import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FAQS, guideClients, guideDetails } from "@/lib/site";

import { ChatPreview } from "./chat-preview";
import { CompareTable } from "./compare-table";
import { FaqList } from "./faq";
import { GuideCards, McpUrlBar } from "./guide-cards";
import { PageGrid } from "./page-layout";
import { ToolGrid } from "./tool-grid";

const meta = {
  title: "Marketing/Sections",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const guides = guideClients().map((c) => ({ id: c.id, name: c.name, ...guideDetails(c.id, c.name) }));

export const Chat: Story = { render: () => <ChatPreview className="max-w-xl" /> };
export const Guides: Story = {
  render: () => (
    <PageGrid>
      <GuideCards guides={guides} />
      <McpUrlBar url="https://www.ergstats.com/mcp" />
    </PageGrid>
  ),
};
export const Compare: Story = {
  render: () => (
    <PageGrid>
      <CompareTable />
    </PageGrid>
  ),
};
export const Tools: Story = { render: () => <ToolGrid /> };
export const Questions: Story = { render: () => <FaqList faqs={FAQS} openFirst /> };
