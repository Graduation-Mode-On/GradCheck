import { describe, expect, it } from "vitest";

import { customRequirementSchema } from "./customRequirement";

describe("customRequirementSchema", () => {
  it("rejects numeric values that exceed the backend numeric(8,2) limit", () => {
    const result = customRequirementSchema.safeParse({
      name: "超大目标",
      kind: "count",
      category: "other",
      targetValue: "1000000",
      currentValue: "0",
      unit: "次",
      importance: "required",
      source: "user_custom",
      includeInProgress: true,
      showOnHome: true,
      deadline: null,
      notes: null
    });

    expect(result.success).toBe(false);
  });
});
