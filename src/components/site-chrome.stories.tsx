import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { Concept2SignInButton } from "./concept2-sign-in-button";
import { SiteFooter } from "./site-footer";
import { HeaderSignIn, SiteHeader } from "./site-header";
import { buttonVariants } from "./ui/button";
import { UserMenu } from "./user-menu";

const meta = {
  title: "Components/Site chrome",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeaderSignedOut: Story = {
  render: () => (
    <SiteHeader>
      <a href="#" className={buttonVariants({ variant: "outline" })}>
        Sign in
      </a>
    </SiteHeader>
  ),
};

export const HeaderPublic: Story = {
  render: () => (
    <SiteHeader nav current="guides">
      <HeaderSignIn />
    </SiteHeader>
  ),
};

export const HeaderSignedIn: Story = {
  render: () => (
    <SiteHeader>
      <UserMenu name="Chris Example" email="chris@example.com" onSignOut={fn()} />
    </SiteHeader>
  ),
};

export const Footer: Story = { render: () => <SiteFooter /> };

export const SignInButton: Story = {
  parameters: { layout: "centered" },
  render: () => <Concept2SignInButton />,
};
