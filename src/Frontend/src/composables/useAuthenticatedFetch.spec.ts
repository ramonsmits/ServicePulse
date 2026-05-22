import { describe, test, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { http, HttpResponse } from "msw";
import { mockServer } from "../../test/mock-server";

const SC_URL = "http://localhost:33333/api/";

describe("authFetch — on-403 cache invalidation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  test("a 403 response triggers descriptor refetch", async () => {
    let descriptorFetchCount = 0;
    mockServer.use(
      http.get(`${SC_URL}errors`, () => new HttpResponse(null, { status: 403 })),
      http.get(`${SC_URL}me/permissions`, () => {
        descriptorFetchCount++;
        return HttpResponse.json({
          version: "2026-05-22T14:30:00Z",
          user: "alice",
          permissions: [{ permission: "messages:view", scope: null }],
        });
      })
    );

    const { authFetch } = await import("./useAuthenticatedFetch");
    // Initialize the usePermissions singleton so the fetcher is available
    const { usePermissions } = await import("./usePermissions");
    usePermissions();

    const response = await authFetch(`${SC_URL}errors`);

    // The 403 is still surfaced to the caller
    expect(response.status).toBe(403);
    // Wait for the fire-and-forget refetch to complete
    await new Promise((r) => setTimeout(r, 50));
    // The descriptor was refetched
    expect(descriptorFetchCount).toBe(1);
  });

  test("a non-403 error does NOT trigger descriptor refetch", async () => {
    let descriptorFetchCount = 0;
    mockServer.use(
      http.get(`${SC_URL}errors`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${SC_URL}me/permissions`, () => {
        descriptorFetchCount++;
        return HttpResponse.json({
          version: "2026-05-22T14:30:00Z",
          user: "alice",
          permissions: [],
        });
      })
    );

    const { authFetch } = await import("./useAuthenticatedFetch");
    const response = await authFetch(`${SC_URL}errors`);

    expect(response.status).toBe(500);
    expect(descriptorFetchCount).toBe(0);
  });
});
