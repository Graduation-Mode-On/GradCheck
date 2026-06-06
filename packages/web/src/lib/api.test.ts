import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteCustomRequirement } from "./api";

describe("API client", () => {
  beforeEach(() => {
    localStorage.setItem("gradcheck.token", "token");
  });

  it("treats 204 no-content responses as successful", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 204
      })
    );

    await expect(deleteCustomRequirement("00000000-0000-4000-8000-000000000001")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-requirements/00000000-0000-4000-8000-000000000001",
      expect.objectContaining({ method: "DELETE" })
    );

    fetchMock.mockRestore();
  });
});
