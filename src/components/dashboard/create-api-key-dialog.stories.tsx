import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import { CreateApiKeyDialog } from "./create-api-key-dialog";

const NEW_KEY = "erg_eVotQbNCISzbMxmorJhBvgKEfJrnEvlERmTiLHjKKNRsXIHpfruYxrawLbXGFrJI";

const meta = {
  title: "Dashboard/CreateApiKeyDialog",
  component: CreateApiKeyDialog,
  args: {
    onCreate: fn(async () => NEW_KEY),
    onDone: fn(),
  },
} satisfies Meta<typeof CreateApiKeyDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

export const CreatesAndRevealsKeyOnce: Story = {
  args: { defaultOpen: true },
  play: async ({ args }) => {
    await userEvent.type(await screen.findByLabelText("Name"), "Claude Code");
    await userEvent.click(screen.getByRole("button", { name: "Create key" }));
    await expect(args.onCreate).toHaveBeenCalledWith("Claude Code");
    await expect(await screen.findByTestId("new-api-key")).toHaveTextContent(NEW_KEY);
    await expect(screen.getByText(/only time you’ll see the full key/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(args.onDone).toHaveBeenCalledWith(NEW_KEY));
  },
};

export const ShowsCreateErrors: Story = {
  args: {
    defaultOpen: true,
    onCreate: fn(async () => {
      throw new Error("You’ve reached the limit of API keys.");
    }),
  },
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Create key" }));
    await expect(await screen.findByText("You’ve reached the limit of API keys.")).toBeInTheDocument();
  },
};
