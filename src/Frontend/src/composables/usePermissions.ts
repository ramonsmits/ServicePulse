import { usePermissionsStore, type PermissionEntry } from "@/stores/PermissionsStore";
import serviceControlClient from "@/components/serviceControlClient";
import logger from "@/logger";

/** Sentinel that signals "auth is disabled — allow everything" */
const ALLOW_ALL_VERSION = "__allow_all__";

/**
 * Tests whether a pattern matches a resource name.
 * Patterns: exact | prefix.* | *
 */
function matchesPattern(pattern: string, resource: string): boolean {
  if (pattern === "*") return true;
  if (pattern === resource) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1); // "Sales." from "Sales.*"
    return resource.startsWith(prefix);
  }
  return false;
}

/**
 * Tests whether a single permission entry permits access.
 *
 * - scope null → unrestricted (allowed for any resource)
 * - resource not provided → verb-level check: entry counts if it has the permission at all
 * - resource provided → scope allow/deny evaluated, deny-wins
 */
function entryPermits(entry: PermissionEntry, resource?: string): boolean {
  if (entry.scope === null) {
    // Unrestricted — allowed at verb level and for any resource
    return true;
  }

  if (resource === undefined) {
    // Verb-level check: the user holds the permission for *some* scope — counts as true
    return true;
  }

  const allowed = entry.scope.allow.some((p) => matchesPattern(p, resource));
  const denied = entry.scope.deny.some((p) => matchesPattern(p, resource));
  return allowed && !denied;
}

// Module-singleton state — mirrors the useAuth.ts module-singleton pattern
let _fetchDescriptor: (() => Promise<void>) | null = null;

/**
 * Permission-aware composable — consumes the GET /api/me/permissions descriptor.
 * Module-singleton shape (single shared fetch function) like useAuth.ts.
 */
export function usePermissions() {
  const store = usePermissionsStore();

  /**
   * Fetches the descriptor from GET api/me/permissions.
   * - 200: stores the descriptor.
   * - 404: auth is disabled — sets allow-all sentinel.
   * - Other errors: leaves the existing descriptor intact (fail-safe).
   */
  async function fetchDescriptor(): Promise<void> {
    try {
      const response = await serviceControlClient.fetchFromServiceControl("me/permissions");

      if (response.status === 404) {
        // Auth disabled — allow everything
        store.setDescriptor({
          version: ALLOW_ALL_VERSION,
          user: "",
          permissions: [],
        });
        return;
      }

      if (!response.ok) {
        logger.warn(`Failed to fetch permissions descriptor: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      store.setDescriptor(data);
    } catch (err) {
      logger.error("Error fetching permissions descriptor", err);
    }
  }

  // Store the fetch function as module singleton for use by cache-invalidation hooks
  if (!_fetchDescriptor) {
    _fetchDescriptor = fetchDescriptor;
  }

  /**
   * Returns true when the current user has the given permission.
   *
   * @param permission - e.g. "messages:retry"
   * @param resourceName - optional queue/endpoint name; when omitted, a verb-level check is done
   *
   * OR semantics: true if ANY matching entry permits access.
   * Allow-all sentinel: true for any permission when auth is disabled.
   */
  function can(permission: string, resourceName?: string): boolean {
    // Auth-disabled sentinel — allow everything
    if (store.version === ALLOW_ALL_VERSION) {
      return true;
    }

    const matchingEntries = store.permissions.filter((e) => e.permission === permission);

    if (matchingEntries.length === 0) {
      return false;
    }

    // OR semantics: true if any entry permits
    return matchingEntries.some((entry) => entryPermits(entry, resourceName));
  }

  return { fetchDescriptor, can };
}

/**
 * Returns the cached fetch function for use in event handlers (e.g. token renewal).
 * Returns a no-op if usePermissions has never been called.
 */
export function getPermissionsFetcher(): () => Promise<void> {
  return _fetchDescriptor ?? (() => Promise.resolve());
}
