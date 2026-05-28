import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/vue";
import { createTestingPinia } from "@pinia/testing";
import { createRouter, createMemoryHistory } from "vue-router";
import { http, HttpResponse } from "msw";
import { mockServer } from "../../test/mock-server";
import DiagnosticsView from "@/views/DiagnosticsView.vue";
import userEvent from "@testing-library/user-event";

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
    { permission: "licensing:manage", status: "not_granted", scope: null },
  ],
  policy: { loaded_at: "2026-05-28T14:30:00Z" },
};

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/diagnostics", component: DiagnosticsView },
    ],
  });
}

async function renderComponent() {
  const router = createTestRouter();
  await router.push("/diagnostics");
  await router.isReady();

  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

  render(DiagnosticsView, {
    global: {
      plugins: [pinia, router],
    },
  });

  // Wait for the initial fetch to complete (loading text disappears)
  await waitFor(() => {
    expect(screen.queryByText(/loading diagnostics/i)).not.toBeInTheDocument();
  });

  return { router };
}

describe("DiagnosticsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when diagnostics are available (200)", () => {
    beforeEach(() => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => HttpResponse.json(mockDiagnosticsResponse)));
    });

    test("renders identity section with subject and name", async () => {
      await renderComponent();

      // alice-abc appears in both identity and claims tables; use getAllByText to confirm presence
      expect(screen.getAllByText("alice-abc").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("alice").length).toBeGreaterThanOrEqual(1);
    });

    test("renders identity authentication type", async () => {
      await renderComponent();

      expect(screen.getByText("AuthenticationTypes.Federation")).toBeInTheDocument();
    });

    test("renders claims table with all claim rows", async () => {
      await renderComponent();

      // All 4 claims should appear
      expect(screen.getByText("sub")).toBeInTheDocument();
      expect(screen.getByText("preferred_username")).toBeInTheDocument();
      expect(screen.getByText("realm_access")).toBeInTheDocument();
      expect(screen.getByText("role")).toBeInTheDocument();
    });

    test("renders claims table with values", async () => {
      await renderComponent();

      // alice-abc appears in identity + claims table; getAllByText handles duplicates
      expect(screen.getAllByText("alice-abc").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("sc-operator").length).toBeGreaterThanOrEqual(1);
    });

    test("renders permissions table with all permission rows", async () => {
      await renderComponent();

      expect(screen.getByText("messages:retry")).toBeInTheDocument();
      expect(screen.getByText("messages:edit")).toBeInTheDocument();
      expect(screen.getByText("licensing:manage")).toBeInTheDocument();
    });

    test("renders 'allowed' status badge with green styling", async () => {
      await renderComponent();

      const allowedBadge = screen.getByText("allowed");
      expect(allowedBadge).toBeInTheDocument();
      expect(allowedBadge.className).toMatch(/allowed|success|green/);
    });

    test("renders 'scoped' status badge with orange styling", async () => {
      await renderComponent();

      const scopedBadge = screen.getByText("scoped");
      expect(scopedBadge).toBeInTheDocument();
      expect(scopedBadge.className).toMatch(/scoped|warning|orange/);
    });

    test("renders 'not_granted' status badge with grey styling", async () => {
      await renderComponent();

      const notGrantedBadge = screen.getByText(/not.granted/i);
      expect(notGrantedBadge).toBeInTheDocument();
      expect(notGrantedBadge.className).toMatch(/not.granted|secondary|grey|gray/i);
    });

    test("renders scope allow patterns for scoped permission", async () => {
      await renderComponent();

      expect(screen.getByText(/Sales\.\*/)).toBeInTheDocument();
    });

    test("Refresh button triggers a refetch", async () => {
      let fetchCount = 0;
      mockServer.use(
        http.get(`${SC_URL}me/diagnostics`, () => {
          fetchCount++;
          return HttpResponse.json(mockDiagnosticsResponse);
        })
      );

      await renderComponent();

      const initialCount = fetchCount;
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialCount);
      });
    });
  });

  describe("when auth is disabled (404)", () => {
    beforeEach(() => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => new HttpResponse(null, { status: 404 })));
    });

    test("shows auth-disabled message instead of tables", async () => {
      await renderComponent();

      expect(screen.getByText(/authorization is disabled/i)).toBeInTheDocument();
      expect(screen.getByText(/diagnostics view is only meaningful when oidc is enabled/i)).toBeInTheDocument();
    });

    test("does not render the claims table when auth is disabled", async () => {
      await renderComponent();

      expect(screen.queryByText("sub")).not.toBeInTheDocument();
    });
  });

  describe("when server returns an error", () => {
    beforeEach(() => {
      mockServer.use(http.get(`${SC_URL}me/diagnostics`, () => new HttpResponse(null, { status: 500 })));
    });

    test("shows an error state", async () => {
      await renderComponent();

      await waitFor(() => {
        // The error alert div contains both "Error:" and the error message text
        expect(screen.getByText(/Failed to fetch diagnostics/i)).toBeInTheDocument();
      });
    });
  });
});
