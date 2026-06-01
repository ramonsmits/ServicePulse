import { ref, computed } from "vue";
import serviceControlClient from "@/components/serviceControlClient";
import logger from "@/logger";

/**
 * One configured custom-attribute index returned by GET /api/custom-indexes.
 * Mirrors `CustomIndexEntry` on the SC side.
 */
export interface CustomIndexEntry {
  key: string;
  authz?: {
    source: string; // "idp-claim" today; "role" reserved
    claim?: string;
    key?: string;
  } | null;
}

export interface CustomIndexesDescriptor {
  version: string;
  indexes: CustomIndexEntry[];
}

// Module-singleton cache — matches the pattern in useAuth / usePermissions.
const descriptor = ref<CustomIndexesDescriptor | null>(null);
const loading = ref(false);
const lastError = ref<string | null>(null);

let inflight: Promise<void> | null = null;

async function fetchOnce(): Promise<void> {
  if (descriptor.value !== null || inflight !== null) {
    return inflight ?? Promise.resolve();
  }
  loading.value = true;
  inflight = (async () => {
    try {
      const [, data] = await serviceControlClient.fetchTypedFromServiceControl<CustomIndexesDescriptor>("custom-indexes");
      descriptor.value = data;
      lastError.value = null;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      lastError.value = msg;
      logger.warn("Failed to fetch /api/custom-indexes:", msg);
      // Fail-open: leave descriptor as null; consumers render empty chip set.
      descriptor.value = { version: "", indexes: [] };
    } finally {
      loading.value = false;
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Read-only access to the configured custom indexes.
 * First call triggers a single fetch; subsequent calls share the cache.
 *
 * The descriptor is what backs both the failed-message filter-chip UI and
 * the admin "Custom indexes" page. See
 * `research/platform-authorization/xacml-vocabulary.md` for the PEP/PDP/PAP/PIP
 * mapping — the chips themselves are SPA-side PEPs (UX-only), the SC server
 * is the authoritative gate.
 */
export function useCustomIndexes() {
  return {
    descriptor: computed(() => descriptor.value),
    indexes: computed<CustomIndexEntry[]>(() => descriptor.value?.indexes ?? []),
    version: computed(() => descriptor.value?.version ?? ""),
    loading: computed(() => loading.value),
    error: computed(() => lastError.value),
    refresh: fetchOnce,
  };
}
