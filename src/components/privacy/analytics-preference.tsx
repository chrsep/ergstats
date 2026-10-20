import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { AnalyticsState } from "@/lib/observability/browser";

const DESCRIPTIONS: Record<AnalyticsState | "loading", string> = {
  loading: "Checking this browser’s setting…",
  on: "Your visits are counted anonymously. Turn this off and this browser sends nothing.",
  off: "Off in this browser. Nothing about your visits is sent.",
  browser: "Off, because your browser sends Do Not Track or Global Privacy Control.",
  unavailable: "Analytics isn’t running on this site.",
};

/** The analytics on/off switch on the privacy page. */
export function AnalyticsPreference({
  state,
  onChange,
}: {
  state: AnalyticsState | "loading";
  onChange: (enabled: boolean) => void;
}) {
  const changeable = state === "on" || state === "off";
  return (
    <Card>
      <CardContent>
        <Field orientation="horizontal" data-disabled={!changeable}>
          <FieldContent>
            <FieldLabel htmlFor="analytics-switch">Anonymous usage analytics</FieldLabel>
            <FieldDescription aria-live="polite">{DESCRIPTIONS[state]}</FieldDescription>
          </FieldContent>
          <Switch
            id="analytics-switch"
            checked={state === "on"}
            disabled={!changeable}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
