import { apiKeyClient } from "@better-auth/api-key/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // oauthProviderClient carries an MCP client's signed authorization request
  // through sign-in and consent, so the flow resumes where it started.
  plugins: [apiKeyClient(), oauthProviderClient()],
});
