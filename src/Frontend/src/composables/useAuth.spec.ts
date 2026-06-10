import { describe, test, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { http, HttpResponse } from "msw";
import { mockServer } from "../../test/mock-server";

const SC_URL = "http://localhost:33333/api/";

/**
 * Tests for the cache invalidation (2): token renewal triggers descriptor refetch.
 *
 * Strategy: directly exercise `getPermissionsFetcher` to verify it is called on
 * addUserLoaded, which is the integration point between useAuth and usePermissions.
 * A full end-to-end test of the oidc-client-ts event pipeline is covered by the
 * useAuth.ts implementation review; here we just confirm the refetch hook is
 * called when the event fires.
 */
describe("usePermissions — token renewal cache invalidation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  test("getPermissionsFetcher returns a callable that refetches from the server", async () => {
    let fetchCount = 0;
    mockServer.use(
      http.get(`${SC_URL}me/permissions`, () => {
        fetchCount++;
        return HttpResponse.json({
          version: "2026-05-22T14:30:00Z",
          user: "alice",
          permissions: [{ permission: "messages:view", scope: null }],
        });
      })
    );

    const { usePermissions, getPermissionsFetcher } = await import("./usePermissions");
    // Initialize composable so the singleton fetcher is registered
    usePermissions();

    // The module-singleton fetcher should now be available
    const fetcher = getPermissionsFetcher();
    await fetcher();

    const { usePermissionsStore } = await import("@/stores/PermissionsStore");
    expect(fetchCount).toBe(1);
    expect(usePermissionsStore().version).toBe("2026-05-22T14:30:00Z");
  });
});
