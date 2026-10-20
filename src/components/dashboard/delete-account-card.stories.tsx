import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { DeleteAccountCard } from "./delete-account-card";

const meta = {
  title: "Dashboard/DeleteAccountCard",
  component: DeleteAccountCard,
  args: {
    // Never resolves, like the real page, which navigates away after deleting.
    onDelete: fn(() => new Promise<never>(() => {})),
    onReauthenticate: fn(),
  },
} satisfies Meta<typeof DeleteAccountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AsksToTypeDelete: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete account" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await expect(dialog.getByText("Delete your account?")).toBeInTheDocument();
    const submit = dialog.getByRole("button", { name: "Delete account" });
    await expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/to confirm/), "delet");
    await expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/to confirm/), "e");
    await expect(submit).toBeEnabled();
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(submit);
    await expect(args.onDelete).toHaveBeenCalledOnce();
  },
};

export const SignInTooOld: Story = {
  args: { onDelete: fn(async () => ({ ok: false as const, reason: "reauthenticate" as const })) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete account" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await userEvent.type(dialog.getByLabelText(/to confirm/), "delete");
    await userEvent.click(dialog.getByRole("button", { name: "Delete account" }));
    await userEvent.click(await dialog.findByRole("button", { name: "Sign in again" }));
    await expect(args.onReauthenticate).toHaveBeenCalledOnce();
  },
};

export const Failed: Story = {
  args: { onDelete: fn(async () => ({ ok: false as const, reason: "failed" as const })) },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete account" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await userEvent.type(dialog.getByLabelText(/to confirm/), "delete");
    await userEvent.click(dialog.getByRole("button", { name: "Delete account" }));
    await expect(await dialog.findByText(/Couldn.t delete your account/)).toBeInTheDocument();
  },
};

export const ReopenedAfterSigningIn: Story = { args: { defaultOpen: true } };
