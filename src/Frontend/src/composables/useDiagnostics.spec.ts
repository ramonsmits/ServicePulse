import { describe, test, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { http, HttpResponse } from "msw";
import { mockServer } from "../../test/mock-server";
import { useDiagnostics } from "./useDiagnostics";

const SC_URL = "http://localhost:33333/api/";

const mockDiagnosticsResponse = {
  identity: {
    subject: "alice-abc",
    name: "alice",
    is_authenticated: true,
    authentication_type: "AuthenticationTypes.Federation",
  },
  claims: [
    { type: "sub", value: "alice-abc", issuer: "https://localhost:8088/realms/particular" },
    { type: "preferred_username", value: "alice", issuer: "https://localhost:8088/realms/particular" },
    { type: "realm_access", value: '{"roles":["sc-operator"]}', issuer: "https://localhost:8088/realms/particular" },
    { type: "role", value: "sc-operator", issuer: "LOCAL AUTHORITY" },
  ],
  permissions: [
    { permission: "messages:retry", status: "allowed", scope: null },
    { permission: "messages:edit", status: "scoped", scope: { allow: ["Sales.*"], deny: ["Sales.secret.*"] } },
    { permission: "licensing:manage", status: "notGranted", scope: null },
  ],
  policy: { loaded_at: "2026-05-28T14:30:00Z" },
};

describe("useDiagnostics", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("fetch()", () => {
    test("returns parsed Diagnostics object on 200", async () => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => HttpResponse.json(mockDiagnosticsResponse)));

      const { fetch } = useDiagnostics();
      const result = await fetch();

      expect(result).not.toBeNull();
      expect(result!.identity.subject).toBe("alice-abc");
      expect(result!.identity.name).toBe("alice");
      expect(result!.identity.is_authenticated).toBe(true);
      expect(result!.identity.authentication_type).toBe("AuthenticationTypes.Federation");
      expect(result!.claims).toHaveLength(4);
      expect(result!.claims[0].type).toBe("sub");
      expect(result!.permissions).toHaveLength(3);
      expect(result!.permissions[0].permission).toBe("messages:retry");
      expect(result!.permissions[0].status).toBe("allowed");
      expect(result!.policy.loaded_at).toBe("2026-05-28T14:30:00Z");
    });

    test("returns null on 404 (auth disabled)", async () => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => new HttpResponse(null, { status: 404 })));

      const { fetch } = useDiagnostics();
      const result = await fetch();

      expect(result).toBeNull();
    });

    test("throws on 500 error", async () => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => new HttpResponse(null, { status: 500 })));

      const { fetch } = useDiagnostics();
      await expect(fetch()).rejects.toThrow();
    });

    test("returns scoped permissions with allow/deny arrays", async () => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => HttpResponse.json(mockDiagnosticsResponse)));

      const { fetch } = useDiagnostics();
      const result = await fetch();

      const scopedPermission = result!.permissions.find((p) => p.status === "scoped");
      expect(scopedPermission).toBeDefined();
      expect(scopedPermission!.scope).not.toBeNull();
      expect(scopedPermission!.scope!.allow).toContain("Sales.*");
      expect(scopedPermission!.scope!.deny).toContain("Sales.secret.*");
    });
  });
});
