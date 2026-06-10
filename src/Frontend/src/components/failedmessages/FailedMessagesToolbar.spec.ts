/**
 * Component tests for permission-aware FailedMessages toolbar buttons.
 *
 * The toolbar has "Retry N selected" and "Delete N selected" buttons that should
 * be controlled by messages:retry and messages:archive permissions respectively.
 *
 * Tests verify:
 *   - sc-viewer (no action perms): retry and delete toolbar buttons absent
 *   - sc-operator (has perms): retry and delete toolbar buttons present
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/vue";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { usePermissionsStore } from "@/stores/PermissionsStore";
import FailedMessages from "./FailedMessages.vue";
import { createRouter, createMemoryHistory } from "vue-router";

// Stub heavy child components
vi.mock("@/components/LicenseNotExpired.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../ServiceControlAvailable.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("./MessageList.vue", () => ({
  default: {
    template: "<div data-testid='message-list'></div>",
    expose: ["getSelectedMessages", "deselectAll", "selectAll", "isAnythingSelected"],
    setup() {
      return {
        getSelectedMessages: () => [],
        deselectAll: () => {},
        selectAll: () => {},
        isAnythingSelected: () => false,
      };
    },
  },
}));
vi.mock("@/components/LoadingSpinner.vue", () => ({
  default: { template: "<div></div>" },
}));
vi.mock("@/components/OrderBy.vue", () => ({
  default: { template: "<div></div>" },
}));
vi.mock("@/components/PaginationStrip.vue", () => ({
  default: { template: "<div></div>" },
}));
vi.mock("./messageGroupClient", () => ({
  default: () => ({
    retryExceptionGroup: vi.fn(),
    archiveExceptionGroup: vi.fn(),
  }),
}));
vi.mock("@/composables/useAutoRefresh", async () => {
  const { ref } = await import("vue");
  return {
    useStoreAutoRefresh: () => ({
      autoRefresh: () => ({
        store: {
          messages: ref([]),
          groupId: ref(""),
          groupName: ref(""),
          totalCount: ref(0),
          pageNumber: ref(1),
          setSort: vi.fn(),
          deleteById: vi.fn(),
          setMessageStatus: vi.fn(),
          perPage: 50,
        },
      }),
      isRefreshing: ref(false),
      updateInterval: vi.fn(),
    }),
  };
});
// Stub MessageStore so the component tree doesn't try to hydrate it
vi.mock("@/stores/MessageStore", () => ({
  useMessageStore: vi.fn(() => ({
    retryMessages: vi.fn(),
    $patch: vi.fn(),
    state: {
      data: {
        id: "",
        status: "failed",
        failure_status: {},
        failure_metadata: {},
        dialog_status: {},
        invoked_saga: {},
      },
    },
    edit_and_retry_config: { enabled: false, locked_headers: [], sensitive_headers: [] },
    messages: [],
  })),
}));

const sharedGlobal = {
  directives: { tippy: () => {} },
  stubs: { Teleport: true },
};

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<div />" } }],
  });
}

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

describe("FailedMessages toolbar — permission gating", () => {
  beforeEach(() => vi.clearAllMocks());

  test("viewer without retry/archive permissions — retry and delete toolbar buttons are hidden", async () => {
    const pinia = makePinia(["messages:view"]);
    const router = makeRouter();
    await router.push("/");
    await router.isReady();

    render(FailedMessages, {
      global: { plugins: [pinia, router], ...sharedGlobal },
    });

    expect(screen.queryByRole("button", { name: /retry.*selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete.*selected/i })).not.toBeInTheDocument();
  });

  test("operator with retry and archive permissions — toolbar buttons are present", async () => {
    const pinia = makePinia(["messages:view", "messages:retry", "messages:archive"]);
    const router = makeRouter();
    await router.push("/");
    await router.isReady();

    render(FailedMessages, {
      global: { plugins: [pinia, router], ...sharedGlobal },
    });

    expect(screen.getByRole("button", { name: /retry.*selected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete.*selected/i })).toBeInTheDocument();
  });
});
