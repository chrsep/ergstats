import { handleAuthorize, handleConsent } from "@/lib/oauth/authorize";

export const dynamic = "force-dynamic";

export const GET = handleAuthorize;
export const POST = handleConsent;
