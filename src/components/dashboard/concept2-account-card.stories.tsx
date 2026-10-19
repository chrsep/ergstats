import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Concept2AccountCard } from "./concept2-account-card";

const meta = {
  title: "Dashboard/Concept2AccountCard",
  component: Concept2AccountCard,
  args: { name: "Chris Example", email: "chris@example.com" },
} satisfies Meta<typeof Concept2AccountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const NoEmail: Story = { args: { email: null } };
