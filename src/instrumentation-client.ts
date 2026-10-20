import { loadAnalytics } from "@/lib/observability/browser";

// Starts loading PostHog in its own chunk; it never blocks hydration.
void loadAnalytics();
