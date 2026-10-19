import type { Preview } from "@storybook/nextjs-vite";
import { useEffect } from "react";

import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === "dark";
      useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
      }, [dark]);
      return (
        <TooltipProvider>
          <div className="bg-background font-sans text-foreground antialiased">
            <Story />
          </div>
        </TooltipProvider>
      );
    },
  ],
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Fail the Storybook test run on accessibility violations.
      test: "error",
    },
  },
};

export default preview;
