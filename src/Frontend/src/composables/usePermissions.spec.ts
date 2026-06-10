import { describe, test, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { http, HttpResponse } from "msw";
import { mockServer } from "../../test/mock-server";
import { usePermissions } from "./usePermissions";
import { usePermissionsStore } from "@/stores/PermissionsStore";

const SC_URL = "http://localhost:33333/api/";

describe("usePermissions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  describe("fetchDescriptor", () => {
    test("fetches and stores the descriptor on 200", async () => {
      mockServer.use(
        http.get(`${SC_URL}me/permissions`, () =>
          HttpResponse.json({
            version: "2026-05-22T14:30:00Z",
            user: "alice",
            permissions: [
              { permission: "messages:retry", scope: { allow: ["Sales.*"], deny: [] } },
              { permission: "messages:view", scope: null },
            ],
          })
        )
      );

      const { fetchDescriptor } = usePermissions();
      await fetchDescriptor();

      const store = usePermissionsStore();
      expect(store.version).toBe("2026-05-22T14:30:00Z");
      expect(store.permissions).toHaveLength(2);
    });

    test("on 404 (auth disabled) sets allow-all sentinel", async () => {
      mockServer.use(http.get(`${SC_URL}me/permissions`, () => new HttpResponse(null, { status: 404 })));

      const { fetchDescriptor, can } = usePermissions();
      await fetchDescriptor();

      // allow-all: any permission, any resource
      expect(can("messages:retry")).toBe(true);
      expect(can("configuration:manage", "any-resource")).toBe(true);
    });

    test("on other error leaves existing descriptor intact", async () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "messages:view", scope: null }],
      });

      mockServer.use(http.get(`${SC_URL}me/permissions`, () => new HttpResponse(null, { status: 500 })));

      const { fetchDescriptor, can } = usePermissions();
      await fetchDescriptor();

      // existing descriptor preserved
      expect(store.permissions).toHaveLength(1);
      expect(can("messages:view")).toBe(true);
    });
  });

  describe("can(permission, resourceName?)", () => {
    test("unrestricted permission (scope null) is allowed for any resource", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "messages:view", scope: null }],
      });

      const { can } = usePermissions();
      expect(can("messages:view")).toBe(true);
      expect(can("messages:view", "Sales.OrderService")).toBe(true);
      expect(can("messages:view", "Finance.Invoicing")).toBe(true);
    });

    test("scoped permission in-scope returns true", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:retry",
            scope: { allow: ["Sales.*"], deny: [] },
          },
        ],
      });

      const { can } = usePermissions();
      expect(can("messages:retry", "Sales.OrderService")).toBe(true);
    });

    test("scoped permission out-of-scope returns false", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:retry",
            scope: { allow: ["Sales.*"], deny: [] },
          },
        ],
      });

      const { can } = usePermissions();
      expect(can("messages:retry", "Finance.Invoicing")).toBe(false);
    });

    test("denied resource in scope returns false (deny-wins)", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:view",
            scope: { allow: ["Sales.*"], deny: ["Sales.Secret.*"] },
          },
        ],
      });

      const { can } = usePermissions();
      expect(can("messages:view", "Sales.OrderService")).toBe(true);
      expect(can("messages:view", "Sales.Secret.Data")).toBe(false);
    });

    test("wildcard * in allow matches everything", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:retry",
            scope: { allow: ["*"], deny: [] },
          },
        ],
      });

      const { can } = usePermissions();
      expect(can("messages:retry", "Sales.OrderService")).toBe(true);
      expect(can("messages:retry", "Finance.Invoicing")).toBe(true);
    });

    test("permission not in descriptor returns false", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "messages:view", scope: null }],
      });

      const { can } = usePermissions();
      expect(can("messages:retry")).toBe(false);
    });

    test("multiple entries for same permission - OR semantics", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:retry",
            scope: { allow: ["Sales.*"], deny: [] },
          },
          {
            permission: "messages:retry",
            scope: { allow: ["Finance.*"], deny: [] },
          },
        ],
      });

      const { can } = usePermissions();
      expect(can("messages:retry", "Sales.OrderService")).toBe(true);
      expect(can("messages:retry", "Finance.Invoicing")).toBe(true);
      expect(can("messages:retry", "HR.Payroll")).toBe(false);
    });

    test("no resource specified with scoped permission - returns true (verb-level check)", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [
          {
            permission: "messages:retry",
            scope: { allow: ["Sales.*"], deny: [] },
          },
        ],
      });

      const { can } = usePermissions();
      // When no resource is specified we do verb-level check: user has the permission for some scope
      expect(can("messages:retry")).toBe(true);
    });

    test("empty permissions list returns false for any permission", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [],
      });

      const { can } = usePermissions();
      expect(can("messages:view")).toBe(false);
    });
  });

  describe("canAny(permissions[])", () => {
    test("returns true when user holds at least one of the listed permissions", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "connections:view", scope: null }],
      });

      const { canAny } = usePermissions();
      expect(canAny(["licensing:view", "connections:view", "endpoints:view"])).toBe(true);
    });

    test("returns false when user holds none of the listed permissions", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "messages:view", scope: null }],
      });

      const { canAny } = usePermissions();
      expect(canAny(["licensing:view", "connections:view", "endpoints:view"])).toBe(false);
    });

    test("returns false for empty permissions array", () => {
      const store = usePermissionsStore();
      store.setDescriptor({
        version: "2026-05-22T14:30:00Z",
        user: "alice",
        permissions: [{ permission: "messages:view", scope: null }],
      });

      const { canAny } = usePermissions();
      expect(canAny([])).toBe(false);
    });

    test("allow-all sentinel: returns true for any permissions list", () => {
      mockServer.use(http.get(`${SC_URL}me/permissions`, () => new HttpResponse(null, { status: 404 })));
      // Directly set the allow-all sentinel to avoid async fetch
      const store = usePermissionsStore();
      store.setDescriptor({ version: "__allow_all__", user: "", permissions: [] });

      const { canAny } = usePermissions();
      expect(canAny(["licensing:view", "connections:view"])).toBe(true);
    });
  });
});
