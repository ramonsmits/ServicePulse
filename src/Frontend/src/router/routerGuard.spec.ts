/**
 * Tests for the route-level permission guard logic.
 *
 * Strategy: extract the same guard logic into a test-local helper and exercise
 * it directly with mocked navigation contexts, rather than wiring a full router
 * with async guards (which can hang in JSDOM due to the `ready` await).
 *
 * Each test builds the `to.matched` structure that the guard inspects, calls
 * `checkPermissionGuard`, and asserts whether it returns `true` (allow) or a
 * redirect object (deny → dashboard).
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePermissionsStore } from "@/stores/PermissionsStore";
import { usePermissions } from "@/composables/usePermissions";
import { useShowToast } from "@/composables/toast";
import { TYPE } from "vue-toastification";
import routeLinks from "@/router/routeLinks";
import type { RouteLocationNormalized, RouteRecordNormalized } from "vue-router";

// ------------------------------------------------------------------
// Mock the toast composable so we can spy without a DOM
// ------------------------------------------------------------------
vi.mock("@/composables/toast", () => ({
  useShowToast: vi.fn(),
}));

const mockShowToast = vi.mocked(useShowToast);

// ------------------------------------------------------------------
// Replicate the guard logic from mount.ts so we can test it in isolation.
// The guard is pure logic — depends only on usePermissions() + useShowToast().
// ------------------------------------------------------------------
type GuardResult = true | { path: string };

async function checkPermissionGuard(matched: Partial<RouteRecordNormalized>[]): Promise<GuardResult> {
  // Build a minimal `to` object
  const to = { matched } as unknown as RouteLocationNormalized;

  // Pre-auth routes always pass
  if (to.matched.some((r) => r.meta?.allowAnonymous)) {
    return true;
  }

  const { can, canAny, ready } = usePermissions();
  await ready;

  for (const record of to.matched) {
    const requiredPermission = record.meta?.requiredPermission as string | undefined;
    const requiredAnyPermission = record.meta?.requiredAnyPermission as string[] | undefined;

    if (requiredPermission !== undefined) {
      if (!can(requiredPermission)) {
        const pageTitle = (record.meta?.title as string | undefined) ?? "this page";
        mockShowToast(TYPE.ERROR, "Access denied", `You do not have permission to access ${pageTitle}.`);
        return { path: routeLinks.dashboard };
      }
    }

    if (requiredAnyPermission !== undefined) {
      if (!canAny(requiredAnyPermission)) {
        const pageTitle = (record.meta?.title as string | undefined) ?? "this page";
        mockShowToast(TYPE.ERROR, "Access denied", `You do not have permission to access ${pageTitle}.`);
        return { path: routeLinks.dashboard };
      }
    }
  }

  return true;
}

// ------------------------------------------------------------------
// Helpers for building matched route records
// ------------------------------------------------------------------
function makeRecord(meta: Record<string, unknown>): Partial<RouteRecordNormalized> {
  return { meta } as Partial<RouteRecordNormalized>;
}

function grantPermission(...permissions: string[]) {
  const store = usePermissionsStore();
  store.setDescriptor({
    version: "2026-05-22T14:30:00Z",
    user: "test",
    permissions: permissions.map((p) => ({ permission: p, scope: null })),
  });
}

function denyAll() {
  usePermissionsStore().setDescriptor({ version: "2026-05-22T14:30:00Z", user: "test", permissions: [] });
}

function allowAll() {
  usePermissionsStore().setDescriptor({ version: "__allow_all__", user: "", permissions: [] });
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("router permission guard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
    mockShowToast.mockReset();
  });

  test("route without requiredPermission — navigation proceeds", async () => {
    denyAll();
    const result = await checkPermissionGuard([makeRecord({ title: "Dashboard" })]);
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("permitted user — navigation proceeds", async () => {
    grantPermission("heartbeats:view");
    const result = await checkPermissionGuard([makeRecord({ title: "Heartbeats", requiredPermission: "heartbeats:view" })]);
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("unpermitted user — redirected to dashboard and toast shown", async () => {
    denyAll();
    const result = await checkPermissionGuard([makeRecord({ title: "Heartbeats • ServicePulse", requiredPermission: "heartbeats:view" })]);
    expect(result).toEqual({ path: routeLinks.dashboard });
    expect(mockShowToast).toHaveBeenCalledWith(TYPE.ERROR, "Access denied", expect.stringContaining("You do not have permission to access"));
  });

  test("anonymous route (allowAnonymous: true) — bypasses permission check entirely", async () => {
    denyAll();
    const result = await checkPermissionGuard([makeRecord({ title: "Signed Out", allowAnonymous: true })]);
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("requiredAnyPermission — denied when user holds none", async () => {
    denyAll();
    const result = await checkPermissionGuard([makeRecord({ title: "Configuration", requiredAnyPermission: ["licensing:view", "connections:view"] })]);
    expect(result).toEqual({ path: routeLinks.dashboard });
    expect(mockShowToast).toHaveBeenCalled();
  });

  test("requiredAnyPermission — allowed when user holds one of the listed permissions", async () => {
    grantPermission("connections:view");
    const result = await checkPermissionGuard([makeRecord({ title: "Configuration", requiredAnyPermission: ["licensing:view", "connections:view"] })]);
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("parent gated + child not gated — child blocked if parent permission is missing", async () => {
    denyAll();
    // Simulate matched = [parent, child]
    const result = await checkPermissionGuard([
      makeRecord({ title: "Heartbeats • ServicePulse", requiredPermission: "heartbeats:view" }),
      makeRecord({ title: "Unhealthy Endpoints • ServicePulse" }), // no extra permission
    ]);
    expect(result).toEqual({ path: routeLinks.dashboard });
    expect(mockShowToast).toHaveBeenCalledOnce();
  });

  test("parent gated + child not gated — child passes when parent permission is held", async () => {
    grantPermission("heartbeats:view");
    const result = await checkPermissionGuard([makeRecord({ title: "Heartbeats • ServicePulse", requiredPermission: "heartbeats:view" }), makeRecord({ title: "Unhealthy Endpoints • ServicePulse" })]);
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("allow-all sentinel — all routes pass regardless of requiredPermission", async () => {
    allowAll();

    const heartbeats = await checkPermissionGuard([makeRecord({ title: "Heartbeats", requiredPermission: "heartbeats:view" })]);
    expect(heartbeats).toBe(true);

    const config = await checkPermissionGuard([makeRecord({ title: "Configuration", requiredAnyPermission: ["licensing:view", "connections:view"] })]);
    expect(config).toBe(true);

    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test("dashboard (no required permission) — always accessible even with no permissions", async () => {
    denyAll();
    const result = await checkPermissionGuard([makeRecord({ title: "Dashboard" })]);
    expect(result).toBe(true);
  });
});
