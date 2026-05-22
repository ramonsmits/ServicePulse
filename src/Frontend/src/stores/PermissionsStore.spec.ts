import { describe, test, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePermissionsStore } from "./PermissionsStore";

describe("PermissionsStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  test("starts empty when sessionStorage has no entry", () => {
    const store = usePermissionsStore();
    expect(store.permissions).toEqual([]);
    expect(store.version).toBeNull();
  });

  test("hydrates from sessionStorage on creation", () => {
    const descriptor = {
      version: "2026-05-22T14:30:00Z",
      user: "alice",
      permissions: [
        { permission: "messages:retry", scope: { allow: ["Sales.*"], deny: [] } },
        { permission: "messages:view", scope: null },
      ],
    };
    sessionStorage.setItem("sp_permissions_descriptor", JSON.stringify(descriptor));

    const store = usePermissionsStore();
    expect(store.version).toBe("2026-05-22T14:30:00Z");
    expect(store.permissions).toHaveLength(2);
    expect(store.permissions[0].permission).toBe("messages:retry");
    expect(store.permissions[1].scope).toBeNull();
  });

  test("setDescriptor stores descriptor and persists to sessionStorage", () => {
    const store = usePermissionsStore();
    store.setDescriptor({
      version: "2026-05-22T15:00:00Z",
      user: "bob",
      permissions: [{ permission: "messages:view", scope: null }],
    });

    expect(store.version).toBe("2026-05-22T15:00:00Z");
    expect(store.permissions).toHaveLength(1);

    const stored = JSON.parse(sessionStorage.getItem("sp_permissions_descriptor") ?? "null");
    expect(stored.version).toBe("2026-05-22T15:00:00Z");
    expect(stored.permissions).toHaveLength(1);
  });

  test("clearDescriptor removes descriptor and clears sessionStorage", () => {
    const store = usePermissionsStore();
    store.setDescriptor({
      version: "2026-05-22T15:00:00Z",
      user: "bob",
      permissions: [{ permission: "messages:view", scope: null }],
    });
    store.clearDescriptor();

    expect(store.permissions).toEqual([]);
    expect(store.version).toBeNull();
    expect(sessionStorage.getItem("sp_permissions_descriptor")).toBeNull();
  });
});
