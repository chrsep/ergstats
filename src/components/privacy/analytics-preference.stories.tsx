import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { AnalyticsPreference } from "./analytics-preference";

const meta = {
  title: "Privacy/AnalyticsPreference",
  component: AnalyticsPreference,
  args: { state: "on", onChange: fn() },
} satisfies Meta<typeof AnalyticsPreference>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {};
export const Off: Story = { args: { state: "off" } };
export const BrowserSignal: Story = { args: { state: "browser" } };
export const Unavailable: Story = { args: { state: "unavailable" } };
export const Loading: Story = { args: { state: "loading" } };
