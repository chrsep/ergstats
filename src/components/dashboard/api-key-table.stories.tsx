import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { ApiKeyTable } from "./api-key-table";

const now = new Date("2026-10-19T09:00:00Z");

const meta = {
  title: "Dashboard/ApiKeyTable",
  component: ApiKeyTable,
  args: {
    now,
    onRevoke: fn(),
    keys: [
      {
        id: "k1",
        name: "Claude Code on my laptop",
        start: "erg_Ab12",
        createdAt: "2026-10-01T08:00:00Z",
        lastRequest: "2026-10-19T08:55:00Z",
        expiresAt: null,
      },
      {
        id: "k2",
        name: "Cursor",
        start: "erg_Zx90",
        createdAt: "2026-09-12T08:00:00Z",
        lastRequest: "2026-10-16T08:00:00Z",
        expiresAt: null,
      },
      { id: "k3", name: null, start: "erg_Qq77", createdAt: "2026-10-18T08:00:00Z", lastRequest: null, expiresAt: null },
    ],
  },
} satisfies Meta<typeof ApiKeyTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithKeys: Story = {};

export const Empty: Story = { args: { keys: [] } };

export const RevokeAsksFirst: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Revoke Cursor" }));
    const dialog = await screen.findByRole("alertdialog");
    await expect(within(dialog).getByText("Revoke “Cursor”?")).toBeInTheDocument();
    await expect(args.onRevoke).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke key" }));
    await expect(args.onRevoke).toHaveBeenCalledWith(expect.objectContaining({ id: "k2" }));
  },
};
