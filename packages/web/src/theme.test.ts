import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tommy theme tokens", () => {
  it("defines the Tommy color palette as CSS variables", () => {
    const stylesheet = readFileSync("src/style.css", "utf8");

    expect(stylesheet).toContain("--tommy-primary: #13acd9");
    expect(stylesheet).toContain("--tommy-info: #237a86");
    expect(stylesheet).toContain("--tommy-success: #7ec200");
    expect(stylesheet).toContain("--tommy-warning: #f49c13");
    expect(stylesheet).toContain("--tommy-error: #ed3f1f");
    expect(stylesheet).toContain("--tommy-text: #333333");
    expect(stylesheet).toContain("--tommy-text-secondary: #555555");
  });
});
