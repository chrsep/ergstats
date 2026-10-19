import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Logo } from "./logo";

const meta = {
  title: "Brand/Logo",
  component: Logo,
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wordmark: Story = {};
export const MarkOnly: Story = { args: { showWordmark: false } };
export const Large: Story = { args: { className: "text-3xl [&_svg]:size-10" } };
