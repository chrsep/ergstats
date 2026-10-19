import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { ConnectedApps } from "./connected-apps";

const meta = {
  title: "Dashboard/ConnectedApps",
  component: ConnectedApps,
  args: {
    onDisconnect: fn(),
    apps: [
      { id: "c1", name: "Claude", host: "claude.ai", connectedAt: "2026-10-19T08:00:00Z" },
      { id: "c2", name: "ChatGPT", host: "chatgpt.com", connectedAt: "2026-10-12T08:00:00Z" },
      { id: "c3", name: "Cursor", host: null, connectedAt: "2026-09-30T08:00:00Z" },
    ],
  },
} satisfies Meta<typeof ConnectedApps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithApps: Story = {};

export const Empty: Story = { args: { apps: [] } };

export const DisconnectAsksFirst: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Disconnect" })[0]);
    const dialog = await screen.findByRole("alertdialog");
    await expect(within(dialog).getByText("Disconnect Claude?")).toBeInTheDocument();
    await expect(args.onDisconnect).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await expect(args.onDisconnect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  },
};
