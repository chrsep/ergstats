import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ConsentCard } from "./consent-card";

const meta = {
  title: "Consent/ConsentCard",
  component: ConsentCard,
  args: {
    clientName: "Claude",
    redirectHost: "claude.ai",
    scopes: ["openid", "profile", "email", "offline_access", "logbook:read"],
    user: { name: "Chris Example", email: "chris@example.com" },
    onDecide: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div className="flex justify-center p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Claude: Story = {};

export const ChatGPT: Story = {
  args: { clientName: "ChatGPT", redirectHost: "chatgpt.com", scopes: ["logbook:read"] },
};

export const Allows: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Read your Concept2 Logbook/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Allow" }));
    await expect(args.onDecide).toHaveBeenCalledWith(true);
  },
};

export const Denies: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Deny" }));
    await expect(args.onDecide).toHaveBeenCalledWith(false);
  },
};
