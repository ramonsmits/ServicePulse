/**
 * Component tests for permission-aware message action buttons.
 *
 * Each test verifies two states:
 *   - sc-viewer (no action permission) → control hidden or disabled
 *   - sc-operator (has permission)     → control visible and enabled
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/vue";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { MessageStatus } from "@/resources/Message";
import { useMessageStore } from "@/stores/MessageStore";
import { usePermissionsStore } from "@/stores/PermissionsStore";

import RetryMessageButton from "./RetryMessageButton.vue";
import EditAndRetryButton from "./EditAndRetryButton.vue";
import RestoreMessageButton from "./RestoreMessageButton.vue";
import DeleteMessageButton from "./DeleteMessageButton.vue";

// Stub dialogs — they use <Teleport to="#modalDisplay"> which requires the element to exist in the DOM
vi.mock("@/components/ConfirmDialog.vue", () => ({
  default: { template: "<span />" },
}));
vi.mock("@/components/failedmessages/EditRetryDialog.vue", () => ({
  default: { template: "<span />" },
}));
vi.mock("@/components/failedmessages/EditIgnoredDialog.vue", () => ({
  default: { template: "<span />" },
}));

/** Shared directive/stub global options for all renders */
const sharedGlobal = {
  directives: { tippy: () => {} },
  stubs: {
    // Teleport to="#modalDisplay" needs the target to exist; stub Teleport to avoid the DOM dependency
    Teleport: true,
  },
};

/** Permission names used by message controls */
const PERM_RETRY = "messages:retry";
const PERM_EDIT = "messages:edit";
const PERM_ARCHIVE = "messages:archive";
const PERM_UNARCHIVE = "messages:unarchive";

/** Create a pinia and pre-set the permissions and message state. */
function makePinia({ permissions = [] as string[], messageStatus = MessageStatus.Failed, archived = false, editRetryEnabled = true }: { permissions?: string[]; messageStatus?: MessageStatus; archived?: boolean; editRetryEnabled?: boolean }) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
  setActivePinia(pinia);

  // Permissions: $patch state directly because stubActions:true stubs setDescriptor
  const permStore = usePermissionsStore(pinia);
  permStore.$patch({
    version: "2026-05-22T14:30:00Z",
    permissions: permissions.map((p) => ({ permission: p, scope: null })),
  });

  // Message store: patch reactive state
  const msgStore = useMessageStore(pinia);
  msgStore.$patch((s) => {
    s.state.data.status = messageStatus;
    s.state.data.failure_status = { retried: false, archived, resolved: false };
    s.edit_and_retry_config = { enabled: editRetryEnabled, locked_headers: [], sensitive_headers: [] };
  });

  return pinia;
}

// ─── RetryMessageButton ────────────────────────────────────────────────────────

describe("RetryMessageButton", () => {
  beforeEach(() => vi.clearAllMocks());

  test("viewer without messages:retry — button is hidden", () => {
    const pinia = makePinia({ permissions: ["messages:view"] });
    render(RetryMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    expect(screen.queryByRole("button", { name: /retry message/i })).not.toBeInTheDocument();
  });

  test("operator with messages:retry — button is visible and enabled", () => {
    const pinia = makePinia({ permissions: ["messages:view", PERM_RETRY] });
    render(RetryMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    const button = screen.getByRole("button", { name: /retry message/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});

// ─── EditAndRetryButton ────────────────────────────────────────────────────────

describe("EditAndRetryButton", () => {
  beforeEach(() => vi.clearAllMocks());

  test("viewer without messages:edit — button is hidden", () => {
    const pinia = makePinia({ permissions: ["messages:view"], editRetryEnabled: true });
    render(EditAndRetryButton, { global: { plugins: [pinia], ...sharedGlobal } });

    expect(screen.queryByRole("button", { name: /edit.*retry/i })).not.toBeInTheDocument();
  });

  test("operator with messages:edit — button is visible and enabled", () => {
    const pinia = makePinia({ permissions: ["messages:view", PERM_EDIT], editRetryEnabled: true });
    render(EditAndRetryButton, { global: { plugins: [pinia], ...sharedGlobal } });

    const button = screen.getByRole("button", { name: /edit.*retry/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});

// ─── RestoreMessageButton ──────────────────────────────────────────────────────

describe("RestoreMessageButton", () => {
  beforeEach(() => vi.clearAllMocks());

  test("viewer without messages:unarchive — restore button hidden even for archived message", () => {
    const pinia = makePinia({
      permissions: ["messages:view"],
      messageStatus: MessageStatus.ArchivedFailure,
      archived: true,
    });
    render(RestoreMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    expect(screen.queryByRole("button", { name: /restore/i })).not.toBeInTheDocument();
  });

  test("operator with messages:unarchive — restore button visible for archived message", () => {
    const pinia = makePinia({
      permissions: ["messages:view", PERM_UNARCHIVE],
      messageStatus: MessageStatus.ArchivedFailure,
      archived: true,
    });
    render(RestoreMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    const button = screen.getByRole("button", { name: /restore/i });
    expect(button).toBeInTheDocument();
  });
});

// ─── DeleteMessageButton ───────────────────────────────────────────────────────

describe("DeleteMessageButton", () => {
  beforeEach(() => vi.clearAllMocks());

  test("viewer without messages:archive — delete button is hidden", () => {
    const pinia = makePinia({ permissions: ["messages:view"] });
    render(DeleteMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    expect(screen.queryByRole("button", { name: /delete message/i })).not.toBeInTheDocument();
  });

  test("operator with messages:archive — delete button is visible", () => {
    const pinia = makePinia({ permissions: ["messages:view", PERM_ARCHIVE] });
    render(DeleteMessageButton, { global: { plugins: [pinia], ...sharedGlobal } });

    const button = screen.getByRole("button", { name: /delete message/i });
    expect(button).toBeInTheDocument();
  });
});
