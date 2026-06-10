/**
 * Component tests for nav-item permission filtering in PageHeader.
 *
 * Each test verifies that the nav renders (or hides) the correct menu items
 * depending on what permissions the current user holds.
 *
 * A "sc-viewer" principal only holds view permissions for specific sections.
 * An unpermissioned user (empty descriptor) should only see Dashboard + Feedback.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/vue";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { RouterLinkStub } from "@vue/test-utils";
import { usePermissionsStore } from "@/stores/PermissionsStore";
import { useAuthStore } from "@/stores/AuthStore";
import PageHeader from "@/components/PageHeader.vue";

// ------------------------------------------------------------------
// Stub child components that make network requests or use tippy
// ------------------------------------------------------------------
vi.mock("@/components/heartbeats/HeartbeatsMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-heartbeats">Heartbeats</a>` },
}));
vi.mock("@/components/monitoring/MonitoringMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-monitoring">Monitoring</a>` },
}));
vi.mock("@/components/audit/AuditMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-audit">All Messages</a>` },
}));
vi.mock("@/components/failedmessages/FailedMessagesMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-failedmessages">Failed Messages</a>` },
}));
vi.mock("@/components/customchecks/CustomChecksMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-customchecks">Custom Checks</a>` },
}));
vi.mock("@/components/events/EventsMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-events">Events</a>` },
}));
vi.mock("@/views/throughputreport/ThroughputMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-throughput">Usage</a>` },
}));
vi.mock("@/components/configuration/ConfigurationMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-configuration">Configuration</a>` },
}));
vi.mock("@/components/dashboard/DashboardMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-dashboard">Dashboard</a>` },
}));
vi.mock("@/components/FeedbackButton.vue", () => ({
  default: { template: `<a data-testid="nav-feedback">Feedback</a>` },
}));
vi.mock("@/components/UserProfileMenuItem.vue", () => ({
  default: { template: `<a data-testid="nav-user-profile">User</a>` },
}));

// Stub monitoringClient so isMonitoringEnabled is controllable
vi.mock("@/components/monitoring/monitoringClient", () => ({
  default: { isMonitoringEnabled: true },
}));

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function makePinia(permissions: string[]) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
  setActivePinia(pinia);

  const permStore = usePermissionsStore(pinia);
  permStore.$patch({
    version: "2026-05-22T14:30:00Z",
    permissions: permissions.map((p) => ({ permission: p, scope: null })),
  });

  return pinia;
}

function renderHeader(pinia: ReturnType<typeof makePinia>) {
  return render(PageHeader, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  });
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe("PageHeader nav-item filtering", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test("unpermissioned user sees only Dashboard and Feedback nav items", () => {
    const pinia = makePinia([]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-feedback")).toBeInTheDocument();

    expect(screen.queryByTestId("nav-heartbeats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-monitoring")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-audit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-failedmessages")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-customchecks")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-events")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-throughput")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-configuration")).not.toBeInTheDocument();
  });

  test("sc-viewer with heartbeats:view sees Heartbeats nav item", () => {
    const pinia = makePinia(["heartbeats:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-heartbeats")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-monitoring")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-failedmessages")).not.toBeInTheDocument();
  });

  test("sc-viewer with messages:view sees Audit and Failed Messages nav items", () => {
    const pinia = makePinia(["messages:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-audit")).toBeInTheDocument();
    expect(screen.getByTestId("nav-failedmessages")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-heartbeats")).not.toBeInTheDocument();
  });

  test("sc-viewer with monitoring:view sees Monitoring nav item", () => {
    const pinia = makePinia(["monitoring:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-monitoring")).toBeInTheDocument();
  });

  test("sc-viewer with customchecks:view sees Custom Checks nav item", () => {
    const pinia = makePinia(["customchecks:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-customchecks")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-events")).not.toBeInTheDocument();
  });

  test("sc-viewer with eventlog:view sees Events nav item", () => {
    const pinia = makePinia(["eventlog:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-events")).toBeInTheDocument();
  });

  test("sc-viewer with throughput:view sees Usage nav item", () => {
    const pinia = makePinia(["throughput:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-throughput")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-configuration")).not.toBeInTheDocument();
  });

  test("sc-viewer with connections:view (one configuration permission) sees Configuration nav item", () => {
    const pinia = makePinia(["connections:view"]);
    renderHeader(pinia);

    expect(screen.getByTestId("nav-configuration")).toBeInTheDocument();
  });

  test("sc-viewer without any configuration permission does not see Configuration nav item", () => {
    const pinia = makePinia(["messages:view", "heartbeats:view"]);
    renderHeader(pinia);

    expect(screen.queryByTestId("nav-configuration")).not.toBeInTheDocument();
  });

  test("allow-all sentinel: all nav items are visible", () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    setActivePinia(pinia);
    const permStore = usePermissionsStore(pinia);
    permStore.$patch({ version: "__allow_all__", permissions: [] });

    renderHeader(pinia);

    expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-heartbeats")).toBeInTheDocument();
    expect(screen.getByTestId("nav-monitoring")).toBeInTheDocument();
    expect(screen.getByTestId("nav-audit")).toBeInTheDocument();
    expect(screen.getByTestId("nav-failedmessages")).toBeInTheDocument();
    expect(screen.getByTestId("nav-customchecks")).toBeInTheDocument();
    expect(screen.getByTestId("nav-events")).toBeInTheDocument();
    expect(screen.getByTestId("nav-throughput")).toBeInTheDocument();
    expect(screen.getByTestId("nav-configuration")).toBeInTheDocument();
  });

  test("authenticated user with authEnabled sees UserProfile menu item", () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    setActivePinia(pinia);
    usePermissionsStore(pinia).$patch({ version: "__allow_all__", permissions: [] });
    useAuthStore(pinia).$patch({ authEnabled: true, isAuthenticated: true });

    renderHeader(pinia);

    expect(screen.getByTestId("nav-user-profile")).toBeInTheDocument();
  });

  test("unauthenticated user does not see UserProfile menu item", () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    setActivePinia(pinia);
    usePermissionsStore(pinia).$patch({ version: "__allow_all__", permissions: [] });
    useAuthStore(pinia).$patch({ authEnabled: false, isAuthenticated: false });

    renderHeader(pinia);

    expect(screen.queryByTestId("nav-user-profile")).not.toBeInTheDocument();
  });
});
