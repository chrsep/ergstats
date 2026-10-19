import { describe, expect, it } from "vitest";

import { describeScopes } from "./scopes";

describe("describeScopes", () => {
  it("explains each scope, skipping openid", () => {
    expect(describeScopes(["openid", "profile", "logbook:read"])).toEqual([
      "See your name and profile picture",
      "Read your Concept2 Logbook: workouts, splits, stroke data and personal bests",
    ]);
  });
});
