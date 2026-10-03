import { describe, it, expect, beforeEach } from "vitest";

describe("Multi-Tenant Organization Management", () => {
  const STORAGE_KEY = "agilix_active_org_id";

  beforeEach(() => {
    localStorage.clear();
  });

  it("should persist active organization in localStorage", () => {
    const orgId = "org-12345";
    localStorage.setItem(STORAGE_KEY, orgId);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(orgId);
  });

  it("should clear or switch organization when requested", () => {
    localStorage.setItem(STORAGE_KEY, "empresa-1");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("empresa-1");

    localStorage.setItem(STORAGE_KEY, "empresa-2");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("empresa-2");
  });
});
